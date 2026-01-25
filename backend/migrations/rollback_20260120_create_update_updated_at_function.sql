-- Rollback: 20260120_create_update_updated_at_function.sql
-- Removes the generic update_updated_at_column() trigger function
--
-- WARNING: This will fail if any triggers still reference this function.
-- Drop dependent triggers first before rolling back this migration.

-- Drop the function (CASCADE to drop dependent triggers/objects)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Verify rollback
-- Run: SELECT proname FROM pg_proc WHERE proname = 'update_updated_at_column';
-- Expected: No results
