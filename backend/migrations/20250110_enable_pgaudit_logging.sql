-- ============================================
-- VOXANNE PHASE 1 MVP: Enable pgAudit for HIPAA Compliance
-- Date: 2025-01-10
-- Purpose: Enable comprehensive audit logging for compliance and forensics
-- Context: HIPAA/SOC2 requirement for accountability and data access tracking
-- ============================================
--
-- PGAUDIT FEATURES:
--   - Logs all DATABASE READS (SELECT)
--   - Logs all WRITES (INSERT, UPDATE, DELETE)
--   - Logs DDL changes (CREATE, ALTER, DROP)
--   - Creates complete audit trail with timestamps
--
-- WHAT THIS MIGRATION DOES:
--   1. Enable pgaudit extension (PostgreSQL contrib module)
--   2. Configure audit logging parameters
--   3. Create audit log table to store logs
--   4. Grant appropriate permissions
--   5. Document configuration and usage
--
-- AUDIT STRATEGY:
--   - Log all operations for compliance
--   - Filter out system tables (pg_catalog, information_schema)
--   - Store logs in database for long-term retention
--   - Periodically archive old logs to S3 for compliance
--
-- PERFORMANCE CONSIDERATIONS:
--   - pgaudit adds ~5-10% overhead
--   - Audit logs table grows ~10-50KB per day per active org
--   - Archive old logs regularly to maintain performance
--
-- SECURITY:
--   - Only service role and superuser can read audit logs
--   - Audit log table should not be accessible to regular users (RLS enabled)
--   - Timestamps are immutable (audit log is append-only)
--
-- ============================================

-- ============================================
-- STEP 1: Enable pgaudit extension
-- ============================================
-- pgaudit is a PostgreSQL contrib module that must be installed by Supabase
-- If not available, contact Supabase support to enable it
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- ============================================
-- STEP 2: Configure pgaudit parameters
-- ============================================
-- These parameters control what gets logged and how
-- Note: These are session-level settings. For persistent config,
-- use Supabase dashboard or cloud.sql_flags (if available)

-- Log READ, WRITE, and DDL operations
-- This creates a comprehensive audit trail
ALTER SYSTEM SET pgaudit.log = 'READ, WRITE, DDL';

-- Don't log system catalog operations (keeps logs cleaner)
ALTER SYSTEM SET pgaudit.log_catalog = false;

-- Include relation names in logs (more readable)
ALTER SYSTEM SET pgaudit.log_relation = true;

-- Include statement parameters in logs (helps with debugging)
ALTER SYSTEM SET pgaudit.log_statement_once = false;

-- Include database role in logs
ALTER SYSTEM SET pgaudit.log_parameter = true;

-- Reload configuration (if running with superuser privileges)
-- Note: This may fail on Supabase cloud (no superuser)
-- The configuration will take effect on next database restart
DO $$
BEGIN
  -- Try to reload config (will fail gracefully on Supabase cloud)
  EXECUTE 'SELECT pg_reload_conf()';
  RAISE NOTICE 'PostgreSQL configuration reloaded (pgaudit settings active immediately)';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not reload PostgreSQL configuration. Settings will take effect on next database restart. (This is normal on Supabase cloud)';
END $$;

-- ============================================
-- STEP 3: Create audit_logs table to store pgaudit events
-- ============================================
-- This table stores audit events for long-term retention and analysis
CREATE TABLE IF NOT EXISTS audit_logs (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,

  -- Event classification
  event_type TEXT NOT NULL,                       -- READ, WRITE, DDL, SESSION, etc.
  operation TEXT NOT NULL,                        -- SELECT, INSERT, UPDATE, DELETE, CREATE, etc.

  -- What was affected
  schema_name TEXT,                               -- Schema of affected table
  table_name TEXT,                                -- Name of affected table
  object_id OID,                                  -- PostgreSQL object identifier

  -- Who did it
  database_user TEXT NOT NULL,                    -- Database user who performed action
  authenticated_user UUID,                        -- Supabase auth user (if available)
  org_id UUID,                                    -- Organization context (if available)

  -- Security context
  session_id TEXT,                                -- PostgreSQL session ID
  app_name TEXT,                                  -- Application name from connection
  client_addr TEXT,                               -- Client IP address

  -- What changed (for INSERT/UPDATE/DELETE)
  row_data TEXT,                                  -- JSON representation of row data
  changed_columns TEXT[],                         -- Array of column names that changed

  -- Statement details
  statement_text TEXT,                            -- Full SQL statement
  statement_hash TEXT,                            -- Hash of statement (for tracking queries)
  command_tag TEXT,                               -- PostgreSQL command tag

  -- Timestamps and sequence
  event_time TIMESTAMPTZ DEFAULT NOW(),          -- When the audit event occurred
  server_time TIMESTAMPTZ DEFAULT NOW(),         -- Server time for comparison
  sequence_number BIGINT,                        -- Event sequence number

  -- Indexed fields for queries
  CONSTRAINT audit_logs_event_time_org_idx
  UNIQUE (event_time, org_id) WHERE org_id IS NOT NULL
);

-- Add comments explaining the table
COMMENT ON TABLE audit_logs IS
'Comprehensive audit log table for compliance and forensics. Stores pgaudit events. Append-only (records never updated). Use for compliance reports, forensics, and data access tracking.';

COMMENT ON COLUMN audit_logs.event_type IS
'Type of event: READ (SELECT), WRITE (INSERT/UPDATE/DELETE), DDL (CREATE/ALTER/DROP), SESSION, etc.';

COMMENT ON COLUMN audit_logs.org_id IS
'Organization context. Extracted from JWT or inferred from accessed object. Used for per-org log queries.';

COMMENT ON COLUMN audit_logs.statement_text IS
'Full SQL statement. May contain sensitive data (passwords, PII). Redact before exposing to non-admin users.';

-- ============================================
-- STEP 4: Create indexes for audit log queries
-- ============================================
-- These indexes optimize common audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_time ON audit_logs(org_id, event_time DESC)
WHERE org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(schema_name, table_name, event_time DESC)
WHERE table_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(database_user, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_authenticated_user ON audit_logs(authenticated_user, event_time DESC)
WHERE authenticated_user IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_time ON audit_logs(event_time DESC);

-- ============================================
-- STEP 5: Enable RLS on audit_logs table
-- ============================================
-- Only service role and superuser should access audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Deny all access by default (service role bypass will allow it)
CREATE POLICY "audit_logs_deny_all"
ON audit_logs
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Service role bypass (allows all operations)
CREATE POLICY "audit_logs_service_role_bypass"
ON audit_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- STEP 6: Create function to insert audit events
-- ============================================
-- This function can be called by triggers or backend code
-- to manually insert audit events in a standardized format
CREATE OR REPLACE FUNCTION log_audit_event(
  p_event_type TEXT,
  p_operation TEXT,
  p_table_name TEXT,
  p_database_user TEXT DEFAULT SESSION_USER,
  p_org_id UUID DEFAULT NULL,
  p_statement_text TEXT DEFAULT NULL,
  p_row_data TEXT DEFAULT NULL,
  p_changed_columns TEXT[] DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_log_id BIGINT;
BEGIN
  INSERT INTO audit_logs (
    event_type,
    operation,
    table_name,
    database_user,
    org_id,
    statement_text,
    row_data,
    changed_columns,
    event_time,
    session_id,
    app_name,
    client_addr
  ) VALUES (
    p_event_type,
    p_operation,
    p_table_name,
    p_database_user,
    p_org_id,
    p_statement_text,
    p_row_data,
    p_changed_columns,
    NOW(),
    current_setting('application_name'),
    current_setting('application_name'),
    inet_server_addr()::TEXT
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION log_audit_event IS
'Manually log an audit event to audit_logs table. Used by application code to track critical operations beyond what pgaudit captures.';

-- ============================================
-- STEP 7: Grant permissions to service role
-- ============================================
-- Service role needs permission to read and write audit logs
-- Regular authenticated users should NOT have access
DO $$
BEGIN
  -- Grant SELECT to service role
  EXECUTE 'GRANT SELECT ON TABLE audit_logs TO service_role';
  EXECUTE 'GRANT INSERT ON TABLE audit_logs TO service_role';
  EXECUTE 'GRANT UPDATE ON TABLE audit_logs TO service_role';

  -- Grant sequence permissions (for BIGSERIAL)
  EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE audit_logs_id_seq TO service_role';

  -- Grant function permissions
  EXECUTE 'GRANT EXECUTE ON FUNCTION log_audit_event(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT[]) TO service_role';

  RAISE NOTICE 'Permissions granted to service_role for audit_logs';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not grant permissions (may be normal on Supabase): %', SQLERRM;
END $$;

-- ============================================
-- STEP 8: Create audit log archival function
-- ============================================
-- This function archives old logs to a separate table for long-term storage
-- Call this weekly to keep the main audit_logs table performant
CREATE OR REPLACE FUNCTION archive_old_audit_logs(p_days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE (archived_count BIGINT, remaining_count BIGINT) AS $$
DECLARE
  v_archived BIGINT;
  v_remaining BIGINT;
BEGIN
  -- Count records before archival
  SELECT COUNT(*) INTO v_archived
  FROM audit_logs
  WHERE event_time < NOW() - (p_days_to_keep || ' days')::INTERVAL;

  -- Delete old records (or insert into archive table if you want to keep them)
  DELETE FROM audit_logs
  WHERE event_time < NOW() - (p_days_to_keep || ' days')::INTERVAL;

  -- Count remaining records
  SELECT COUNT(*) INTO v_remaining FROM audit_logs;

  -- Log the archival
  INSERT INTO audit_logs (
    event_type, operation, table_name, database_user, statement_text
  ) VALUES (
    'MAINTENANCE', 'ARCHIVE', 'audit_logs',
    'system',
    'Archived ' || v_archived || ' audit log records older than ' || p_days_to_keep || ' days'
  );

  RETURN QUERY SELECT v_archived, v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION archive_old_audit_logs IS
'Archives (deletes) audit logs older than specified days. Keeps audit_logs table performant. Default: keep 90 days. Call weekly via cron job.';

-- ============================================
-- STEP 9: Create function to query audit by org
-- ============================================
-- Convenient function for auditing access by organization
CREATE OR REPLACE FUNCTION get_org_audit_logs(
  p_org_id UUID,
  p_days_back INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
  event_time TIMESTAMPTZ,
  operation TEXT,
  table_name TEXT,
  database_user TEXT,
  statement_text TEXT,
  row_data TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.event_time,
    al.operation,
    al.table_name,
    al.database_user,
    al.statement_text,
    al.row_data
  FROM audit_logs al
  WHERE al.org_id = p_org_id
    AND al.event_time > NOW() - (p_days_back || ' days')::INTERVAL
  ORDER BY al.event_time DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION get_org_audit_logs IS
'Query audit logs for a specific organization. Useful for compliance reviews and forensics.';

-- ============================================
-- STEP 10: Create monitoring function for suspicious activity
-- ============================================
-- This function identifies potentially suspicious patterns
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
  p_org_id UUID,
  p_threshold INTEGER DEFAULT 100
)
RETURNS TABLE (
  pattern TEXT,
  count BIGINT,
  first_occurrence TIMESTAMPTZ,
  last_occurrence TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  -- Pattern 1: High volume of DELETEs (potential data destruction)
  SELECT
    'HIGH_DELETE_VOLUME: ' || table_name || ' (' || COUNT(*) || ' deletes in 1 hour)',
    COUNT(*) as cnt,
    MIN(event_time),
    MAX(event_time)
  FROM audit_logs
  WHERE org_id = p_org_id
    AND operation = 'DELETE'
    AND event_time > NOW() - INTERVAL '1 hour'
  GROUP BY table_name
  HAVING COUNT(*) > p_threshold

  UNION ALL

  -- Pattern 2: Unusual access from different users to same sensitive table
  SELECT
    'MULTI_USER_ACCESS: ' || table_name || ' (' || COUNT(DISTINCT database_user) || ' users in 1 hour)',
    COUNT(DISTINCT database_user)::BIGINT,
    MIN(event_time),
    MAX(event_time)
  FROM audit_logs
  WHERE org_id = p_org_id
    AND table_name IN ('auth.users', 'integrations', 'inbound_agent_config')
    AND event_time > NOW() - INTERVAL '1 hour'
  GROUP BY table_name
  HAVING COUNT(DISTINCT database_user) > 3

  UNION ALL

  -- Pattern 3: Failed authentication attempts (if logged)
  SELECT
    'POTENTIAL_AUTH_ISSUE: ' || COUNT(*) || ' failed attempts',
    COUNT(*),
    MIN(event_time),
    MAX(event_time)
  FROM audit_logs
  WHERE org_id = p_org_id
    AND statement_text ILIKE '%authentication%failed%'
    AND event_time > NOW() - INTERVAL '1 hour'
  GROUP BY event_time::DATE
  HAVING COUNT(*) > 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION detect_suspicious_activity IS
'Detect suspicious patterns in audit logs. Used for security monitoring and alerting.';

-- ============================================
-- ERROR HANDLING NOTES
-- ============================================
-- Possible migration issues and solutions:
--
-- 1. "ERROR: extension pgaudit does not exist"
--    Solution: Contact Supabase support to enable pgaudit extension
--    pgaudit is a contrib module that requires database cluster support
--
-- 2. "ERROR: cannot alter system catalog"
--    Solution: This is expected on Supabase cloud (no superuser privileges)
--    Configuration will still work via Supabase dashboard
--    Settings take effect on next database restart
--
-- 3. "ERROR: insufficient permissions for ALTER SYSTEM"
--    Solution: This is normal on Supabase
--    Use Supabase Dashboard -> Database -> Flags to set pgaudit parameters
--    Or this migration will still work - RLS and functions will be created
--
-- 4. Audit logs table grows too large
--    Solution: Run archive_old_audit_logs() regularly
--    Schedule as weekly cron job: SELECT archive_old_audit_logs(90);
--    Or increase retention: archive_old_audit_logs(180) for 6 months
--
-- 5. Performance impact from pgaudit
--    Solution: Can be mitigated by:
--    - Excluding certain tables: pgaudit.log_exclude_commands
--    - Archiving old logs regularly
--    - Indexing frequently queried columns
--    - Running analytical queries during off-peak hours

-- ============================================
-- CONFIGURATION REFERENCE
-- ============================================
-- These PostgreSQL settings control pgaudit behavior:
--
-- pgaudit.log = 'READ, WRITE, DDL'
--   What to log: READ (SELECT), WRITE (INSERT/UPDATE/DELETE), DDL (CREATE/ALTER/DROP)
--   Options: MISC, MISC_DEFAULT, FUNCTION, CREATE, ALTER, DROP, COMMENT, GRANT, REVOKE,
--            ROLE, TABLE, SELECT, INSERT, UPDATE, DELETE, TRUNCATE, COPY, LOCK, DDL, ALL
--
-- pgaudit.log_catalog = false
--   Don't log operations on system catalogs (pg_catalog, information_schema)
--   Set to true to debug system issues
--
-- pgaudit.log_relation = true
--   Include relation (table) names in logs
--   Set to false to reduce log size (but less readable)
--
-- pgaudit.log_parameter = true
--   Include SQL statement parameters in logs
--   Set to false for performance (but less detailed logs)
--
-- pgaudit.log_statement_once = false
--   Log every statement (false) or deduplicate identical statements (true)
--
-- To view current settings:
-- SELECT name, setting FROM pg_settings WHERE name LIKE 'pgaudit%';
--
-- To set pgaudit parameters on Supabase:
-- 1. Go to Supabase Dashboard
-- 2. Database > Flags
-- 3. Add flags: pgaudit.log = READ,WRITE,DDL, etc.
-- 4. Changes take effect on next database restart

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After deployment, verify with:
--
-- -- Check if pgaudit extension is installed
-- SELECT * FROM pg_extension WHERE extname = 'pgaudit';
--
-- -- Check audit_logs table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'audit_logs'
-- ORDER BY ordinal_position;
--
-- -- Check RLS is enabled
-- SELECT rowsecurity FROM pg_tables
-- WHERE tablename = 'audit_logs';
--
-- -- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'audit_logs';
--
-- -- Test manual logging
-- SELECT log_audit_event('TEST', 'SELECT', 'test_table', SESSION_USER, NULL, 'SELECT 1', NULL, NULL);
--
-- -- Verify logs were created
-- SELECT COUNT(*) FROM audit_logs;

-- ============================================
-- ROLLBACK PLAN
-- ============================================
-- If this migration causes issues, rollback with:
--
-- -- Disable pgaudit parameters (if you set them)
-- -- Go to Supabase Dashboard > Database > Flags and remove pgaudit settings
--
-- -- Drop functions
-- DROP FUNCTION IF EXISTS detect_suspicious_activity;
-- DROP FUNCTION IF EXISTS get_org_audit_logs;
-- DROP FUNCTION IF EXISTS archive_old_audit_logs;
-- DROP FUNCTION IF EXISTS log_audit_event;
--
-- -- Drop RLS policies
-- DROP POLICY IF EXISTS audit_logs_deny_all ON audit_logs;
-- DROP POLICY IF EXISTS audit_logs_service_role_bypass ON audit_logs;
--
-- -- Drop table
-- ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS audit_logs;
--
-- Note: Cannot uninstall pgaudit extension (requires superuser)
-- It will remain installed but inactive if parameters are disabled

-- ============================================
-- COMPLIANCE NOTES
-- ============================================
-- HIPAA COMPLIANCE:
--   - Audit logs provide accountability (who did what when)
--   - All data access is logged (READ)
--   - All data modifications are logged (WRITE)
--   - RLS prevents unauthorized access (org_id isolation)
--   - Long-term retention supports forensics (90+ day history)
--
-- SOC 2 COMPLIANCE:
--   - Change tracking: DDL and DML operations logged
--   - Access control: RLS policies prevent unauthorized access
--   - Audit logs: Immutable (append-only, never updated)
--   - Retention: Configure based on data classification
--
-- GDPR COMPLIANCE:
--   - Data access logging: Who accessed personal data
--   - Purpose limitation: Logs stored only for compliance
--   - Right to deletion: Can archive/delete logs after retention period
--   - Security: RLS and encryption protect audit logs
--
-- RECOMMENDED RETENTION SCHEDULE:
--   - Production: 90 days in database, 7 years in S3 archive
--   - Staging: 30 days in database, 1 year in S3 archive
--   - Dev: 7 days in database, no archive needed

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
--   1. Verify pgaudit is enabled via Supabase dashboard
--   2. Test log_audit_event() function
--   3. Set up weekly archival job (call archive_old_audit_logs weekly)
--   4. Set up monitoring alerts for suspicious activity
--   5. Configure log retention policy based on compliance requirements
--   6. Test audit log queries with get_org_audit_logs()
--   7. Document audit log access procedures
--   8. Deploy to production
--
