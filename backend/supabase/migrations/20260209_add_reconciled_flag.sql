-- P0-5: Add reconciled flag to calls table for Vapi API reconciliation
-- This enables tracking of calls recovered via daily API reconciliation vs webhook delivery

-- Add reconciled column to track calls recovered via API reconciliation
ALTER TABLE calls ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN calls.reconciled IS 'True if call was recovered via API reconciliation (webhook never arrived), false if received via webhook';

-- Create index for efficient reconciliation queries
-- This index speeds up the daily reconciliation job which filters by reconciled = false
CREATE INDEX IF NOT EXISTS idx_calls_reconciled ON calls(reconciled, created_at DESC);

-- Add index for org_id + created_at (used in reconciliation queries)
CREATE INDEX IF NOT EXISTS idx_calls_org_created ON calls(org_id, created_at DESC);

-- Create view for reconciliation metrics (for monitoring)
CREATE OR REPLACE VIEW vapi_webhook_reliability AS
SELECT
  DATE_TRUNC('day', created_at) AS date,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE reconciled = true) AS reconciled_calls,
  COUNT(*) FILTER (WHERE reconciled = false) AS webhook_calls,
  ROUND(
    (COUNT(*) FILTER (WHERE reconciled = false)::NUMERIC / COUNT(*)::NUMERIC * 100),
    2
  ) AS webhook_reliability_percentage
FROM calls
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Add comment for view
COMMENT ON VIEW vapi_webhook_reliability IS 'Daily webhook reliability metrics - tracks percentage of calls received via webhook vs API reconciliation';
