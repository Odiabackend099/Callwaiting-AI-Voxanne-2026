-- ============================================
-- BYOC Credentials Schema Migration
-- ============================================
-- This migration consolidates BYOC credentials into a single source of truth
-- and creates a fast lookup table for Vapi webhook handlers
-- ============================================

-- Phase 1: Create unified org_credentials table
-- Single source of truth for all BYOC credentials across all providers
CREATE TABLE IF NOT EXISTS org_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('vapi', 'twilio', 'google_calendar', 'resend', 'elevenlabs')),

  -- Encrypted credentials (AES-256-GCM format: "iv:authTag:content")
  encrypted_config TEXT NOT NULL,

  -- Connection status and metadata
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  verification_error TEXT,

  -- Timestamp tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one credential set per org+provider combination
  UNIQUE(org_id, provider)
);

-- Performance indexes
CREATE INDEX idx_org_credentials_org_id ON org_credentials(org_id) WHERE is_active = true;
CREATE INDEX idx_org_credentials_provider ON org_credentials(provider) WHERE is_active = true;
CREATE INDEX idx_org_credentials_org_provider ON org_credentials(org_id, provider) WHERE is_active = true;

-- RLS Policies for org_credentials table
ALTER TABLE org_credentials ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users: can only see their own org's credentials
CREATE POLICY org_credentials_org_policy
  ON org_credentials
  FOR ALL
  TO authenticated
  USING (org_id = public.auth_org_id())
  WITH CHECK (org_id = public.auth_org_id());

-- Policy for service role: full access (for backend operations)
CREATE POLICY org_credentials_service_role_bypass
  ON org_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-update updated_at on modification
CREATE TRIGGER org_credentials_updated_at_trigger
  BEFORE UPDATE ON org_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- ============================================
-- Phase 2: Create assistant-to-org mapping table
-- Fast O(1) lookup for webhook handlers to resolve org_id from assistant_id
-- ============================================
CREATE TABLE IF NOT EXISTS assistant_org_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vapi_assistant_id TEXT NOT NULL UNIQUE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assistant_role TEXT CHECK (assistant_role IN ('inbound', 'outbound')),

  -- Metadata for debugging and audit trail
  assistant_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  -- Constraint to ensure unique mapping
  CONSTRAINT unique_assistant_id UNIQUE(vapi_assistant_id)
);

-- Performance indexes for webhook resolution
CREATE INDEX idx_assistant_org_mapping_assistant ON assistant_org_mapping(vapi_assistant_id);
CREATE INDEX idx_assistant_org_mapping_org ON assistant_org_mapping(org_id);
CREATE INDEX idx_assistant_org_mapping_last_used ON assistant_org_mapping(last_used_at DESC);

-- RLS Policies for assistant_org_mapping table
ALTER TABLE assistant_org_mapping ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users: can see their own org's mappings
CREATE POLICY assistant_org_mapping_org_policy
  ON assistant_org_mapping
  FOR SELECT
  TO authenticated
  USING (org_id = public.auth_org_id());

-- Policy for service role: full access (for webhook handlers and backend)
CREATE POLICY assistant_org_mapping_service_role_bypass
  ON assistant_org_mapping
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Phase 3: Migrate existing data
-- This section handles backwards compatibility during transition
-- ============================================

-- Step 3.1: Migrate Vapi credentials from integrations table
INSERT INTO org_credentials (org_id, provider, encrypted_config, is_active, last_verified_at, created_at, updated_at)
SELECT
  org_id,
  'vapi' as provider,
  COALESCE(config::TEXT, '{}') as encrypted_config,
  connected as is_active,
  last_checked_at as last_verified_at,
  created_at,
  updated_at
FROM integrations
WHERE provider = 'vapi' AND org_id IS NOT NULL
ON CONFLICT (org_id, provider) DO NOTHING;

-- Step 3.2: Migrate Twilio credentials from integration_settings table
-- Transform individual columns into encrypted JSON config
INSERT INTO org_credentials (org_id, provider, encrypted_config, is_active, last_verified_at, created_at, updated_at)
SELECT
  org_id,
  'twilio' as provider,
  -- Create a JSON structure from individual encrypted columns
  -- Note: This assumes the columns are already encrypted in integration_settings
  jsonb_build_object(
    'accountSid', twilio_account_sid,
    'authToken', twilio_auth_token,
    'phoneNumber', twilio_from_number,
    'testPhoneNumber', test_destination_number
  )::TEXT as encrypted_config,
  (twilio_account_sid IS NOT NULL AND twilio_auth_token IS NOT NULL) as is_active,
  last_verified_at,
  created_at,
  updated_at
FROM integration_settings
WHERE org_id IS NOT NULL
  AND (twilio_account_sid IS NOT NULL OR twilio_auth_token IS NOT NULL)
ON CONFLICT (org_id, provider) DO NOTHING;

-- Step 3.3: Migrate Vapi webhook secrets (if separate from API key in integration_settings)
-- This updates the existing Vapi entry with webhook secret if present
UPDATE org_credentials
SET encrypted_config =
  jsonb_set(
    encrypted_config::jsonb,
    '{webhookSecret}',
    to_jsonb(integration_settings.vapi_webhook_secret)
  )::TEXT
FROM integration_settings
WHERE org_credentials.org_id = integration_settings.org_id
  AND org_credentials.provider = 'vapi'
  AND integration_settings.vapi_webhook_secret IS NOT NULL;

-- Step 3.4: Migrate Google Calendar credentials from integrations table
INSERT INTO org_credentials (org_id, provider, encrypted_config, is_active, last_verified_at, created_at, updated_at)
SELECT
  org_id,
  'google_calendar' as provider,
  config::TEXT as encrypted_config,
  connected as is_active,
  last_checked_at as last_verified_at,
  created_at,
  updated_at
FROM integrations
WHERE provider = 'google_calendar' AND org_id IS NOT NULL
ON CONFLICT (org_id, provider) DO NOTHING;

-- Step 3.5: Populate assistant_org_mapping from agents table
INSERT INTO assistant_org_mapping (vapi_assistant_id, org_id, assistant_role, assistant_name, created_at)
SELECT
  vapi_assistant_id,
  org_id,
  role as assistant_role,
  name as assistant_name,
  created_at
FROM agents
WHERE vapi_assistant_id IS NOT NULL
  AND vapi_assistant_id != ''
  AND org_id IS NOT NULL
ON CONFLICT (vapi_assistant_id) DO UPDATE SET
  last_used_at = NOW();

-- ============================================
-- Phase 4: Create backward-compatibility views
-- These allow old code to continue working during migration
-- ============================================

-- View to provide legacy integrations table interface
CREATE OR REPLACE VIEW integrations_compat AS
SELECT
  id,
  org_id,
  provider,
  encrypted_config::JSONB as config,
  is_active as connected,
  last_verified_at as last_checked_at,
  created_at,
  updated_at
FROM org_credentials;

-- ============================================
-- Phase 5: Add new columns to agents table for better tracking
-- ============================================

-- Add version tracking column for optimistic locking
ALTER TABLE org_credentials ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Comment explaining the tables
COMMENT ON TABLE org_credentials IS 'Single source of truth for all BYOC credentials. Stores encrypted credentials with provider isolation.';
COMMENT ON TABLE assistant_org_mapping IS 'Maps Vapi assistant IDs to organization IDs for fast webhook handler resolution.';
COMMENT ON COLUMN org_credentials.encrypted_config IS 'Encrypted credential payload in format: iv:authTag:encryptedContent (hex-encoded)';
COMMENT ON COLUMN assistant_org_mapping.vapi_assistant_id IS 'Unique identifier for Vapi assistant used as primary lookup key for webhooks';

-- ============================================
-- Phase 6: Verification queries
-- Run these to verify migration success
-- ============================================

-- Count migrated credentials by provider
-- SELECT provider, COUNT(*) as count FROM org_credentials WHERE is_active = true GROUP BY provider;

-- Check for any missing org_id references
-- SELECT COUNT(*) as unmapped_assistants FROM assistant_org_mapping WHERE org_id IS NULL;

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('org_credentials', 'assistant_org_mapping');
