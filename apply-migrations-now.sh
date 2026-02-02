#!/bin/bash

# Supabase credentials
PROJECT_REF="lbjymlodxprzqgtyqtcq"
ACCESS_TOKEN="sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8"
DB_URL="postgresql://postgres:Eguale%402021%3F%5C@db.lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres"

echo "=== Applying Migration 1: view_actionable_leads ==="
curl -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE OR REPLACE VIEW view_actionable_leads AS SELECT c.id, c.org_id, c.phone, c.first_name, c.last_name, c.email, c.lead_status, c.lead_score, c.created_at, c.updated_at, c.last_contact_date, EXTRACT(DAY FROM (NOW() - c.last_contact_date)) as days_since_contact, CASE WHEN c.last_contact_date IS NULL THEN true WHEN EXTRACT(DAY FROM (NOW() - c.last_contact_date)) > 7 THEN true ELSE false END as follow_up_overdue FROM contacts c WHERE c.lead_status IN ('\''hot'\'', '\''warm'\'') AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.contact_id = c.id AND a.scheduled_at > NOW() AND a.scheduled_at < NOW() + INTERVAL '\''7 days'\'') ORDER BY c.lead_score DESC, c.last_contact_date ASC NULLS FIRST; ALTER VIEW view_actionable_leads SET (security_invoker = true);"
  }'

echo -e "\n\n=== Applying Migration 2: indexes ==="
curl -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_org_date_pagination ON calls(org_id, created_at DESC) WHERE created_at > NOW() - INTERVAL '\''90 days'\''; CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calls_direction_date ON calls(org_id, call_direction, created_at DESC) WHERE created_at > NOW() - INTERVAL '\''90 days'\'';"
  }'

echo -e "\n\n=== Applying Migration 3: RPC function ==="
curl -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE OR REPLACE FUNCTION get_dashboard_stats_optimized(p_org_id UUID, p_time_window TEXT DEFAULT '\''7d'\'') RETURNS TABLE(total_calls BIGINT, completed_calls BIGINT, calls_today BIGINT, inbound_calls BIGINT, outbound_calls BIGINT, avg_duration NUMERIC, pipeline_value NUMERIC) LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN QUERY SELECT COUNT(*)::BIGINT as total_calls, COUNT(CASE WHEN c.status = '\''completed'\'' THEN 1 END)::BIGINT as completed_calls, COUNT(CASE WHEN c.created_at >= CURRENT_DATE THEN 1 END)::BIGINT as calls_today, COUNT(CASE WHEN c.call_direction = '\''inbound'\'' THEN 1 END)::BIGINT as inbound_calls, COUNT(CASE WHEN c.call_direction = '\''outbound'\'' THEN 1 END)::BIGINT as outbound_calls, ROUND(AVG(COALESCE(c.duration_seconds, 0)))::NUMERIC as avg_duration, COALESCE((SELECT SUM(ct.estimated_value) FROM contacts ct WHERE ct.org_id = p_org_id AND ct.lead_status = '\''hot'\''), 0)::NUMERIC as pipeline_value FROM calls c WHERE c.org_id = p_org_id AND c.created_at >= CASE WHEN p_time_window = '\''24h'\'' THEN NOW() - INTERVAL '\''24 hours'\'' WHEN p_time_window = '\''7d'\'' THEN NOW() - INTERVAL '\''7 days'\'' WHEN p_time_window = '\''30d'\'' THEN NOW() - INTERVAL '\''30 days'\'' ELSE NOW() - INTERVAL '\''7 days'\'' END; END; $$;"
  }'

echo -e "\n\n=== Verifying migrations ==="
curl -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = '\''view_actionable_leads'\'') as view_ok, (SELECT COUNT(*) FROM pg_indexes WHERE indexname IN ('\''idx_calls_org_date_pagination'\'', '\''idx_calls_direction_date'\'')) as indexes_ok, EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = '\''get_dashboard_stats_optimized'\'') as function_ok;"
  }'

echo -e "\n\nDONE!"
