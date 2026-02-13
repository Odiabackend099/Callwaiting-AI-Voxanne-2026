-- Migration: Atomic Asset Billing (Phase 1)
-- Date: 2026-02-14
-- Purpose: Fix TOCTOU race condition in phone provisioning
-- Adds idempotency_key column, new asset types, and atomic check-and-deduct RPC
-- ============================================
-- STEP 1: Add idempotency_key column to credit_transactions
-- ============================================
ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_txn_idempotency ON credit_transactions(idempotency_key)
WHERE idempotency_key IS NOT NULL;
COMMENT ON COLUMN credit_transactions.idempotency_key IS 'Unique key for asset purchase deduplication. Format: provision-{orgId}-{timestamp}-{nonce}';
-- ============================================
-- STEP 2: Update type CHECK constraint to include new asset types
-- ============================================
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE credit_transactions
ADD CONSTRAINT credit_transactions_type_check CHECK (
        type IN (
            'topup',
            'call_deduction',
            'refund',
            'adjustment',
            'bonus',
            'phone_provisioning',
            'phone_number',
            'did',
            'license'
        )
    );
-- ============================================
-- STEP 3: Create atomic check-and-deduct RPC function
-- ============================================
CREATE OR REPLACE FUNCTION check_balance_and_deduct_asset_cost(
        p_org_id UUID,
        p_cost_pence INTEGER,
        p_asset_type TEXT,
        -- 'phone_number', 'did', 'license', 'phone_provisioning'
        p_description TEXT,
        p_idempotency_key TEXT -- Format: 'provision-{orgId}-{timestamp}-{nonce}'
    ) RETURNS JSONB AS $$
DECLARE v_balance_before INTEGER;
v_balance_after INTEGER;
v_debt_limit INTEGER;
v_txn_id UUID;
BEGIN -- Step 1: Lock the row and read balance (prevents concurrent reads)
SELECT wallet_balance_pence,
    debt_limit_pence INTO v_balance_before,
    v_debt_limit
FROM organizations
WHERE id = p_org_id FOR
UPDATE;
IF NOT FOUND THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'organization_not_found'
);
END IF;
-- Step 2: Calculate new balance
v_balance_after := v_balance_before - p_cost_pence;
-- Step 3: Enforce ZERO debt for asset purchases (stricter than call debt limit)
-- Asset purchases require positive balance — no credit allowed
IF v_balance_after < 0 THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'insufficient_balance',
    'balance_pence',
    v_balance_before,
    'required_pence',
    p_cost_pence,
    'shortfall_pence',
    - v_balance_after
);
END IF;
-- Step 4: Deduct atomically
UPDATE organizations
SET wallet_balance_pence = v_balance_after,
    updated_at = NOW()
WHERE id = p_org_id;
-- Step 5: Insert ledger entry with idempotency protection
INSERT INTO credit_transactions (
        org_id,
        type,
        direction,
        amount_pence,
        balance_before_pence,
        balance_after_pence,
        description,
        idempotency_key,
        created_at
    )
VALUES (
        p_org_id,
        p_asset_type,
        'debit',
        p_cost_pence,
        v_balance_before,
        v_balance_after,
        p_description,
        p_idempotency_key,
        NOW()
    ) ON CONFLICT (idempotency_key)
WHERE idempotency_key IS NOT NULL DO NOTHING
RETURNING id INTO v_txn_id;
IF v_txn_id IS NULL THEN -- Duplicate request detected — rollback the balance change
UPDATE organizations
SET wallet_balance_pence = v_balance_before,
    updated_at = NOW()
WHERE id = p_org_id;
RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'duplicate_request',
    'idempotency_key',
    p_idempotency_key
);
END IF;
RETURN jsonb_build_object(
    'success',
    true,
    'transaction_id',
    v_txn_id,
    'balance_before_pence',
    v_balance_before,
    'balance_after_pence',
    v_balance_after
);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
GRANT EXECUTE ON FUNCTION check_balance_and_deduct_asset_cost TO service_role;
COMMENT ON FUNCTION check_balance_and_deduct_asset_cost IS 'Atomically checks balance and deducts cost for asset purchases (phone numbers, DIDs, licenses).
Uses FOR UPDATE row lock to prevent TOCTOU race conditions.
Enforces zero-debt policy (stricter than call billing).
Idempotency via unique idempotency_key prevents duplicate charges.';
-- ============================================
-- STEP 4: Verify migration
-- ============================================
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'credit_transactions'
        AND column_name = 'idempotency_key'
) THEN RAISE EXCEPTION 'Migration failed: idempotency_key column not created';
END IF;
RAISE NOTICE 'Migration 20260214_atomic_asset_billing successful';
END $$;