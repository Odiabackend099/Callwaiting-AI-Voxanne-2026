/**
 * Migration: Mark Deprecated Columns
 *
 * Purpose: Add database comments and triggers warning future developers
 * Part of: Strategic SSOT Fix - Phase 1
 * Date: 2026-02-09
 *
 * This migration marks calls.caller_name and calls.from_number as deprecated
 * with warnings for any code that tries to write to them. These columns will
 * be kept for 1 month as a safety net, then dropped in Phase 3 (March 2026).
 *
 * Strategy: Soft deprecation with monitoring (not hard blocking)
 * - Add comments explaining deprecation
 * - Add trigger to log warnings when code writes to deprecated columns
 * - Keep columns functional for backward compatibility during transition
 */

-- ============================================================================
-- STEP 1: Mark deprecated columns with clear warnings
-- ============================================================================

-- caller_name: Deprecated in favor of calls_with_caller_names view
COMMENT ON COLUMN calls.caller_name IS
  '⚠️ DEPRECATED 2026-02-09: Use calls_with_caller_names view instead.
   DO NOT write to this column - it creates stale data that violates SSOT.
   This column will be dropped 2026-03-09 (Phase 3).

   Why deprecated: Frozen snapshot at webhook time, never updates when contact changes.
   Replacement: Query calls_with_caller_names.resolved_caller_name for live resolution.

   Part of Strategic SSOT Fix: https://github.com/voxanne-ai/voxanne/issues/XXX';

-- from_number: Deprecated in favor of phone_number (duplicate column)
COMMENT ON COLUMN calls.from_number IS
  '⚠️ DEPRECATED 2026-02-09: Use phone_number instead.
   DO NOT write to this column - it duplicates phone_number field.
   This column will be dropped 2026-03-09 (Phase 3).

   Why deprecated: Duplicate storage violates DRY principle and creates confusion.
   Replacement: Use calls.phone_number (canonical E.164 format).

   Part of Strategic SSOT Fix: https://github.com/voxanne-ai/voxanne/issues/XXX';

-- ============================================================================
-- STEP 2: Create deprecation tracking function
-- ============================================================================

-- Function to log warnings when deprecated columns are written to
CREATE OR REPLACE FUNCTION check_deprecated_column_writes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log warning if code tries to write to caller_name
  IF NEW.caller_name IS DISTINCT FROM OLD.caller_name THEN
    RAISE WARNING '[DEPRECATED COLUMN WRITE] calls.caller_name was written to. Use calls_with_caller_names view instead. Call ID: %, Org ID: %, Value: %',
      NEW.id, NEW.org_id, NEW.caller_name;
  END IF;

  -- Log warning if code tries to write to from_number
  IF NEW.from_number IS DISTINCT FROM OLD.from_number THEN
    RAISE WARNING '[DEPRECATED COLUMN WRITE] calls.from_number was written to. Use phone_number instead. Call ID: %, Org ID: %, Value: %',
      NEW.id, NEW.org_id, NEW.from_number;
  END IF;

  -- Allow the write (soft deprecation - not blocking)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comment
COMMENT ON FUNCTION check_deprecated_column_writes() IS
  'Logs warnings when code writes to deprecated columns (caller_name, from_number).
   Does not block writes (soft deprecation) to maintain backward compatibility during transition.
   Added: 2026-02-09 as part of Strategic SSOT Fix.
   Remove: 2026-03-09 when deprecated columns are dropped.';

-- ============================================================================
-- STEP 3: Attach trigger to calls table
-- ============================================================================

-- Trigger fires BEFORE UPDATE to log deprecated column writes
CREATE TRIGGER warn_deprecated_writes
  BEFORE UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION check_deprecated_column_writes();

-- Add helpful comment
COMMENT ON TRIGGER warn_deprecated_writes ON calls IS
  'Warns developers when they write to deprecated columns (caller_name, from_number).
   Helps identify code that needs updating before Phase 3 column drop.
   Added: 2026-02-09 as part of Strategic SSOT Fix.
   Remove: 2026-03-09 when deprecated columns are dropped.';

-- ============================================================================
-- STEP 4: Create deprecation audit log table (optional monitoring)
-- ============================================================================

-- Table to track deprecated column writes for analysis
CREATE TABLE IF NOT EXISTS deprecated_column_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  old_value TEXT,
  new_value TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying recent violations
CREATE INDEX IF NOT EXISTS idx_deprecated_audit_detected
ON deprecated_column_audit(detected_at DESC);

-- Index for querying by organization
CREATE INDEX IF NOT EXISTS idx_deprecated_audit_org
ON deprecated_column_audit(org_id, detected_at DESC);

-- Add helpful comment
COMMENT ON TABLE deprecated_column_audit IS
  'Tracks writes to deprecated columns for monitoring and debugging.
   Helps identify which code paths need updating before Phase 3 column drop.
   Created: 2026-02-09 as part of Strategic SSOT Fix.
   Retention: 30 days (automatically cleaned up).';

-- ============================================================================
-- STEP 5: Enhanced audit logging function
-- ============================================================================

-- Enhanced function that both warns AND logs to audit table
CREATE OR REPLACE FUNCTION check_deprecated_column_writes_with_audit()
RETURNS TRIGGER AS $$
BEGIN
  -- Check caller_name writes
  IF NEW.caller_name IS DISTINCT FROM OLD.caller_name THEN
    -- Log warning to PostgreSQL logs
    RAISE WARNING '[DEPRECATED COLUMN WRITE] calls.caller_name was written to. Call ID: %, Org ID: %, Old: %, New: %',
      NEW.id, NEW.org_id, OLD.caller_name, NEW.caller_name;

    -- Log to audit table for analysis
    INSERT INTO deprecated_column_audit (table_name, column_name, call_id, org_id, old_value, new_value)
    VALUES ('calls', 'caller_name', NEW.id, NEW.org_id, OLD.caller_name, NEW.caller_name);
  END IF;

  -- Check from_number writes
  IF NEW.from_number IS DISTINCT FROM OLD.from_number THEN
    -- Log warning to PostgreSQL logs
    RAISE WARNING '[DEPRECATED COLUMN WRITE] calls.from_number was written to. Call ID: %, Org ID: %, Old: %, New: %',
      NEW.id, NEW.org_id, OLD.from_number, NEW.from_number;

    -- Log to audit table for analysis
    INSERT INTO deprecated_column_audit (table_name, column_name, call_id, org_id, old_value, new_value)
    VALUES ('calls', 'from_number', NEW.id, NEW.org_id, OLD.from_number, NEW.from_number);
  END IF;

  -- Allow the write (soft deprecation)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: Update trigger to use enhanced function
-- ============================================================================

-- Replace simple warning trigger with audited version
DROP TRIGGER IF EXISTS warn_deprecated_writes ON calls;

CREATE TRIGGER warn_deprecated_writes
  BEFORE UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION check_deprecated_column_writes_with_audit();

-- ============================================================================
-- STEP 7: Create cleanup job for audit log (30-day retention)
-- ============================================================================

-- Function to clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_deprecated_column_audit()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete audit logs older than 30 days
  DELETE FROM deprecated_column_audit
  WHERE detected_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % old deprecated column audit logs', deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comment
COMMENT ON FUNCTION cleanup_deprecated_column_audit() IS
  'Deletes deprecated column audit logs older than 30 days.
   Should be run daily via cron job.
   Created: 2026-02-09 as part of Strategic SSOT Fix.';

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing after deployment)
-- ============================================================================

-- Uncomment these queries to verify migration success:
--
-- -- Check if triggers are active
-- SELECT
--   trigger_name,
--   event_manipulation,
--   action_timing,
--   action_statement
-- FROM information_schema.triggers
-- WHERE trigger_name = 'warn_deprecated_writes';
-- -- Expected: 1 row showing BEFORE UPDATE trigger
--
-- -- Check recent deprecated column writes (if any)
-- SELECT
--   table_name,
--   column_name,
--   COUNT(*) as write_count,
--   MAX(detected_at) as last_write
-- FROM deprecated_column_audit
-- WHERE detected_at > NOW() - INTERVAL '7 days'
-- GROUP BY table_name, column_name
-- ORDER BY write_count DESC;
-- -- Expected: Empty initially, should populate if code writes to deprecated columns
--
-- -- Test trigger manually (should generate warning)
-- UPDATE calls
-- SET caller_name = 'Test Name'
-- WHERE id = (SELECT id FROM calls LIMIT 1);
-- -- Expected: WARNING message in PostgreSQL logs and 1 row in deprecated_column_audit
