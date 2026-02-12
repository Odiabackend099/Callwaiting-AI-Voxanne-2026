-- Fix add_wallet_credits to handle both credits and debits
-- Issue: Function hardcoded direction='credit' but phone provisioning uses negative amounts (debits)
-- Fix: Dynamically set direction based on amount sign

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
  v_direction TEXT;
  v_amount_abs INTEGER;
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

  -- Calculate new balance
  v_balance_after := v_balance_before + p_amount_pence;

  -- Determine direction and absolute amount
  IF p_amount_pence >= 0 THEN
    v_direction := 'credit';
    v_amount_abs := p_amount_pence;
  ELSE
    v_direction := 'debit';
    v_amount_abs := ABS(p_amount_pence);
  END IF;

  -- Update wallet balance
  UPDATE organizations
  SET wallet_balance_pence = v_balance_after,
      updated_at = NOW()
  WHERE id = p_org_id;

  -- Insert transaction with correct direction
  INSERT INTO credit_transactions (
    org_id, type, amount_pence, direction,
    balance_before_pence, balance_after_pence,
    stripe_payment_intent_id, stripe_charge_id,
    description, created_by
  ) VALUES (
    p_org_id, p_type, v_amount_abs, v_direction,
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
