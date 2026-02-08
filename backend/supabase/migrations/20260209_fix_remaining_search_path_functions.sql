-- Migration: Fix Remaining function_search_path_mutable Linter Warnings
-- Date: 2026-02-09
-- Purpose: Set search_path on 32 remaining functions flagged by Supabase linter
-- Safety: ALTER FUNCTION SET search_path does NOT modify function body
-- All functions are SECURITY INVOKER (lower risk than DEFINER)

-- ============================================================
-- Group A: Trigger / updated_at functions (13)
-- ============================================================
ALTER FUNCTION public.update_user_org_roles_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_recording_status(p_call_id uuid, p_org_id uuid, p_status text, p_storage_path text) SET search_path = 'public';
ALTER FUNCTION public.update_appointments_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_escalation_rules_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_outbound_agent_config_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_verified_caller_ids_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_forwarding_configs_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_profiles_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_campaign_updated_at() SET search_path = 'public';
ALTER FUNCTION public.update_appointment_holds_updated_at() SET search_path = 'public';
ALTER FUNCTION public.set_updated_at() SET search_path = 'public';

-- ============================================================
-- Group B: Feature flags (4)
-- ============================================================
ALTER FUNCTION public.is_feature_enabled(p_org_id uuid, p_flag_key text) SET search_path = 'public';
ALTER FUNCTION public.update_feature_flag(p_flag_key text, p_enabled_globally boolean, p_rollout_percentage integer) SET search_path = 'public';
ALTER FUNCTION public.get_org_enabled_features(p_org_id uuid) SET search_path = 'public';
ALTER FUNCTION public.log_feature_flag_change() SET search_path = 'public';

-- ============================================================
-- Group C: Website routes (8)
-- ============================================================
ALTER FUNCTION public.calculate_lead_temperature(p_status text, p_intent text, p_duration integer, p_booked boolean) SET search_path = 'public';
ALTER FUNCTION public.validate_email(email text) SET search_path = 'public';
ALTER FUNCTION public.populate_conversation_id() SET search_path = 'public';
ALTER FUNCTION public.find_or_create_client(p_email text, p_name text, p_phone text, p_company text) SET search_path = 'public';
ALTER FUNCTION public.get_client_booking_count(p_client_email text) SET search_path = 'public';
ALTER FUNCTION public.normalize_phone(phone text) SET search_path = 'public';
ALTER FUNCTION public.get_contacts_paged(p_org_id uuid, p_limit integer, p_offset integer, p_lead_status text, p_search text) SET search_path = 'public';
ALTER FUNCTION public.get_service_price_by_keyword(p_org_id uuid, p_keyword text) SET search_path = 'public';

-- ============================================================
-- Group D: Calendly bookings (3)
-- ============================================================
ALTER FUNCTION public.generate_booking_id() SET search_path = 'public';
ALTER FUNCTION public.set_booking_id() SET search_path = 'public';
ALTER FUNCTION public.check_duplicate_booking(p_client_email text, p_booking_date date, p_booking_time text) SET search_path = 'public';

-- ============================================================
-- Group E: Other (4)
-- ============================================================
ALTER FUNCTION public.prevent_org_id_change() SET search_path = 'public';
ALTER FUNCTION public.expire_old_notifications() SET search_path = 'public';
ALTER FUNCTION public.get_cached_search(p_query_hash text) SET search_path = 'public';
ALTER FUNCTION public.auth_org_id() SET search_path = 'public';
