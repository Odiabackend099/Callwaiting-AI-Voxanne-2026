-- Add integration_settings table to store Vapi/Twilio keys securely
-- Keys are encrypted at rest using Supabase's encryption
CREATE TABLE IF NOT EXISTS integration_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Vapi Configuration
  vapi_api_key TEXT,
  -- Encrypted
  vapi_webhook_secret TEXT,
  -- Encrypted
  -- Twilio Configuration
  twilio_account_sid TEXT,
  -- Encrypted
  twilio_auth_token TEXT,
  -- Encrypted
  twilio_from_number TEXT,
  -- E.164 format, not encrypted
  -- Test Configuration
  test_destination_number TEXT,
  -- E.164 format, not encrypted
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_verified_at TIMESTAMP WITH TIME ZONE,
  -- Ensure one row per org
  UNIQUE(org_id),
  CONSTRAINT valid_twilio_number CHECK (
    twilio_from_number IS NULL
    OR twilio_from_number ~ '^\+[1-9]\d{1,14}$'
  ),
  CONSTRAINT valid_test_number CHECK (
    test_destination_number IS NULL
    OR test_destination_number ~ '^\+[1-9]\d{1,14}$'
  )
);
-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_integration_settings_org_id ON integration_settings(org_id);
-- Add comment
COMMENT ON TABLE integration_settings IS 'Stores Vapi and Twilio API credentials for the founder console. Keys are encrypted at rest.';
COMMENT ON COLUMN integration_settings.vapi_api_key IS 'Vapi API key (encrypted). Used to create outbound calls and manage assistants.';
COMMENT ON COLUMN integration_settings.vapi_webhook_secret IS 'Vapi webhook secret (encrypted). Used to verify webhook signatures.';
COMMENT ON COLUMN integration_settings.twilio_account_sid IS 'Twilio Account SID (encrypted). Used to authenticate with Twilio API.';
COMMENT ON COLUMN integration_settings.twilio_auth_token IS 'Twilio Auth Token (encrypted). Used to authenticate with Twilio API.';