-- Migration: Remove leads table and clean schema for production
-- This removes the leads table as lead data lives in Superbiz database
-- Date: 2025-12-15
-- Step 1: Remove foreign key constraint from call_logs
ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS call_logs_lead_id_fkey;
-- Step 2: Drop the lead_id column from call_logs
-- We'll keep call logs but remove the lead reference
ALTER TABLE call_logs DROP COLUMN IF EXISTS lead_id;
-- Step 3: Drop the leads table entirely
DROP TABLE IF EXISTS leads CASCADE;
-- Step 4: Clean up any demo/test data from call_tracking
-- Remove any calls marked as test calls
DELETE FROM call_tracking
WHERE metadata->>'is_test_call' = 'true';
-- Step 5: Clean up corresponding call_logs for test calls
DELETE FROM call_logs
WHERE metadata->>'is_test_call' = 'true';
-- Step 6: Clean up old processed webhook events (keep last 7 days only)
DELETE FROM processed_webhook_events
WHERE created_at < NOW() - INTERVAL '7 days';
-- Step 7: Add comment for documentation
COMMENT ON TABLE call_logs IS 'Production call logs - lead data stored in Superbiz database';
COMMENT ON TABLE call_tracking IS 'Real-time call tracking for dashboard - no demo data';
-- Step 8: Vacuum tables to reclaim space
VACUUM ANALYZE call_logs;
VACUUM ANALYZE call_tracking;
VACUUM ANALYZE processed_webhook_events;