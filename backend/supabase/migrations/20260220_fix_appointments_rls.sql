-- ================================================
-- Fix Appointments Display Issue
-- ================================================
-- Date: 2026-02-20
-- Issue: TestSprite discovered appointments not visible in dashboard
-- Root Cause: Missing RLS SELECT policy on appointments table
-- Diagnostic Results:
--   - Database (service role): 1 appointment exists
--   - RLS query (user level): 0 appointments returned
--   - API endpoint: 0 appointments returned
-- Fix: Add SELECT policy allowing users to view own org's appointments
-- ================================================

-- Enable RLS on appointments table (if not already enabled)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policies if any (idempotent)
DROP POLICY IF EXISTS "Users can view own org appointments" ON appointments;
DROP POLICY IF EXISTS "Enable read access for users based on org_id" ON appointments;
DROP POLICY IF EXISTS "appointments_select_policy" ON appointments;

-- Create SELECT policy: Users can view appointments for their own organization
CREATE POLICY "Users can view own org appointments"
ON appointments
FOR SELECT
USING (
  org_id = (
    SELECT org_id
    FROM profiles
    WHERE id = auth.uid()
  )
);

-- Verify RLS policies exist (for manual verification)
-- Run this query after migration:
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'appointments' AND cmd = 'SELECT';

-- Expected output:
-- policyname                           | cmd    | qual
-- -------------------------------------|--------|------
-- Users can view own org appointments | SELECT | (org_id = ( SELECT profiles.org_id...))
