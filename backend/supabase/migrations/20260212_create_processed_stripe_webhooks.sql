/**
 * P0-3: Webhook Idempotency Table
 *
 * Creates table to track processed Stripe webhook events, preventing replay attacks.
 *
 * Security Issue (CVSS 8.7):
 * Without idempotency tracking, attackers can replay webhooks (checkout.session.completed)
 * to grant themselves unlimited free credits from a single payment.
 *
 * Defense-in-Depth:
 * - BullMQ provides queue-level idempotency (jobId = event_id)
 * - This table provides database-level idempotency for audit trail and compliance
 * - Survives queue flushes, restarts, and cross-system webhook deliveries
 *
 * Usage:
 * 1. Before processing webhook: Check if event_id exists
 * 2. If exists: Skip processing (idempotent)
 * 3. If not exists: Process webhook, then INSERT event_id
 *
 * Data Retention:
 * - Stripe retains events for 30 days
 * - We retain processed events for 90 days for audit compliance
 * - Cleanup job runs daily to remove events >90 days old
 */

-- Table: processed_stripe_webhooks
-- Tracks all processed Stripe webhook events for idempotency and audit compliance
CREATE TABLE IF NOT EXISTS processed_stripe_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stripe event ID (unique across all Stripe events)
  -- Example: "evt_1ABCde2fGHIjklMN3oPQRstu"
  event_id TEXT NOT NULL UNIQUE,

  -- Stripe event type (for analytics and debugging)
  -- Examples: "checkout.session.completed", "payment_intent.succeeded"
  event_type TEXT NOT NULL,

  -- Organization ID (for multi-tenant filtering)
  -- Extracted from event metadata
  org_id UUID,

  -- Webhook processing status
  -- Values: 'processed', 'failed', 'duplicate'
  status TEXT NOT NULL DEFAULT 'processed',

  -- When the webhook was first received
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- When the webhook was processed (or skipped if duplicate)
  processed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Error message if processing failed
  error_message TEXT,

  -- Full event data (for debugging and audit)
  -- Stored as JSONB for queryability
  event_data JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index: Fast lookup by event_id (primary idempotency check)
-- Used on EVERY webhook receive to check for duplicates
CREATE INDEX IF NOT EXISTS idx_processed_stripe_webhooks_event_id
  ON processed_stripe_webhooks(event_id);

-- Index: Filter by org_id (for multi-tenant queries and debugging)
CREATE INDEX IF NOT EXISTS idx_processed_stripe_webhooks_org_id
  ON processed_stripe_webhooks(org_id);

-- Index: Filter by event_type (for analytics)
CREATE INDEX IF NOT EXISTS idx_processed_stripe_webhooks_event_type
  ON processed_stripe_webhooks(event_type);

-- Index: Filter by received_at (for cleanup job and time-based queries)
CREATE INDEX IF NOT EXISTS idx_processed_stripe_webhooks_received_at
  ON processed_stripe_webhooks(received_at DESC);

-- Index: Filter by status (for error monitoring and debugging)
CREATE INDEX IF NOT EXISTS idx_processed_stripe_webhooks_status
  ON processed_stripe_webhooks(status);

-- RLS: Enable row-level security
-- Only service role can read/write (webhooks processed by backend, not client)
ALTER TABLE processed_stripe_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role has full access
CREATE POLICY processed_stripe_webhooks_service_role
  ON processed_stripe_webhooks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Helper Function: Check if webhook event was already processed
-- Returns TRUE if event_id exists in table (duplicate), FALSE otherwise
CREATE OR REPLACE FUNCTION is_stripe_event_processed(p_event_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM processed_stripe_webhooks
    WHERE event_id = p_event_id
  );
END;
$$;

-- Helper Function: Mark webhook event as processed
-- Inserts event_id into table to prevent future duplicates
-- Returns TRUE on success, FALSE if already exists
CREATE OR REPLACE FUNCTION mark_stripe_event_processed(
  p_event_id TEXT,
  p_event_type TEXT,
  p_org_id UUID DEFAULT NULL,
  p_event_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to insert (will fail if duplicate due to UNIQUE constraint)
  INSERT INTO processed_stripe_webhooks (
    event_id,
    event_type,
    org_id,
    event_data,
    status
  ) VALUES (
    p_event_id,
    p_event_type,
    p_org_id,
    p_event_data,
    'processed'
  )
  ON CONFLICT (event_id) DO NOTHING;

  -- Return TRUE if inserted, FALSE if duplicate
  RETURN FOUND;
END;
$$;

-- Helper Function: Cleanup old processed webhook events
-- Removes events older than 90 days to prevent table bloat
-- Called by daily cron job
CREATE OR REPLACE FUNCTION cleanup_old_processed_stripe_webhooks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM processed_stripe_webhooks
  WHERE received_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Insert sample comment for documentation
COMMENT ON TABLE processed_stripe_webhooks IS 'Tracks processed Stripe webhook events for idempotency and audit compliance. Defense-in-depth protection against replay attacks.';
COMMENT ON COLUMN processed_stripe_webhooks.event_id IS 'Unique Stripe event ID (e.g., evt_1ABCde2fGHIjklMN3oPQRstu). Used for idempotency checks.';
COMMENT ON COLUMN processed_stripe_webhooks.status IS 'Processing status: processed (success), failed (error), duplicate (already processed)';
COMMENT ON FUNCTION is_stripe_event_processed IS 'Check if Stripe event was already processed (idempotency check)';
COMMENT ON FUNCTION mark_stripe_event_processed IS 'Mark Stripe event as processed to prevent future duplicates';
COMMENT ON FUNCTION cleanup_old_processed_stripe_webhooks IS 'Remove processed events older than 90 days (called by daily cron)';
