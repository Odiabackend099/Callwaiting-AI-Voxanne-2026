/**
 * Database Migration: Add Index on organizations.telephony_country
 *
 * Purpose: Optimize queries that filter by telephony_country
 * Date: 2026-01-30
 * Context: Critical Issue #7 from senior engineer code review
 *
 * Use Case:
 * - Analytics: COUNT(*) GROUP BY telephony_country
 * - Filtering: SELECT * FROM organizations WHERE telephony_country = 'NG'
 * - Reporting: Show country distribution dashboard
 *
 * Performance Impact:
 * - Before: Full table scan (seq_scan) on organizations table
 * - After: Index scan (index_scan) - 10-100x faster for large tables
 */

-- ============================================
-- ADD INDEX ON TELEPHONY_COUNTRY
-- ============================================

BEGIN;

-- Create index on telephony_country column
-- CONCURRENTLY prevents table locking during index creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organizations_telephony_country
ON organizations(telephony_country)
WHERE telephony_country IS NOT NULL;

-- Add index comment for documentation
COMMENT ON INDEX idx_organizations_telephony_country IS
'Optimizes queries filtering by telephony_country (e.g., analytics, country distribution)';

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'organizations'
AND indexname = 'idx_organizations_telephony_country';
-- Expected: 1 row with index definition

-- Test query performance (should use Index Scan)
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM organizations
WHERE telephony_country = 'NG';
-- Expected: Index Scan using idx_organizations_telephony_country (cost low)

-- Check index size
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexrelname = 'idx_organizations_telephony_country';
-- Expected: Small size (typically < 1 MB for thousands of orgs)

-- ============================================
-- ROLLBACK INSTRUCTIONS
-- ============================================

-- To remove this index:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_organizations_telephony_country;
