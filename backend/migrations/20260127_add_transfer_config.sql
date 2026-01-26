-- Phase 1: Add Transfer Configuration to integration_settings
-- This enables warm handoff functionality with department-specific routing

-- Add transfer configuration columns
ALTER TABLE integration_settings
ADD COLUMN IF NOT EXISTS transfer_phone_number TEXT,
ADD COLUMN IF NOT EXISTS transfer_sip_uri TEXT,
ADD COLUMN IF NOT EXISTS transfer_departments JSONB DEFAULT '{"general": null, "billing": null, "medical": null}'::jsonb;

-- Validate E.164 phone number format
ALTER TABLE integration_settings
ADD CONSTRAINT valid_transfer_phone CHECK (
  transfer_phone_number IS NULL
  OR transfer_phone_number ~ '^\+[1-9]\d{1,14}$'
);

-- Add documentation comments
COMMENT ON COLUMN integration_settings.transfer_phone_number IS 'Default warm transfer destination phone number (E.164 format, e.g., +15551234567)';
COMMENT ON COLUMN integration_settings.transfer_sip_uri IS 'Optional SIP URI for VoIP transfers with enhanced context (e.g., sip:agent@domain.com)';
COMMENT ON COLUMN integration_settings.transfer_departments IS 'Department-specific transfer numbers as JSON: {"general": "+15551234567", "billing": "+15559876543", "medical": "+15555555555"}';
