-- Add cc_email column to email_tracking table
-- This allows tracking of CC recipients for campaign emails

ALTER TABLE IF EXISTS email_tracking
ADD COLUMN IF NOT EXISTS cc_email TEXT;

-- Add comment
COMMENT ON COLUMN email_tracking.cc_email IS 'CC recipient email address (e.g., austyneguale@gmail.com)';

-- Success
SELECT 'Migration complete: cc_email column added to email_tracking' as status;
