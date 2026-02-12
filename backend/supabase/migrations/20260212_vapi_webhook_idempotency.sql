-- Webhook idempotency tracking table
-- Prevents duplicate processing when Vapi retries webhooks
--
-- Problem: Without idempotency, network timeouts cause:
-- - Duplicate appointments created
-- - Duplicate SMS sent
-- - Double billing charges
-- - Duplicate leads in dashboard
--
-- Solution: Track processed webhook event IDs and skip duplicates

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  webhook_payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate processing
  UNIQUE(org_id, event_id)
);

-- Indexes for performance
CREATE INDEX idx_processed_webhook_events_lookup
  ON processed_webhook_events(org_id, event_id);

CREATE INDEX idx_processed_webhook_events_created
  ON processed_webhook_events(created_at DESC);

-- Helper function to check if event already processed
CREATE OR REPLACE FUNCTION is_vapi_event_processed(
  p_org_id UUID,
  p_event_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM processed_webhook_events
    WHERE org_id = p_org_id AND event_id = p_event_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to mark event as processed
CREATE OR REPLACE FUNCTION mark_vapi_event_processed(
  p_org_id UUID,
  p_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO processed_webhook_events (org_id, event_id, event_type, webhook_payload)
  VALUES (p_org_id, p_event_id, p_event_type, p_payload)
  ON CONFLICT (org_id, event_id) DO NOTHING;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function (called by scheduled job)
-- Deletes events older than 7 days to prevent table bloat
CREATE OR REPLACE FUNCTION cleanup_old_processed_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM processed_webhook_events
  WHERE created_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations can view their own webhook events"
  ON processed_webhook_events
  FOR SELECT
  USING (org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid);

CREATE POLICY "Service role has full access"
  ON processed_webhook_events
  FOR ALL
  USING (current_user = 'service_role');

-- Add comment
COMMENT ON TABLE processed_webhook_events IS
  'Tracks processed Vapi webhooks to prevent duplicate processing. 7-day retention.';
