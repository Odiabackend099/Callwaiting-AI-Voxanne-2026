-- Prevent duplicate active calls to same lead
-- This prevents race conditions when multiple requests try to call the same lead
-- Add unique partial index for active calls
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_call_per_lead ON call_tracking (lead_id)
WHERE call_outcome IN ('queued', 'ringing', 'in_progress');
-- Add phone column to call_tracking for global duplicate prevention
ALTER TABLE call_tracking
ADD COLUMN IF NOT EXISTS phone TEXT;
-- Add index for phone-based duplicate prevention
CREATE INDEX IF NOT EXISTS idx_call_tracking_phone_active ON call_tracking (phone)
WHERE call_outcome IN ('queued', 'ringing', 'in_progress');
-- Add index for recent calls rate limiting
CREATE INDEX IF NOT EXISTS idx_call_tracking_phone_recent ON call_tracking (phone, called_at DESC);