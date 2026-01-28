/**
 * Rollback Migration: Hybrid Forwarding Configs Extension
 *
 * Purpose: Remove country_code and carrier_name columns from hybrid_forwarding_configs
 * Rollback for: 20260130_extend_hybrid_forwarding_configs.sql
 *
 * Run this if deployment fails or needs to be reverted:
 * psql $DATABASE_URL -f backend/migrations/20260130_rollback_hybrid_forwarding_configs.sql
 */

-- ============================================
-- ROLLBACK STEPS (Reverse Order of Creation)
-- ============================================

BEGIN;

-- Step 1: Drop indexes first (dependencies)
DROP INDEX IF EXISTS idx_forwarding_configs_country;

-- Step 2: Drop columns
ALTER TABLE hybrid_forwarding_configs
DROP COLUMN IF EXISTS country_code,
DROP COLUMN IF EXISTS carrier_name;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify columns no longer exist (should return 0 rows)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'hybrid_forwarding_configs'
AND column_name IN ('country_code', 'carrier_name');
-- Expected: 0 rows

-- Verify index removed
SELECT indexname
FROM pg_indexes
WHERE tablename = 'hybrid_forwarding_configs'
AND indexname = 'idx_forwarding_configs_country';
-- Expected: 0 rows

-- Verify existing data still accessible
SELECT COUNT(*) as existing_configs
FROM hybrid_forwarding_configs;
-- Expected: [count of existing configs, unchanged]

-- ============================================
-- DATA LOSS WARNING
-- ============================================

-- ⚠️ WARNING: This rollback will permanently delete:
-- - All country_code values
-- - All carrier_name values
--
-- If you need to preserve this data, export first:
-- COPY (SELECT id, country_code, carrier_name FROM hybrid_forwarding_configs WHERE country_code IS NOT NULL) TO '/tmp/forwarding_configs_backup.csv' CSV HEADER;
--
-- To restore after re-applying migration:
-- \copy hybrid_forwarding_configs (id, country_code, carrier_name) FROM '/tmp/forwarding_configs_backup.csv' CSV HEADER ON CONFLICT (id) DO UPDATE SET country_code = EXCLUDED.country_code, carrier_name = EXCLUDED.carrier_name
