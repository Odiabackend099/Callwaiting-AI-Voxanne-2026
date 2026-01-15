-- ============================================
-- PHASE 6: Extend Appointments Table
-- Date: 2026-01-15
-- Purpose: Add clinic_id, provider_id, patient fields for Phase 6 testing
-- ============================================

-- Add missing columns to appointments table if they don't exist
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS provider_id UUID,
ADD COLUMN IF NOT EXISTS patient_name TEXT,
ADD COLUMN IF NOT EXISTS patient_email TEXT;

-- Add comments
COMMENT ON COLUMN appointments.clinic_id IS
'Denormalized clinic reference (same as org_id). Used for Phase 6 testing.';

COMMENT ON COLUMN appointments.provider_id IS
'Provider/staff member who will handle this appointment.';

COMMENT ON COLUMN appointments.patient_name IS
'Name of the patient booking the appointment.';

COMMENT ON COLUMN appointments.patient_email IS
'Email of the patient for confirmation and reminders.';

-- Drop old contact_id constraint if it exists and make it optional
-- ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_contact_id_fkey;
-- ALTER TABLE appointments ALTER COLUMN contact_id DROP NOT NULL;

-- Add index for provider lookups
CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(org_id, provider_id)
WHERE deleted_at IS NULL;

-- Add index for patient email lookups
CREATE INDEX IF NOT EXISTS idx_appointments_patient_email ON appointments(org_id, patient_email)
WHERE deleted_at IS NULL AND patient_email IS NOT NULL;

-- Ensure clinic_id matches org_id for existing records
UPDATE appointments SET clinic_id = org_id WHERE clinic_id IS NULL;

-- Make clinic_id NOT NULL after backfill
ALTER TABLE appointments ALTER COLUMN clinic_id SET NOT NULL;
