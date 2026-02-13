-- Migration: Credit Reservation Pattern (Phase 2)
-- Date: 2026-02-14
-- Purpose: Implement authorize-then-capture billing for calls
-- Creates credit_reservations table, reserve + commit RPC functions
-- ============================================
-- STEP 1: Create credit_reservations table
-- ============================================
CREATE TABLE IF NOT EXISTS credit_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    call_id TEXT NOT NULL,
    vapi_call_id TEXT,
    reserved_pence INTEGER NOT NULL CHECK (reserved_pence > 0),
    committed_pence INTEGER DEFAULT NULL,
    released_pence INTEGER DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('active', 'committed', 'expired', 'released')
    ),
    estimated_minutes INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    committed_at TIMESTAMPTZ DEFAULT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
    CONSTRAINT credit_res_call_unique UNIQUE (call_id)
);
CREATE INDEX IF NOT EXISTS idx_credit_res_org_status ON credit_reservations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_res_expires ON credit_reservations(expires_at)
WHERE status = 'active';
COMMENT ON TABLE credit_reservations IS 'Holds (authorizations) on wallet balance during active calls. Committed on call end, expired/released on timeout.';
-- ============================================
-- STEP 2: Add 'reservation' to credit_transactions type constraint
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
            'license',
            'reservation',
            'reservation_release'
        )
    );
-- ============================================
-- STEP 3: Create reserve_call_credits() RPC
-- ============================================
CREATE OR REPLACE FUNCTION reserve_call_credits(
        p_org_id UUID,
        p_call_id TEXT,
        p_vapi_call_id TEXT,
        p_estimated_minutes INTEGER DEFAULT 5
    ) RETURNS JSONB AS $$
DECLARE v_balance_pence INTEGER;
v_total_active_reservations INTEGER;
v_effective_balance INTEGER;
v_rate_per_minute INTEGER;
v_reserve_amount INTEGER;
v_reservation_id UUID;
BEGIN -- Lock org row
SELECT wallet_balance_pence INTO v_balance_pence
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
-- Calculate total active reservations (holds)
SELECT COALESCE(SUM(reserved_pence), 0) INTO v_total_active_reservations
FROM credit_reservations
WHERE org_id = p_org_id
    AND status = 'active';
-- Effective balance = wallet balance - active reservations
v_effective_balance := v_balance_pence - v_total_active_reservations;
-- Calculate reserve amount: £0.49/min * estimated_minutes (49 pence/min)
v_rate_per_minute := 49;
v_reserve_amount := v_rate_per_minute * p_estimated_minutes;
-- Check if effective balance covers the reservation
IF v_effective_balance < v_reserve_amount THEN -- If effective balance > 0, reserve what we can (partial reservation)
IF v_effective_balance > 0 THEN v_reserve_amount := v_effective_balance;
ELSE RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'insufficient_balance',
    'balance_pence',
    v_balance_pence,
    'active_reservations_pence',
    v_total_active_reservations,
    'effective_balance_pence',
    v_effective_balance,
    'required_pence',
    v_reserve_amount
);
END IF;
END IF;
-- Create reservation (hold)
INSERT INTO credit_reservations (
        org_id,
        call_id,
        vapi_call_id,
        reserved_pence,
        estimated_minutes,
        status,
        expires_at
    )
VALUES (
        p_org_id,
        p_call_id,
        p_vapi_call_id,
        v_reserve_amount,
        p_estimated_minutes,
        'active',
        NOW() + INTERVAL '30 minutes'
    ) ON CONFLICT (call_id) DO NOTHING
RETURNING id INTO v_reservation_id;
-- Idempotency: if reservation already exists for this call
IF v_reservation_id IS NULL THEN
SELECT id INTO v_reservation_id
FROM credit_reservations
WHERE call_id = p_call_id;
RETURN jsonb_build_object(
    'success',
    true,
    'duplicate',
    true,
    'reservation_id',
    v_reservation_id
);
END IF;
RETURN jsonb_build_object(
    'success',
    true,
    'duplicate',
    false,
    'reservation_id',
    v_reservation_id,
    'reserved_pence',
    v_reserve_amount,
    'balance_pence',
    v_balance_pence,
    'effective_balance_pence',
    v_effective_balance - v_reserve_amount,
    'active_reservations_pence',
    v_total_active_reservations + v_reserve_amount
);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
GRANT EXECUTE ON FUNCTION reserve_call_credits TO service_role;
-- ============================================
-- STEP 4: Create commit_reserved_credits() RPC
-- ============================================
CREATE OR REPLACE FUNCTION commit_reserved_credits(
        p_call_id TEXT,
        p_actual_duration_seconds INTEGER
    ) RETURNS JSONB AS $$
DECLARE v_reservation RECORD;
v_actual_cost INTEGER;
v_rate_per_minute INTEGER;
v_actual_minutes NUMERIC;
v_balance_before INTEGER;
v_balance_after INTEGER;
v_released_pence INTEGER;
v_txn_id UUID;
BEGIN -- Find and lock the reservation
SELECT cr.*,
    o.wallet_balance_pence INTO v_reservation
FROM credit_reservations cr
    JOIN organizations o ON o.id = cr.org_id
WHERE cr.call_id = p_call_id
    AND cr.status = 'active' FOR
UPDATE OF cr,
    o;
IF NOT FOUND THEN -- No active reservation — fall back to direct billing
RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'no_active_reservation',
    'call_id',
    p_call_id,
    'fallback_to_direct_billing',
    true
);
END IF;
-- Calculate actual cost: ceil(minutes) * rate
v_rate_per_minute := 49;
v_actual_minutes := CEIL(p_actual_duration_seconds::NUMERIC / 60);
v_actual_cost := v_rate_per_minute * v_actual_minutes::INTEGER;
-- Cap actual cost at reserved amount (we never charge MORE than reserved)
IF v_actual_cost > v_reservation.reserved_pence THEN v_actual_cost := v_reservation.reserved_pence;
END IF;
-- Calculate released credits (unused portion)
v_released_pence := v_reservation.reserved_pence - v_actual_cost;
-- Get current balance
v_balance_before := v_reservation.wallet_balance_pence;
-- Deduct actual cost from wallet
v_balance_after := v_balance_before - v_actual_cost;
-- Update wallet balance
UPDATE organizations
SET wallet_balance_pence = v_balance_after,
    updated_at = NOW()
WHERE id = v_reservation.org_id;
-- Mark reservation as committed
UPDATE credit_reservations
SET status = 'committed',
    committed_pence = v_actual_cost,
    released_pence = v_released_pence,
    committed_at = NOW()
WHERE id = v_reservation.id;
-- Insert ledger entry for the actual charge
INSERT INTO credit_transactions (
        org_id,
        type,
        direction,
        amount_pence,
        balance_before_pence,
        balance_after_pence,
        call_id,
        vapi_call_id,
        description,
        created_by
    )
VALUES (
        v_reservation.org_id,
        'call_deduction',
        'debit',
        v_actual_cost,
        v_balance_before,
        v_balance_after,
        p_call_id,
        v_reservation.vapi_call_id,
        format(
            'Call billing (commit): %s min @ %s p/min. Reserved: %s p, Used: %s p, Released: %s p',
            v_actual_minutes,
            v_rate_per_minute,
            v_reservation.reserved_pence,
            v_actual_cost,
            v_released_pence
        ),
        'vapi_webhook'
    ) ON CONFLICT (call_id) DO NOTHING
RETURNING id INTO v_txn_id;
IF v_txn_id IS NULL THEN RETURN jsonb_build_object('success', true, 'duplicate', true);
END IF;
RETURN jsonb_build_object(
    'success',
    true,
    'duplicate',
    false,
    'transaction_id',
    v_txn_id,
    'reserved_pence',
    v_reservation.reserved_pence,
    'actual_cost_pence',
    v_actual_cost,
    'released_pence',
    v_released_pence,
    'balance_before_pence',
    v_balance_before,
    'balance_after_pence',
    v_balance_after,
    'actual_minutes',
    v_actual_minutes,
    'duration_seconds',
    p_actual_duration_seconds
);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
GRANT EXECUTE ON FUNCTION commit_reserved_credits TO service_role;
-- ============================================
-- STEP 5: Create cleanup function for expired reservations
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_reservations() RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
UPDATE credit_reservations
SET status = 'expired'
WHERE status = 'active'
    AND expires_at < NOW();
GET DIAGNOSTICS v_count = ROW_COUNT;
RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
GRANT EXECUTE ON FUNCTION cleanup_expired_reservations TO service_role;
-- ============================================
-- STEP 6: Verify migration
-- ============================================
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'credit_reservations'
) THEN RAISE EXCEPTION 'Migration failed: credit_reservations table not created';
END IF;
RAISE NOTICE 'Migration 20260214_credit_reservation successful';
END $$;