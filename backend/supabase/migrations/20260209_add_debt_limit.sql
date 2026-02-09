-- Migration: Add Debt Limit to Credit Wallets
-- Date: 2026-02-09
-- Purpose: Prevent unlimited negative balances with configurable debt limit
-- CTO Directive: Default $5.00 (500 cents) = ~7 minutes of call time at $0.70/minute

-- Step 1: Add debt_limit_pence column to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS debt_limit_pence INTEGER DEFAULT 500 NOT NULL;

COMMENT ON COLUMN organizations.debt_limit_pence IS 'Maximum negative balance allowed (cents). Default: 500 cents ($5.00 USD) = ~7 minutes of call time at $0.70/minute';

-- Step 2: Update existing RPC function to enforce debt limit
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
SET search_path = public
AS $$
DECLARE
  v_balance_before INTEGER;
  v_balance_after INTEGER;
  v_debt_limit INTEGER;
  v_gross_profit INTEGER;
  v_low_balance_threshold INTEGER;
  v_txn_id UUID;
BEGIN
  -- Lock the org row to prevent concurrent deductions
  SELECT wallet_balance_pence, wallet_low_balance_pence, debt_limit_pence
  INTO v_balance_before, v_low_balance_threshold, v_debt_limit
  FROM organizations
  WHERE id = p_org_id
  FOR UPDATE;

  IF v_balance_before IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
  END IF;

  -- Calculate new balance
  v_balance_after := v_balance_before - p_client_charged_pence;
  v_gross_profit := p_client_charged_pence - p_provider_cost_pence;

  -- Check debt limit BEFORE deducting (P0-3 enforcement)
  IF v_balance_after < -v_debt_limit THEN
    -- Debt limit exceeded - return error with details
    RETURN jsonb_build_object(
      'success', false,
      'error', 'debt_limit_exceeded',
      'current_balance', v_balance_before,
      'debt_limit', v_debt_limit,
      'attempted_deduction', p_client_charged_pence,
      'new_balance_would_be', v_balance_after,
      'amount_over_limit', (-v_balance_after) - v_debt_limit,
      'message', format('Debt limit of %s cents would be exceeded. Current balance: %s, deduction: %s, new balance: %s',
                        v_debt_limit, v_balance_before, p_client_charged_pence, v_balance_after)
    );
  END IF;

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
    COALESCE(p_description, 'Call deduction: ' || p_vapi_call_id),
    'vapi_webhook'
  )
  ON CONFLICT (call_id) DO NOTHING  -- Idempotency: prevent double-billing
  RETURNING id INTO v_txn_id;

  -- Detect duplicate (call already billed)
  IF v_txn_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  -- Check if balance is now below low_balance_threshold (trigger auto-recharge)
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after,
    'client_charged_pence', p_client_charged_pence,
    'provider_cost_pence', p_provider_cost_pence,
    'gross_profit_pence', v_gross_profit,
    'needs_recharge', v_balance_after < v_low_balance_threshold,
    'debt_limit', v_debt_limit,
    'remaining_debt_capacity', v_debt_limit + v_balance_after,
    'in_debt', v_balance_after < 0
  );
END;
$$;

-- Add helpful comment
COMMENT ON FUNCTION deduct_call_credits IS 'Deduct call credits from wallet with atomic debt limit enforcement. Returns error if debt limit would be exceeded.';

-- Step 3: Verify migration success
DO $$
BEGIN
  -- Check column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'organizations'
      AND column_name = 'debt_limit_pence'
  ) THEN
    RAISE EXCEPTION 'Migration failed: debt_limit_pence column not created';
  END IF;

  RAISE NOTICE 'Migration successful: debt_limit_pence column added to organizations table with default 500 cents ($5.00 USD)';
END $$;
