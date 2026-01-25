-- Run this in Supabase SQL Editor
-- Purpose: Clear old Google Calendar credentials before re-linking with fixed code
DELETE FROM org_credentials
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
    AND provider = 'google_calendar';
-- Verify deletion
SELECT COUNT(*) as remaining_credentials
FROM org_credentials
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
    AND provider = 'google_calendar';
-- Expected result: 0 rows