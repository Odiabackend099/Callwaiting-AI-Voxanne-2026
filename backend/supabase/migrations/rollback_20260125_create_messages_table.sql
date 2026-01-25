-- Rollback: 20260125_create_messages_table.sql
-- Removes the messages table and all associated indexes, policies, and triggers
--
-- CAREFUL: This will delete all message audit logs. Use only for development/testing.
-- For production rollbacks, consider archiving data first.

-- Drop all triggers on messages table
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
DROP TRIGGER IF EXISTS prevent_org_id_change_messages ON messages;

-- Drop all Row Level Security policies
DROP POLICY IF EXISTS messages_org_isolation ON messages;
DROP POLICY IF EXISTS messages_service_role ON messages;

-- Disable RLS (if no other tables need it, this is optional)
-- ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Drop all indexes
DROP INDEX IF EXISTS idx_messages_org_id;
DROP INDEX IF EXISTS idx_messages_contact_id;
DROP INDEX IF EXISTS idx_messages_call_id;
DROP INDEX IF EXISTS idx_messages_method;
DROP INDEX IF EXISTS idx_messages_status;
DROP INDEX IF EXISTS idx_messages_sent_at;
DROP INDEX IF EXISTS idx_messages_org_method_sent;

-- Drop the table
DROP TABLE IF EXISTS messages CASCADE;

-- Verify rollback
-- Run: SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='messages');
-- Expected: false
