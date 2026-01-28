-- Migration: Webhook Delivery Log Table
-- Tracks webhook delivery attempts and failures for debugging and monitoring
-- Created: 2026-01-27

-- Create webhook_delivery_log table
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  job_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  
  CONSTRAINT webhook_delivery_log_status_check 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter'))
);

-- Create indexes for common queries
CREATE INDEX idx_webhook_delivery_log_org_id ON webhook_delivery_log(org_id);
CREATE INDEX idx_webhook_delivery_log_status ON webhook_delivery_log(status);
CREATE INDEX idx_webhook_delivery_log_created_at ON webhook_delivery_log(created_at DESC);
CREATE INDEX idx_webhook_delivery_log_job_id ON webhook_delivery_log(job_id);

-- Create index for monitoring failed webhooks
CREATE INDEX idx_webhook_delivery_log_failed 
ON webhook_delivery_log(org_id, status, created_at DESC) 
WHERE status IN ('failed', 'dead_letter');

-- Add RLS policies
ALTER TABLE webhook_delivery_log ENABLE ROW LEVEL SECURITY;

-- Policy: Organizations can only see their own webhook logs
CREATE POLICY webhook_delivery_log_org_isolation 
ON webhook_delivery_log 
FOR SELECT 
USING (org_id = auth.jwt() ->> 'org_id');

-- Policy: Service role can access all logs
CREATE POLICY webhook_delivery_log_service_role_bypass 
ON webhook_delivery_log 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE webhook_delivery_log IS 
'Tracks webhook delivery attempts for monitoring and debugging. 
Includes retry attempts, error messages, and final status.';

-- Function to clean up old webhook logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_delivery_log
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND status IN ('completed', 'dead_letter');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_old_webhook_logs TO service_role;

COMMENT ON FUNCTION cleanup_old_webhook_logs IS 
'Deletes webhook delivery logs older than 30 days (completed or dead_letter only).
Returns the number of deleted rows.';
