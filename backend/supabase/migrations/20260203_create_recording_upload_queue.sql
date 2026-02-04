-- Migration: Create recording_upload_queue table
-- Date: 2026-02-03
-- Purpose: Enable recording upload from Vapi CDN to Supabase Storage (fixes CORS playback issue)

-- Create recording upload queue table
CREATE TABLE IF NOT EXISTS recording_upload_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vapi_recording_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  CONSTRAINT recording_upload_queue_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create indexes for worker queries
CREATE INDEX idx_recording_upload_queue_status
  ON recording_upload_queue(status)
  WHERE status = 'pending';

CREATE INDEX idx_recording_upload_queue_org_id
  ON recording_upload_queue(org_id);

CREATE INDEX idx_recording_upload_queue_call_id
  ON recording_upload_queue(call_id);

CREATE INDEX idx_recording_upload_queue_created_at
  ON recording_upload_queue(created_at DESC);

-- Enable Row Level Security
ALTER TABLE recording_upload_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for service role (backend workers)
CREATE POLICY "Service role can manage recording upload queue"
  ON recording_upload_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE recording_upload_queue IS 'Queue for uploading call recordings from Vapi CDN to Supabase Storage. Processed by background worker.';
COMMENT ON COLUMN recording_upload_queue.vapi_recording_url IS 'Original recording URL from Vapi CDN';
COMMENT ON COLUMN recording_upload_queue.status IS 'Upload status: pending (queued), processing (in progress), completed (success), failed (permanent failure)';
COMMENT ON COLUMN recording_upload_queue.attempts IS 'Number of upload attempts (max 3)';
