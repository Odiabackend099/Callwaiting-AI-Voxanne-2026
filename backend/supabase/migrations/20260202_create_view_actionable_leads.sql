-- Migration: Create view_actionable_leads for dashboard hot leads
-- Purpose: Fixes "Error loading leads: Database error" in dashboard
-- Date: 2026-02-02

-- Create the missing view for actionable leads (hot leads needing follow-up)
CREATE OR REPLACE VIEW view_actionable_leads AS
SELECT
    c.id,
    c.org_id,
    c.phone,
    c.first_name,
    c.last_name,
    c.email,
    c.lead_status,
    c.lead_score,
    c.created_at,
    c.updated_at,
    c.last_contact_date,
    -- Calculate days since last contact
    EXTRACT(DAY FROM (NOW() - c.last_contact_date)) as days_since_contact,
    -- Check if follow-up is overdue
    CASE
        WHEN c.last_contact_date IS NULL THEN true
        WHEN EXTRACT(DAY FROM (NOW() - c.last_contact_date)) > 7 THEN true
        ELSE false
    END as follow_up_overdue
FROM contacts c
WHERE
    -- Only show hot/warm leads
    c.lead_status IN ('hot', 'warm')
    -- Exclude leads with appointments in next 7 days
    AND NOT EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.contact_id = c.id
        AND a.scheduled_at > NOW()
        AND a.scheduled_at < NOW() + INTERVAL '7 days'
    )
ORDER BY
    c.lead_score DESC,
    c.last_contact_date ASC NULLS FIRST;

-- Add RLS policy for multi-tenant security
ALTER VIEW view_actionable_leads SET (security_invoker = true);

-- Add helpful comment for future reference
COMMENT ON VIEW view_actionable_leads IS 'Actionable leads needing follow-up - filters for hot/warm leads without upcoming appointments. Orders by lead score (high priority first) then by last contact date (oldest first). Uses security_invoker=true for RLS enforcement.';
