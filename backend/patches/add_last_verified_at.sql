-- Apply via Supabase Dashboard -> SQL Editor
BEGIN;

ALTER TABLE org_credentials 
ADD COLUMN last_verified_at TIMESTAMPTZ;

COMMIT;

-- Verify with:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'org_credentials';
