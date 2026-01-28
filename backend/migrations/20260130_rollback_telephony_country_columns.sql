/**
 * Rollback Migration: Organizations Telephony Columns
 *
 * Purpose: Remove telephony_country, assigned_twilio_number, forwarding_carrier columns
 * Rollback for: 20260130_add_telephony_country_to_orgs.sql
 *
 * Run this if deployment fails or needs to be reverted:
 * psql $DATABASE_URL -f backend/migrations/20260130_rollback_telephony_country_columns.sql
 */

-- ============================================
-- ROLLBACK STEPS (Reverse Order of Creation)
-- ============================================

BEGIN;

-- Step 1: Drop indexes first (dependencies)
DROP INDEX IF EXISTS idx_organizations_telephony;

-- Step 2: Drop columns
ALTER TABLE organizations
DROP COLUMN IF EXISTS telephony_country,
DROP COLUMN IF EXISTS assigned_twilio_number,
DROP COLUMN IF EXISTS forwarding_carrier;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify columns no longer exist (should return 0 rows for each)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'organizations'
AND column_name IN ('telephony_country', 'assigned_twilio_number', 'forwarding_carrier');
-- Expected: 0 rows

-- Verify index removed
SELECT indexname
FROM pg_indexes
WHERE tablename = 'organizations'
AND indexname = 'idx_organizations_telephony';
-- Expected: 0 rows

-- ============================================
-- DATA LOSS WARNING
-- ============================================

-- ⚠️ WARNING: This rollback will permanently delete:
-- - All telephony_country selections
-- - All assigned_twilio_number assignments
-- - All forwarding_carrier selections
--
-- If you need to preserve this data, export first:
-- COPY (SELECT id, telephony_country, assigned_twilio_number, forwarding_carrier FROM organizations WHERE telephony_country IS NOT NULL) TO '/tmp/telephony_backup.csv' CSV HEADER;
--
-- To restore after re-applying migration:
-- \copy organizations (id, telephony_country, assigned_twilio_number, forwarding_carrier) FROM '/tmp/telephony_backup.csv' CSV HEADER
