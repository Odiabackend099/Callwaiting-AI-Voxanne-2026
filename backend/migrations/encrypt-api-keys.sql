-- Encryption Migration for API Keys
-- Encrypts sensitive API keys in the integrations table using pgcrypto
-- This migration adds encrypted columns and migrates data

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encrypted columns for storing secrets
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS config_encrypted BYTEA;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS encryption_key VARCHAR(255);

-- Create a function to encrypt config JSON
CREATE OR REPLACE FUNCTION encrypt_config(config JSONB, encryption_key TEXT)
RETURNS BYTEA AS $$
BEGIN
  -- Use pgp_sym_encrypt to encrypt the config JSON as text
  RETURN pgp_sym_encrypt(config::TEXT, encryption_key);
END;
$$ LANGUAGE plpgsql;

-- Create a function to decrypt config JSON
CREATE OR REPLACE FUNCTION decrypt_config(config_encrypted BYTEA, encryption_key TEXT)
RETURNS JSONB AS $$
BEGIN
  -- Decrypt and convert back to JSONB
  RETURN pgp_sym_decrypt(config_encrypted, encryption_key)::JSONB;
END;
$$ LANGUAGE plpgsql;

-- Migrate existing config data to encrypted column
-- Note: You'll need to set the encryption key via application on first use
DO $$
DECLARE
  encryption_key TEXT := COALESCE(current_setting('app.encryption_key', true), 'default-unsafe-key-change-me');
BEGIN
  UPDATE integrations
  SET config_encrypted = encrypt_config(config, encryption_key)
  WHERE config IS NOT NULL AND config_encrypted IS NULL;
END $$;

-- Create indexes for integrations
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_org_provider ON integrations(org_id, provider);

-- Add critical indexes for call_tracking queries (prevents N+1 and slow queries)
CREATE INDEX IF NOT EXISTS idx_call_tracking_lead_id ON call_tracking(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_tracking_called_at ON call_tracking(called_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_tracking_lead_outcome ON call_tracking(lead_id, call_outcome);
CREATE INDEX IF NOT EXISTS idx_call_tracking_agent_id ON call_tracking(agent_id);

-- Add indexes for leads queries
CREATE INDEX IF NOT EXISTS idx_leads_opted_out ON leads(opted_out);
CREATE INDEX IF NOT EXISTS idx_leads_org_created ON leads(org_id, created_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN integrations.config_encrypted IS 'Encrypted API configuration (JSONB encrypted with pgp_sym_encrypt)';
COMMENT ON FUNCTION encrypt_config(JSONB, TEXT) IS 'Encrypts a JSONB config object using a secret key';
COMMENT ON FUNCTION decrypt_config(BYTEA, TEXT) IS 'Decrypts a JSONB config object using a secret key';

-- Grant permissions (adjust role names as needed)
GRANT EXECUTE ON FUNCTION encrypt_config(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_config(BYTEA, TEXT) TO authenticated;

-- Alternative: Use Supabase Vault (recommended for production)
-- Uncomment the following section if using Supabase Vault

/*
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Store encryption keys in Supabase Vault
INSERT INTO vault.secrets (name, secret, description)
VALUES (
  'vapi_encryption_key',
  'your-secret-key-here',
  'Encryption key for Vapi API credentials'
)
ON CONFLICT (name) DO UPDATE
SET secret = EXCLUDED.secret;

-- Create encrypted storage for API keys
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS vapi_secret_vault_id UUID;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS twilio_secret_vault_id UUID;

-- Update auth policies if using Row Level Security
CREATE POLICY "Users can see their org integrations"
  ON integrations
  FOR SELECT
  USING (auth.uid()::TEXT = org_id OR org_id = 'default');
*/
