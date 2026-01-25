-- ============================================
-- Create Generic updated_at Trigger Function
-- Date: 2026-01-20
-- Purpose: Reusable trigger function for all tables that need automatic updated_at tracking
-- ============================================

-- CRITICAL: This migration MUST be applied BEFORE migrations that reference update_updated_at_column()
-- Migrations that depend on this:
-- - 20260125_create_messages_table.sql
-- - 20260113_create_follow_up_tasks_table.sql
-- - add-csv-imports-tables.sql

-- Create the generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment for clarity
COMMENT ON FUNCTION update_updated_at_column() IS
'Generic trigger function that updates the updated_at column to the current timestamp.
Can be reused across multiple tables instead of creating table-specific versions.';

-- ============================================
-- Rollback script (for reference):
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
-- ============================================
