-- ============================================
-- WARDEN CRITICAL FIX: Create auth.org_id() Function
-- Date: 2025-01-10
-- Purpose: Enable RLS policies to extract org_id from JWT claims (SSOT)
-- Context: Zero-Trust Warden Phase 1 - Identity Architecture Fix
-- ============================================

-- STEP 1: Create auth.org_id() helper function
-- This function extracts org_id from JWT claims (app_metadata.org_id)
-- Returns NULL if org_id is missing (defensive; will trigger RLS denial)

-- CRITICAL FIX: Cannot create functions in 'auth' schema (reserved by Supabase)
-- Creating in 'public' schema instead, but naming it to match usage pattern
-- Returns UUID (matching org_id column type) instead of text
CREATE OR REPLACE FUNCTION public.auth_org_id() 
RETURNS uuid 
LANGUAGE sql 
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    NULLIF(
      ((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata')::jsonb ->> 'org_id'),
      ''
    )::uuid;
$$;

-- Alternative: Create wrapper function with alias-like name for compatibility
-- This allows RLS policies to use: (SELECT public.auth_org_id()) 
-- Which is functionally equivalent to auth.org_id() that we want

-- STEP 2: Grant execute permissions
-- authenticated: For RLS policies (users making API requests)
-- service_role: For background jobs that need to query with org context

GRANT EXECUTE ON FUNCTION public.auth_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_org_id() TO service_role;

-- STEP 3: Add comment for documentation
COMMENT ON FUNCTION public.auth_org_id() IS 
'Extracts org_id from JWT app_metadata. This is the Single Source of Truth (SSOT) for tenant identity in RLS policies. Returns NULL if org_id is missing (defensive). NOTE: Function is in public schema (not auth) because auth schema is reserved by Supabase.';

-- ============================================
-- VERIFICATION
-- ============================================
-- After deployment, test in Supabase SQL Editor (authenticated as a user):
-- 
-- SELECT auth.uid();  -- Should return your UUID
-- SELECT public.auth_org_id(); -- Should return your org_id from app_metadata
--
-- If auth.org_id() returns NULL:
--   1. Check that user's JWT contains app_metadata.org_id
--   2. Check that RLS policies use this function correctly
--   3. Verify function is granted to authenticated role
--
-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- This function enables RLS policies to use:
--   USING (org_id = (SELECT public.auth_org_id()))
--   WITH CHECK (org_id = (SELECT public.auth_org_id()))
--
-- This is the foundation for database-level tenant isolation (SSOT).
-- Next: Deploy org_id immutability triggers (migration: 20250110_create_org_id_immutability_triggers.sql)
