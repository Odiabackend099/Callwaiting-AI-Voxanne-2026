-- ============================================================================
-- ATOMIC BOOKING FUNCTION
-- Purpose: Create contact + appointment in single transaction
-- Prevents partial failures and RLS issues
-- ============================================================================
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS book_appointment_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, INT);
CREATE OR REPLACE FUNCTION book_appointment_atomic(
        p_org_id UUID,
        p_patient_name TEXT,
        p_patient_email TEXT,
        p_patient_phone TEXT,
        p_service_type TEXT,
        p_scheduled_at TIMESTAMPTZ,
        p_duration_minutes INT
    ) RETURNS JSON AS $$
DECLARE v_contact_id UUID;
v_appointment_id UUID;
v_result JSON;
BEGIN -- ========================================
-- STEP 1: Validate org exists and is active
-- ========================================
IF NOT EXISTS (
    SELECT 1
    FROM organizations
    WHERE id = p_org_id -- AND status = 'active' -- Optional: can add status check if organization table has status
) THEN RAISE EXCEPTION 'Organization % does not exist',
p_org_id;
END IF;
-- ========================================
-- STEP 2: Find or create contact
-- Uses UPSERT to handle duplicates atomically
-- ========================================
INSERT INTO contacts (
        org_id,
        name,
        email,
        phone,
        created_at,
        updated_at
    )
VALUES (
        p_org_id,
        p_patient_name,
        p_patient_email,
        p_patient_phone,
        NOW(),
        NOW()
    ) ON CONFLICT (org_id, email) DO
UPDATE
SET name = COALESCE(EXCLUDED.name, contacts.name),
    phone = COALESCE(EXCLUDED.phone, contacts.phone),
    updated_at = NOW()
RETURNING id INTO v_contact_id;
-- ========================================
-- STEP 3: Create appointment
-- Linked to contact from Step 2
-- ========================================
INSERT INTO appointments (
        id,
        org_id,
        contact_id,
        service_type,
        scheduled_at,
        duration_minutes,
        status,
        confirmation_sent,
        created_at,
        updated_at
    )
VALUES (
        gen_random_uuid(),
        p_org_id,
        v_contact_id,
        p_service_type,
        p_scheduled_at,
        p_duration_minutes,
        'confirmed',
        false,
        NOW(),
        NOW()
    )
RETURNING id INTO v_appointment_id;
-- ========================================
-- STEP 4: Return success result
-- ========================================
v_result := json_build_object(
    'success',
    true,
    'contact_id',
    v_contact_id,
    'appointment_id',
    v_appointment_id,
    'created_at',
    NOW()
);
RETURN v_result;
EXCEPTION
WHEN unique_violation THEN -- Handle duplicate appointment (same time/contact) if there were constraints 
-- but usually appointments can duplicate unless specific constraints exist
RAISE EXCEPTION 'Duplicate appointment detected or constraint violation: %',
SQLERRM;
WHEN foreign_key_violation THEN -- Handle invalid org_id
RAISE EXCEPTION 'Invalid organization ID or foreign key violation';
WHEN OTHERS THEN -- Log and re-raise any other error
RAISE EXCEPTION 'Booking failed: %',
SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ============================================================================
-- GRANT EXECUTE TO SERVICE ROLE
-- This allows backend to call the function
-- ============================================================================
GRANT EXECUTE ON FUNCTION book_appointment_atomic TO service_role;