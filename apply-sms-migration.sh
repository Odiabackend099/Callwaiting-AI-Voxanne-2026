#!/bin/bash
# Apply SMS Delivery Log Migration to Production

# USAGE:
# export DATABASE_URL='postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
# ./apply-sms-migration.sh

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set"
    echo ""
    echo "Get your connection string from Supabase:"
    echo "1. Go to: https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq/settings/database"
    echo "2. Copy 'Connection string' under 'Connection pooling'"
    echo "3. Replace [YOUR-PASSWORD] with your database password"
    echo ""
    echo "Then run:"
    echo "export DATABASE_URL='postgresql://postgres...'"
    echo "./apply-sms-migration.sh"
    exit 1
fi

echo "🔄 Applying SMS delivery log migration..."
echo ""

psql "$DATABASE_URL" <<'SQL'
-- Migration: SMS Delivery Log Table
-- Date: 2026-02-01

BEGIN;

-- Create sms_delivery_log table
CREATE TABLE IF NOT EXISTS sms_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL UNIQUE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('processing', 'delivered', 'failed', 'dead_letter')),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    delivery_time_ms INTEGER,
    twilio_sid TEXT,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sms_delivery_log_org_id ON sms_delivery_log(org_id);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_log_status ON sms_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_log_created_at ON sms_delivery_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_log_job_id ON sms_delivery_log(job_id);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_log_failures ON sms_delivery_log(org_id, created_at DESC)
    WHERE status IN ('failed', 'dead_letter');

-- RLS
ALTER TABLE sms_delivery_log ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Organizations view own SMS logs" ON sms_delivery_log;
CREATE POLICY "Organizations view own SMS logs"
    ON sms_delivery_log FOR SELECT
    USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Service role manages all SMS logs" ON sms_delivery_log;
CREATE POLICY "Service role manages all SMS logs"
    ON sms_delivery_log FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Helper functions
CREATE OR REPLACE FUNCTION get_sms_delivery_stats(p_org_id UUID, p_hours INTEGER DEFAULT 24)
RETURNS TABLE (
    total_sent INTEGER,
    delivered INTEGER,
    failed INTEGER,
    dead_letter INTEGER,
    success_rate NUMERIC,
    avg_delivery_time_ms NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE status = 'delivered')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER,
        COUNT(*) FILTER (WHERE status = 'dead_letter')::INTEGER,
        ROUND((COUNT(*) FILTER (WHERE status = 'delivered')::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2),
        ROUND(AVG(delivery_time_ms) FILTER (WHERE status = 'delivered'), 0)
    FROM sms_delivery_log
    WHERE org_id = p_org_id AND created_at > NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_dead_letter_sms(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID, job_id TEXT, org_id UUID, recipient_phone TEXT,
    message TEXT, attempt_number INTEGER, error_message TEXT, created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT sdl.id, sdl.job_id, sdl.org_id, sdl.recipient_phone, sdl.message,
           sdl.attempt_number, sdl.error_message, sdl.created_at
    FROM sms_delivery_log sdl
    WHERE sdl.status = 'dead_letter'
    ORDER BY sdl.created_at DESC LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_old_sms_delivery_logs()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM sms_delivery_log
    WHERE status = 'delivered' AND created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    DELETE FROM sms_delivery_log
    WHERE status IN ('failed', 'dead_letter') AND created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- Verification
SELECT table_name FROM information_schema.tables WHERE table_name = 'sms_delivery_log';
SELECT COUNT(*) as index_count FROM pg_indexes WHERE tablename = 'sms_delivery_log';
SELECT COUNT(*) as policy_count FROM pg_policies WHERE tablename = 'sms_delivery_log';
SQL

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "Next step: Add REDIS_URL to Render environment variables"
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi
