-- Migration: Fix Rate Mismatch (49p → 56p)
-- Date: 2026-02-16
-- Purpose: Align RPC function rates with application config
-- Impact: Fixes 12.5% undercharging (7 pence/minute)
-- ============================================

-- STEP 1: Update reserve_call_credits() to use 56p/min
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
-- FIXED: Rate updated from 49p to 56p (matches application config)
-- Application: 70 USD cents × 0.79 GBP = 55.3 → ceil = 56p
v_rate_per_minute := 56;  -- Changed from 49
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
-- STEP 2: Update commit_reserved_credits() to use 56p/min
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
-- FIXED: Rate updated from 49p to 56p (matches application config)
v_rate_per_minute := 56;  -- Changed from 49
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
-- STEP 3: Verify migration
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 20260216_fix_rate_mismatch successful';
    RAISE NOTICE 'Rate updated: 49p/min → 56p/min';
    RAISE NOTICE 'Both RPC functions updated: reserve_call_credits, commit_reserved_credits';
END $$;
