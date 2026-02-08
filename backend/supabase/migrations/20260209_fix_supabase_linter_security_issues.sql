-- ============================================================================
-- Migration: Fix Supabase Database Linter Security Issues
-- Date: 2026-02-09
-- Applied: 2026-02-08 via Supabase Management API
-- Purpose: Resolve all 3 categories of linter errors:
--   1. RLS Disabled in Public (8 tables → enable RLS or drop unused)
--   2. RLS References user_metadata (policies using insecure user_metadata)
--   3. Function Search Path Mutable (SECURITY DEFINER functions missing SET search_path)
--
-- Safety:
--   - All DROP POLICY use IF EXISTS guard
--   - All ALTER TABLE RLS is additive (ENABLE, not DISABLE)
--   - ALTER FUNCTION SET search_path does NOT modify function body
--   - Service_role bypass ensures all backend operations continue working
--   - Migration is idempotent (safe to run multiple times)
--
-- Schema corrections applied during execution:
--   - payment_events_log has user_id (not org_id) → service_role-only policy
--   - failed_recording_uploads, recording_upload_metrics, recording_downloads have no org_id
--     → service_role-only + RLS enabled
--   - call_logs_legacy had old policies named "call_logs_org_isolation"/"call_logs_org_insert"
--     (without "legacy" prefix) → dropped separately
--   - Functions record_call_usage, get_org_usage_summary, log_service_price_change,
--     handle_new_user_signup do not exist in live DB → removed
--   - log_auth_event has 2 overloads (inet and text for ip_address) → both fixed
--   - Additional functions found in live DB: complete_voice_session, log_agent_config_change
-- ============================================================================

-- ############################################################################
-- PHASE 1: RLS DISABLED IN PUBLIC
-- ############################################################################

-- ============================================================================
-- 1A: DROP orphaned backup tables (no code references, no RLS, just noise)
-- ============================================================================

DROP TABLE IF EXISTS knowledge_base_chunks_backup_20260128;
DROP TABLE IF EXISTS knowledge_base_chunks_backup_20260128_v2;
DROP TABLE IF EXISTS knowledge_base_chunks_backup_20260128_manual;

-- ============================================================================
-- 1B: Enable RLS + org_id policies on active tables with org_id column
-- ============================================================================

-- ----- bookings table (has org_id) -----
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_org_isolation" ON bookings;
CREATE POLICY "bookings_org_isolation"
  ON bookings
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS "bookings_org_insert" ON bookings;
CREATE POLICY "bookings_org_insert"
  ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS "bookings_org_update" ON bookings;
CREATE POLICY "bookings_org_update"
  ON bookings
  FOR UPDATE TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS "bookings_org_delete" ON bookings;
CREATE POLICY "bookings_org_delete"
  ON bookings
  FOR DELETE TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS "bookings_service_role_bypass" ON bookings;
CREATE POLICY "bookings_service_role_bypass"
  ON bookings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ----- payment_events_log table (has user_id, no org_id → service_role only) -----
ALTER TABLE payment_events_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_events_log_service_role_bypass" ON payment_events_log;
CREATE POLICY "payment_events_log_service_role_bypass"
  ON payment_events_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 1C: Enable RLS + service_role-only on system tables (no org_id column)
-- ============================================================================

-- ----- backup_verification_log table -----
ALTER TABLE backup_verification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backup_verification_log_service_role_only" ON backup_verification_log;
CREATE POLICY "backup_verification_log_service_role_only"
  ON backup_verification_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ----- orphaned_recordings table -----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orphaned_recordings') THEN
    ALTER TABLE orphaned_recordings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "orphaned_recordings_service_role_only" ON orphaned_recordings;
    CREATE POLICY "orphaned_recordings_service_role_only"
      ON orphaned_recordings
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ----- webhook_events table (may or may not exist) -----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'webhook_events') THEN
    ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "webhook_events_service_role_only" ON webhook_events;
    CREATE POLICY "webhook_events_service_role_only"
      ON webhook_events
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ----- failed_recording_uploads (no org_id → service_role only + enable RLS) -----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'failed_recording_uploads') THEN
    ALTER TABLE failed_recording_uploads ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "failed_uploads_service_role_only" ON failed_recording_uploads;
    CREATE POLICY "failed_uploads_service_role_only"
      ON failed_recording_uploads
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ----- recording_upload_metrics (no org_id → service_role only + enable RLS) -----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recording_upload_metrics') THEN
    ALTER TABLE recording_upload_metrics ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "recording_metrics_service_role_only" ON recording_upload_metrics;
    CREATE POLICY "recording_metrics_service_role_only"
      ON recording_upload_metrics
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ----- recording_downloads (no org_id → service_role only + enable RLS) -----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recording_downloads') THEN
    ALTER TABLE recording_downloads ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "recording_downloads_service_role_only" ON recording_downloads;
    CREATE POLICY "recording_downloads_service_role_only"
      ON recording_downloads
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-- ############################################################################
-- PHASE 2: FIX RLS POLICIES REFERENCING user_metadata
-- Drop old policies and recreate using (SELECT public.auth_org_id())
-- which reads from app_metadata (not user-editable)
-- ############################################################################

-- ============================================================================
-- 2A: knowledge_base
-- ============================================================================
DROP POLICY IF EXISTS "knowledge_base_org_isolation" ON knowledge_base;
DROP POLICY IF EXISTS "knowledge_base_org_insert" ON knowledge_base;

CREATE POLICY "knowledge_base_org_isolation"
  ON knowledge_base
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "knowledge_base_org_insert"
  ON knowledge_base
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- ============================================================================
-- 2B: recording_upload_queue
-- ============================================================================
DROP POLICY IF EXISTS "recording_queue_org_isolation" ON recording_upload_queue;
DROP POLICY IF EXISTS "recording_queue_org_insert" ON recording_upload_queue;
DROP POLICY IF EXISTS "Users can see their org recording queue" ON recording_upload_queue;

CREATE POLICY "recording_queue_org_isolation"
  ON recording_upload_queue
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "recording_queue_org_insert"
  ON recording_upload_queue
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- ============================================================================
-- 2C: inbound_agent_config
-- ============================================================================
DROP POLICY IF EXISTS "inbound_agent_config_org_isolation" ON inbound_agent_config;
DROP POLICY IF EXISTS "inbound_agent_config_org_insert" ON inbound_agent_config;

CREATE POLICY "inbound_agent_config_org_isolation"
  ON inbound_agent_config
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "inbound_agent_config_org_insert"
  ON inbound_agent_config
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- ============================================================================
-- 2D: leads
-- ============================================================================
DROP POLICY IF EXISTS "leads_org_isolation" ON leads;
DROP POLICY IF EXISTS "leads_org_insert" ON leads;

CREATE POLICY "leads_org_isolation"
  ON leads
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "leads_org_insert"
  ON leads
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- ============================================================================
-- 2E: call_logs_legacy
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'call_logs_legacy') THEN
    -- Drop old policies (both prefixed and unprefixed names)
    DROP POLICY IF EXISTS "call_logs_legacy_org_isolation" ON call_logs_legacy;
    DROP POLICY IF EXISTS "call_logs_legacy_org_insert" ON call_logs_legacy;
    DROP POLICY IF EXISTS "call_logs_org_isolation" ON call_logs_legacy;
    DROP POLICY IF EXISTS "call_logs_org_insert" ON call_logs_legacy;

    CREATE POLICY "call_logs_legacy_org_isolation"
      ON call_logs_legacy
      FOR SELECT TO authenticated
      USING (org_id = (SELECT public.auth_org_id()));

    CREATE POLICY "call_logs_legacy_org_insert"
      ON call_logs_legacy
      FOR INSERT TO authenticated
      WITH CHECK (org_id = (SELECT public.auth_org_id()));
  END IF;
END $$;

-- ============================================================================
-- 2F: agents
-- ============================================================================
DROP POLICY IF EXISTS "agents_org_isolation" ON agents;
DROP POLICY IF EXISTS "agents_org_insert" ON agents;

CREATE POLICY "agents_org_isolation"
  ON agents
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "agents_org_insert"
  ON agents
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- ============================================================================
-- 2G: integrations
-- ============================================================================
DROP POLICY IF EXISTS "integrations_org_insert" ON integrations;
DROP POLICY IF EXISTS "integrations_org_isolation" ON integrations;

CREATE POLICY "integrations_org_isolation"
  ON integrations
  FOR SELECT TO authenticated
  USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "integrations_org_insert"
  ON integrations
  FOR INSERT TO authenticated
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- ============================================================================
-- 2H: organizations (uses id = auth_org_id, not org_id)
-- ============================================================================
DROP POLICY IF EXISTS "organizations_own_org_only" ON organizations;

CREATE POLICY "organizations_own_org_only"
  ON organizations
  FOR SELECT TO authenticated
  USING (id = (SELECT public.auth_org_id()));


-- ############################################################################
-- PHASE 3: FIX FUNCTION SEARCH PATH
-- SET search_path = 'public' on all SECURITY DEFINER functions
-- This prevents search_path hijacking attacks
-- ALTER FUNCTION does NOT modify function body (safe, no logic changes)
--
-- Function signatures verified against live database (pg_proc query)
-- Functions that already had search_path: create_notification, handle_new_user_setup
-- Functions not present in live DB: record_call_usage, get_org_usage_summary,
--   log_service_price_change, handle_new_user_signup, mark_contact_for_deletion,
--   hard_delete_expired_records
-- ############################################################################

-- ============================================================================
-- 3A: Prepaid Credit Ledger (20260208_prepaid_credit_ledger.sql)
-- ============================================================================
ALTER FUNCTION public.deduct_call_credits(uuid, text, text, integer, integer, integer, jsonb, text)
  SET search_path = 'public';

ALTER FUNCTION public.add_wallet_credits(uuid, integer, text, text, text, text, text)
  SET search_path = 'public';

ALTER FUNCTION public.get_wallet_summary(uuid)
  SET search_path = 'public';

-- ============================================================================
-- 3B: Auth Sessions & Audit (20260128_create_auth_sessions_and_audit.sql)
-- log_auth_event has 2 overloads (inet vs text for ip_address)
-- ============================================================================
ALTER FUNCTION public.log_auth_event(uuid, uuid, text, inet, text, jsonb)
  SET search_path = 'public';

ALTER FUNCTION public.log_auth_event(uuid, uuid, text, text, text, jsonb)
  SET search_path = 'public';

ALTER FUNCTION public.cleanup_old_auth_audit_logs()
  SET search_path = 'public';

ALTER FUNCTION public.create_session(uuid, uuid, text, text, text, text, integer)
  SET search_path = 'public';

ALTER FUNCTION public.revoke_session(uuid)
  SET search_path = 'public';

ALTER FUNCTION public.revoke_all_sessions(uuid)
  SET search_path = 'public';

-- ============================================================================
-- 3C: Backup Verification (20260128_create_backup_verification_log.sql)
-- ============================================================================
ALTER FUNCTION public.get_latest_backup_verification()
  SET search_path = 'public';

ALTER FUNCTION public.get_backup_verification_history(integer)
  SET search_path = 'public';

ALTER FUNCTION public.cleanup_old_backup_verification_logs()
  SET search_path = 'public';

-- ============================================================================
-- 3D: Appointment Booking (20260127_appointment_booking_with_lock.sql)
-- ============================================================================
ALTER FUNCTION public.book_appointment_with_lock(uuid, uuid, timestamptz, integer, uuid, text, jsonb, bigint)
  SET search_path = 'public';

-- ============================================================================
-- 3E: Webhook Delivery Log (20260127_webhook_delivery_log.sql)
-- ============================================================================
ALTER FUNCTION public.cleanup_old_webhook_logs()
  SET search_path = 'public';

-- ============================================================================
-- 3F: Dashboard Stats (20260202_optimize_dashboard_stats.sql)
-- ============================================================================
ALTER FUNCTION public.get_dashboard_stats_optimized(uuid, text)
  SET search_path = 'public';

-- ============================================================================
-- 3G: SMS Delivery Log (20260201_create_sms_delivery_log.sql)
-- ============================================================================
ALTER FUNCTION public.get_sms_delivery_stats(uuid, integer)
  SET search_path = 'public';

ALTER FUNCTION public.get_dead_letter_sms(integer)
  SET search_path = 'public';

ALTER FUNCTION public.cleanup_old_sms_delivery_logs()
  SET search_path = 'public';

-- ============================================================================
-- 3H: Voice Session
-- ============================================================================
ALTER FUNCTION public.complete_voice_session(text, text)
  SET search_path = 'public';

-- ============================================================================
-- 3I: Agent Config Audit
-- ============================================================================
ALTER FUNCTION public.log_agent_config_change(uuid, uuid, text, jsonb, jsonb, text, text, text)
  SET search_path = 'public';

-- ============================================================================
-- 3J: Knowledge Base RAG (match_knowledge_chunks)
-- ============================================================================
ALTER FUNCTION public.match_knowledge_chunks(vector, double precision, integer, uuid)
  SET search_path = 'public';

-- ============================================================================
-- 3K: User Org Roles
-- ============================================================================
ALTER FUNCTION public.get_user_role(uuid, uuid)
  SET search_path = 'public';

-- ============================================================================
-- 3L: Atomic Booking
-- ============================================================================
ALTER FUNCTION public.book_appointment_atomic(uuid, text, text, text, text, timestamptz, integer)
  SET search_path = 'public';

-- ============================================================================
-- 3M: Atomic Config Update
-- ============================================================================
ALTER FUNCTION public.update_agent_and_integrations(
  uuid, uuid, text, text, text, text, integer, text, text, text, text, text, text, timestamptz, text
) SET search_path = 'public';


-- ############################################################################
-- VERIFICATION QUERIES (run after migration to confirm fixes)
-- ############################################################################

-- All 5 checks passed on 2026-02-08:
--
-- backup_tables_remaining: 0
-- tables_with_rls: 8
-- user_metadata_in_using: 0
-- user_metadata_in_with_check: 0
-- functions_missing_search_path: 0

-- 1. Verify backup tables dropped
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public' AND tablename LIKE 'knowledge_base_chunks_backup%';
-- Expected: 0 rows

-- 2. Verify RLS enabled on all previously-flagged tables
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('bookings','payment_events_log','backup_verification_log',
--                      'orphaned_recordings','webhook_events',
--                      'failed_recording_uploads','recording_upload_metrics','recording_downloads');
-- Expected: All show rowsecurity = true

-- 3. Verify no policies reference user_metadata (both USING and WITH CHECK)
-- SELECT schemaname, tablename, policyname
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (qual::text LIKE '%user_metadata%' OR with_check::text LIKE '%user_metadata%');
-- Expected: 0 rows

-- 4. Verify all SECURITY DEFINER functions have search_path set
-- SELECT p.proname
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public' AND p.prosecdef = true
--   AND (p.proconfig IS NULL
--        OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'));
-- Expected: 0 rows

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
