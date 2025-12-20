-- Create recording_upload_metrics table for tracking upload performance
-- This table stores metrics for monitoring success rates and performance

CREATE TABLE IF NOT EXISTS recording_upload_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Call information
  call_id UUID NOT NULL,
  call_type TEXT CHECK (call_type IN ('inbound', 'outbound')),

  -- Upload status and timing
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  duration_ms INT NOT NULL,

  -- File information
  file_size_bytes BIGINT,

  -- Error tracking
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_recording_upload_metrics_status ON recording_upload_metrics(status);
CREATE INDEX idx_recording_upload_metrics_created_at ON recording_upload_metrics(created_at);
CREATE INDEX idx_recording_upload_metrics_call_type ON recording_upload_metrics(call_type);
CREATE INDEX idx_recording_upload_metrics_time_range ON recording_upload_metrics(created_at, status)
  WHERE created_at > NOW() - INTERVAL '7 days';

-- Partition by status for faster queries (success rate)
CREATE INDEX idx_recording_upload_metrics_status_created_at ON recording_upload_metrics(status, created_at)
  WHERE created_at > NOW() - INTERVAL '30 days';

-- Enable row-level security
ALTER TABLE recording_upload_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policy: Service role can insert and read
CREATE POLICY "Service role can manage recording metrics"
  ON recording_upload_metrics
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON recording_upload_metrics TO service_role;
GRANT SELECT ON recording_upload_metrics TO authenticated;

-- Add comment
COMMENT ON TABLE recording_upload_metrics IS
'Metrics table for tracking call recording upload performance. Used for success rate monitoring and alerting.';
