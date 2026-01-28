-- Migration: Add telephony country tracking to organizations
-- Purpose: Track which country each organization operates in for smart Twilio number provisioning
-- Date: 2026-01-30
-- Feature: Global Hybrid Telephony Infrastructure

-- Add telephony_country column (ISO 3166-1 alpha-2 country code)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS telephony_country TEXT DEFAULT 'US';

-- Add assigned_twilio_number column (E.164 format phone number)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS assigned_twilio_number TEXT;

-- Add forwarding_carrier column (carrier slug from carrier_forwarding_rules JSONB)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS forwarding_carrier TEXT;

-- Add comments for documentation
COMMENT ON COLUMN organizations.telephony_country IS 'ISO 3166-1 alpha-2 country code. Used for smart Twilio number provisioning. References carrier_forwarding_rules.country_code (soft reference).';
COMMENT ON COLUMN organizations.assigned_twilio_number IS 'The Twilio number assigned to this org for call forwarding (E.164 format, e.g., +15551234567). Provisioned dynamically based on telephony_country.';
COMMENT ON COLUMN organizations.forwarding_carrier IS 'User-selected carrier slug (e.g., glo, mtn, turkcell, vodafone, att, tmobile). Maps to keys in carrier_forwarding_rules.carrier_codes JSONB.';

-- Create index for provisioning queries
CREATE INDEX IF NOT EXISTS idx_organizations_telephony
ON organizations(telephony_country, assigned_twilio_number)
WHERE assigned_twilio_number IS NOT NULL;

-- Create index for carrier lookup
CREATE INDEX IF NOT EXISTS idx_organizations_carrier
ON organizations(forwarding_carrier)
WHERE forwarding_carrier IS NOT NULL;

-- Add constraint to ensure telephony_country is valid (optional, soft validation)
-- Note: We don't enforce foreign key to carrier_forwarding_rules to allow flexibility
-- If carrier_forwarding_rules is updated, organizations.telephony_country remains valid

-- Verification queries (commented out for production)
-- SELECT id, name, telephony_country, assigned_twilio_number, forwarding_carrier FROM organizations LIMIT 10;
-- SELECT telephony_country, COUNT(*) FROM organizations GROUP BY telephony_country;
