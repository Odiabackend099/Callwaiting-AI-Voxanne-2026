/**
 * Migration: Golden Record SSOT Architecture
 *
 * Purpose: Enrich calls table and create bidirectional linking with appointments
 * Part of: CTO Golden Record Directive
 * Date: 2026-02-13
 *
 * This migration implements the "Golden Record" SSOT architecture by:
 * 1. Adding cost_cents, appointment_id, tools_used to calls table
 * 2. Adding call_id, vapi_call_id to appointments table
 * 3. Backfilling cost data from metadata
 * 4. Updating calls_with_caller_names view to include appointment data
 *
 * Key Features:
 * - Bidirectional linking between calls and appointments
 * - Cost stored as integer cents (not floating point dollars)
 * - Tools used during call surfaced for analytics
 * - All changes are additive (no breaking changes)
 */

-- ============================================================================
-- STEP 1A: Add columns to calls table
-- ============================================================================

-- Add cost as integer cents (avoids floating point precision issues)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS cost_cents INTEGER DEFAULT 0;

-- Add foreign key to appointments (nullable - most calls don't book)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;

-- Add array of tool names used during the call
ALTER TABLE calls ADD COLUMN IF NOT EXISTS tools_used TEXT[] DEFAULT '{}';

-- Add ended_reason column (raw Vapi endedReason code)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ended_reason TEXT;

-- Index for appointment lookup (WHERE clause filters nulls for efficiency)
CREATE INDEX IF NOT EXISTS idx_calls_appointment_id ON calls(appointment_id) WHERE appointment_id IS NOT NULL;

-- Index for cost analytics (only index calls with cost > 0)
CREATE INDEX IF NOT EXISTS idx_calls_cost ON calls(org_id, cost_cents) WHERE cost_cents > 0;

-- ============================================================================
-- STEP 1B: Add columns to appointments table
-- ============================================================================

-- Add foreign key back to calls (nullable - appointments can be created outside calls)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS call_id UUID;

-- Add vapi_call_id for direct correlation without JOIN
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS vapi_call_id TEXT;

-- Index for call-to-appointment lookups
CREATE INDEX IF NOT EXISTS idx_appointments_call_id ON appointments(call_id) WHERE call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_vapi_call_id ON appointments(vapi_call_id) WHERE vapi_call_id IS NOT NULL;

-- ============================================================================
-- STEP 1C: Backfill cost_cents from existing metadata
-- ============================================================================

-- Backfill cost from metadata.cost (stored as dollars, convert to cents)
-- Use CEIL to round up (never undercharge)
UPDATE calls
SET cost_cents = CEIL((metadata->>'cost')::numeric * 100)::integer
WHERE metadata->>'cost' IS NOT NULL
  AND (metadata->>'cost')::numeric > 0
  AND (cost_cents IS NULL OR cost_cents = 0);

-- ============================================================================
-- STEP 1D: Update the Golden Record View
-- ============================================================================

-- Replace the existing calls_with_caller_names view to include:
-- - New Golden Record columns (cost_cents, appointment_id, tools_used)
-- - Appointment data via LEFT JOIN
-- - Backward compatibility with deprecated columns

CREATE OR REPLACE VIEW calls_with_caller_names AS
SELECT
  -- All original calls columns
  c.id,
  c.vapi_call_id,
  c.org_id,
  c.contact_id,
  c.phone_number,
  c.call_direction,
  c.call_type,
  c.status,
  c.duration_seconds,
  c.recording_url,
  c.recording_storage_path,
  c.transcript,
  c.sentiment_label,
  c.sentiment_score,
  c.sentiment_summary,
  c.sentiment_urgency,
  c.sentiment,  -- Legacy packed format
  c.ended_reason,
  c.outcome,
  c.outcome_summary,
  c.notes,
  c.call_sid,
  c.start_time,
  c.end_time,
  c.created_at,
  c.updated_at,
  c.is_test_call,
  c.reconciled,
  c.intent,
  c.transcript_text,
  c.from_number,
  c.to_number,
  c.metadata,

  -- NEW Golden Record columns
  c.cost_cents,
  c.appointment_id,
  c.tools_used,

  -- Deprecated columns (kept for backward compatibility)
  -- These will be removed in Phase 3 (March 2026)
  c.caller_name AS deprecated_caller_name,
  c.from_number AS deprecated_from_number,

  -- ====================================================================
  -- SSOT RESOLUTION: Always get name from contacts table (never stale)
  -- ====================================================================
  COALESCE(
    ct.name,              -- Priority 1: Contact name (SSOT)
    c.phone_number,       -- Priority 2: Phone number fallback
    'Unknown'             -- Priority 3: Last resort
  ) AS resolved_caller_name,

  -- Contact enrichment metadata
  ct.email AS contact_email,
  ct.lead_status AS contact_lead_status,
  ct.lead_score AS contact_lead_score,
  ct.service_interests AS contact_service_interests,
  ct.last_contacted_at AS contact_last_seen,
  ct.created_at AS contact_created_at,

  -- ====================================================================
  -- APPOINTMENT DATA: NEW - Joined from appointments table
  -- ====================================================================
  apt.scheduled_at AS appointment_scheduled_at,
  apt.status AS appointment_status,
  apt.service_type AS appointment_service_type,
  apt.duration_minutes AS appointment_duration_minutes,
  apt.google_calendar_event_id AS appointment_calendar_event_id,
  apt.created_at AS appointment_created_at,

  -- Computed fields for dashboard convenience
  CASE
    WHEN ct.name IS NOT NULL THEN 'contact'
    WHEN c.phone_number IS NOT NULL THEN 'phone'
    ELSE 'unknown'
  END AS name_source,

  -- NEW: Appointment link indicator
  CASE
    WHEN c.appointment_id IS NOT NULL THEN true
    ELSE false
  END AS has_appointment

FROM calls c
LEFT JOIN contacts ct ON c.contact_id = ct.id
LEFT JOIN appointments apt ON c.appointment_id = apt.id;

-- Update view comment
COMMENT ON VIEW calls_with_caller_names IS
  'Golden Record SSOT view - Always JOINs with contacts and appointments.
   Provides live name resolution + appointment linking.
   Updated: 2026-02-13 (added appointment JOIN + Golden Record columns)';

-- Grant access to authenticated users and service role
GRANT SELECT ON calls_with_caller_names TO authenticated;
GRANT SELECT ON calls_with_caller_names TO service_role;

-- ============================================================================
-- STEP 1E: Verification queries
-- ============================================================================

-- Test query to verify migration success
DO $$
DECLARE
  calls_count INTEGER;
  calls_with_cost INTEGER;
  calls_with_appointment INTEGER;
  appointments_with_call INTEGER;
  view_row_count INTEGER;
BEGIN
  -- Count various states
  SELECT COUNT(*) INTO calls_count FROM calls;
  SELECT COUNT(*) INTO calls_with_cost FROM calls WHERE cost_cents > 0;
  SELECT COUNT(*) INTO calls_with_appointment FROM calls WHERE appointment_id IS NOT NULL;
  SELECT COUNT(*) INTO appointments_with_call FROM appointments WHERE call_id IS NOT NULL;
  SELECT COUNT(*) INTO view_row_count FROM calls_with_caller_names;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Golden Record Schema Migration - Verification Report';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Total calls in table: %', calls_count;
  RAISE NOTICE 'Calls with cost data: %', calls_with_cost;
  RAISE NOTICE 'Calls linked to appointments: %', calls_with_appointment;
  RAISE NOTICE 'Appointments linked to calls: %', appointments_with_call;
  RAISE NOTICE 'Rows in Golden Record view: %', view_row_count;
  RAISE NOTICE '=======================================================';

  -- Verify view structure includes new columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls_with_caller_names'
    AND column_name IN ('cost_cents', 'appointment_id', 'tools_used')
  ) THEN
    RAISE NOTICE '✅ View includes Golden Record columns';
  ELSE
    RAISE WARNING '⚠️  View missing some Golden Record columns';
  END IF;

  -- Verify indexes were created
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname IN ('idx_calls_appointment_id', 'idx_calls_cost', 'idx_appointments_call_id', 'idx_appointments_vapi_call_id')
  ) THEN
    RAISE NOTICE '✅ Performance indexes created';
  ELSE
    RAISE WARNING '⚠️  Some indexes may be missing';
  END IF;

  RAISE NOTICE '=======================================================';
END $$;

-- ============================================================================
-- MANUAL VERIFICATION QUERIES (uncomment to test)
-- ============================================================================

-- Uncomment these to verify migration manually:

-- -- 1. Verify new columns exist in calls table
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'calls'
-- AND column_name IN ('cost_cents', 'appointment_id', 'tools_used')
-- ORDER BY column_name;

-- -- 2. Verify new columns exist in appointments table
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'appointments'
-- AND column_name IN ('call_id', 'vapi_call_id')
-- ORDER BY column_name;

-- -- 3. Sample data from Golden Record view
-- SELECT
--   id,
--   vapi_call_id,
--   resolved_caller_name,
--   cost_cents,
--   appointment_id,
--   appointment_scheduled_at,
--   appointment_status,
--   tools_used,
--   has_appointment
-- FROM calls_with_caller_names
-- ORDER BY created_at DESC
-- LIMIT 10;

-- -- 4. Verify cost backfill worked
-- SELECT
--   COUNT(*) as total_calls,
--   COUNT(CASE WHEN cost_cents > 0 THEN 1 END) as calls_with_cost,
--   AVG(cost_cents)::integer as avg_cost_cents,
--   MAX(cost_cents) as max_cost_cents
-- FROM calls;

-- -- 5. Check appointment linking (should be 0 initially)
-- SELECT
--   COUNT(*) as total_appointments,
--   COUNT(CASE WHEN call_id IS NOT NULL THEN 1 END) as linked_to_call,
--   COUNT(CASE WHEN vapi_call_id IS NOT NULL THEN 1 END) as with_vapi_call_id
-- FROM appointments;
