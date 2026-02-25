-- ============================================================================
-- Fix: Scope onboarding_events RLS to org
-- Migration: 20260225_fix_onboarding_rls.sql
--
-- Problem: Original migration 20260225_onboarding_wizard.sql used USING (true)
--          and WITH CHECK (true), allowing any authenticated user to read or
--          insert rows for any org_id — a cross-tenant data leak.
--
-- Fix: Drop the two permissive policies and recreate them using the codebase's
--      canonical RLS helper: (SELECT public.auth_org_id())
--      Pattern source: 20260209_fix_supabase_linter_security_issues.sql
-- ============================================================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "Users can insert own org onboarding events" ON onboarding_events;
DROP POLICY IF EXISTS "Users can view own org onboarding events" ON onboarding_events;

-- Recreate INSERT scoped to the authenticated user's org
CREATE POLICY "Users can insert own org onboarding events"
  ON onboarding_events FOR INSERT
  TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Recreate SELECT scoped to the authenticated user's org
CREATE POLICY "Users can view own org onboarding events"
  ON onboarding_events FOR SELECT
  TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));
