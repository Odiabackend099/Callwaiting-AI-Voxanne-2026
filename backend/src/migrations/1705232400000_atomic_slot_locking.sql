-- Migration: Create atomic slot locking RPC functions
-- Purpose: Implement SELECT FOR UPDATE to prevent double-booking

-- 1. Main RPC: claim_slot_atomic
-- Uses SELECT FOR UPDATE to ensure exactly one caller succeeds
CREATE OR REPLACE FUNCTION public.claim_slot_atomic(
  p_slot_id UUID,
  p_contact_id UUID,
  p_clinic_id UUID,
  p_hold_duration_minutes INT DEFAULT 15
)
RETURNS TABLE(
  slot_id UUID,
  claimed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT
) AS $$
DECLARE
  v_slot_found BOOLEAN;
  v_hold_id UUID;
  v_now TIMESTAMP WITH TIME ZONE;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_now := NOW();
  v_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::INTERVAL;

  -- Step 1: Lock the slot row and check availability
  -- SELECT FOR UPDATE ensures only one concurrent transaction succeeds here
  SELECT EXISTS (
    SELECT 1 FROM public.availability_slots
    WHERE slot_id = p_slot_id
    AND clinic_id = p_clinic_id
    AND is_available = true
    AND start_time > v_now
    FOR UPDATE  -- This is the critical lock
  ) INTO v_slot_found;

  -- Step 2: If slot not available (another caller locked it), return 409
  IF NOT v_slot_found THEN
    RAISE EXCEPTION 'Slot unavailable - locked by another caller' 
    USING ERRCODE = '409';
  END IF;

  -- Step 3: Create appointment hold (atomic transaction)
  INSERT INTO public.appointment_holds (
    id,
    clinic_id,
    contact_id,
    slot_id,
    status,
    created_at,
    expires_at
  ) VALUES (
    gen_random_uuid(),
    p_clinic_id,
    p_contact_id,
    p_slot_id,
    'active',
    v_now,
    v_expires_at
  ) RETURNING appointment_holds.id INTO v_hold_id;

  -- Step 4: Mark slot as unavailable
  UPDATE public.availability_slots
  SET is_available = false,
      updated_at = v_now
  WHERE slot_id = p_slot_id
  AND clinic_id = p_clinic_id;

  -- Step 5: Return success with hold details
  RETURN QUERY SELECT
    p_slot_id,
    v_now,
    v_expires_at,
    'success'::TEXT;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: Get next available slots (for pivot response)
CREATE OR REPLACE FUNCTION public.get_next_available_slots(
  p_clinic_id UUID,
  p_limit INT DEFAULT 5
)
RETURNS TABLE(
  slot_id UUID,
  start_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INT,
  provider_id UUID,
  service_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.slot_id,
    s.start_time,
    s.duration_minutes,
    s.provider_id,
    s.service_type
  FROM public.availability_slots s
  WHERE s.clinic_id = p_clinic_id
  AND s.is_available = true
  AND s.start_time > NOW()
  ORDER BY s.start_time ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: Release a claimed slot
CREATE OR REPLACE FUNCTION public.release_slot_lock(
  p_slot_id UUID,
  p_clinic_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  -- Mark slot as available again
  UPDATE public.appointment_holds
  SET status = 'released',
      updated_at = NOW()
  WHERE slot_id = p_slot_id
  AND clinic_id = p_clinic_id
  AND status = 'active';

  UPDATE public.availability_slots
  SET is_available = true,
      updated_at = NOW()
  WHERE slot_id = p_slot_id
  AND clinic_id = p_clinic_id;

  RETURN QUERY SELECT
    true,
    'Slot released successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Release expired slot holds (scheduled job)
CREATE OR REPLACE FUNCTION public.release_expired_slot_holds(
  p_now TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(
  released_count INT
) AS $$
DECLARE
  v_count INT;
BEGIN
  -- Find expired holds
  WITH expired_holds AS (
    SELECT id, slot_id, clinic_id
    FROM public.appointment_holds
    WHERE status = 'active'
    AND expires_at < p_now
  )
  UPDATE public.appointment_holds h
  SET status = 'expired',
      updated_at = p_now
  FROM expired_holds eh
  WHERE h.id = eh.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Release associated slots
  UPDATE public.availability_slots s
  SET is_available = true,
      updated_at = p_now
  WHERE s.slot_id IN (
    SELECT slot_id FROM public.appointment_holds
    WHERE status = 'expired'
    AND expires_at < p_now
  );

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.claim_slot_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_available_slots TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_slot_lock TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_slot_holds TO authenticated;
