-- Migration: Webhook Unique Constraints
-- Date: 2025-12-16
-- Purpose: Add unique constraints to prevent duplicate webhook processing
-- Fixes: Race condition where concurrent webhooks create duplicate records
-- ============================================================================
-- BACKUP EXISTING DATA (Safety measure)
-- ============================================================================
-- Create backup tables (optional, for rollback)
-- Uncomment if you want to keep backups
-- CREATE TABLE IF NOT EXISTS call_tracking_backup_20251216 AS SELECT * FROM call_tracking;
-- CREATE TABLE IF NOT EXISTS processed_webhook_events_backup_20251216 AS SELECT * FROM processed_webhook_events;
-- ============================================================================
-- CLEAN UP EXISTING DUPLICATES (If any)
-- ============================================================================
-- Find and remove duplicate call_tracking rows (keep oldest)
WITH duplicates AS (
    SELECT id,
        vapi_call_id,
        ROW_NUMBER() OVER (
            PARTITION BY vapi_call_id
            ORDER BY created_at ASC
        ) as rn
    FROM call_tracking
    WHERE vapi_call_id IS NOT NULL
)
DELETE FROM call_tracking
WHERE id IN (
        SELECT id
        FROM duplicates
        WHERE rn > 1
    );
-- Find and remove duplicate processed_webhook_events (keep oldest)
WITH duplicates AS (
    SELECT id,
        event_id,
        ROW_NUMBER() OVER (
            PARTITION BY event_id
            ORDER BY created_at ASC
        ) as rn
    FROM processed_webhook_events
    WHERE event_id IS NOT NULL
)
DELETE FROM processed_webhook_events
WHERE id IN (
        SELECT id
        FROM duplicates
        WHERE rn > 1
    );
-- ============================================================================
-- ADD UNIQUE CONSTRAINTS
-- ============================================================================
-- Unique constraint on call_tracking.vapi_call_id
-- Prevents duplicate call tracking records for the same Vapi call
-- Handles race condition where multiple webhooks arrive simultaneously
ALTER TABLE call_tracking
ADD CONSTRAINT call_tracking_vapi_call_id_unique UNIQUE (vapi_call_id);
-- Unique constraint on processed_webhook_events.event_id
-- Ensures true idempotency (atomic check-and-insert)
-- Prevents race condition in idempotency checks
ALTER TABLE processed_webhook_events
ADD CONSTRAINT processed_webhook_events_event_id_unique UNIQUE (event_id);
-- Unique constraint on call_logs.vapi_call_id
-- Prevents duplicate call log entries
ALTER TABLE call_logs
ADD CONSTRAINT call_logs_vapi_call_id_unique UNIQUE (vapi_call_id);
-- Unique constraint on calls.vapi_call_id
-- Prevents duplicate call entries
ALTER TABLE calls
ADD CONSTRAINT calls_vapi_call_id_unique UNIQUE (vapi_call_id);
-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify constraints were created
DO $$
DECLARE constraint_count INTEGER;
BEGIN
SELECT COUNT(*) INTO constraint_count
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
    AND constraint_type = 'UNIQUE'
    AND constraint_name LIKE '%vapi_call_id%';
RAISE NOTICE 'Unique constraints created: %',
constraint_count;
IF constraint_count < 3 THEN RAISE EXCEPTION 'Expected at least 3 unique constraints, found %',
constraint_count;
END IF;
END $$;
-- ============================================================================
-- ROLLBACK INSTRUCTIONS (If needed)
-- ============================================================================
-- To rollback this migration:
-- ALTER TABLE call_tracking DROP CONSTRAINT IF EXISTS call_tracking_vapi_call_id_unique;
-- ALTER TABLE processed_webhook_events DROP CONSTRAINT IF EXISTS processed_webhook_events_event_id_unique;
-- ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS call_logs_vapi_call_id_unique;
-- ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_vapi_call_id_unique;
-- ============================================================================
-- NOTES
-- ============================================================================
-- Impact on webhook handler:
-- 1. INSERT operations may now fail with unique constraint violation (23505)
-- 2. Code must handle this error and fetch existing record instead
-- 3. This is EXPECTED behavior and prevents duplicate processing
-- 4. See code_review_webhooks.md Issue 2.3 for implementation details