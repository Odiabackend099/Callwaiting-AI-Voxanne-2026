-- ================================================
-- Reschedule Appointment with Advisory Lock
-- ================================================
-- Date: 2026-02-20
-- Issue: TestSprite discovered missing reschedule endpoint
-- Purpose: Allow users to reschedule appointments with conflict detection
-- Pattern: Reuses proven advisory lock pattern from booking system
-- ================================================

CREATE OR REPLACE FUNCTION reschedule_appointment_with_lock(
  p_appointment_id UUID,
  p_org_id UUID,
  p_new_scheduled_at TIMESTAMPTZ,
  p_new_duration_minutes INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_lock_key BIGINT;
  v_conflict_count INTEGER;
  v_updated_appointment JSONB;
  v_existing_appointment RECORD;
BEGIN
  -- Step 1: Verify appointment exists and belongs to org
  SELECT * INTO v_existing_appointment
  FROM appointments
  WHERE id = p_appointment_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Appointment not found or access denied'
    );
  END IF;

  -- Step 2: Generate deterministic lock key for new time slot
  -- Same pattern as book_appointment_with_lock for consistency
  v_lock_key := ('x' || substr(md5(p_org_id::text || p_new_scheduled_at::text), 1, 16))::bit(64)::bigint;

  -- Step 3: Acquire advisory lock (transaction-scoped, auto-releases on commit/rollback)
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Time slot is being booked by another request. Please try again.'
    );
  END IF;

  -- Step 4: Check for conflicts (exclude the appointment being rescheduled)
  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments
  WHERE org_id = p_org_id
    AND id != p_appointment_id
    AND status IN ('scheduled', 'confirmed')
    AND (
      -- New appointment time overlaps with existing appointment
      tstzrange(p_new_scheduled_at, p_new_scheduled_at + (p_new_duration_minutes || ' minutes')::interval, '[)')
      &&
      tstzrange(scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval, '[)')
    );

  IF v_conflict_count > 0 THEN
    -- Find the conflicting appointment for detailed error message
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Time slot conflicts with existing appointment',
      'conflicting_appointment', (
        SELECT jsonb_build_object(
          'id', id,
          'scheduled_at', scheduled_at,
          'duration_minutes', duration_minutes,
          'contact_name', (
            SELECT first_name || ' ' || last_name
            FROM contacts
            WHERE contacts.id = appointments.contact_id
          )
        )
        FROM appointments
        WHERE org_id = p_org_id
          AND id != p_appointment_id
          AND status IN ('scheduled', 'confirmed')
          AND tstzrange(p_new_scheduled_at, p_new_scheduled_at + (p_new_duration_minutes || ' minutes')::interval, '[)')
            &&
            tstzrange(scheduled_at, scheduled_at + (duration_minutes || ' minutes')::interval, '[)')
        LIMIT 1
      )
    );
  END IF;

  -- Step 5: Update appointment (no conflicts found)
  UPDATE appointments
  SET
    scheduled_at = p_new_scheduled_at,
    duration_minutes = p_new_duration_minutes,
    updated_at = NOW()
  WHERE id = p_appointment_id
    AND org_id = p_org_id
  RETURNING jsonb_build_object(
    'id', id,
    'scheduled_at', scheduled_at,
    'duration_minutes', duration_minutes,
    'status', status,
    'contact_id', contact_id,
    'google_event_id', google_event_id,
    'updated_at', updated_at
  ) INTO v_updated_appointment;

  -- Step 6: Return success with updated appointment data
  RETURN jsonb_build_object(
    'success', true,
    'appointment', v_updated_appointment
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reschedule_appointment_with_lock(UUID, UUID, TIMESTAMPTZ, INTEGER) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION reschedule_appointment_with_lock IS 'Reschedules an appointment with conflict detection using advisory locks. Prevents race conditions when multiple users try to book the same slot.';
