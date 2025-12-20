-- Create recording_upload_queue table for asynchronous recording processing
-- This table stores pending recording uploads from webhooks
-- A background worker processes items from this queue

CREATE TABLE IF NOT EXISTS recording_upload_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Call information
  call_id UUID NOT NULL,
  vapi_call_id TEXT,
  org_id UUID,

  -- Recording metadata
  recording_url TEXT NOT NULL,
  call_type TEXT CHECK (call_type IN ('inbound', 'outbound')),

  -- Queue status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),

  -- Error tracking
  error_message TEXT,
  last_error_at TIMESTAMP,
  attempt_count INT DEFAULT 0,
  max_attempts INT DEFAULT 3,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  processing_started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Indexes for efficient querying
  CONSTRAINT valid_recording_url CHECK (recording_url ~ '^https?://')
);

-- Indexes for queue processing
CREATE INDEX idx_recording_upload_queue_status ON recording_upload_queue(status)
  WHERE status IN ('pending', 'processing');
CREATE INDEX idx_recording_upload_queue_priority ON recording_upload_queue(priority, created_at)
  WHERE status = 'pending';
CREATE INDEX idx_recording_upload_queue_call_id ON recording_upload_queue(call_id);
CREATE INDEX idx_recording_upload_queue_vapi_call_id ON recording_upload_queue(vapi_call_id);

-- Enable row-level security
ALTER TABLE recording_upload_queue ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see queue items for their org
CREATE POLICY "Users can see their org recording queue"
  ON recording_upload_queue
  FOR SELECT
  USING (org_id = auth.uid() OR org_id IS NULL);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON recording_upload_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE ON recording_upload_queue TO service_role;

-- Add comment
COMMENT ON TABLE recording_upload_queue IS
'Asynchronous queue for recording uploads from webhooks. Background worker processes items from this table.
This prevents webhook handlers from blocking on slow recording uploads (can take 180+ seconds).';
