-- Google Calendar Connection Reset Script
-- Run this in Supabase SQL Editor to clear the existing connection
-- This forces a fresh OAuth flow with the new email permission scope
-- Replace this org_id with your actual organization ID
UPDATE org_credentials
SET is_active = false,
    encrypted_config = NULL,
    connected_email = NULL,
    updated_at = NOW()
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
    AND provider = 'google_calendar';
-- Verify the reset was successful
SELECT org_id,
    provider,
    is_active,
    connected_email,
    updated_at
FROM org_credentials
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
    AND provider = 'google_calendar';
-- Expected result:
-- is_active: false
-- connected_email: NULL
-- You can now re-link via the dashboard UI