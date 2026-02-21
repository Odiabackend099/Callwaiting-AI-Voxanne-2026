-- Migration: Link verified caller IDs to Vapi phone numbers
-- Date: 2026-02-16
-- Purpose: Enable outbound calls to use verified caller ID as the displayed number
--
-- Problem: Verified caller IDs exist in Twilio + DB but are never imported into Vapi,
-- so outbound calls show the wrong number (Twilio's number instead of user's verified number).
--
-- Solution: Store the Vapi phone number UUID and Twilio OutgoingCallerId SID
-- so the system can use verified numbers for outbound calls and clean up on delete.

-- Add Vapi phone number UUID (returned from Vapi importTwilioNumber API)
ALTER TABLE verified_caller_ids
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT;

-- Add Twilio OutgoingCallerId SID (for cleanup when deleting)
ALTER TABLE verified_caller_ids
  ADD COLUMN IF NOT EXISTS twilio_caller_id_sid TEXT;

-- Index for phone-number-resolver lookups:
-- "Give me this org's verified number that's been imported into Vapi"
CREATE INDEX IF NOT EXISTS idx_verified_caller_ids_org_vapi_linked
  ON verified_caller_ids(org_id)
  WHERE status = 'verified' AND vapi_phone_number_id IS NOT NULL;

-- Document the columns
COMMENT ON COLUMN verified_caller_ids.vapi_phone_number_id IS
  'UUID from Vapi after importing via POST /phone-number/import/twilio. Used as phoneNumberId in outbound calls.';

COMMENT ON COLUMN verified_caller_ids.twilio_caller_id_sid IS
  'Twilio OutgoingCallerId SID (e.g., PNxxxx). Used for cleanup when removing verification.';
