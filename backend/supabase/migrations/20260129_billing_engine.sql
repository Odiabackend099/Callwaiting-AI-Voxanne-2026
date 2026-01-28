-- Migration: Billing Engine Schema
-- Adds billing columns to organizations and creates usage_ledger table
-- Created: 2026-01-29

-- ============================================
-- STEP 1: Add billing columns to organizations
-- ============================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_item_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_plan TEXT DEFAULT 'none'
  CHECK (billing_plan IN ('none', 'starter', 'professional', 'enterprise'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS included_minutes INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS minutes_used INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS overage_rate_pence INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS setup_fee_paid BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_currency TEXT DEFAULT 'gbp';

-- Indexes for billing queries
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id
  ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription_id
  ON organizations(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_billing_plan
  ON organizations(billing_plan) WHERE billing_plan != 'none';

-- ============================================
-- STEP 2: Create usage_ledger table
-- ============================================

CREATE TABLE IF NOT EXISTS usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  vapi_call_id TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  billable_minutes INTEGER NOT NULL,
  is_overage BOOLEAN NOT NULL DEFAULT false,
  overage_pence INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  minutes_used_before INTEGER NOT NULL,
  minutes_used_after INTEGER NOT NULL,
  stripe_usage_record_id TEXT,
  stripe_reported BOOLEAN NOT NULL DEFAULT false,
  stripe_reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT usage_ledger_call_id_unique UNIQUE (call_id)
);

-- Indexes for usage_ledger
CREATE INDEX IF NOT EXISTS idx_usage_ledger_org_id
  ON usage_ledger(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_created_at
  ON usage_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_org_period
  ON usage_ledger(org_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_unreported
  ON usage_ledger(stripe_reported, created_at)
  WHERE stripe_reported = false;

-- ============================================
-- STEP 3: Row Level Security
-- ============================================

ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;

-- Users can only view their own organization's usage
DROP POLICY IF EXISTS "Users can view own org usage" ON usage_ledger;
CREATE POLICY "Users can view own org usage" ON usage_ledger
  FOR SELECT
  USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- Service role has full access (billing writes are server-side only)
DROP POLICY IF EXISTS "Service role full access on usage_ledger" ON usage_ledger;
CREATE POLICY "Service role full access on usage_ledger" ON usage_ledger
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- STEP 4: Atomic usage recording function
-- ============================================

CREATE OR REPLACE FUNCTION record_call_usage(
  p_org_id UUID,
  p_call_id TEXT,
  p_vapi_call_id TEXT,
  p_duration_seconds INTEGER,
  p_billable_minutes INTEGER,
  p_is_overage BOOLEAN,
  p_overage_pence INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_minutes_before INTEGER;
  v_minutes_after INTEGER;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_included_minutes INTEGER;
  v_ledger_id UUID;
BEGIN
  -- Lock the org row to prevent concurrent updates
  SELECT minutes_used, current_period_start, current_period_end, included_minutes
  INTO v_minutes_before, v_period_start, v_period_end, v_included_minutes
  FROM organizations
  WHERE id = p_org_id
  FOR UPDATE;

  -- Validate billing period exists
  IF v_period_start IS NULL OR v_period_end IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Organization has no active billing period'
    );
  END IF;

  v_minutes_after := v_minutes_before + p_billable_minutes;

  -- Update minutes_used atomically
  UPDATE organizations
  SET minutes_used = v_minutes_after,
      updated_at = NOW()
  WHERE id = p_org_id;

  -- Insert ledger entry
  INSERT INTO usage_ledger (
    org_id, call_id, vapi_call_id, duration_seconds, billable_minutes,
    is_overage, overage_pence, period_start, period_end,
    minutes_used_before, minutes_used_after
  ) VALUES (
    p_org_id, p_call_id, p_vapi_call_id, p_duration_seconds, p_billable_minutes,
    p_is_overage, p_overage_pence, v_period_start, v_period_end,
    v_minutes_before, v_minutes_after
  )
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'ledger_id', v_ledger_id,
    'minutes_before', v_minutes_before,
    'minutes_after', v_minutes_after,
    'included_minutes', v_included_minutes,
    'is_overage', p_is_overage,
    'overage_pence', p_overage_pence
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Idempotency: this call has already been billed
    RETURN jsonb_build_object(
      'success', true,
      'error', 'Already billed',
      'duplicate', true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION record_call_usage TO service_role;

-- ============================================
-- STEP 5: Helper functions
-- ============================================

-- Get usage summary for an organization's current period
CREATE OR REPLACE FUNCTION get_org_usage_summary(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'billing_plan', o.billing_plan,
    'included_minutes', o.included_minutes,
    'minutes_used', o.minutes_used,
    'minutes_remaining', GREATEST(0, o.included_minutes - o.minutes_used),
    'overage_minutes', GREATEST(0, o.minutes_used - o.included_minutes),
    'overage_rate_pence', o.overage_rate_pence,
    'overage_cost_pence', GREATEST(0, o.minutes_used - o.included_minutes) * o.overage_rate_pence,
    'current_period_start', o.current_period_start,
    'current_period_end', o.current_period_end,
    'total_calls_this_period', (
      SELECT COUNT(*) FROM usage_ledger ul
      WHERE ul.org_id = p_org_id
        AND ul.period_start = o.current_period_start
        AND ul.period_end = o.current_period_end
    )
  )
  INTO v_result
  FROM organizations o
  WHERE o.id = p_org_id;

  RETURN COALESCE(v_result, jsonb_build_object('error', 'Organization not found'));
END;
$$;

GRANT EXECUTE ON FUNCTION get_org_usage_summary TO service_role;

COMMENT ON TABLE usage_ledger IS
'Immutable audit trail of all billed call usage. Each row represents one call.
call_id is unique to prevent double-billing (idempotency key).
stripe_reported tracks whether the overage has been reported to Stripe.';

COMMENT ON FUNCTION record_call_usage IS
'Atomically records call usage: updates organizations.minutes_used and inserts usage_ledger row.
Uses FOR UPDATE row lock to prevent race conditions on concurrent calls.
Returns success=true with duplicate=true if the call was already billed (idempotent).';
