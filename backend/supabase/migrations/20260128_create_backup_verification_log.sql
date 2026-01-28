-- Migration: Backup Verification Log Table
-- Tracks automated backup verification results for monitoring and alerting
-- Created: 2026-01-28

-- Create backup_verification_log table
CREATE TABLE IF NOT EXISTS backup_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  backup_id TEXT,
  backup_age_hours INTEGER,
  backup_size_mb INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'failure')),
  checks_passed INTEGER NOT NULL DEFAULT 0,
  checks_failed INTEGER NOT NULL DEFAULT 0,
  error_details JSONB,
  verification_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT backup_verification_log_status_check 
    CHECK (status IN ('success', 'warning', 'failure'))
);

-- Create indexes for common queries
CREATE INDEX idx_backup_verification_log_verified_at 
ON backup_verification_log(verified_at DESC);

CREATE INDEX idx_backup_verification_log_status 
ON backup_verification_log(status);

CREATE INDEX idx_backup_verification_log_created_at 
ON backup_verification_log(created_at DESC);

-- Create index for monitoring failures
CREATE INDEX idx_backup_verification_log_failures 
ON backup_verification_log(verified_at DESC, status) 
WHERE status IN ('warning', 'failure');

-- Add comment for documentation
COMMENT ON TABLE backup_verification_log IS 
'Tracks automated backup verification results. 
Includes backup age, size, table checks, and row count validation.
Used for monitoring backup health and alerting on failures.';

-- Function to get latest verification status
CREATE OR REPLACE FUNCTION get_latest_backup_verification()
RETURNS TABLE (
  verified_at TIMESTAMPTZ,
  status TEXT,
  backup_age_hours INTEGER,
  checks_passed INTEGER,
  checks_failed INTEGER,
  error_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bvl.verified_at,
    bvl.status,
    bvl.backup_age_hours,
    bvl.checks_passed,
    bvl.checks_failed,
    bvl.error_details
  FROM backup_verification_log bvl
  ORDER BY bvl.verified_at DESC
  LIMIT 1;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_latest_backup_verification TO service_role;

COMMENT ON FUNCTION get_latest_backup_verification IS 
'Returns the most recent backup verification result.
Used by monitoring dashboards and alerting systems.';

-- Function to get verification history
CREATE OR REPLACE FUNCTION get_backup_verification_history(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  verified_at TIMESTAMPTZ,
  status TEXT,
  backup_age_hours INTEGER,
  checks_passed INTEGER,
  checks_failed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bvl.verified_at,
    bvl.status,
    bvl.backup_age_hours,
    bvl.checks_passed,
    bvl.checks_failed
  FROM backup_verification_log bvl
  WHERE bvl.verified_at > NOW() - (p_days || ' days')::INTERVAL
  ORDER BY bvl.verified_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_backup_verification_history TO service_role;

COMMENT ON FUNCTION get_backup_verification_history IS 
'Returns backup verification history for the specified number of days.
Default: 30 days. Used for trend analysis and reporting.';

-- Function to cleanup old verification logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_backup_verification_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM backup_verification_log
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_old_backup_verification_logs TO service_role;

COMMENT ON FUNCTION cleanup_old_backup_verification_logs IS 
'Deletes backup verification logs older than 90 days.
Returns the number of deleted rows.
Should be run monthly to prevent table bloat.';
