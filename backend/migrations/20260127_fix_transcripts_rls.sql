-- ============================================
-- CRITICAL SECURITY FIX: Call Transcripts RLS
-- Fixes multi-tenant data isolation for conversation transcripts
-- Date: 2026-01-27
-- Risk Level: CRITICAL - Contains full conversation text (potential PHI/PII)
-- ============================================

-- ============================================================================
-- STEP 1: Add org_id to call_transcripts
-- ============================================================================

ALTER TABLE call_transcripts ADD COLUMN IF NOT EXISTS org_id UUID;

-- Populate org_id from call_tracking table
-- Note: call_transcripts.call_id references call_tracking(id)
UPDATE call_transcripts ct
SET org_id = ctr.org_id
FROM call_tracking ctr
WHERE ct.call_id = ctr.id
AND ct.org_id IS NULL;

-- For any orphaned transcripts (call_tracking deleted), try call_logs
UPDATE call_transcripts ct
SET org_id = cl.org_id
FROM call_logs cl
WHERE ct.call_id::text = cl.vapi_call_id
AND ct.org_id IS NULL;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'call_transcripts_org_id_fkey'
  ) THEN
    ALTER TABLE call_transcripts
    ADD CONSTRAINT call_transcripts_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_transcripts_org_id ON call_transcripts(org_id);

-- ============================================================================
-- STEP 2: Enable RLS
-- ============================================================================

ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Create RLS policies
-- ============================================================================

DROP POLICY IF EXISTS call_transcripts_org_isolation ON call_transcripts;
CREATE POLICY call_transcripts_org_isolation ON call_transcripts
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS call_transcripts_service_role ON call_transcripts;
CREATE POLICY call_transcripts_service_role ON call_transcripts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 4: Add org_id immutability trigger
-- ============================================================================

DROP TRIGGER IF EXISTS org_id_immutable_call_transcripts ON call_transcripts;
CREATE TRIGGER org_id_immutable_call_transcripts
  BEFORE UPDATE ON call_transcripts
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- 1. Added org_id column to call_transcripts
-- 2. Populated from call_tracking and call_logs tables
-- 3. Enabled RLS with standard auth_org_id() pattern
-- 4. Added service_role bypass for backend operations
-- 5. Added org_id immutability trigger
--
-- Run this verification query after applying:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE tablename = 'call_transcripts';
--
-- CRITICAL: This table contains PHI/PII (conversation transcripts)
-- Ensure RLS is active before any production traffic!
-- ============================================================================
