-- Migration: SMS Delivery Log Table
-- Date: 2026-02-01
-- Purpose: Track SMS delivery attempts, retries, and failures for monitoring and debugging
--
-- Critical Feature: Background SMS delivery via BullMQ queue
-- Prevents blocking Vapi call responses (which have 15-30s timeout)
--
-- Use Cases:
-- 1. Monitor SMS delivery success rates
-- 2. Debug failed SMS (dead letter queue)
-- 3. Track retry attempts and delivery times
-- 4. Generate SMS delivery reports

BEGIN;

-- Create sms_delivery_log table
CREATE TABLE IF NOT EXISTS sms_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job tracking
    job_id TEXT NOT NULL UNIQUE, -- BullMQ job ID

    -- Organization & recipient
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL, -- E.164 format

    -- Message content
    message TEXT NOT NULL,

    -- Delivery status
    status TEXT NOT NULL CHECK (status IN ('processing', 'delivered', 'failed', 'dead_letter')),
    attempt_number INTEGER NOT NULL DEFAULT 1,

    -- Performance & result
    delivery_time_ms INTEGER, -- Time taken to deliver (NULL if failed)
    twilio_sid TEXT, -- Twilio message SID (NULL if failed)
    error_message TEXT, -- Error details if failed

    -- Metadata
    metadata JSONB, -- { appointmentId, contactId, callId, triggerType }

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_sms_delivery_log_org_id ON sms_delivery_log(org_id);
CREATE INDEX idx_sms_delivery_log_status ON sms_delivery_log(status);
CREATE INDEX idx_sms_delivery_log_created_at ON sms_delivery_log(created_at DESC);
CREATE INDEX idx_sms_delivery_log_job_id ON sms_delivery_log(job_id);

-- Partial index for failed/dead letter SMS (monitoring)
CREATE INDEX idx_sms_delivery_log_failures ON sms_delivery_log(org_id, created_at DESC)
    WHERE status IN ('failed', 'dead_letter');

-- Row-level security (RLS)
ALTER TABLE sms_delivery_log ENABLE ROW LEVEL SECURITY;

-- Policy: Organizations can view their own SMS delivery logs
CREATE POLICY "Organizations view own SMS logs"
    ON sms_delivery_log
    FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM profiles WHERE id = auth.uid()
        )
    );

-- Policy: Service role can manage all SMS logs (for queue worker)
CREATE POLICY "Service role manages all SMS logs"
    ON sms_delivery_log
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Helper function: Get SMS delivery stats for organization
CREATE OR REPLACE FUNCTION get_sms_delivery_stats(
    p_org_id UUID,
    p_hours INTEGER DEFAULT 24
)
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
        COUNT(*)::INTEGER AS total_sent,
        COUNT(*) FILTER (WHERE status = 'delivered')::INTEGER AS delivered,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER AS failed,
        COUNT(*) FILTER (WHERE status = 'dead_letter')::INTEGER AS dead_letter,
        ROUND(
            (COUNT(*) FILTER (WHERE status = 'delivered')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
            2
        ) AS success_rate,
        ROUND(AVG(delivery_time_ms) FILTER (WHERE status = 'delivered'), 0) AS avg_delivery_time_ms
    FROM sms_delivery_log
    WHERE org_id = p_org_id
        AND created_at > NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Get dead letter queue SMS (for manual retry)
CREATE OR REPLACE FUNCTION get_dead_letter_sms(
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    job_id TEXT,
    org_id UUID,
    recipient_phone TEXT,
    message TEXT,
    attempt_number INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sdl.id,
        sdl.job_id,
        sdl.org_id,
        sdl.recipient_phone,
        sdl.message,
        sdl.attempt_number,
        sdl.error_message,
        sdl.created_at
    FROM sms_delivery_log sdl
    WHERE sdl.status = 'dead_letter'
    ORDER BY sdl.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function: Delete old SMS logs (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_sms_delivery_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete delivered SMS logs older than 30 days
    DELETE FROM sms_delivery_log
    WHERE status = 'delivered'
        AND created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Keep failed/dead_letter logs for 90 days (debugging)
    DELETE FROM sms_delivery_log
    WHERE status IN ('failed', 'dead_letter')
        AND created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'SMS delivery log table created successfully';
    RAISE NOTICE 'Indexes created: 5 (org_id, status, created_at, job_id, failures)';
    RAISE NOTICE 'Helper functions created: get_sms_delivery_stats, get_dead_letter_sms, cleanup_old_sms_delivery_logs';
    RAISE NOTICE 'RLS enabled with 2 policies';
END $$;

COMMIT;

-- VERIFICATION QUERIES (run manually after migration):
/*
-- 1. Verify table exists
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'sms_delivery_log';

-- 2. Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sms_delivery_log';

-- 3. Verify helper functions
SELECT proname, pronargs
FROM pg_proc
WHERE proname IN ('get_sms_delivery_stats', 'get_dead_letter_sms', 'cleanup_old_sms_delivery_logs');

-- 4. Verify RLS policies
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'sms_delivery_log';

-- 5. Test SMS delivery stats function
SELECT * FROM get_sms_delivery_stats('00000000-0000-0000-0000-000000000000'::UUID, 24);
*/
