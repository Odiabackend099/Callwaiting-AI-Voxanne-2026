-- ============================================
-- HYBRID TELEPHONY - Phase 1.2: Forwarding Configurations
-- Date: 2026-01-26
-- Purpose: Store GSM call forwarding configurations for verified numbers
--
-- TABLE CREATED:
--   hybrid_forwarding_configs: Stores forwarding preferences (Type A/B)
--
-- FEATURES:
--   - Two forwarding types: total_ai (unconditional) & safety_net (conditional)
--   - Carrier-specific code generation
--   - Ring time configuration (for conditional forwarding)
--   - Setup confirmation tracking
--   - Multi-tenant isolation via RLS
-- ============================================

-- ===== hybrid_forwarding_configs Table =====
-- Stores user's call forwarding configuration for their verified phone numbers
CREATE TABLE IF NOT EXISTS hybrid_forwarding_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Reference to the verified caller ID
    verified_caller_id UUID NOT NULL REFERENCES verified_caller_ids(id) ON DELETE CASCADE,

    -- User's physical SIM phone number (E.164)
    -- This is the number they want to forward FROM
    sim_phone_number TEXT NOT NULL,

    -- Forwarding type:
    --   'total_ai' (Type A): All calls go to AI immediately (unconditional)
    --   'safety_net' (Type B): AI answers only missed/busy calls (conditional)
    forwarding_type TEXT NOT NULL CHECK (
        forwarding_type IN ('total_ai', 'safety_net')
    ),

    -- Carrier information (affects GSM code generation)
    carrier TEXT NOT NULL CHECK (
        carrier IN ('att', 'tmobile', 'verizon', 'sprint', 'other_gsm', 'other_cdma', 'international')
    ),
    carrier_country_code TEXT DEFAULT 'US',

    -- Twilio number to forward calls TO (destination for GSM codes)
    -- This is the org's Vapi-connected Twilio number
    twilio_forwarding_number TEXT NOT NULL,

    -- Ring time before forwarding (seconds) - only for 'safety_net' mode
    -- Valid range: 5-60 seconds (most carriers support 5-30)
    ring_time_seconds INTEGER DEFAULT 25,

    -- Generated GSM/CDMA codes (stored for user reference)
    generated_activation_code TEXT,
    generated_deactivation_code TEXT,

    -- Status tracking
    -- 'pending_setup': Config created, user hasn't dialed code yet
    -- 'active': User confirmed they dialed the activation code
    -- 'disabled': User deactivated forwarding
    status TEXT NOT NULL DEFAULT 'pending_setup' CHECK (
        status IN ('pending_setup', 'active', 'disabled')
    ),

    -- User confirmation that they've dialed the GSM code
    user_confirmed_setup BOOLEAN DEFAULT false,
    confirmed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_org_sim UNIQUE(org_id, sim_phone_number),
    CONSTRAINT valid_sim_phone_e164 CHECK (sim_phone_number ~ '^\+[1-9]\d{6,14}$'),
    CONSTRAINT valid_twilio_phone_e164 CHECK (twilio_forwarding_number ~ '^\+[1-9]\d{6,14}$'),
    CONSTRAINT valid_ring_time CHECK (ring_time_seconds >= 5 AND ring_time_seconds <= 60)
);

-- ===== Indexes =====
-- Primary lookup: org's active forwarding configs
CREATE INDEX idx_forwarding_configs_org_status
    ON hybrid_forwarding_configs(org_id, status)
    WHERE status = 'active';

-- Lookup by verified caller ID (for joining)
CREATE INDEX idx_forwarding_configs_verified_id
    ON hybrid_forwarding_configs(verified_caller_id);

-- SIM phone lookup (for checking existing configs)
CREATE INDEX idx_forwarding_configs_sim_phone
    ON hybrid_forwarding_configs(sim_phone_number);

-- Pending setups (for reminder notifications)
CREATE INDEX idx_forwarding_configs_pending
    ON hybrid_forwarding_configs(org_id, created_at)
    WHERE status = 'pending_setup';

-- ===== RLS Policies =====
ALTER TABLE hybrid_forwarding_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "forwarding_configs_org_policy" ON hybrid_forwarding_configs;
DROP POLICY IF EXISTS "forwarding_configs_service_role_bypass" ON hybrid_forwarding_configs;

-- Organization isolation policy
CREATE POLICY "forwarding_configs_org_policy"
    ON hybrid_forwarding_configs
    FOR ALL
    TO authenticated
    USING (
        org_id = (SELECT public.auth_org_id())
    )
    WITH CHECK (
        org_id = (SELECT public.auth_org_id())
    );

-- Service role bypass for backend operations
CREATE POLICY "forwarding_configs_service_role_bypass"
    ON hybrid_forwarding_configs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===== Immutability Trigger =====
-- Prevent org_id from being changed after creation
CREATE TRIGGER org_id_immutable_forwarding_configs
    BEFORE UPDATE ON hybrid_forwarding_configs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_org_id_change();

-- ===== Updated At Trigger =====
-- Auto-update updated_at timestamp on any modification
CREATE OR REPLACE FUNCTION update_forwarding_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER forwarding_configs_updated_at
    BEFORE UPDATE ON hybrid_forwarding_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_forwarding_configs_updated_at();

-- ===== Comments =====
COMMENT ON TABLE hybrid_forwarding_configs IS 'Stores GSM call forwarding configurations for hybrid telephony. Links verified caller IDs to forwarding destinations.';
COMMENT ON COLUMN hybrid_forwarding_configs.forwarding_type IS 'Type A (total_ai): All calls to AI. Type B (safety_net): AI answers missed/busy calls only.';
COMMENT ON COLUMN hybrid_forwarding_configs.carrier IS 'Mobile carrier affects GSM code syntax. att/tmobile use GSM codes, verizon uses CDMA codes.';
COMMENT ON COLUMN hybrid_forwarding_configs.ring_time_seconds IS 'Seconds to ring before forwarding (safety_net only). Most carriers support 5-30 seconds.';
COMMENT ON COLUMN hybrid_forwarding_configs.generated_activation_code IS 'GSM/CDMA code user dials to activate forwarding (e.g., **61*+1xxx*11*25#).';
COMMENT ON COLUMN hybrid_forwarding_configs.generated_deactivation_code IS 'GSM/CDMA code user dials to disable forwarding (e.g., ##61#).';
COMMENT ON COLUMN hybrid_forwarding_configs.user_confirmed_setup IS 'True when user confirms they successfully dialed the activation code.';

-- ============================================
-- CARRIER CODE REFERENCE (for documentation)
-- ============================================
-- Type A (Unconditional - All Calls):
--   T-Mobile:     **21*DEST#       (deactivate: ##21#)
--   AT&T:         *21*DEST#        (deactivate: #21#)
--   Verizon:      *72DEST          (deactivate: *73)
--
-- Type B (Conditional - Busy/No Answer):
--   T-Mobile:     **61*DEST*11*TIME#   (deactivate: ##61#)
--   AT&T:         *004*DEST*11*TIME#   (deactivate: ##004#)
--   Verizon:      *71DEST              (deactivate: *73)
--   Note: Verizon doesn't support ring time adjustment via MMI
-- ============================================

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After applying this migration, verify with:
--
-- -- Check table exists
-- \dt hybrid_forwarding_configs
--
-- -- Check RLS is enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename = 'hybrid_forwarding_configs';
--
-- -- Check policies exist
-- SELECT tablename, policyname
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'hybrid_forwarding_configs'
-- ORDER BY policyname;
--
-- -- Check indexes exist
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'hybrid_forwarding_configs';
--
-- -- Check foreign key to verified_caller_ids works
-- SELECT conname, conrelid::regclass, confrelid::regclass
-- FROM pg_constraint
-- WHERE conname LIKE '%forwarding%';
-- ============================================
-- MIGRATION COMPLETE: hybrid_forwarding_configs
-- ============================================
