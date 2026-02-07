-- Migration: Pre-Paid Credit Ledger
-- Adds wallet columns to organizations and creates credit_transactions table.
-- Replaces subscription-based billing with prepaid credits.
-- All amounts stored as INTEGER PENCE (no floating point).
-- Created: 2026-02-08

-- ============================================
-- STEP 1: Add wallet columns to organizations
-- ============================================

-- Update plan CHECK to include 'prepaid' (column is 'plan', not 'billing_plan')
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('starter', 'professional', 'enterprise', 'prepaid'));

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS wallet_balance_pence INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS wallet_low_balance_pence INTEGER DEFAULT 500;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS wallet_auto_recharge BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS wallet_recharge_amount_pence INTEGER DEFAULT 5000;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS wallet_markup_percent INTEGER DEFAULT 100;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_default_pm_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for low-balance auto-recharge checks
CREATE INDEX IF NOT EXISTS idx_organizations_wallet_balance
  ON organizations(wallet_balance_pence)
  WHERE wallet_balance_pence IS NOT NULL;

-- ============================================
-- STEP 2: Create credit_transactions table
-- ============================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Transaction type and direction
  type TEXT NOT NULL CHECK (type IN ('topup', 'call_deduction', 'refund', 'adjustment', 'bonus')),
  amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),

  -- Balance snapshot (for reconciliation)
  balance_before_pence INTEGER NOT NULL,
  balance_after_pence INTEGER NOT NULL,

  -- Call-specific fields (NULL for topup/refund/adjustment/bonus)
  call_id TEXT,
  vapi_call_id TEXT,
  provider_cost_pence INTEGER,
  client_charged_pence INTEGER,
  gross_profit_pence INTEGER,
  markup_percent INTEGER,
  cost_breakdown JSONB,

  -- Stripe fields (NULL for call_deduction)
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,

  -- Metadata
  description TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Idempotency: one billing entry per call
  CONSTRAINT credit_txn_call_unique UNIQUE (call_id)
);

-- Partial unique: one credit per Stripe PaymentIntent
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_txn_stripe_pi
  ON credit_transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_org_id
  ON credit_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_org_created
  ON credit_transactions(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_org_type
  ON credit_transactions(org_id, type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_call_id
  ON credit_transactions(call_id)
  WHERE call_id IS NOT NULL;

-- ============================================
-- STEP 3: Row Level Security
-- ============================================

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org credit transactions" ON credit_transactions;
CREATE POLICY "Users can view own org credit transactions" ON credit_transactions
  FOR SELECT
  USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

DROP POLICY IF EXISTS "Service role full access on credit_transactions" ON credit_transactions;
CREATE POLICY "Service role full access on credit_transactions" ON credit_transactions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- STEP 4: Atomic credit deduction function
-- ============================================

CREATE OR REPLACE FUNCTION deduct_call_credits(
  p_org_id UUID,
  p_call_id TEXT,
  p_vapi_call_id TEXT,
  p_provider_cost_pence INTEGER,
  p_markup_percent INTEGER,
  p_client_charged_pence INTEGER,
  p_cost_breakdown JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_gross_profit INTEGER;
  v_low_balance_threshold INTEGER;
  v_txn_id UUID;
BEGIN
  -- Lock the org row to prevent concurrent deductions
  SELECT wallet_balance_pence, wallet_low_balance_pence
  INTO v_balance_before, v_low_balance_threshold
  FROM organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF v_balance_before IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  v_balance_after := v_balance_before - p_client_charged_pence;
  v_gross_profit := p_client_charged_pence - p_provider_cost_pence;

  -- Allow negative balance (call already happened; debt collected via auto-recharge)
  UPDATE organizations
  SET wallet_balance_pence = v_balance_after,
      updated_at = NOW()
  WHERE id = p_org_id;

  -- Insert immutable ledger entry
  INSERT INTO credit_transactions (
    org_id, type, amount_pence, direction,
    balance_before_pence, balance_after_pence,
    call_id, vapi_call_id,
    provider_cost_pence, client_charged_pence, gross_profit_pence,
    markup_percent, cost_breakdown,
    description, created_by
  ) VALUES (
    p_org_id, 'call_deduction', p_client_charged_pence, 'debit',
    v_balance_before, v_balance_after,
    p_call_id, p_vapi_call_id,
    p_provider_cost_pence, p_client_charged_pence, v_gross_profit,
    p_markup_percent, p_cost_breakdown,
    COALESCE(p_description, 'Call ' || p_call_id),
    'system'
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'client_charged_pence', p_client_charged_pence,
    'provider_cost_pence', p_provider_cost_pence,
    'gross_profit_pence', v_gross_profit,
    'needs_recharge', v_balance_after < v_low_balance_threshold
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Idempotent: this call was already billed
    RETURN jsonb_build_object('success', true, 'duplicate', true);
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_call_credits TO service_role;

-- ============================================
-- STEP 5: Add wallet credits function
-- ============================================

CREATE OR REPLACE FUNCTION add_wallet_credits(
  p_org_id UUID,
  p_amount_pence INTEGER,
  p_type TEXT,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_stripe_charge_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_created_by TEXT DEFAULT 'system'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_txn_id UUID;
BEGIN
  -- Lock org row
  SELECT wallet_balance_pence
  INTO v_balance_before
  FROM organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF v_balance_before IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  v_balance_after := v_balance_before + p_amount_pence;

  UPDATE organizations
  SET wallet_balance_pence = v_balance_after,
      updated_at = NOW()
  WHERE id = p_org_id;

  INSERT INTO credit_transactions (
    org_id, type, amount_pence, direction,
    balance_before_pence, balance_after_pence,
    stripe_payment_intent_id, stripe_charge_id,
    description, created_by
  ) VALUES (
    p_org_id, p_type, p_amount_pence, 'credit',
    v_balance_before, v_balance_after,
    p_stripe_payment_intent_id, p_stripe_charge_id,
    p_description, p_created_by
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'amount_added', p_amount_pence
  );
END;
$$;

GRANT EXECUTE ON FUNCTION add_wallet_credits TO service_role;

-- ============================================
-- STEP 6: Wallet summary helper
-- ============================================

CREATE OR REPLACE FUNCTION get_wallet_summary(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'balance_pence', o.wallet_balance_pence,
    'balance_formatted', '£' || ROUND(o.wallet_balance_pence / 100.0, 2),
    'low_balance_pence', o.wallet_low_balance_pence,
    'auto_recharge_enabled', o.wallet_auto_recharge,
    'recharge_amount_pence', o.wallet_recharge_amount_pence,
    'markup_percent', o.wallet_markup_percent,
    'is_low_balance', o.wallet_balance_pence <= o.wallet_low_balance_pence,
    'has_payment_method', o.stripe_default_pm_id IS NOT NULL,
    'total_spent_pence', COALESCE((
      SELECT SUM(client_charged_pence) FROM credit_transactions
      WHERE org_id = p_org_id AND type = 'call_deduction'
    ), 0),
    'total_calls', (
      SELECT COUNT(*) FROM credit_transactions
      WHERE org_id = p_org_id AND type = 'call_deduction'
    ),
    'total_topped_up_pence', COALESCE((
      SELECT SUM(amount_pence) FROM credit_transactions
      WHERE org_id = p_org_id AND direction = 'credit'
    ), 0),
    'total_profit_pence', COALESCE((
      SELECT SUM(gross_profit_pence) FROM credit_transactions
      WHERE org_id = p_org_id AND type = 'call_deduction'
    ), 0)
  )
  INTO v_result
  FROM organizations o
  WHERE o.id = p_org_id;

  RETURN COALESCE(v_result, jsonb_build_object('error', 'Organization not found'));
END;
$$;

GRANT EXECUTE ON FUNCTION get_wallet_summary TO service_role;

-- ============================================
-- STEP 7: Migrate existing orgs to prepaid
-- ============================================

UPDATE organizations
SET plan = 'prepaid'
WHERE plan != 'prepaid' OR plan IS NULL;

-- ============================================
-- STEP 8: Comments
-- ============================================

COMMENT ON TABLE credit_transactions IS
'Immutable audit trail of all wallet movements: top-ups, call deductions, refunds, adjustments.
call_id is unique to prevent double-billing (idempotency key).
All amounts in integer pence (GBP). No floating point.';

COMMENT ON FUNCTION deduct_call_credits IS
'Atomically deducts credits from org wallet after a call ends.
Uses FOR UPDATE row lock to prevent race conditions.
Returns success=true with duplicate=true if the call was already billed (idempotent).
Allows negative balance (debt collected via auto-recharge).';

COMMENT ON FUNCTION add_wallet_credits IS
'Atomically adds credits to org wallet (top-up, refund, bonus).
Uses FOR UPDATE row lock. stripe_payment_intent_id unique index prevents duplicate top-ups.';
