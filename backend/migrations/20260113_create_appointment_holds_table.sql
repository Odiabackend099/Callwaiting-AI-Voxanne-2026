-- ============================================
-- VOXANNE PHASE 1: Create Appointment Holds Table
-- Date: 2026-01-13
-- Purpose: Store temporary slot reservations during OTP verification
-- Context: Atomic booking system for race condition prevention
-- ============================================
--
-- HOLD LIFECYCLE:
--   held -> confirmed (OTP verified, appointment created)
--   held -> expired (timeout or patient hung up)
--   held -> requires_manual_followup (3 failed OTP attempts)
--
-- RLS STRATEGY:
--   - All org-scoped queries use: org_id = (SELECT public.auth_org_id())
--   - Service role has unrestricted access
--   - org_id is immutable (trigger prevents modification)
--
-- ============================================
-- ============================================
-- STEP 1: Create appointment_holds table
-- ============================================
CREATE TABLE IF NOT EXISTS appointment_holds (
    -- Primary key and organization
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    -- Slot reservation details
    calendar_id TEXT NOT NULL,
    -- Google Calendar ID
    slot_time TIMESTAMPTZ NOT NULL,
    -- Reserved time slot
    call_sid TEXT NOT NULL,
    -- Twilio call identifier
    -- Patient information
    patient_name TEXT,
    patient_phone TEXT,
    -- OTP verification
    otp_code TEXT,
    -- 4-digit verification code
    otp_sent_at TIMESTAMPTZ,
    verification_attempts INTEGER DEFAULT 0,
    -- Hold status and lifecycle
    status TEXT NOT NULL DEFAULT 'held',
    -- 'held', 'confirmed', 'expired', 'requires_manual_followup'
    expires_at TIMESTAMPTZ NOT NULL,
    -- Auto-calculated expiration time
    appointment_id UUID REFERENCES appointments(id) ON DELETE
    SET NULL,
        -- Timestamps
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ -- Soft delete support
);
-- Add comments explaining the table
COMMENT ON TABLE appointment_holds IS 'Stores temporary slot reservations during OTP verification. Prevents double-booking through atomic locking. Part of the atomic booking system for Voxanne Phase 1.';
COMMENT ON COLUMN appointment_holds.org_id IS 'Organization ID for multi-tenant isolation. IMMUTABLE - cannot be changed after creation.';
COMMENT ON COLUMN appointment_holds.slot_time IS 'The date and time of the reserved slot. Used for conflict detection.';
COMMENT ON COLUMN appointment_holds.expires_at IS 'Expiration timestamp for this hold. Typically created_at + 10 minutes. Holds are automatically cleaned up after expiration.';
COMMENT ON COLUMN appointment_holds.status IS 'Current status: held (active reservation), confirmed (appointment created), expired (timeout), requires_manual_followup (too many OTP failures).';
-- ============================================
-- STEP 2: Create indexes for performance
-- ============================================
-- Composite index for conflict detection (same org + slot + active status)
CREATE INDEX IF NOT EXISTS idx_appointment_holds_org_slot ON appointment_holds(org_id, slot_time, status)
WHERE deleted_at IS NULL
    AND status = 'held';
-- Index for cleanup job (find expired holds)
CREATE INDEX IF NOT EXISTS idx_appointment_holds_expires ON appointment_holds(expires_at)
WHERE deleted_at IS NULL
    AND status = 'held';
-- Index for call tracking
CREATE INDEX IF NOT EXISTS idx_appointment_holds_call_sid ON appointment_holds(call_sid)
WHERE deleted_at IS NULL;
-- ============================================
-- STEP 3: Create updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_appointment_holds_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_appointment_holds_updated_at ON appointment_holds;
CREATE TRIGGER update_appointment_holds_updated_at BEFORE
UPDATE ON appointment_holds FOR EACH ROW EXECUTE FUNCTION update_appointment_holds_updated_at();
-- ============================================
-- STEP 4: Enable RLS and create policies
-- ============================================
ALTER TABLE appointment_holds ENABLE ROW LEVEL SECURITY;
-- Policy: Authenticated users can SELECT holds from their org
CREATE POLICY "appointment_holds_select_org" ON appointment_holds FOR
SELECT TO authenticated USING (
        org_id = (
            SELECT public.auth_org_id()
        )
    );
-- Policy: Authenticated users can UPDATE holds in their org
CREATE POLICY "appointment_holds_update_org" ON appointment_holds FOR
UPDATE TO authenticated USING (
        org_id = (
            SELECT public.auth_org_id()
        )
    ) WITH CHECK (
        org_id = (
            SELECT public.auth_org_id()
        )
    );
-- Policy: Authenticated users can DELETE holds from their org
CREATE POLICY "appointment_holds_delete_org" ON appointment_holds FOR DELETE TO authenticated USING (
    org_id = (
        SELECT public.auth_org_id()
    )
);
-- Policy: Authenticated users can INSERT holds into their org
CREATE POLICY "appointment_holds_insert_org" ON appointment_holds FOR
INSERT TO authenticated WITH CHECK (
        org_id = (
            SELECT public.auth_org_id()
        )
    );
-- Policy: Service role bypass (no restrictions)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'appointment_holds'
        AND policyname = 'appointment_holds_service_role_bypass'
) THEN CREATE POLICY "appointment_holds_service_role_bypass" ON appointment_holds FOR ALL TO service_role USING (true) WITH CHECK (true);
END IF;
END $$;
-- ============================================
-- STEP 5: Add org_id immutability trigger
-- ============================================
DROP TRIGGER IF EXISTS org_id_immutable_appointment_holds ON appointment_holds;
CREATE TRIGGER org_id_immutable_appointment_holds BEFORE
UPDATE ON appointment_holds FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();
-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After deployment, verify with:
--
-- -- Check table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'appointment_holds'
-- ORDER BY ordinal_position;
--
-- -- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'appointment_holds';
--
-- -- Check RLS policies
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'appointment_holds';
-- ============================================
-- MIGRATION COMPLETE
-- ============================================