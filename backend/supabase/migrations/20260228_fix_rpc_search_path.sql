-- Migration: Fix Missing SET search_path on SECURITY DEFINER Functions
-- Date: 2026-02-28
-- Purpose: Patch 15 functions created Feb 8–20 that were missed by the prior
--          bulk fix in 20260209_fix_remaining_search_path_functions.sql.
-- Safety: ALTER FUNCTION SET search_path does NOT modify the function body.
--         It is idempotent — safe to re-run if already applied.
-- Risk:   ZERO. No function logic is changed. Only the security context.
-- Rollback: ALTER FUNCTION public.<name> RESET search_path;

-- ============================================================
-- Group A: Billing Functions (HIGHEST PRIORITY)
-- These gate wallet deductions and credits — most critical path.
-- ============================================================

-- Latest version from 20260212_fix_add_wallet_credits_direction.sql
ALTER FUNCTION public.add_wallet_credits(uuid, integer, text, text, text, text, text) SET search_path = 'public';

-- Latest version from 20260216_fix_rate_mismatch.sql (overrides 20260214)
ALTER FUNCTION public.commit_reserved_credits(text, integer) SET search_path = 'public';

-- ============================================================
-- Group B: Appointment Booking (HIGH PRIORITY)
-- Advisory lock function for race-condition-safe appointment booking.
-- ============================================================

ALTER FUNCTION public.reschedule_appointment_with_lock(uuid, uuid, timestamptz, integer) SET search_path = 'public';

-- ============================================================
-- Group C: Stripe Webhook Idempotency (MEDIUM PRIORITY)
-- Prevents replay attacks and duplicate credit grants.
-- ============================================================

ALTER FUNCTION public.is_stripe_event_processed(text) SET search_path = 'public';
ALTER FUNCTION public.mark_stripe_event_processed(text, text, uuid, jsonb) SET search_path = 'public';
ALTER FUNCTION public.cleanup_old_processed_stripe_webhooks() SET search_path = 'public';

-- ============================================================
-- Group D: Vapi Webhook Idempotency (MEDIUM PRIORITY)
-- Prevents duplicate webhook processing for voice call events.
-- ============================================================

ALTER FUNCTION public.is_vapi_event_processed(uuid, text) SET search_path = 'public';
ALTER FUNCTION public.mark_vapi_event_processed(uuid, text, text, jsonb) SET search_path = 'public';
ALTER FUNCTION public.cleanup_old_processed_webhook_events() SET search_path = 'public';

-- ============================================================
-- Group E: RLS Security Helpers (MEDIUM PRIORITY)
-- Used for automated RLS policy auditing and verification.
-- ============================================================

ALTER FUNCTION public.check_rls_enabled(text) SET search_path = 'public';
ALTER FUNCTION public.get_table_policies(text) SET search_path = 'public';
ALTER FUNCTION public.get_all_rls_policies() SET search_path = 'public';
ALTER FUNCTION public.count_rls_policies() SET search_path = 'public';

-- ============================================================
-- Group F: Cost Analytics (LOW PRIORITY)
-- NOTE: These functions were NOT present in production DB as of 2026-02-28.
-- Keeping here for documentation; skip if applying to a fresh environment.
-- ALTER FUNCTION public.get_cost_analytics(uuid, integer) SET search_path = 'public';
-- ALTER FUNCTION public.get_cost_trend(uuid, integer) SET search_path = 'public';
