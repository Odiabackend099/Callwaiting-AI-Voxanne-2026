-- =====================================================
-- MIGRATION: Fix Clinical Dashboard Pulse View
-- Date: 2026-01-31
-- Purpose: Update dashboard pulse view to use correct column names after Phase 6 unification
-- =====================================================

-- Drop old broken view that references non-existent columns
DROP VIEW IF EXISTS view_clinical_dashboard_pulse;

-- Recreate with correct column names post-Phase 6 (unified calls table)
-- Using call_direction instead of direction, and queries unified calls table
CREATE OR REPLACE VIEW view_clinical_dashboard_pulse AS
SELECT
  org_id,          -- ✅ Add for multi-tenant filtering
  call_direction,  -- ✅ Correct column name (was: direction)
  COUNT(*) as total_calls,
  AVG(COALESCE(duration_seconds, 0)) as avg_duration_seconds,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
  COUNT(CASE WHEN recording_url IS NOT NULL OR recording_storage_path IS NOT NULL THEN 1 END) as calls_with_recording
FROM calls  -- ✅ Correct table name (unified calls table)
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY org_id, call_direction;

-- Add performance index for dashboard stats queries
CREATE INDEX IF NOT EXISTS idx_calls_stats
ON calls(created_at DESC, call_direction, status, duration_seconds)
WHERE created_at > NOW() - INTERVAL '30 days';

-- Verify view works
-- SELECT * FROM view_clinical_dashboard_pulse;
-- Expected: Rows with call_direction='inbound' or 'outbound', total_calls>0, avg_duration_seconds>0

-- =====================================================
-- MIGRATION COMPLETE
-- View updated to work with unified calls table schema
-- =====================================================
