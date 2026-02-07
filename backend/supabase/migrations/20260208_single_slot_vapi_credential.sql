-- ============================================
-- Single-Slot Telephony: Add vapi_credential_id to organizations
-- Enforces 1 Org = 1 Twilio Connection via saveTwilioCredential()
-- ============================================

-- Org-level SSOT for which Vapi credential ID the org uses
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS vapi_credential_id TEXT;

COMMENT ON COLUMN organizations.vapi_credential_id IS
  'Vapi credential UUID for this org Twilio connection. Set by saveTwilioCredential(). Nullable for orgs without Twilio.';

-- Index for quick lookup when syncing credentials
CREATE INDEX IF NOT EXISTS idx_organizations_vapi_credential
  ON organizations(vapi_credential_id) WHERE vapi_credential_id IS NOT NULL;
