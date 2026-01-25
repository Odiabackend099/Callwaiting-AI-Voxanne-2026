-- Rollback: 20260125_create_services_table.sql
-- Removes the services table, function, and all associated policies/triggers
--
-- CAREFUL: This will delete all service definitions. Use only for development/testing.

-- Drop all triggers
DROP TRIGGER IF EXISTS update_services_updated_at ON services;
DROP TRIGGER IF EXISTS prevent_org_id_change_services ON services;

-- Drop all Row Level Security policies
DROP POLICY IF EXISTS services_org_isolation ON services;
DROP POLICY IF EXISTS services_service_role ON services;

-- Disable RLS
-- ALTER TABLE services DISABLE ROW LEVEL SECURITY;

-- Drop all indexes
DROP INDEX IF EXISTS idx_services_org_id;
DROP INDEX IF EXISTS idx_services_org_name_unique;
DROP INDEX IF EXISTS idx_services_keywords;
DROP INDEX IF EXISTS idx_services_status;

-- Drop the PL/pgSQL function
DROP FUNCTION IF EXISTS get_service_price_by_keyword(uuid, text);

-- Drop the table
DROP TABLE IF EXISTS services CASCADE;

-- Verify rollback
-- Run: SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='services');
-- Expected: false
