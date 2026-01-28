-- Migration: Telephony Infrastructure Improvements (Post Senior Engineer Review)
-- Purpose: Add JSONB validation, GIN indexes, and additional constraints
-- Date: 2026-01-30
-- Related: Global Hybrid Telephony Infrastructure

-- ============================================
-- 1. Add JSONB Schema Validation
-- ============================================

-- Validate carrier_codes JSONB structure to prevent malformed data
ALTER TABLE carrier_forwarding_rules
ADD CONSTRAINT valid_carrier_codes_structure
CHECK (
  jsonb_typeof(carrier_codes) = 'object' AND
  carrier_codes ? 'total_ai' OR
  carrier_codes ? 'safety_net'
);

-- Add comment explaining constraint
COMMENT ON CONSTRAINT valid_carrier_codes_structure
ON carrier_forwarding_rules IS 'Ensures carrier_codes JSONB has valid structure with at least one forwarding type';

-- ============================================
-- 2. Add GIN Index for JSONB Query Performance
-- ============================================

-- Enable fast queries on carrier_codes JSONB field
-- This allows efficient lookups like: WHERE carrier_codes ? 'glo'
CREATE INDEX IF NOT EXISTS idx_carrier_forwarding_rules_codes
ON carrier_forwarding_rules USING GIN (carrier_codes);

COMMENT ON INDEX idx_carrier_forwarding_rules_codes IS 'GIN index for fast JSONB queries on carrier codes';

-- ============================================
-- 3. Add Index for Organizations Telephony Queries
-- ============================================

-- Composite index for common query pattern: filter by country and check if provisioned
CREATE INDEX IF NOT EXISTS idx_organizations_telephony_provisioned
ON organizations(telephony_country, assigned_twilio_number)
WHERE assigned_twilio_number IS NOT NULL AND telephony_country IS NOT NULL;

COMMENT ON INDEX idx_organizations_telephony_provisioned IS 'Optimizes queries for provisioned telephony configurations';

-- ============================================
-- 4. Add Updated_At Trigger for Optimistic Locking
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at column to organizations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE organizations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create trigger for organizations table
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Add Validation for Country Code Format
-- ============================================

-- Ensure country codes are always uppercase 2-letter ISO codes
ALTER TABLE carrier_forwarding_rules
ADD CONSTRAINT valid_country_code_format
CHECK (country_code ~ '^[A-Z]{2}$');

ALTER TABLE organizations
ADD CONSTRAINT valid_telephony_country_format
CHECK (telephony_country IS NULL OR telephony_country ~ '^[A-Z]{2}$');

-- ============================================
-- 6. Add Check Constraint for E.164 Phone Numbers
-- ============================================

-- Validate assigned_twilio_number follows E.164 format
ALTER TABLE organizations
ADD CONSTRAINT valid_twilio_number_format
CHECK (
  assigned_twilio_number IS NULL OR
  assigned_twilio_number ~ '^\+[1-9]\d{1,14}$'
);

COMMENT ON CONSTRAINT valid_twilio_number_format
ON organizations IS 'Ensures assigned Twilio numbers follow E.164 format (+1234567890)';

-- ============================================
-- 7. Create Audit Log for Country Changes
-- ============================================

-- Track all telephony country changes for debugging
CREATE TABLE IF NOT EXISTS telephony_country_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  old_country TEXT,
  new_country TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- Index for querying org's country change history
CREATE INDEX IF NOT EXISTS idx_telephony_audit_org_id
ON telephony_country_audit_log(org_id, changed_at DESC);

-- Enable RLS
ALTER TABLE telephony_country_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Orgs can view their own audit logs
CREATE POLICY telephony_audit_org_read ON telephony_country_audit_log
  FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

-- RLS Policy: Service role can insert
CREATE POLICY telephony_audit_service_write ON telephony_country_audit_log
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE telephony_country_audit_log IS 'Audit trail for all telephony country selection changes';

-- ============================================
-- Verification Queries (Commented)
-- ============================================

-- Verify GIN index exists
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'carrier_forwarding_rules'
-- AND indexname = 'idx_carrier_forwarding_rules_codes';

-- Verify constraints
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'carrier_forwarding_rules'::regclass;

-- Test JSONB validation (should fail)
-- INSERT INTO carrier_forwarding_rules (country_code, country_name, recommended_twilio_country, carrier_codes)
-- VALUES ('XX', 'Test', 'US', '{"invalid": "structure"}'::jsonb);

-- Test E.164 validation (should fail)
-- UPDATE organizations SET assigned_twilio_number = '1234567890' WHERE id = 'some-uuid';
