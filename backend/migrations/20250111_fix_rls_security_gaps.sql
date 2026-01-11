-- ============================================
-- TIER 1 - T1.1: Fix RLS Security Gaps
-- Date: 2025-01-11
-- Purpose: Fix critical RLS security issues in integrations, integration_settings, and recording_upload_queue
-- 
-- CRITICAL SECURITY FIXES:
--   1. recording_upload_queue: Uses auth.uid() instead of org_id (BROKEN)
--   2. integrations: NO RLS policies (API keys exposed)
--   3. integration_settings: NO RLS policies (credentials exposed)
-- ============================================
-- ===== FIX 1: recording_upload_queue RLS Policy =====
-- Current bug: USING (org_id = auth.uid() OR org_id IS NULL)
-- Problem: Compares org_id (UUID of org) with auth.uid() (UUID of user) - will never match!
-- Fix: Use public.auth_org_id() function to get user's org_id from JWT
DROP POLICY IF EXISTS "Users can see their org recording queue" ON recording_upload_queue;
CREATE POLICY "recording_upload_queue_org_policy" ON recording_upload_queue FOR ALL TO authenticated USING (
    org_id = (
        SELECT public.auth_org_id()
    )
) WITH CHECK (
    org_id = (
        SELECT public.auth_org_id()
    )
);
-- Service role bypass (preserve existing functionality)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'recording_upload_queue'
        AND policyname = 'recording_upload_queue_service_role_bypass'
) THEN CREATE POLICY "recording_upload_queue_service_role_bypass" ON recording_upload_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
END IF;
END $$;
-- ===== FIX 2: integrations Table RLS =====
-- Current: NO RLS policies (contains API keys!)
-- Fix: Add org_id-based RLS policies
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations_org_policy" ON integrations FOR ALL TO authenticated USING (
    org_id = (
        SELECT public.auth_org_id()
    )
) WITH CHECK (
    org_id = (
        SELECT public.auth_org_id()
    )
);
-- Service role bypass
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'integrations'
        AND policyname = 'integrations_service_role_bypass'
) THEN CREATE POLICY "integrations_service_role_bypass" ON integrations FOR ALL TO service_role USING (true) WITH CHECK (true);
END IF;
END $$;
-- ===== FIX 3: integration_settings Table RLS =====
-- Current: NO RLS policies (contains encrypted credentials!)
-- Fix: Add org_id-based RLS policies
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integration_settings_org_policy" ON integration_settings FOR ALL TO authenticated USING (
    org_id = (
        SELECT public.auth_org_id()::text
    )
) WITH CHECK (
    org_id = (
        SELECT public.auth_org_id()::text
    )
);
-- Service role bypass
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'integration_settings'
        AND policyname = 'integration_settings_service_role_bypass'
) THEN CREATE POLICY "integration_settings_service_role_bypass" ON integration_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
END IF;
END $$;
-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After applying this migration, verify with:
--
-- -- Check RLS is enabled
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('recording_upload_queue', 'integrations', 'integration_settings');
--
-- -- Check all policies exist
-- SELECT tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('recording_upload_queue', 'integrations', 'integration_settings')
-- ORDER BY tablename, policyname;
--
-- -- Test cross-org isolation (should return empty)
-- SELECT * FROM integrations WHERE org_id != (SELECT public.auth_org_id());
-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next: Apply T1.2 (Escalation Rules Foundation)