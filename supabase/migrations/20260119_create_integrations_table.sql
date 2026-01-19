-- Migration: Create unified `integrations` table and migrate Twilio credentials
-- Generated: 2026-01-19
-- Purpose: Consolidate credential storage into a single `integrations` table (SSOT)
-- Note: integrations table already exists; this migration adapts it for credential encryption

BEGIN;

-- 1) Add encrypted_config column if missing (migration to SSOT encrypted credentials)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'integrations' AND column_name = 'encrypted_config'
    ) THEN
        ALTER TABLE integrations ADD COLUMN encrypted_config jsonb DEFAULT '{}'::jsonb;
    END IF;
END$$;

-- 2) Add encrypted flag if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'integrations' AND column_name = 'encrypted'
    ) THEN
        ALTER TABLE integrations ADD COLUMN encrypted boolean DEFAULT false;
    END IF;
END$$;

-- 3) Migrate Twilio credentials from customer_twilio_keys (if present)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'customer_twilio_keys') THEN
    INSERT INTO integrations (org_id, provider, encrypted_config, encrypted, created_at, updated_at)
    SELECT
      org_id,
      'TWILIO',
      jsonb_build_object(
        'accountSid', account_sid,
        'authToken', auth_token,
        'phoneNumber', phone_number,
        'phoneNumberId', phone_number_id
      )::jsonb,
      false,
      COALESCE(created_at, NOW()),
      NOW()
    FROM customer_twilio_keys
    ON CONFLICT (org_id, provider) DO UPDATE
      SET encrypted_config = EXCLUDED.encrypted_config,
          updated_at = NOW();
  END IF;
END$$;

-- 4) Rename old tables to deprecated_*
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'customer_twilio_keys') THEN
    ALTER TABLE customer_twilio_keys RENAME TO deprecated_customer_twilio_keys;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'google_oauth_keys') THEN
    ALTER TABLE google_oauth_keys RENAME TO deprecated_google_oauth_keys;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'vapi_org_keys') THEN
    ALTER TABLE vapi_org_keys RENAME TO deprecated_vapi_org_keys;
  END IF;
END$$;

-- 5) Ensure RLS is enabled
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- 6) Final validation: ensure Sara org has TWILIO credentials (if they existed before)
-- Note: If no customer_twilio_keys exist in the database, this check is skipped
DO $$
DECLARE
  sara_org uuid := '46cf2995-2bee-44e3-838b-24151486fe4e';
  exists_twilio boolean;
  had_any_twilio boolean;
BEGIN
  -- First check if there were any Twilio keys at all
  SELECT EXISTS (SELECT 1 FROM deprecated_customer_twilio_keys LIMIT 1) INTO had_any_twilio;
  
  IF had_any_twilio THEN
    SELECT EXISTS (
      SELECT 1 FROM integrations WHERE org_id = sara_org AND provider = 'TWILIO'
    ) INTO exists_twilio;

    IF NOT exists_twilio THEN
      RAISE EXCEPTION 'Migration ABORTED: TWILIO credentials existed but were not found for Sara org % in integrations after migration. Aborting to prevent outage.', sara_org;
    END IF;
  END IF;
END$$;

COMMIT;

-- Migration complete. NOTE: encrypted_config contains plaintext values until application-level encryption is run.
-- Run the follow-up Node.js script: backend/scripts/encrypt-integrations.ts to encrypt sensitive fields and set encrypted=true.

-- Example verification query:
-- SELECT org_id, provider, encrypted_config ->> 'phoneNumber' as phone FROM integrations WHERE provider = 'TWILIO' LIMIT 50;

