/**
 * Rollback Migration: Carrier Forwarding Rules Table
 *
 * Purpose: Safely remove carrier_forwarding_rules table and related objects
 * Rollback for: 20260130_create_carrier_forwarding_rules.sql
 *
 * Run this if deployment fails or needs to be reverted:
 * psql $DATABASE_URL -f backend/migrations/20260130_rollback_carrier_forwarding_rules.sql
 */

-- ============================================
-- ROLLBACK STEPS (Reverse Order of Creation)
-- ============================================

BEGIN;

-- Step 1: Drop RLS policies
DROP POLICY IF EXISTS carrier_forwarding_rules_select_policy ON carrier_forwarding_rules;
DROP POLICY IF EXISTS carrier_forwarding_rules_service_policy ON carrier_forwarding_rules;

-- Step 2: Revoke grants
REVOKE SELECT ON carrier_forwarding_rules FROM authenticated;
REVOKE ALL ON carrier_forwarding_rules FROM service_role;

-- Step 3: Drop indexes
DROP INDEX IF EXISTS idx_carrier_rules_country;
DROP INDEX IF EXISTS idx_carrier_rules_recommended;

-- Step 4: Drop table (CASCADE removes dependencies)
DROP TABLE IF EXISTS carrier_forwarding_rules CASCADE;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify table no longer exists (should return 0 rows)
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'carrier_forwarding_rules'
);
-- Expected: f (false)

-- Verify indexes removed
SELECT indexname
FROM pg_indexes
WHERE tablename = 'carrier_forwarding_rules';
-- Expected: 0 rows

-- Verify RLS policies removed
SELECT policyname
FROM pg_policies
WHERE tablename = 'carrier_forwarding_rules';
-- Expected: 0 rows

-- ============================================
-- CLEANUP NOTES
-- ============================================

-- After running this rollback:
-- 1. Remove backend/src/services/gsm-code-generator-v2.ts
-- 2. Remove backend/src/routes/telephony-country-selection.ts
-- 3. Revert to original gsm-code-generator.ts (hardcoded switch)
-- 4. Remove frontend CountrySelectionStep.tsx component
-- 5. Revert organizations table changes (see rollback_telephony_country_columns.sql)
