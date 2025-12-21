-- Migration: Add Performance Indexes for Queue Tables
-- Purpose: Optimize database queries for recording upload queue processing
-- Date: 2025-12-21

-- Indexes for recording_upload_queue (used by queue worker)
-- Worker queries by status and priority
CREATE INDEX IF NOT EXISTS idx_recording_upload_queue_status_priority
  ON recording_upload_queue(status, priority DESC)
  WHERE status IN ('pending', 'processing');

-- Query for locked items waiting for retry
CREATE INDEX IF NOT EXISTS idx_recording_upload_queue_locked_until
  ON recording_upload_queue(locked_until, status)
  WHERE status = 'processing';

-- Indexes for failed_recording_uploads (used by retry service)
-- Retry service checks which items are due for retry
CREATE INDEX IF NOT EXISTS idx_failed_uploads_next_retry
  ON failed_recording_uploads(next_retry_at)
  WHERE retry_count < max_retries;

-- Archive old failed uploads
CREATE INDEX IF NOT EXISTS idx_failed_uploads_created_at
  ON failed_recording_uploads(created_at DESC)
  WHERE retry_count >= max_retries;

-- Indexes for orphaned_recordings (used by cleanup job)
-- Cleanup job finds unclean orphaned recordings
CREATE INDEX IF NOT EXISTS idx_orphaned_recordings_cleanup_status
  ON orphaned_recordings(cleaned_up_at)
  WHERE cleaned_up_at IS NULL;

-- Find recordings by storage path for manual cleanup
CREATE INDEX IF NOT EXISTS idx_orphaned_recordings_storage_path
  ON orphaned_recordings(storage_path);

-- Indexes for recording_upload_metrics (used for monitoring)
-- Dashboard queries recent metrics
CREATE INDEX IF NOT EXISTS idx_recording_metrics_created_at
  ON recording_upload_metrics(created_at DESC);

-- Query metrics by organization
CREATE INDEX IF NOT EXISTS idx_recording_metrics_org_created
  ON recording_upload_metrics(org_id, created_at DESC);

-- Verify all indexes are created
-- Run this query to confirm: SELECT indexname, tablename FROM pg_indexes
-- WHERE schemaname = 'public'
-- AND tablename IN ('recording_upload_queue', 'failed_recording_uploads', 'orphaned_recordings', 'recording_upload_metrics')
-- ORDER BY tablename, indexname;
