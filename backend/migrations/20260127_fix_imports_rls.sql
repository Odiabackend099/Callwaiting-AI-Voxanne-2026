-- ============================================
-- CRITICAL SECURITY FIX: Import Tables RLS
-- Fixes multi-tenant data isolation for CSV imports
-- Date: 2026-01-27
-- Risk Level: HIGH - Import jobs contain lead data
-- ============================================

-- ============================================================================
-- STEP 1: Enable RLS on imports table (already has org_id)
-- ============================================================================

ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create RLS policies for imports
-- ============================================================================

DROP POLICY IF EXISTS imports_org_isolation ON imports;
CREATE POLICY imports_org_isolation ON imports
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS imports_service_role ON imports;
CREATE POLICY imports_service_role ON imports
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 3: Add org_id to import_errors (denormalized for RLS performance)
-- ============================================================================

-- Add org_id column to import_errors
ALTER TABLE import_errors ADD COLUMN IF NOT EXISTS org_id UUID;

-- Populate from imports table
UPDATE import_errors ie
SET org_id = i.org_id
FROM imports i
WHERE ie.import_id = i.id
AND ie.org_id IS NULL;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'import_errors_org_id_fkey'
  ) THEN
    ALTER TABLE import_errors
    ADD CONSTRAINT import_errors_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_import_errors_org_id ON import_errors(org_id);

-- ============================================================================
-- STEP 4: Enable RLS on import_errors
-- ============================================================================

ALTER TABLE import_errors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS policies for import_errors
-- ============================================================================

DROP POLICY IF EXISTS import_errors_org_isolation ON import_errors;
CREATE POLICY import_errors_org_isolation ON import_errors
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS import_errors_service_role ON import_errors;
CREATE POLICY import_errors_service_role ON import_errors
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 6: Add org_id immutability triggers
-- ============================================================================

DROP TRIGGER IF EXISTS org_id_immutable_imports ON imports;
CREATE TRIGGER org_id_immutable_imports
  BEFORE UPDATE ON imports
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

DROP TRIGGER IF EXISTS org_id_immutable_import_errors ON import_errors;
CREATE TRIGGER org_id_immutable_import_errors
  BEFORE UPDATE ON import_errors
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- 1. Enabled RLS on imports table
-- 2. Added org_id column to import_errors for direct RLS
-- 3. Created org_isolation policies using standard auth_org_id() pattern
-- 4. Created service_role bypass policies for backend operations
-- 5. Added org_id immutability triggers
--
-- Run this verification query after applying:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE tablename IN ('imports', 'import_errors');
-- ============================================================================
