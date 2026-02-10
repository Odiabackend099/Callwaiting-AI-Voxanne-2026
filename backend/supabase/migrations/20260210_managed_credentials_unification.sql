-- Migration: Unify Managed and BYOC Credentials Storage
-- Date: 2026-02-10
-- Purpose: Add is_managed column to org_credentials table to unify managed telephony
--          numbers with BYOC credentials, enabling agent config dropdown to show both types

-- ============================================================================
-- PHASE 1: Add is_managed Column
-- ============================================================================

-- Add is_managed flag to distinguish managed vs BYOC credentials
ALTER TABLE org_credentials
ADD COLUMN IF NOT EXISTS is_managed BOOLEAN DEFAULT false;

COMMENT ON COLUMN org_credentials.is_managed IS 'Indicates if this credential is managed by Voxanne (true) or BYOC (false)';

-- ============================================================================
-- PHASE 2: Create Indexes
-- ============================================================================

-- Index for fast queries filtering by managed status
CREATE INDEX IF NOT EXISTS idx_org_credentials_managed
ON org_credentials(org_id, provider, is_managed)
WHERE is_active = true;

COMMENT ON INDEX idx_org_credentials_managed IS 'Optimizes queries filtering active credentials by managed status';

-- ============================================================================
-- PHASE 3: Enforce One Managed Number Per Org
-- ============================================================================

-- Unique constraint: Only one active managed Twilio credential per org
-- This prevents users from provisioning multiple managed numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_credentials_one_managed_per_org
ON org_credentials(org_id, provider)
WHERE is_managed = true AND is_active = true AND provider = 'twilio';

COMMENT ON INDEX idx_org_credentials_one_managed_per_org IS 'Enforces business rule: one managed phone number per organization';

-- ============================================================================
-- PHASE 4: Update RLS Policies
-- ============================================================================

-- No RLS policy changes needed - existing policies already handle all rows

-- ============================================================================
-- PHASE 5: Data Validation
-- ============================================================================

-- Verify no existing data conflicts with new constraint
DO $$
DECLARE
  conflict_count INTEGER;
BEGIN
  -- Check for orgs with multiple managed credentials
  SELECT COUNT(*)
  INTO conflict_count
  FROM (
    SELECT org_id, provider
    FROM org_credentials
    WHERE is_managed = true
      AND is_active = true
      AND provider = 'twilio'
    GROUP BY org_id, provider
    HAVING COUNT(*) > 1
  ) conflicts;

  IF conflict_count > 0 THEN
    RAISE WARNING 'Found % organizations with multiple managed credentials. Manual resolution required.', conflict_count;
  ELSE
    RAISE NOTICE 'No conflicts found. Migration safe to proceed.';
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================

-- To rollback this migration:
--
-- 1. Drop the unique constraint:
--    DROP INDEX IF EXISTS idx_org_credentials_one_managed_per_org;
--
-- 2. Drop the query optimization index:
--    DROP INDEX IF EXISTS idx_org_credentials_managed;
--
-- 3. Remove the is_managed column:
--    ALTER TABLE org_credentials DROP COLUMN IF EXISTS is_managed;
--
-- 4. Delete managed entries from org_credentials (if needed):
--    DELETE FROM org_credentials
--    WHERE provider = 'twilio'
--      AND encrypted_config->>'managedByVoxanne' = 'true';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify migration applied correctly:
--
-- 1. Check column exists:
--    SELECT column_name, data_type, column_default
--    FROM information_schema.columns
--    WHERE table_name = 'org_credentials'
--      AND column_name = 'is_managed';
--
-- 2. Check indexes exist:
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE tablename = 'org_credentials'
--      AND indexname IN ('idx_org_credentials_managed', 'idx_org_credentials_one_managed_per_org');
--
-- 3. Check for conflicts:
--    SELECT org_id, COUNT(*)
--    FROM org_credentials
--    WHERE is_managed = true
--      AND is_active = true
--      AND provider = 'twilio'
--    GROUP BY org_id
--    HAVING COUNT(*) > 1;
