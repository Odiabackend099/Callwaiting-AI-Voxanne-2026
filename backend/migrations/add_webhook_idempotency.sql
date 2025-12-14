-- Add webhook idempotency tracking table
-- Prevents duplicate processing of the same webhook event

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  call_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by call_id
CREATE INDEX IF NOT EXISTS idx_processed_events_call_id ON processed_webhook_events(call_id);

-- Index for fast lookup by event_id
CREATE INDEX IF NOT EXISTS idx_processed_events_event_id ON processed_webhook_events(event_id);

-- Index for cleanup: find old events
CREATE INDEX IF NOT EXISTS idx_processed_events_received_at ON processed_webhook_events(received_at);

-- Add comment
COMMENT ON TABLE processed_webhook_events IS 'Tracks processed webhook events to prevent duplicate handling. Vapi guarantees at-least-once delivery; this table ensures idempotency.';
