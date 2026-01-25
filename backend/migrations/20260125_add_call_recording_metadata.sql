-- Migration: Add Recording Metadata Columns to Call Logs
-- Description: Tracks recording processing status and call transfer details
-- Date: 2026-01-25

-- 1. Add recording_status column to track upload/processing progress
ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS recording_status TEXT CHECK (recording_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending';

-- 2. Add transfer tracking columns for when calls are transferred
ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS transfer_to TEXT,
ADD COLUMN IF NOT EXISTS transfer_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transfer_reason TEXT;

-- 3. Create index for recording_status to optimize queries
CREATE INDEX IF NOT EXISTS idx_call_logs_recording_status ON call_logs(recording_status) WHERE recording_status IS NOT NULL;

-- 4. Create index for transfer tracking
CREATE INDEX IF NOT EXISTS idx_call_logs_transfer_time ON call_logs(transfer_time DESC) WHERE transfer_time IS NOT NULL;

-- 5. Update any existing call_logs to have recording_status based on current state
-- If recording_storage_path is populated and not 'processing', mark as 'completed'
-- Otherwise, mark as 'pending'
UPDATE call_logs
SET recording_status = CASE
  WHEN recording_storage_path IS NOT NULL AND recording_storage_path != 'processing' THEN 'completed'
  WHEN recording_storage_path = 'processing' THEN 'processing'
  ELSE 'pending'
END
WHERE recording_status = 'pending';

-- 6. Create function to safely update recording status
CREATE OR REPLACE FUNCTION update_recording_status(
  p_call_id UUID,
  p_org_id UUID,
  p_status TEXT,
  p_storage_path TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE call_logs
  SET
    recording_status = p_status,
    recording_storage_path = COALESCE(p_storage_path, recording_storage_path),
    updated_at = NOW()
  WHERE id = p_call_id AND org_id = p_org_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 7. Grant access to function
GRANT EXECUTE ON FUNCTION update_recording_status TO authenticated;

-- 8. Do the same for the calls table
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS recording_status TEXT CHECK (recording_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending';

-- 9. Update existing calls records
UPDATE calls
SET recording_status = CASE
  WHEN recording_storage_path IS NOT NULL AND recording_storage_path != 'processing' THEN 'completed'
  WHEN recording_storage_path = 'processing' THEN 'processing'
  ELSE 'pending'
END
WHERE recording_status = 'pending';

-- 10. Create index on calls table
CREATE INDEX IF NOT EXISTS idx_calls_recording_status ON calls(recording_status) WHERE recording_status IS NOT NULL;
