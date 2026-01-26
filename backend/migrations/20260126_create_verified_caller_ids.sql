-- ============================================
-- HYBRID TELEPHONY - Phase 1.1: Verified Caller IDs
-- Date: 2026-01-26
-- Purpose: Store phone numbers verified via Twilio OutgoingCallerId API
--
-- TABLE CREATED:
--   verified_caller_ids: Tracks phone number verification status for BYOC
--
-- FEATURES:
--   - Twilio validation integration
--   - Verification code hashing (security)
--   - Attempt tracking (max 3)
--   - Expiration handling (10 min TTL)
--   - Multi-tenant isolation via RLS
-- ============================================

-- ===== verified_caller_ids Table =====
-- Stores phone numbers that users have verified ownership of via Twilio validation call
CREATE TABLE IF NOT EXISTS verified_caller_ids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Phone number in E.164 format (+15551234567)
    phone_number TEXT NOT NULL,

    -- Friendly name for display
    friendly_name TEXT,

    -- Twilio OutgoingCallerId SID (once verified)
    twilio_caller_id_sid TEXT,

    -- Twilio validation call SID (during verification)
    twilio_call_sid TEXT,

    -- Verification status: pending, verified, failed, expired
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'verified', 'failed', 'expired')
    ),

    -- 6-digit verification code (hashed using bcrypt for security)
    verification_code_hash TEXT,
    verification_code_expires_at TIMESTAMPTZ,

    -- Number of verification attempts (max 3)
    verification_attempts INTEGER DEFAULT 0,

    -- Timestamps
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_org_phone UNIQUE(org_id, phone_number),
    CONSTRAINT valid_phone_e164 CHECK (phone_number ~ '^\+[1-9]\d{6,14}$'),
    CONSTRAINT max_verification_attempts CHECK (verification_attempts <= 5)
);

-- ===== Indexes =====
-- Primary lookup: org's verified numbers
CREATE INDEX idx_verified_caller_ids_org_status
    ON verified_caller_ids(org_id, status)
    WHERE status = 'verified';

-- Phone number lookup (for checking if already verified)
CREATE INDEX idx_verified_caller_ids_phone
    ON verified_caller_ids(phone_number);

-- Twilio SID lookup (for callback handling)
CREATE INDEX idx_verified_caller_ids_twilio_sid
    ON verified_caller_ids(twilio_caller_id_sid)
    WHERE twilio_caller_id_sid IS NOT NULL;

-- Pending verifications (for cleanup jobs)
CREATE INDEX idx_verified_caller_ids_pending
    ON verified_caller_ids(verification_code_expires_at)
    WHERE status = 'pending';

-- ===== RLS Policies =====
ALTER TABLE verified_caller_ids ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "verified_caller_ids_org_policy" ON verified_caller_ids;
DROP POLICY IF EXISTS "verified_caller_ids_service_role_bypass" ON verified_caller_ids;

-- Organization isolation policy
CREATE POLICY "verified_caller_ids_org_policy"
    ON verified_caller_ids
    FOR ALL
    TO authenticated
    USING (
        org_id = (SELECT public.auth_org_id())
    )
    WITH CHECK (
        org_id = (SELECT public.auth_org_id())
    );

-- Service role bypass for backend operations
CREATE POLICY "verified_caller_ids_service_role_bypass"
    ON verified_caller_ids
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===== Immutability Trigger =====
-- Prevent org_id from being changed after creation
CREATE TRIGGER org_id_immutable_verified_caller_ids
    BEFORE UPDATE ON verified_caller_ids
    FOR EACH ROW
    EXECUTE FUNCTION prevent_org_id_change();

-- ===== Updated At Trigger =====
-- Auto-update updated_at timestamp on any modification
CREATE OR REPLACE FUNCTION update_verified_caller_ids_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verified_caller_ids_updated_at
    BEFORE UPDATE ON verified_caller_ids
    FOR EACH ROW
    EXECUTE FUNCTION update_verified_caller_ids_updated_at();

-- ===== Comments =====
COMMENT ON TABLE verified_caller_ids IS 'Stores phone numbers verified via Twilio OutgoingCallerId API for hybrid telephony BYOC feature.';
COMMENT ON COLUMN verified_caller_ids.phone_number IS 'User phone number in E.164 format. Used as outbound caller ID after verification.';
COMMENT ON COLUMN verified_caller_ids.twilio_caller_id_sid IS 'Twilio OutgoingCallerId SID (PNxxxx) assigned after successful verification.';
COMMENT ON COLUMN verified_caller_ids.twilio_call_sid IS 'Twilio Call SID (CAxxxx) of the verification call.';
COMMENT ON COLUMN verified_caller_ids.status IS 'Verification status: pending (awaiting code), verified (complete), failed (max attempts), expired (timeout).';
COMMENT ON COLUMN verified_caller_ids.verification_code_hash IS 'Bcrypt hash of 6-digit verification code. Never store plain text.';
COMMENT ON COLUMN verified_caller_ids.verification_attempts IS 'Counter for failed code entry attempts. Locked after 5 attempts.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After applying this migration, verify with:
--
-- -- Check table exists
-- \dt verified_caller_ids
--
-- -- Check RLS is enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename = 'verified_caller_ids';
--
-- -- Check policies exist
-- SELECT tablename, policyname
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'verified_caller_ids'
-- ORDER BY policyname;
--
-- -- Check indexes exist
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'verified_caller_ids';
-- ============================================
-- MIGRATION COMPLETE: verified_caller_ids
-- ============================================
