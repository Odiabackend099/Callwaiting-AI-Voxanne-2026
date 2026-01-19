-- ============================================================================
-- ATOMIC BOOKING FUNCTION
-- Purpose: Create lead + appointment in single transaction
-- Uses leads table (phone-first SSOT) instead of deprecated contacts table
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
    WHERE id = p_org_id
) THEN RAISE EXCEPTION 'Organization % does not exist',
p_org_id;
END IF;
-- ========================================
-- STEP 2: Find or create lead (phone-first SSOT)
-- Phone is the unique key per org
-- ========================================
-- First check if lead exists by phone for this org
v_contact_id := (
    SELECT id FROM leads 
    WHERE org_id = p_org_id 
    AND phone = p_patient_phone
    LIMIT 1
);

-- If lead exists, update it; otherwise insert
IF v_contact_id IS NOT NULL THEN
    -- Update existing lead
    UPDATE leads
    SET name = COALESCE(p_patient_name, name),
        email = COALESCE(p_patient_email, email),
        updated_at = NOW()
    WHERE id = v_contact_id;
ELSE
    -- Insert new lead using phone as natural key
    INSERT INTO leads (
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
        )
    RETURNING id INTO v_contact_id;
END IF;
-- ========================================
-- STEP 3: Create appointment
-- Linked to lead from Step 2
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
WHEN unique_violation THEN -- Handle duplicate constraints if they exist
RAISE EXCEPTION 'Duplicate constraint violation: %',
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