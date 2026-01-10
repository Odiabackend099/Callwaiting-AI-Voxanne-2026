-- ============================================
-- VOXANNE PHASE 1 MVP: Create Contacts Table
-- Date: 2025-01-10
-- Purpose: Store contact information for leads and potential customers
-- Context: Foundation for appointment booking and outreach tracking
-- ============================================
--
-- CONTACT LIFECYCLE:
--   new -> contacted -> qualified -> booked -> converted
--   new -> contacted -> qualified -> booked -> lost
--
-- LEAD SCORING:
--   hot:  High conversion probability (score > 70)
--   warm: Medium conversion probability (score 40-70)
--   cold: Low conversion probability (score < 40)
--
-- RLS STRATEGY:
--   - All org-scoped queries use: org_id = (SELECT public.auth_org_id())
--   - Service role has unrestricted access
--   - org_id is immutable (trigger prevents modification)
--   - Phone UNIQUE constraint is org-scoped to prevent duplicates within org
--
-- ============================================

-- ============================================
-- STEP 1: Create enums for contacts
-- ============================================
DO $$
BEGIN
  -- Create lead_score enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_score_type') THEN
    CREATE TYPE lead_score_type AS ENUM ('hot', 'warm', 'cold');
  END IF;

  -- Create lead_status enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status_type') THEN
    CREATE TYPE lead_status_type AS ENUM (
      'new',
      'contacted',
      'qualified',
      'booked',
      'converted',
      'lost'
    );
  END IF;
END $$;

-- ============================================
-- STEP 2: Create contacts table
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  -- Primary key and organization
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Contact basic information
  name TEXT NOT NULL,                             -- Full name
  phone TEXT,                                     -- Phone number (optional for now)
  email TEXT,                                     -- Email address

  -- Service interests and lead qualification
  service_interests JSONB DEFAULT '[]'::jsonb,   -- Array of service types they're interested in
                                                  -- Example: ["botox", "filler", "skincare"]
  lead_score lead_score_type DEFAULT 'cold',    -- hot, warm, cold
  lead_status lead_status_type DEFAULT 'new',   -- Progression through sales pipeline

  -- Engagement tracking
  last_contact_at TIMESTAMPTZ,                   -- When we last communicated with them
  notes TEXT,                                     -- Internal notes about this contact

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment explaining the table
COMMENT ON TABLE contacts IS
'Stores contact information for leads and potential customers. Part of the outreach and appointment booking system. Each contact is org-scoped and immutable (org_id cannot change after creation).';

COMMENT ON COLUMN contacts.org_id IS
'Organization ID for multi-tenant isolation. IMMUTABLE - cannot be changed after creation. Enforced by prevent_org_id_change trigger.';

COMMENT ON COLUMN contacts.service_interests IS
'JSONB array of service types the contact is interested in. Example: ["botox", "filler", "skincare", "consultation"]. Used for personalized outreach.';

COMMENT ON COLUMN contacts.lead_score IS
'Qualification score: hot (>70), warm (40-70), cold (<40). Used to prioritize follow-up efforts.';

COMMENT ON COLUMN contacts.lead_status IS
'Current status in the sales pipeline: new, contacted, qualified, booked, converted, lost.';

COMMENT ON COLUMN contacts.last_contact_at IS
'Timestamp of the most recent contact (email, call, message). Used for campaign scheduling.';

-- ============================================
-- STEP 3: Create UNIQUE constraint for phone
-- ============================================
-- Ensure phone numbers are unique within an organization (no duplicates per org)
-- This prevents duplicate contact records for the same phone in the same org
ALTER TABLE contacts ADD CONSTRAINT uq_contacts_org_phone
UNIQUE (org_id, phone) WHERE phone IS NOT NULL;

-- ============================================
-- STEP 4: Create indexes for performance
-- ============================================
-- Composite index for org + status + updated_at (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_contacts_org_status_updated ON contacts(org_id, lead_status, updated_at DESC);

-- Composite index for phone lookup within org (idempotency checks)
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone ON contacts(org_id, phone)
WHERE phone IS NOT NULL;

-- Index for creation date (used for "New Contacts" reports)
CREATE INDEX IF NOT EXISTS idx_contacts_org_created ON contacts(org_id, created_at DESC);

-- Index for service interests search (JSONB)
CREATE INDEX IF NOT EXISTS idx_contacts_service_interests ON contacts USING GIN(service_interests);

-- Index for last contact tracking (used for follow-up scheduling)
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact ON contacts(last_contact_at DESC)
WHERE last_contact_at IS NOT NULL;

-- ============================================
-- STEP 5: Create updated_at trigger
-- ============================================
-- This trigger automatically updates the updated_at timestamp
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- ============================================
-- STEP 6: Enable RLS and create policies
-- ============================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can SELECT contacts from their org
CREATE POLICY "contacts_select_org"
ON contacts
FOR SELECT
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

-- Policy: Authenticated users can UPDATE contacts in their org
CREATE POLICY "contacts_update_org"
ON contacts
FOR UPDATE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()))
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Policy: Authenticated users can DELETE contacts from their org
CREATE POLICY "contacts_delete_org"
ON contacts
FOR DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

-- Policy: Authenticated users can INSERT contacts into their org
CREATE POLICY "contacts_insert_org"
ON contacts
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Policy: Service role bypass (no restrictions)
-- Service role should have full access for backend operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contacts'
      AND policyname = 'contacts_service_role_bypass'
  ) THEN
    CREATE POLICY "contacts_service_role_bypass"
    ON contacts
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- STEP 7: Add org_id immutability trigger
-- ============================================
-- This trigger prevents modification of org_id after creation
-- Uses the prevent_org_id_change() function created in earlier migration
DROP TRIGGER IF EXISTS org_id_immutable_contacts ON contacts;
CREATE TRIGGER org_id_immutable_contacts
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_org_id_change();

-- ============================================
-- ERROR HANDLING NOTES
-- ============================================
-- Possible migration issues and solutions:
--
-- 1. "ERROR: relation organizations does not exist"
--    Solution: Run 20250110_create_organizations_table_foundation.sql BEFORE this migration
--
-- 2. "ERROR: function prevent_org_id_change() does not exist"
--    Solution: Run 20250110_create_org_id_immutability_triggers.sql first
--
-- 3. "ERROR: function public.auth_org_id() does not exist"
--    Solution: Run 20250110_create_auth_org_id_function.sql first
--
-- 4. "ERROR: type 'lead_score_type' already exists"
--    Solution: This is safe - the DO block checks existence first
--
-- 5. "ERROR: duplicate key value violates unique constraint"
--    Solution: This happens if two contacts with same phone exist in an org
--               Data cleanup may be needed before applying this constraint
--
-- 6. RLS policy errors when testing
--    Solution: Ensure user has org_id in JWT app_metadata (run update-user-org-metadata.ts)

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After deployment, verify with:
--
-- -- Check table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'contacts'
-- ORDER BY ordinal_position;
--
-- -- Check UNIQUE constraint
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'contacts';
--
-- -- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'contacts';
--
-- -- Check RLS policies
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'contacts';
--
-- -- Test JSONB service_interests column
-- SELECT id, service_interests
-- FROM contacts
-- WHERE service_interests @> '["botox"]'::jsonb
-- LIMIT 1;

-- ============================================
-- ROLLBACK PLAN
-- ============================================
-- If this migration causes issues, rollback with:
--
-- DROP TRIGGER IF EXISTS org_id_immutable_contacts ON contacts;
-- DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
-- ALTER TABLE contacts DROP CONSTRAINT IF EXISTS uq_contacts_org_phone;
-- ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS contacts;
-- DROP TYPE IF EXISTS lead_score_type;
-- DROP TYPE IF EXISTS lead_status_type;
--
-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
--   1. Verify table structure and indexes
--   2. Test RLS policies with authenticated user
--   3. Test org_id immutability trigger
--   4. Test UNIQUE constraint (insert duplicate phone should fail)
--   5. Deploy to production
--
