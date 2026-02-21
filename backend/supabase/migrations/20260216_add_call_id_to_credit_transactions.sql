-- Migration: Add call_id and vapi_call_id to credit_transactions
-- Date: 2026-02-16
-- Purpose: Fix critical schema mismatch preventing call billing
-- Root Cause: commit_reserved_credits() RPC tries to insert call_id/vapi_call_id but columns don't exist
-- Impact: All call billing was silently failing since 2026-02-14
-- ============================================

-- STEP 1: Add call_id column (links transaction to internal call record)
-- ============================================
ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS call_id TEXT;

-- Add index for fast lookup by call_id
CREATE INDEX IF NOT EXISTS idx_credit_transactions_call_id
ON credit_transactions(call_id);

-- Add UNIQUE constraint to prevent duplicate billing for same call
ALTER TABLE credit_transactions
ADD CONSTRAINT credit_transactions_call_id_unique
UNIQUE (call_id)
DEFERRABLE INITIALLY DEFERRED;

COMMENT ON COLUMN credit_transactions.call_id IS 'Internal call identifier (links to calls table). Ensures one billing transaction per call (idempotency).';

-- ============================================
-- STEP 2: Add vapi_call_id column (links to Vapi external ID)
-- ============================================
ALTER TABLE credit_transactions
ADD COLUMN IF NOT EXISTS vapi_call_id TEXT;

-- Add index for Vapi reconciliation queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_vapi_call_id
ON credit_transactions(vapi_call_id);

COMMENT ON COLUMN credit_transactions.vapi_call_id IS 'Vapi external call identifier. Used for reconciliation with Vapi billing reports.';

-- ============================================
-- STEP 3: Verify migration
-- ============================================
DO $$
DECLARE
    v_call_id_exists BOOLEAN;
    v_vapi_call_id_exists BOOLEAN;
BEGIN
    -- Check if call_id column exists
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credit_transactions'
          AND column_name = 'call_id'
    ) INTO v_call_id_exists;

    -- Check if vapi_call_id column exists
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'credit_transactions'
          AND column_name = 'vapi_call_id'
    ) INTO v_vapi_call_id_exists;

    IF NOT v_call_id_exists THEN
        RAISE EXCEPTION 'Migration failed: call_id column not created';
    END IF;

    IF NOT v_vapi_call_id_exists THEN
        RAISE EXCEPTION 'Migration failed: vapi_call_id column not created';
    END IF;

    RAISE NOTICE 'Migration 20260216_add_call_id_to_credit_transactions successful';
    RAISE NOTICE 'Added call_id column with UNIQUE constraint';
    RAISE NOTICE 'Added vapi_call_id column for reconciliation';
    RAISE NOTICE 'Billing pipeline now operational';
END $$;
