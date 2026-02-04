CREATE OR REPLACE FUNCTION book_appointment_with_lock(
  p_org_id UUID,
  p_contact_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_duration_minutes INTEGER,
  p_service_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_lock_key BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_appointment_id UUID;
  v_conflict_id UUID;
  v_conflict_scheduled_at TIMESTAMPTZ;
  v_conflict_contact_name TEXT;
  v_end_time TIMESTAMPTZ;
  v_lock_acquired BOOLEAN;
BEGIN
  v_end_time := p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL;
  
  IF p_lock_key IS NOT NULL THEN
    v_lock_acquired := pg_try_advisory_xact_lock(p_lock_key);
    IF NOT v_lock_acquired THEN
      RETURN jsonb_build_object('success', false, 'error', 'Slot is currently being booked by another request');
    END IF;
  END IF;
  
  SELECT a.id, a.scheduled_at, c.name
  INTO v_conflict_id, v_conflict_scheduled_at, v_conflict_contact_name
  FROM appointments a
  LEFT JOIN contacts c ON c.id = a.contact_id
  WHERE a.org_id = p_org_id
    AND a.status IN ('confirmed', 'pending')
    AND a.deleted_at IS NULL
    AND (
      (p_scheduled_at >= a.scheduled_at AND p_scheduled_at < (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL))
      OR (v_end_time > a.scheduled_at AND v_end_time <= (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL))
      OR (p_scheduled_at <= a.scheduled_at AND v_end_time >= (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL))
    )
  LIMIT 1;
  
  IF v_conflict_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Time slot is already booked', 'conflicting_appointment', jsonb_build_object('id', v_conflict_id, 'scheduled_at', v_conflict_scheduled_at, 'contact_name', v_conflict_contact_name));
  END IF;
  
  INSERT INTO appointments (org_id, contact_id, scheduled_at, duration_minutes, service_id, notes, metadata, status, created_at, updated_at)
  VALUES (p_org_id, p_contact_id, p_scheduled_at, p_duration_minutes, p_service_id, p_notes, p_metadata, 'confirmed', NOW(), NOW())
  RETURNING id INTO v_appointment_id;
  
  INSERT INTO audit_logs (org_id, event_type, event_data, created_at)
  VALUES (p_org_id, 'appointment.booked', jsonb_build_object('appointment_id', v_appointment_id, 'contact_id', p_contact_id, 'scheduled_at', p_scheduled_at, 'duration_minutes', p_duration_minutes), NOW());
  
  RETURN jsonb_build_object('success', true, 'appointment_id', v_appointment_id);
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error booking appointment: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
