-- Migration: Create inbound_agent_config table
-- Purpose: Store inbound agent configuration with Twilio/Vapi credentials
-- Date: 2025-12-18
-- Issue: Inbound agent config table missing, causing webhook failures
-- ============================================================================
-- 1. CREATE inbound_agent_config TABLE
-- ============================================================================
-- Mirrors outbound_agent_config schema for consistency
-- Stores credentials and config for inbound calls
CREATE TABLE IF NOT EXISTS inbound_agent_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
    -- Vapi credentials and assistant link
    vapi_api_key TEXT,
    vapi_assistant_id TEXT,
    -- Twilio credentials for inbound calls
    twilio_account_sid TEXT,
    twilio_auth_token TEXT,
    twilio_phone_number TEXT,
    -- Agent personality config
    system_prompt TEXT,
    first_message TEXT,
    voice_id TEXT DEFAULT 'Paige',
    language TEXT DEFAULT 'en-US',
    max_call_duration INTEGER DEFAULT 600,
    -- Status and sync tracking
    is_active BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure one config per organization
    UNIQUE(org_id)
);
-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_inbound_agent_config_org ON inbound_agent_config(org_id);
CREATE INDEX IF NOT EXISTS idx_inbound_agent_config_active ON inbound_agent_config(is_active);
CREATE INDEX IF NOT EXISTS idx_inbound_agent_config_phone ON inbound_agent_config(twilio_phone_number)
WHERE twilio_phone_number IS NOT NULL;
-- ============================================================================
-- 3. CREATE TRIGGER FOR updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_inbound_agent_config_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_inbound_agent_config_updated_at_trigger ON inbound_agent_config;
CREATE TRIGGER update_inbound_agent_config_updated_at_trigger BEFORE
UPDATE ON inbound_agent_config FOR EACH ROW EXECUTE FUNCTION update_inbound_agent_config_updated_at();
-- ============================================================================
-- 4. BACKFILL FROM EXISTING DATA
-- ============================================================================
-- Populate inbound_agent_config from integrations and agents tables
DO $$
DECLARE v_org_id UUID;
v_vapi_key TEXT;
v_twilio_sid TEXT;
v_twilio_token TEXT;
v_twilio_phone TEXT;
v_assistant_id TEXT;
v_system_prompt TEXT;
v_first_message TEXT;
v_voice TEXT;
v_language TEXT;
v_max_duration INTEGER;
BEGIN -- Loop through each organization
FOR v_org_id IN
SELECT DISTINCT org_id
FROM organizations LOOP -- Get Vapi API key from integrations
SELECT config->>'vapi_api_key' INTO v_vapi_key
FROM integrations
WHERE org_id = v_org_id
    AND provider = 'vapi'
LIMIT 1;
-- Get Twilio inbound credentials from integrations
SELECT config->>'accountSid',
    config->>'authToken',
    config->>'phoneNumber' INTO v_twilio_sid,
    v_twilio_token,
    v_twilio_phone
FROM integrations
WHERE org_id = v_org_id
    AND provider = 'twilio_inbound'
LIMIT 1;
-- Get inbound agent config from agents table
SELECT vapi_assistant_id,
    system_prompt,
    first_message,
    voice,
    language,
    max_call_duration INTO v_assistant_id,
    v_system_prompt,
    v_first_message,
    v_voice,
    v_language,
    v_max_duration
FROM agents
WHERE org_id = v_org_id
    AND role = 'inbound'
LIMIT 1;
-- Insert if we have at least some data
IF v_vapi_key IS NOT NULL
OR v_assistant_id IS NOT NULL THEN
INSERT INTO inbound_agent_config (
        org_id,
        vapi_api_key,
        vapi_assistant_id,
        twilio_account_sid,
        twilio_auth_token,
        twilio_phone_number,
        system_prompt,
        first_message,
        voice_id,
        language,
        max_call_duration,
        is_active,
        created_at,
        updated_at
    )
VALUES (
        v_org_id,
        v_vapi_key,
        v_assistant_id,
        v_twilio_sid,
        v_twilio_token,
        v_twilio_phone,
        v_system_prompt,
        v_first_message,
        COALESCE(v_voice, 'Paige'),
        COALESCE(v_language, 'en-US'),
        COALESCE(v_max_duration, 600),
        true,
        NOW(),
        NOW()
    ) ON CONFLICT (org_id) DO NOTHING;
END IF;
END LOOP;
END $$;
-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- 1. ✓ Created inbound_agent_config table
-- 2. ✓ Created indexes for performance
-- 3. ✓ Created updated_at trigger
-- 4. ✓ Backfilled from integrations and agents tables
--
-- Next steps:
-- - Update API keys save endpoint to populate this table
-- - Update webhook to load credentials from this table