-- Migration: Add unique constraint on vapi_call_id to prevent duplicate call tracking
-- This prevents race conditions where multiple webhooks for the same call create duplicate records
-- Date: 2025-12-15
-- Step 1: Check for existing duplicates and clean them up
-- Find duplicate vapi_call_ids (keep the oldest record, delete newer ones)
WITH duplicates AS (
    SELECT vapi_call_id,
        array_agg(
            id
            ORDER BY created_at ASC
        ) as ids
    FROM call_tracking
    WHERE vapi_call_id IS NOT NULL
    GROUP BY vapi_call_id
    HAVING COUNT(*) > 1
)
DELETE FROM call_tracking
WHERE id IN (
        SELECT unnest(ids [2:]) -- Delete all but the first (oldest) record
        FROM duplicates
    );
-- Step 2: Add unique constraint
-- This will prevent future duplicate inserts
ALTER TABLE call_tracking
ADD CONSTRAINT call_tracking_vapi_call_id_unique UNIQUE (vapi_call_id);
-- Step 3: Create index for performance (if not already exists)
-- This speeds up lookups by vapi_call_id
CREATE INDEX IF NOT EXISTS idx_call_tracking_vapi_call_id ON call_tracking(vapi_call_id);
-- Step 4: Add comment for documentation
COMMENT ON CONSTRAINT call_tracking_vapi_call_id_unique ON call_tracking IS 'Ensures each Vapi call ID appears only once in call tracking to prevent duplicate webhook processing';