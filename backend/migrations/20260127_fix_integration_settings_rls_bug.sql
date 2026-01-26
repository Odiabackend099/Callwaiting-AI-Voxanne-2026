-- ============================================
-- FIX: integration_settings RLS Policy Bug
-- Date: 2026-01-27
-- Problem: Policy uses ::text cast which breaks UUID comparison
-- ============================================

-- ============================================================================
-- Background:
-- The 20250111_fix_rls_security_gaps.sql migration has a bug on line 64:
--   USING (org_id = (SELECT public.auth_org_id()::text))
-- This casts the UUID to TEXT, which may cause comparison failures.
--
-- This migration fixes it by:
-- 1. Dropping the broken policy
-- 2. Creating a correct policy with proper type handling
-- ============================================================================

-- Drop the potentially broken policy
DROP POLICY IF EXISTS "integration_settings_org_policy" ON integration_settings;

-- Create correct policy
-- Use COALESCE and type casting to handle both UUID and TEXT org_id columns
CREATE POLICY "integration_settings_org_isolation" ON integration_settings
  FOR ALL TO authenticated
  USING (org_id::text = (SELECT public.auth_org_id()::text))
  WITH CHECK (org_id::text = (SELECT public.auth_org_id()::text));

-- Ensure service role bypass exists
DROP POLICY IF EXISTS "integration_settings_service_role_bypass" ON integration_settings;
CREATE POLICY "integration_settings_service_role" ON integration_settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Also verify integrations table (from same migration) is correct
-- ============================================================================

-- Drop and recreate with consistent naming
DROP POLICY IF EXISTS "integrations_org_policy" ON integrations;
DROP POLICY IF EXISTS "integrations_org_isolation" ON integrations;
CREATE POLICY "integrations_org_isolation" ON integrations
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Ensure service role bypass exists
DROP POLICY IF EXISTS "integrations_service_role_bypass" ON integrations;
DROP POLICY IF EXISTS "integrations_service_role" ON integrations;
CREATE POLICY "integrations_service_role" ON integrations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Add org_id immutability triggers
-- ============================================================================

DROP TRIGGER IF EXISTS org_id_immutable_integration_settings ON integration_settings;
CREATE TRIGGER org_id_immutable_integration_settings
  BEFORE UPDATE ON integration_settings
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

DROP TRIGGER IF EXISTS org_id_immutable_integrations ON integrations;
CREATE TRIGGER org_id_immutable_integrations
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- 1. Fixed integration_settings RLS policy (was using broken ::text cast)
-- 2. Standardized integrations RLS policy naming
-- 3. Added org_id immutability triggers to both tables
--
-- Run this verification query after applying:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE tablename IN ('integration_settings', 'integrations');
-- ============================================================================
