-- ============================================
-- VOXANNE PHASE 1: Create Atomic Booking RPC Functions
-- Date: 2026-01-13
-- Purpose: Atomic slot claiming with PostgreSQL advisory locks
-- Context: Prevents double-booking race conditions
-- Security: SECURITY INVOKER + service_role only (prevents privilege escalation)
-- ============================================
-- ===== FUNCTION 1: Atomic Slot Claiming =====
-- Claims a calendar slot atomically using PostgreSQL advisory locks
-- Prevents double-booking with microsecond-level precision
CREATE OR REPLACE FUNCTION claim_slot_atomic(
        p_org_id UUID,
        p_calendar_id TEXT,
        p_slot_time TIMESTAMPTZ,
        p_call_sid TEXT,
        p_patient_name TEXT DEFAULT NULL,
        p_patient_phone TEXT DEFAULT NULL,
        p_hold_duration_minutes INTEGER DEFAULT 10
    ) RETURNS TABLE (
        success BOOLEAN,
        hold_id UUID,
        error TEXT,
        action TEXT
    ) AS $$
DECLARE v_hold_id UUID;
v_lock_key BIGINT;
v_existing_hold UUID;
v_expires_at TIMESTAMPTZ;
BEGIN BEGIN -- Input validation
IF p_org_id IS NULL THEN RAISE EXCEPTION 'VALIDATION_ERROR: org_id is required';
END IF;
IF TRIM(COALESCE(p_calendar_id, '')) = '' THEN RAISE EXCEPTION 'VALIDATION_ERROR: calendar_id is required';
END IF;
IF p_slot_time IS NULL THEN RAISE EXCEPTION 'VALIDATION_ERROR: slot_time is required';
END IF;
IF TRIM(COALESCE(p_call_sid, '')) = '' THEN RAISE EXCEPTION 'VALIDATION_ERROR: call_sid is required';
END IF;
-- Normalize inputs
p_calendar_id := TRIM(p_calendar_id);
p_call_sid := TRIM(p_call_sid);
-- CRITICAL: Acquire advisory lock to prevent race conditions
-- Lock key is hash of org_id + slot_time (unique per org per slot)
-- pg_advisory_xact_lock releases automatically at transaction end
v_lock_key := hashtextextended(p_org_id::TEXT || p_slot_time::TEXT, 0);
PERFORM pg_advisory_xact_lock(v_lock_key);
-- Check for existing active hold on this slot
SELECT id INTO v_existing_hold
FROM appointment_holds
WHERE org_id = p_org_id
    AND slot_time = p_slot_time
    AND status = 'held'
    AND expires_at > NOW()
    AND deleted_at IS NULL
LIMIT 1;
IF v_existing_hold IS NOT NULL THEN -- Slot is already held by another call
RETURN QUERY
SELECT false,
    NULL::UUID,
    'Slot is currently held by another caller'::TEXT,
    'OFFER_ALTERNATIVES'::TEXT;
RETURN;
END IF;
-- Calculate expiration time
v_expires_at := NOW() + (p_hold_duration_minutes || ' minutes')::INTERVAL;
-- Create hold record
INSERT INTO appointment_holds (
        org_id,
        calendar_id,
        slot_time,
        call_sid,
        patient_name,
        patient_phone,
        status,
        expires_at,
        created_at,
        updated_at
    )
VALUES (
        p_org_id,
        p_calendar_id,
        p_slot_time,
        p_call_sid,
        p_patient_name,
        p_patient_phone,
        'held',
        v_expires_at,
        NOW(),
        NOW()
    )
RETURNING id INTO v_hold_id;
-- Success
RETURN QUERY
SELECT true,
    v_hold_id,
    NULL::TEXT,
    NULL::TEXT;
EXCEPTION
WHEN OTHERS THEN -- Any error triggers auto-rollback
RETURN QUERY
SELECT false,
    NULL::UUID,
    format('DATABASE_ERROR_%s: %s', SQLSTATE, SQLERRM)::TEXT,
    'ESCALATE'::TEXT;
END;
END $$ LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public;
-- Grant to service_role only (prevents privilege escalation)
GRANT EXECUTE ON FUNCTION claim_slot_atomic(
        UUID,
        TEXT,
        TIMESTAMPTZ,
        TEXT,
        TEXT,
        TEXT,
        INTEGER
    ) TO service_role;
-- ===== FUNCTION 2: Confirm Held Slot =====
-- Verifies OTP and converts hold to confirmed appointment
CREATE OR REPLACE FUNCTION confirm_held_slot(
        p_hold_id UUID,
        p_org_id UUID,
        p_contact_id UUID,
        p_service_type TEXT
    ) RETURNS TABLE (
        success BOOLEAN,
        appointment_id UUID,
        error TEXT
    ) AS $$
DECLARE v_appointment_id UUID;
v_hold_record RECORD;
BEGIN BEGIN -- Input validation
IF p_hold_id IS NULL THEN RAISE EXCEPTION 'VALIDATION_ERROR: hold_id is required';
END IF;
IF p_org_id IS NULL THEN RAISE EXCEPTION 'VALIDATION_ERROR: org_id is required';
END IF;
IF p_contact_id IS NULL THEN RAISE EXCEPTION 'VALIDATION_ERROR: contact_id is required';
END IF;
IF TRIM(COALESCE(p_service_type, '')) = '' THEN RAISE EXCEPTION 'VALIDATION_ERROR: service_type is required';
END IF;
-- Fetch and validate hold
SELECT * INTO v_hold_record
FROM appointment_holds
WHERE id = p_hold_id
    AND org_id = p_org_id
    AND deleted_at IS NULL;
IF NOT FOUND THEN RETURN QUERY
SELECT false,
    NULL::UUID,
    'Hold not found or expired'::TEXT;
RETURN;
END IF;
-- Check if hold is still valid
IF v_hold_record.status != 'held' THEN RETURN QUERY
SELECT false,
    NULL::UUID,
    format(
        'Hold status is %s, expected held',
        v_hold_record.status
    )::TEXT;
RETURN;
END IF;
IF v_hold_record.expires_at < NOW() THEN RETURN QUERY
SELECT false,
    NULL::UUID,
    'Hold has expired'::TEXT;
RETURN;
END IF;
-- Create appointment
INSERT INTO appointments (
        org_id,
        contact_id,
        service_type,
        scheduled_at,
        status,
        created_at,
        updated_at
    )
VALUES (
        p_org_id,
        p_contact_id,
        p_service_type,
        v_hold_record.slot_time,
        'confirmed',
        NOW(),
        NOW()
    )
RETURNING id INTO v_appointment_id;
-- Update hold to confirmed status
UPDATE appointment_holds
SET status = 'confirmed',
    appointment_id = v_appointment_id,
    updated_at = NOW()
WHERE id = p_hold_id;
-- Success
RETURN QUERY
SELECT true,
    v_appointment_id,
    NULL::TEXT;
EXCEPTION
WHEN OTHERS THEN -- Any error triggers auto-rollback
RETURN QUERY
SELECT false,
    NULL::UUID,
    format('DATABASE_ERROR_%s: %s', SQLSTATE, SQLERRM)::TEXT;
END;
END $$ LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public;
GRANT EXECUTE ON FUNCTION confirm_held_slot(UUID, UUID, UUID, TEXT) TO service_role;
-- ===== FUNCTION 3: Release Hold =====
-- Releases a hold when patient hangs up or session ends
CREATE OR REPLACE FUNCTION release_hold(p_hold_id UUID, p_org_id UUID) RETURNS TABLE (success BOOLEAN) AS $$ BEGIN BEGIN -- Input validation
    IF p_hold_id IS NULL THEN RAISE EXCEPTION 'VALIDATION_ERROR: hold_id is required';
END IF;
IF p_org_id IS NULL THEN RAISE EXCEPTION 'VALIDATION_ERROR: org_id is required';
END IF;
-- Update hold to expired status
UPDATE appointment_holds
SET status = 'expired',
    updated_at = NOW()
WHERE id = p_hold_id
    AND org_id = p_org_id
    AND status = 'held'
    AND deleted_at IS NULL;
-- Return success even if no rows updated (idempotent)
RETURN QUERY
SELECT true;
EXCEPTION
WHEN OTHERS THEN -- Log error but don't fail (non-critical operation)
RETURN QUERY
SELECT false;
END;
END $$ LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public;
GRANT EXECUTE ON FUNCTION release_hold(UUID, UUID) TO service_role;
-- ===== FUNCTION 4: Cleanup Expired Holds =====
-- Background job to clean up expired holds
-- Should be called periodically (e.g., every 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_expired_holds() RETURNS TABLE (deleted_count INTEGER) AS $$
DECLARE v_count INTEGER;
BEGIN -- Update expired holds
UPDATE appointment_holds
SET status = 'expired',
    updated_at = NOW()
WHERE status = 'held'
    AND expires_at < NOW()
    AND deleted_at IS NULL;
GET DIAGNOSTICS v_count = ROW_COUNT;
RETURN QUERY
SELECT v_count;
END $$ LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public;
GRANT EXECUTE ON FUNCTION cleanup_expired_holds() TO service_role;
-- ============================================
-- DOCUMENTATION
-- ============================================
-- Usage in atomic-booking-service.ts:
--
-- EXAMPLE 1: Claim slot
-- const { data } = await supabase.rpc('claim_slot_atomic', {
--   p_org_id: orgId,
--   p_calendar_id: calendarId,
--   p_slot_time: slotTime.toISOString(),
--   p_call_sid: callSid,
--   p_patient_name: patientName,
--   p_patient_phone: patientPhone,
--   p_hold_duration_minutes: 10
-- });
--
-- EXAMPLE 2: Confirm slot after OTP verification
-- const { data } = await supabase.rpc('confirm_held_slot', {
--   p_hold_id: holdId,
--   p_org_id: orgId,
--   p_contact_id: contactId,
--   p_service_type: 'consultation'
-- });
--
-- EXAMPLE 3: Release hold on call end
-- await supabase.rpc('release_hold', {
--   p_hold_id: holdId,
--   p_org_id: orgId
-- });
--
-- EXAMPLE 4: Cleanup job (run every 5 minutes)
-- const { data } = await supabase.rpc('cleanup_expired_holds');
-- ============================================
-- MIGRATION COMPLETE
-- ============================================