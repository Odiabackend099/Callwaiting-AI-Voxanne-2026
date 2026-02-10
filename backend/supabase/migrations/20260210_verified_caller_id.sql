-- ============================================================
-- VERIFIED CALLER ID - Phase 1 Implementation
-- ============================================================
-- Date: 2026-02-10
-- Purpose: Allow users to verify their business phone number
--          for professional outbound caller ID
-- Revenue: $0 (brand enhancement, existing Twilio feature)
-- ============================================================

-- Create verified_caller_ids table
CREATE TABLE IF NOT EXISTS verified_caller_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'US',
  verification_code TEXT, -- 6-digit code for active verification (temporary)
  verification_sid TEXT, -- Twilio validation request SID
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, verified, failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT verified_caller_ids_status_check CHECK (status IN ('pending', 'verified', 'failed')),
  CONSTRAINT verified_caller_ids_unique_phone UNIQUE(org_id, phone_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_verified_caller_ids_org_id
  ON verified_caller_ids(org_id);

CREATE INDEX IF NOT EXISTS idx_verified_caller_ids_phone
  ON verified_caller_ids(phone_number);

CREATE INDEX IF NOT EXISTS idx_verified_caller_ids_status
  ON verified_caller_ids(status)
  WHERE status = 'verified'; -- Partial index for active verified numbers

-- Enable Row Level Security
ALTER TABLE verified_caller_ids ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own organization's verified numbers
CREATE POLICY "Users can view own verified numbers"
  ON verified_caller_ids
  FOR SELECT
  USING (
    org_id IN (
      SELECT (auth.jwt() -> 'app_metadata' ->> 'org_id')::UUID
    )
  );

-- RLS Policy: Users can insert verified numbers for their org
CREATE POLICY "Users can insert own verified numbers"
  ON verified_caller_ids
  FOR INSERT
  WITH CHECK (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::UUID
  );

-- RLS Policy: Users can update their own organization's verified numbers
CREATE POLICY "Users can update own verified numbers"
  ON verified_caller_ids
  FOR UPDATE
  USING (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::UUID
  )
  WITH CHECK (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::UUID
  );

-- RLS Policy: Users can delete their own organization's verified numbers
CREATE POLICY "Users can delete own verified numbers"
  ON verified_caller_ids
  FOR DELETE
  USING (
    org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::UUID
  );

-- Add comment for documentation
COMMENT ON TABLE verified_caller_ids IS 'Stores user-verified phone numbers for professional outbound caller ID via Twilio Caller ID verification';
COMMENT ON COLUMN verified_caller_ids.verification_code IS 'Temporary 6-digit code (cleared after verification)';
COMMENT ON COLUMN verified_caller_ids.verification_sid IS 'Twilio ValidationRequest SID for tracking';
COMMENT ON COLUMN verified_caller_ids.status IS 'Verification status: pending (awaiting code), verified (active), failed (invalid code)';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Table: verified_caller_ids
-- Indexes: 3 (org_id, phone_number, status partial)
-- RLS Policies: 4 (SELECT, INSERT, UPDATE, DELETE)
-- Multi-tenant: YES (org_id isolation via RLS)
-- ============================================================
