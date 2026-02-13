-- ============================================
-- FIX: get_wallet_summary RPC function
-- ============================================
-- Issue: RPC was querying non-existent columns
-- Solution: Use actual database schema columns (SSOT)
--
-- Before:
--   - Queried: client_charged_pence (doesn't exist)
--   - Queried: gross_profit_pence (doesn't exist)
--   - Queried: wallet_low_balance_pence (doesn't exist)
--   - Queried: wallet_auto_recharge (doesn't exist)
--
-- After:
--   - Uses: amount_pence (actual column in credit_transactions)
--   - Uses: debt_limit_pence (actual column in organizations)
--   - Uses: wallet_markup_percent (actual column in organizations)
--   - Uses: stripe_customer_id (actual column in organizations)

CREATE OR REPLACE FUNCTION get_wallet_summary(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'balance_pence', o.wallet_balance_pence,
    'balance_formatted', '£' || ROUND(o.wallet_balance_pence / 100.0, 2),
    'low_balance_pence', o.debt_limit_pence,  -- FIXED: Use debt_limit_pence instead of wallet_low_balance_pence
    'auto_recharge_enabled', false,  -- FIXED: Not stored in DB, default to false
    'recharge_amount_pence', 5000,  -- FIXED: Not stored in DB, use default 5000p
    'markup_percent', o.wallet_markup_percent,
    'is_low_balance', o.wallet_balance_pence <= o.debt_limit_pence,  -- FIXED: Compare to debt_limit_pence
    'has_payment_method', o.stripe_customer_id IS NOT NULL,  -- FIXED: Check stripe_customer_id instead of stripe_default_pm_id
    'total_spent_pence', COALESCE((
      SELECT SUM(amount_pence) FROM credit_transactions  -- FIXED: Use amount_pence instead of client_charged_pence
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
      SELECT SUM(amount_pence) FROM credit_transactions  -- FIXED: Use amount_pence instead of gross_profit_pence
      WHERE org_id = p_org_id AND type = 'call_deduction'
    ), 0)
  )
  INTO v_result
  FROM organizations o
  WHERE o.id = p_org_id;

  RETURN COALESCE(v_result, jsonb_build_object('error', 'Organization not found'));
END;
$$;

GRANT EXECUTE ON FUNCTION get_wallet_summary(uuid) TO service_role;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON FUNCTION get_wallet_summary(uuid) IS
'Returns wallet summary for organization including balance, transaction counts, and spending totals.
Uses SSOT (Single Source of Truth) database columns.
Fixed 2026-02-13: Query correct columns instead of non-existent ones.';
