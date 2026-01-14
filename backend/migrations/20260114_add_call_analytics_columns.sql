-- Migration: Add Clinical Analytics Columns & Views (Revised V2)
-- Description: Enhances calls table with sentiment/scoring and adds dashboard views.
-- Fixes: Maps patient_name to ct.name.
-- 1. Enhance calls table
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS direction text CHECK (direction IN ('inbound', 'outbound')),
    ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id),
    ADD COLUMN IF NOT EXISTS sentiment_score float CHECK (
        sentiment_score >= 0
        AND sentiment_score <= 1
    ),
    ADD COLUMN IF NOT EXISTS lead_score int DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lead_temp text CHECK (lead_temp IN ('hot', 'warm', 'cool', 'cold')),
    ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS procedure_intent text,
    ADD COLUMN IF NOT EXISTS financial_value int DEFAULT 0;
-- Index for fast filtering on leads page
CREATE INDEX IF NOT EXISTS idx_calls_lead_temp ON calls(lead_temp)
WHERE lead_temp IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);
-- 2. Create View: Clinical Dashboard Pulse
-- Aggregates metrics for the top cards and charts
DROP VIEW IF EXISTS view_clinical_dashboard_pulse;
CREATE OR REPLACE VIEW view_clinical_dashboard_pulse AS
SELECT org_id,
    COUNT(*) as total_calls,
    -- Inbound/Outbound Ratio
    COUNT(*) FILTER (
        WHERE direction = 'inbound'
    ) as inbound_calls,
    COUNT(*) FILTER (
        WHERE direction = 'outbound'
    ) as outbound_calls,
    -- Durations
    COALESCE(
        AVG(duration_seconds) FILTER (
            WHERE status = 'completed'
        ),
        0
    )::int as avg_duration_seconds,
    -- Success Rate (Bookings / Inbound)
    CASE
        WHEN COUNT(*) FILTER (
            WHERE direction = 'inbound'
        ) = 0 THEN 0
        ELSE ROUND(
            (
                COUNT(*) FILTER (
                    WHERE (metadata->>'booking_confirmed')::boolean = true
                )::numeric / NULLIF(
                    COUNT(*) FILTER (
                        WHERE direction = 'inbound'
                    ),
                    0
                )::numeric
            ) * 100,
            1
        )
    END as success_rate,
    -- ROI Metrics
    SUM(financial_value) as pipeline_value,
    COUNT(*) FILTER (
        WHERE lead_temp = 'hot'
    ) as hot_leads_count
FROM calls
GROUP BY org_id;
-- 3. Create View: Actionable Leads
-- Pre-calculates formatting for the Leads Page
DROP VIEW IF EXISTS view_actionable_leads;
CREATE OR REPLACE VIEW view_actionable_leads AS
SELECT c.id,
    c.org_id,
    c.contact_id,
    ct.name as patient_name,
    c.phone_number,
    -- Format Date for UI
    to_char(c.created_at, 'DD Mon YYYY, HH24:MI') as formatted_date,
    c.duration_seconds as duration,
    c.direction,
    c.status,
    -- Intelligence Columns
    c.sentiment_score,
    c.lead_temp,
    c.procedure_intent,
    c.financial_value,
    -- Smart logic for "Next Action"
    CASE
        WHEN c.lead_temp = 'hot' THEN 'Urgent Callback'
        WHEN c.lead_temp = 'warm' THEN 'Follow-up SMS'
        ELSE 'Archive'
    END as recommended_action,
    (c.metadata->>'booking_confirmed')::boolean as is_booked
FROM calls c
    LEFT JOIN contacts ct ON c.contact_id = ct.id
ORDER BY CASE
        c.lead_temp
        WHEN 'hot' THEN 1
        WHEN 'warm' THEN 2
        ELSE 3
    END,
    c.created_at DESC;
-- 4. Function to Calculate Lead Temperature
CREATE OR REPLACE FUNCTION calculate_lead_temperature(
        p_status text,
        p_intent text,
        p_duration int,
        p_booked boolean
    ) RETURNS text AS $$ BEGIN -- HOT: Abandoned High Value (Intent is set, but not booked, long duration)
    IF p_intent IN ('facelift', 'rhinoplasty', 'breast_augmentation')
    AND p_booked = false THEN RETURN 'hot';
END IF;
-- WARM: Completed, General Intent, Not Booked
IF p_status = 'completed'
AND p_booked = false THEN RETURN 'warm';
END IF;
-- COOL: Just an inquiry
RETURN 'cool';
-- Default
END;
$$ LANGUAGE plpgsql IMMUTABLE;
-- Grant access
GRANT SELECT ON view_clinical_dashboard_pulse TO authenticated;
GRANT SELECT ON view_actionable_leads TO authenticated;