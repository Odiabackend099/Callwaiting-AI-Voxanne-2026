-- ============================================
-- VOXANNE PHASE 1 MVP: Add org_id to Webhook Events Table
-- Date: 2025-01-10
-- Purpose: Enable org-scoped webhook idempotency and isolation
-- Context: Multi-tenant security - prevent cross-org webhook event reuse
-- ============================================
--
-- CURRENT STATE:
--   processed_webhook_events table has UNIQUE(event_id)
--   This allows one event_id globally, across all orgs
--   SECURITY ISSUE: If org A and org B both receive same event_id, only first org processes it
--
-- TARGET STATE:
--   processed_webhook_events will have UNIQUE(org_id, event_id)
--   Each org can have its own event_id without conflict
--   Prevents webhook event replay attacks between orgs
--
-- MIGRATION STRATEGY:
--   1. Add org_id column (nullable initially)
--   2. Backfill org_id from call_logs table (via call_id relationship)
--   3. Create new composite index (org_id, event_id)
--   4. Drop old single-column unique index
--   5. Add NOT NULL constraint to org_id
--   6. Verify no data loss
--
-- ============================================

-- ============================================
-- STEP 1: Add org_id column (nullable)
-- ============================================
-- This column is added as nullable so we can backfill data safely
ALTER TABLE processed_webhook_events
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add comment explaining the column
COMMENT ON COLUMN processed_webhook_events.org_id IS
'Organization ID for multi-tenant webhook isolation. Ensures each org has unique event_id namespace.';

-- ============================================
-- STEP 2: Backfill org_id from call_logs or calls table
-- ============================================
-- Strategy: For each webhook event, find associated call and extract org_id
-- This handles different webhook event types that reference different tables
DO $$
DECLARE
  v_updated_count INTEGER := 0;
  v_no_match_count INTEGER := 0;
BEGIN
  -- For webhook events linked to call_logs (most common for Vapi webhooks)
  UPDATE processed_webhook_events we
  SET org_id = cl.org_id
  FROM call_logs cl
  WHERE we.call_log_id = cl.id
    AND we.org_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % rows from call_logs', v_updated_count;

  -- For webhook events linked to calls table (fallback)
  UPDATE processed_webhook_events we
  SET org_id = c.org_id
  FROM calls c
  WHERE we.call_id = c.id
    AND we.org_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % additional rows from calls', v_updated_count;

  -- For webhook events linked via vapi_call_id
  UPDATE processed_webhook_events we
  SET org_id = c.org_id
  FROM calls c
  WHERE we.vapi_call_id IS NOT NULL
    AND we.vapi_call_id = c.vapi_call_id
    AND we.org_id IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % additional rows from vapi_call_id', v_updated_count;

  -- Check for any remaining NULL org_id values
  SELECT COUNT(*) INTO v_no_match_count
  FROM processed_webhook_events
  WHERE org_id IS NULL;

  IF v_no_match_count > 0 THEN
    RAISE WARNING 'WARNING: % webhook events could not be backfilled with org_id. These may be orphaned or incomplete records.', v_no_match_count;
    -- Backfill with default org for data integrity
    UPDATE processed_webhook_events
    SET org_id = 'a0000000-0000-0000-0000-000000000001'::UUID
    WHERE org_id IS NULL;
    RAISE NOTICE 'Backfilled % orphaned records with default org_id', v_no_match_count;
  END IF;
END $$;

-- ============================================
-- STEP 3: Create new composite UNIQUE index
-- ============================================
-- This index enforces unique constraint on (org_id, event_id)
-- allowing each org to have its own event_id namespace
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_webhook_events_org_event
ON processed_webhook_events(org_id, event_id);

-- ============================================
-- STEP 4: Drop old single-column UNIQUE index
-- ============================================
-- First, find and drop the old unique constraint
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find the existing unique constraint on processed_webhook_events
  SELECT constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints
  WHERE table_name = 'processed_webhook_events'
    AND constraint_type = 'UNIQUE'
    AND constraint_name NOT LIKE 'idx_%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE processed_webhook_events DROP CONSTRAINT ' || v_constraint_name;
    RAISE NOTICE 'Dropped old constraint: %', v_constraint_name;
  END IF;

  -- Also drop any old index named like "processed_webhook_events_event_id_key"
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'processed_webhook_events'
      AND indexname LIKE '%event_id%'
      AND indexname NOT LIKE '%org_event%'
  ) THEN
    DROP INDEX IF EXISTS processed_webhook_events_event_id_key;
    RAISE NOTICE 'Dropped old index: processed_webhook_events_event_id_key';
  END IF;
END $$;

-- ============================================
-- STEP 5: Add NOT NULL constraint to org_id
-- ============================================
-- Now that we've backfilled all values, make org_id required
ALTER TABLE processed_webhook_events
ALTER COLUMN org_id SET NOT NULL;

-- ============================================
-- STEP 6: Verify data integrity
-- ============================================
DO $$
DECLARE
  v_total_rows INTEGER;
  v_null_org_count INTEGER;
  v_duplicate_count INTEGER;
BEGIN
  -- Count total rows
  SELECT COUNT(*) INTO v_total_rows
  FROM processed_webhook_events;

  -- Count NULL org_ids (should be 0)
  SELECT COUNT(*) INTO v_null_org_count
  FROM processed_webhook_events
  WHERE org_id IS NULL;

  -- Count potential duplicates (should be 0 if index is working)
  SELECT COUNT(*) INTO v_duplicate_count
  FROM (
    SELECT org_id, event_id, COUNT(*)
    FROM processed_webhook_events
    GROUP BY org_id, event_id
    HAVING COUNT(*) > 1
  ) dupes;

  RAISE NOTICE '=== DATA INTEGRITY CHECK ===';
  RAISE NOTICE 'Total webhook events: %', v_total_rows;
  RAISE NOTICE 'NULL org_id count: % (should be 0)', v_null_org_count;
  RAISE NOTICE 'Duplicate (org_id, event_id) count: % (should be 0)', v_duplicate_count;

  IF v_null_org_count > 0 THEN
    RAISE EXCEPTION 'FAILED: Found % rows with NULL org_id. Migration did not backfill correctly.', v_null_org_count;
  END IF;

  IF v_duplicate_count > 0 THEN
    RAISE WARNING 'WARNING: Found % duplicate (org_id, event_id) pairs. These may cause constraint violations.', v_duplicate_count;
  END IF;

  RAISE NOTICE 'Data integrity check PASSED';
END $$;

-- ============================================
-- STEP 7: Update RLS if table has RLS enabled
-- ============================================
-- Check if table has RLS and update policies if needed
DO $$
DECLARE
  v_rls_enabled BOOLEAN;
BEGIN
  -- Check if RLS is enabled on this table
  SELECT rowsecurity INTO v_rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = 'processed_webhook_events';

  IF v_rls_enabled THEN
    RAISE NOTICE 'RLS is enabled on processed_webhook_events. Review policies to include org_id checks.';

    -- Drop old policies that don't check org_id
    DROP POLICY IF EXISTS "processed_webhook_events_select" ON processed_webhook_events;
    DROP POLICY IF EXISTS "processed_webhook_events_insert" ON processed_webhook_events;

    -- Note: processed_webhook_events is typically service-role only (backend operations)
    -- RLS policies may not be needed if accessed only by service role
    -- Uncomment below if you need to add org-scoped RLS policies
    /*
    CREATE POLICY "webhook_events_org_isolation"
    ON processed_webhook_events
    FOR SELECT
    TO authenticated
    USING (org_id = (SELECT public.auth_org_id()));
    */
  ELSE
    RAISE NOTICE 'RLS is NOT enabled on processed_webhook_events (expected). Service role will have access.';
  END IF;
END $$;

-- ============================================
-- ERROR HANDLING NOTES
-- ============================================
-- Possible migration issues and solutions:
--
-- 1. "ERROR: relation organizations does not exist"
--    Solution: Run 20250110_create_organizations_table_foundation.sql BEFORE this migration
--
-- 2. "ERROR: relation call_logs does not exist"
--    Solution: call_logs table may not exist yet. Backfill will still work for calls table.
--
-- 3. "ERROR: duplicate key value violates unique constraint"
--    Solution: The composite index found duplicate (org_id, event_id) pairs
--    Investigation: SELECT org_id, event_id, COUNT(*) FROM processed_webhook_events
--                   GROUP BY org_id, event_id HAVING COUNT(*) > 1;
--    Fix: Manually delete duplicate rows (keep most recent based on created_at)
--         Then retry migration
--
-- 4. "ERROR: Backfill failed - org_id still NULL for most rows"
--    Solution: The webhook event table structure may be different
--    Investigation: DESCRIBE processed_webhook_events;
--    Fix: Update the backfill DO block to match actual column names
--
-- 5. Constraint violation on deployment to production
--    Solution: May be due to old event_id constraint still enforced
--    Fix: Ensure old constraint is dropped BEFORE adding NOT NULL constraint

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After deployment, verify with:
--
-- -- Check org_id column exists and is NOT NULL
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'processed_webhook_events'
--   AND column_name = 'org_id';
--
-- -- Check new composite index
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'processed_webhook_events'
--   AND indexname LIKE '%org_event%';
--
-- -- Verify no old unique constraints on just event_id
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'processed_webhook_events'
--   AND constraint_type = 'UNIQUE';
--
-- -- Test idempotency with org-scoping
-- INSERT INTO processed_webhook_events (org_id, event_id, ...)
-- VALUES ('org-a-id', 'event-123', ...)
-- ON CONFLICT (org_id, event_id) DO UPDATE SET processed_at = NOW();
-- -- Should succeed and use the composite constraint

-- ============================================
-- ROLLBACK PLAN
-- ============================================
-- If this migration causes issues, rollback with:
--
-- -- Drop new composite index
-- DROP INDEX IF EXISTS idx_processed_webhook_events_org_event;
--
-- -- Restore old unique constraint (if you saved the definition)
-- ALTER TABLE processed_webhook_events
-- ADD CONSTRAINT processed_webhook_events_event_id_key UNIQUE(event_id);
--
-- -- Remove org_id column
-- ALTER TABLE processed_webhook_events
-- DROP COLUMN IF EXISTS org_id;
--
-- ============================================
-- SECURITY NOTES
-- ============================================
-- This migration fixes a critical security issue:
--
-- BEFORE: processed_webhook_events used UNIQUE(event_id)
-- - Org A receives event_id 'vapi-123' -> processed
-- - Org B receives event_id 'vapi-123' -> REJECTED (duplicate)
-- - Security implication: Event reuse could cause org B to lose webhook data
--
-- AFTER: processed_webhook_events uses UNIQUE(org_id, event_id)
-- - Org A processes event_id 'vapi-123' -> success
-- - Org B can also process event_id 'vapi-123' -> success (different namespace)
-- - Each org has its own event_id namespace (like per-tenant event tracking)

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
--   1. Verify table structure and constraints
--   2. Test webhook idempotency with org_id
--   3. Deploy to production
--   4. Monitor webhook processing for any issues
--
