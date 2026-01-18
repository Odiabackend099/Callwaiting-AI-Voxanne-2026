-- Migration: Make contact_id nullable for Vapi bookings without leads
-- The leads table was deleted but appointments still references it
-- Solution: Make contact_id optional so Vapi bookings don't require a contact record

ALTER TABLE appointments
ALTER COLUMN contact_id DROP NOT NULL;

-- Add comment explaining this change
COMMENT ON COLUMN appointments.contact_id IS 'Optional contact reference - can be null for Vapi system bookings';

-- Verify the change
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'appointments' AND column_name = 'contact_id';
