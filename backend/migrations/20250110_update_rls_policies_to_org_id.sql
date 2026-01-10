-- ============================================
-- WARDEN CRITICAL FIX: Update RLS Policies to Use org_id (SSOT)
-- Date: 2025-01-10
-- Purpose: Migrate RLS policies from user_id-based to org_id-based isolation
-- Context: Zero-Trust Warden Phase 1 - RLS Policy Update for SSOT
-- 
-- PREREQUISITES:
--   1. org_id columns exist on all tables (migration: 20250110_add_org_id_to_existing_tables.sql)
--   2. All data has org_id populated (migration: 20250110_backfill_org_id_from_user_id.sql)
--   3. NOT NULL constraints applied (migration: 20250110_add_org_id_not_null_constraints.sql)
--   4. public.auth_org_id() function exists (migration: 20250110_create_auth_org_id_function.sql)
--   5. All users have org_id in JWT app_metadata (script: update-user-org-metadata.ts)
--
-- NEXT STEPS:
--   1. Test cross-tenant isolation (integration tests)
--   2. Verify RLS policies work correctly
--   3. Monitor for any access issues
-- ============================================

-- ============================================
-- CRITICAL TABLES: Update RLS Policies to org_id
-- ============================================

-- ===== call_logs Table =====
-- Current: Uses `auth.role() = 'authenticated'` (too permissive, allows cross-tenant access)
-- New: Uses `org_id = (SELECT public.auth_org_id())` (enforces org-based isolation)

-- Drop old permissive policies
DROP POLICY IF EXISTS "Users can view all call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can insert call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can update call logs" ON call_logs;

-- Create new org_id-based policies
CREATE POLICY "call_logs_org_isolation"
ON call_logs
FOR SELECT, UPDATE, DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "call_logs_org_insert"
ON call_logs
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Service role bypass (preserve existing or create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'call_logs' 
      AND policyname = 'call_logs_service_role_bypass'
  ) THEN
    CREATE POLICY "call_logs_service_role_bypass"
    ON call_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ===== calls Table =====
-- Current: Only service role has access (needs authenticated user policy)
-- New: Add org_id-based policy for authenticated users

CREATE POLICY "calls_org_isolation"
ON calls
FOR SELECT, UPDATE, DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "calls_org_insert"
ON calls
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Service role bypass (preserve existing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'calls' 
      AND policyname = 'calls_service_role_bypass'
  ) THEN
    CREATE POLICY "calls_service_role_bypass"
    ON calls
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ===== campaigns Table =====
-- Current: Uses `user_id = auth.uid()` (user-based isolation)
-- New: Uses `org_id = (SELECT public.auth_org_id())` (org-based isolation)

-- Drop old user_id-based policies
DROP POLICY IF EXISTS "campaigns_select_own" ON campaigns;
DROP POLICY IF EXISTS "campaigns_insert_own" ON campaigns;
DROP POLICY IF EXISTS "campaigns_update_own" ON campaigns;
DROP POLICY IF EXISTS "campaigns_delete_own" ON campaigns;

-- Create new org_id-based policies
CREATE POLICY "campaigns_org_isolation"
ON campaigns
FOR SELECT, UPDATE, DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "campaigns_org_insert"
ON campaigns
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Service role bypass (preserve existing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'campaigns' 
      AND policyname = 'campaigns_service_role_bypass'
  ) THEN
    CREATE POLICY "campaigns_service_role_bypass"
    ON campaigns
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ===== contacts Table =====
-- Current: Uses `user_id = auth.uid()` (user-based isolation)
-- New: Uses `org_id = (SELECT public.auth_org_id())` (org-based isolation)

-- Drop old user_id-based policies (multiple variations exist)
DROP POLICY IF EXISTS "Users can create contacts for themselves" ON contacts;
DROP POLICY IF EXISTS "Users can manage their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_user" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_user" ON contacts;
DROP POLICY IF EXISTS "contacts_select_user" ON contacts;
DROP POLICY IF EXISTS "contacts_update_user" ON contacts;

-- Create new org_id-based policies
CREATE POLICY "contacts_org_isolation"
ON contacts
FOR SELECT, UPDATE, DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "contacts_org_insert"
ON contacts
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Service role bypass (preserve existing)
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

-- ===== knowledge_base Table =====
-- Current: Uses `user_id = auth.uid()` (user-based isolation)
-- New: Uses `org_id = (SELECT public.auth_org_id())` (org-based isolation)

-- Drop old user_id-based policies (multiple variations exist)
DROP POLICY IF EXISTS "knowledge_base_delete_own" ON knowledge_base;
DROP POLICY IF EXISTS "knowledge_base_delete_user" ON knowledge_base;
DROP POLICY IF EXISTS "knowledge_base_insert_own" ON knowledge_base;
DROP POLICY IF EXISTS "knowledge_base_insert_user" ON knowledge_base;
DROP POLICY IF EXISTS "knowledge_base_select_own" ON knowledge_base;
DROP POLICY IF EXISTS "knowledge_base_select_user" ON knowledge_base;
DROP POLICY IF EXISTS "knowledge_base_update_own" ON knowledge_base;
DROP POLICY IF EXISTS "knowledge_base_update_user" ON knowledge_base;

-- Create new org_id-based policies
CREATE POLICY "knowledge_base_org_isolation"
ON knowledge_base
FOR SELECT, UPDATE, DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "knowledge_base_org_insert"
ON knowledge_base
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Service role bypass (if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'knowledge_base' 
      AND policyname = 'knowledge_base_service_role_bypass'
  ) THEN
    CREATE POLICY "knowledge_base_service_role_bypass"
    ON knowledge_base
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ===== leads Table =====
-- Current: Uses `user_id = auth.uid()` (user-based isolation)
-- New: Uses `org_id = (SELECT public.auth_org_id())` (org-based isolation)

-- Drop old user_id-based policies
DROP POLICY IF EXISTS "leads_select_own_secure" ON leads;
DROP POLICY IF EXISTS "leads_insert_own_secure" ON leads;
DROP POLICY IF EXISTS "leads_update_own_secure" ON leads;
DROP POLICY IF EXISTS "leads_delete_own_secure" ON leads;

-- Create new org_id-based policies
CREATE POLICY "leads_org_isolation"
ON leads
FOR SELECT, UPDATE, DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "leads_org_insert"
ON leads
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Service role bypass (if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'leads' 
      AND policyname = 'leads_service_role_bypass'
  ) THEN
    CREATE POLICY "leads_service_role_bypass"
    ON leads
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ===== campaign_leads Table =====
-- Current: Uses `auth.role() = 'authenticated'` (too permissive, allows cross-tenant access)
-- New: Uses `org_id = (SELECT public.auth_org_id())` (enforces org-based isolation)

-- Drop old permissive policies
DROP POLICY IF EXISTS "Users can insert campaign leads" ON campaign_leads;
DROP POLICY IF EXISTS "Users can view campaign leads" ON campaign_leads;

-- Create new org_id-based policies
CREATE POLICY "campaign_leads_org_isolation"
ON campaign_leads
FOR SELECT, UPDATE, DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "campaign_leads_org_insert"
ON campaign_leads
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Service role bypass (if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'campaign_leads' 
      AND policyname = 'campaign_leads_service_role_bypass'
  ) THEN
    CREATE POLICY "campaign_leads_service_role_bypass"
    ON campaign_leads
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- SECONDARY TABLES: Update RLS Policies (If They Exist)
-- ============================================

-- knowledge_base_changelog (if it has RLS enabled)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'knowledge_base_changelog'
      AND rowsecurity = true
  ) THEN
    -- Drop old policies if they exist
    DROP POLICY IF EXISTS "knowledge_base_changelog_org_isolation" ON knowledge_base_changelog;
    
    -- Create new org_id-based policies
    CREATE POLICY "knowledge_base_changelog_org_isolation"
    ON knowledge_base_changelog
    FOR SELECT, UPDATE, DELETE
    TO authenticated
    USING (org_id = (SELECT public.auth_org_id()));

    CREATE POLICY "knowledge_base_changelog_org_insert"
    ON knowledge_base_changelog
    FOR INSERT
    TO authenticated
    WITH CHECK (org_id = (SELECT public.auth_org_id()));
  END IF;
END $$;

-- kb_sync_log (if it has RLS enabled)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'kb_sync_log'
      AND rowsecurity = true
  ) THEN
    DROP POLICY IF EXISTS "kb_sync_log_org_isolation" ON kb_sync_log;
    
    CREATE POLICY "kb_sync_log_org_isolation"
    ON kb_sync_log
    FOR SELECT, UPDATE, DELETE
    TO authenticated
    USING (org_id = (SELECT public.auth_org_id()));

    CREATE POLICY "kb_sync_log_org_insert"
    ON kb_sync_log
    FOR INSERT
    TO authenticated
    WITH CHECK (org_id = (SELECT public.auth_org_id()));
  END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After applying this migration, verify with:
--
-- -- Check all new policies exist
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   cmd as command,
--   qual as using_expression,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('call_logs', 'calls', 'campaigns', 'contacts', 'knowledge_base', 'leads', 'campaign_leads')
--   AND policyname LIKE '%org%'
-- ORDER BY tablename, policyname;
--
-- -- Test as authenticated user (should only see your org's data):
-- SELECT COUNT(*) FROM call_logs;  -- Should only return your org's call logs
-- SELECT COUNT(*) FROM campaigns;  -- Should only return your org's campaigns
-- SELECT COUNT(*) FROM leads;      -- Should only return your org's leads
--
-- -- Test cross-tenant access (should return empty):
-- SELECT * FROM call_logs WHERE org_id != (SELECT public.auth_org_id());
-- -- Should return empty (RLS blocks cross-tenant access)

-- ============================================
-- ROLLBACK PLAN
-- ============================================
-- If these policies cause issues, rollback with:
--
-- -- Restore old policies (example for call_logs):
-- CREATE POLICY "Users can view all call logs"
-- ON call_logs
-- FOR SELECT
-- TO authenticated
-- USING (auth.role() = 'authenticated');
--
-- -- Drop new org_id-based policies:
-- DROP POLICY IF EXISTS "call_logs_org_isolation" ON call_logs;
-- DROP POLICY IF EXISTS "call_logs_org_insert" ON call_logs;
-- -- ... (repeat for all tables)

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next: Test cross-tenant isolation (integration tests)
-- Then: Verify RLS policies work correctly
-- Finally: Monitor for any access issues
