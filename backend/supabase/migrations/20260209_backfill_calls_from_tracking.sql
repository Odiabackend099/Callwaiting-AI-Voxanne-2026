-- Backfill calls table from call_tracking for organizations with missing data
-- Date: 2026-02-09
-- Purpose: Ensure ALL organizations see their call data in the dashboard

-- This migration copies calls from call_tracking to calls table where:
-- 1. The vapi_call_id exists in call_tracking but not in calls
-- 2. The call has actually happened (not just queued)

INSERT INTO calls (
  id,
  org_id,
  vapi_call_id,
  phone_number,
  from_number,
  caller_name,
  call_direction,
  status,
  started_at,
  created_at,
  updated_at,
  is_test_call,
  metadata
)
SELECT
  gen_random_uuid() as id,
  ct.org_id,
  ct.vapi_call_id,
  ct.phone as phone_number,
  ct.phone as from_number,
  COALESCE(
    (SELECT c.name FROM contacts c WHERE c.org_id = ct.org_id AND c.phone = ct.phone LIMIT 1),
    'Unknown Caller'
  ) as caller_name,
  CASE
    WHEN ct.metadata->>'channel' = 'outbound' THEN 'outbound'
    WHEN ct.metadata->>'channel' = 'web' THEN 'inbound'
    ELSE 'inbound'
  END as call_direction,
  CASE
    WHEN ct.call_outcome = 'completed' THEN 'completed'
    WHEN ct.call_outcome = 'failed' THEN 'failed'
    WHEN ct.call_outcome = 'no-answer' THEN 'no-answer'
    WHEN ct.call_outcome = 'voicemail' THEN 'voicemail'
    ELSE 'completed'
  END as status,
  ct.called_at as started_at,
  ct.called_at as created_at,
  NOW() as updated_at,
  COALESCE((ct.metadata->>'is_test_call')::boolean, false) as is_test_call,
  ct.metadata
FROM call_tracking ct
WHERE ct.vapi_call_id IS NOT NULL
  AND ct.vapi_call_id != ''
  AND ct.call_outcome != 'queued'  -- Only backfill calls that actually happened
  AND NOT EXISTS (
    SELECT 1 FROM calls c WHERE c.vapi_call_id = ct.vapi_call_id
  )
ON CONFLICT (vapi_call_id) DO NOTHING;

-- Log how many records were backfilled
DO $$
DECLARE
  backfilled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backfilled_count
  FROM call_tracking ct
  WHERE ct.vapi_call_id IS NOT NULL
    AND ct.vapi_call_id != ''
    AND ct.call_outcome != 'queued'
    AND NOT EXISTS (
      SELECT 1 FROM calls c WHERE c.vapi_call_id = ct.vapi_call_id
    );

  RAISE NOTICE 'Backfilled % calls from call_tracking to calls table', backfilled_count;
END $$;
