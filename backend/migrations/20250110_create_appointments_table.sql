-- ============================================
-- VOXANNE PHASE 1 MVP: Create Appointments Table
-- Date: 2025-01-10
-- Purpose: Store scheduled appointments for contacts
-- Context: Core feature for 90-day campaign follow-up
-- ============================================
--
-- APPOINTMENT LIFECYCLE:
--   pending -> confirmed -> in_progress -> completed
--   pending -> confirmed -> cancelled
--   pending -> no_show
--
-- RLS STRATEGY:
--   - All org-scoped queries use: org_id = (SELECT public.auth_org_id())
--   - Service role has unrestricted access
--   - org_id is immutable (trigger prevents modification)
--
-- ============================================

-- ============================================
-- STEP 1: Create status enum for appointments
-- ============================================
DO $$
BEGIN
  -- Create enum type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE appointment_status AS ENUM (
      'pending',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'no_show'
    );
  END IF;
END $$;

-- ============================================
-- STEP 2: Create appointments table
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  -- Primary key and organization
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Foreign key relationships
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Appointment details
  service_type TEXT NOT NULL,                     -- 'consultation', 'botox', 'filler', 'other'
  scheduled_at TIMESTAMPTZ NOT NULL,             -- When the appointment is scheduled
  duration_minutes INTEGER DEFAULT 30,            -- Expected duration
  status appointment_status DEFAULT 'pending',    -- Current status

  -- Booking and communication
  calendar_link TEXT,                             -- Link to calendar event
  confirmation_sent BOOLEAN DEFAULT false,       -- Whether confirmation was sent to contact

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ                         -- Soft delete support
);

-- Add comment explaining the table
COMMENT ON TABLE appointments IS
'Stores scheduled appointments for contacts. Part of the appointment lifecycle management system for Voxanne Phase 1 MVP. Each appointment is org-scoped and immutable (org_id cannot change after creation).';

COMMENT ON COLUMN appointments.org_id IS
'Organization ID for multi-tenant isolation. IMMUTABLE - cannot be changed after creation. Enforced by prevent_org_id_change trigger.';

COMMENT ON COLUMN appointments.contact_id IS
'Reference to the contact who has the appointment. Automatically deleted when contact is deleted.';

COMMENT ON COLUMN appointments.status IS
'Current status of the appointment. Enum: pending, confirmed, in_progress, completed, cancelled, no_show.';

COMMENT ON COLUMN appointments.scheduled_at IS
'The date and time when the appointment is scheduled.';

COMMENT ON COLUMN appointments.confirmation_sent IS
'Flag indicating whether a confirmation message/email was sent to the contact.';

-- ============================================
-- STEP 3: Create indexes for performance
-- ============================================
-- Composite index for org-scoped queries with scheduling filtering
CREATE INDEX IF NOT EXISTS idx_appointments_org_scheduled_at ON appointments(org_id, scheduled_at DESC)
WHERE deleted_at IS NULL;

-- Single column indexes for common queries
CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments(contact_id)
WHERE deleted_at IS NULL;

-- Composite index for org + status filtering (used for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_appointments_org_status ON appointments(org_id, status)
WHERE deleted_at IS NULL;

-- Index for upcoming appointments
CREATE INDEX IF NOT EXISTS idx_appointments_upcoming ON appointments(scheduled_at)
WHERE status IN ('pending', 'confirmed') AND deleted_at IS NULL;

-- ============================================
-- STEP 4: Create updated_at trigger
-- ============================================
-- This trigger automatically updates the updated_at timestamp
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointments_updated_at();

-- ============================================
-- STEP 5: Enable RLS and create policies
-- ============================================
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can SELECT appointments from their org
CREATE POLICY "appointments_select_org"
ON appointments
FOR SELECT
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

-- Policy: Authenticated users can UPDATE appointments in their org
CREATE POLICY "appointments_update_org"
ON appointments
FOR UPDATE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()))
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Policy: Authenticated users can DELETE appointments from their org
CREATE POLICY "appointments_delete_org"
ON appointments
FOR DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

-- Policy: Authenticated users can INSERT appointments into their org
CREATE POLICY "appointments_insert_org"
ON appointments
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Policy: Service role bypass (no restrictions)
-- Service role should have full access for backend operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'appointments'
      AND policyname = 'appointments_service_role_bypass'
  ) THEN
    CREATE POLICY "appointments_service_role_bypass"
    ON appointments
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- STEP 6: Add org_id immutability trigger
-- ============================================
-- This trigger prevents modification of org_id after creation
-- Uses the prevent_org_id_change() function created in earlier migration
DROP TRIGGER IF EXISTS org_id_immutable_appointments ON appointments;
CREATE TRIGGER org_id_immutable_appointments
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_org_id_change();

-- ============================================
-- ERROR HANDLING NOTES
-- ============================================
-- Possible migration issues and solutions:
--
-- 1. "ERROR: relation contacts does not exist"
--    Solution: Run 20250110_create_contacts_table.sql BEFORE this migration
--
-- 2. "ERROR: function prevent_org_id_change() does not exist"
--    Solution: Run 20250110_create_org_id_immutability_triggers.sql first
--
-- 3. "ERROR: function public.auth_org_id() does not exist"
--    Solution: Run 20250110_create_auth_org_id_function.sql first
--
-- 4. "ERROR: type 'appointment_status' already exists"
--    Solution: This is safe - the DO block checks existence first
--
-- 5. RLS policy errors when testing
--    Solution: Ensure user has org_id in JWT app_metadata (run update-user-org-metadata.ts)

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After deployment, verify with:
--
-- -- Check table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'appointments'
-- ORDER BY ordinal_position;
--
-- -- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'appointments';
--
-- -- Check RLS policies
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'appointments';
--
-- -- Check triggers
-- SELECT trigger_name, event_object_columns, trigger_statement
-- FROM information_schema.triggers
-- WHERE event_object_table = 'appointments';

-- ============================================
-- ROLLBACK PLAN
-- ============================================
-- If this migration causes issues, rollback with:
--
-- DROP TRIGGER IF EXISTS org_id_immutable_appointments ON appointments;
-- DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
-- ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS appointments;
-- DROP TYPE IF EXISTS appointment_status;
--
-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
--   1. Verify table structure and indexes
--   2. Test RLS policies with authenticated user
--   3. Test org_id immutability trigger
--   4. Deploy to production
--
