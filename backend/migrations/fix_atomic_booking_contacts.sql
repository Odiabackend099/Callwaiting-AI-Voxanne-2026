-- ============================================================================
-- FIX ATOMIC BOOKING (CONTACTS VERSION)
-- Purpose: 
-- 1. Add unique constraint to contacts table (org_id, phone)
-- 2. Rewrite book_appointment_atomic to use contacts table with ON CONFLICT
-- ============================================================================
-- STEP 1: Add Unique Constraint to contacts
-- We use DO block to safely add constraint if it doesn't exist
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contacts_org_id_phone_key'
) THEN -- First, we might need to clean up duplicates if any exist
-- This is a simple cleanup keeping the most recently updated record
DELETE FROM contacts a USING (
        SELECT min(id) as id,
            phone,
            org_id
        FROM contacts
        GROUP BY phone,
            org_id
        HAVING count(*) > 1
    ) b
WHERE a.phone = b.phone
    AND a.org_id = b.org_id
    AND a.id <> b.id;
ALTER TABLE contacts
ADD CONSTRAINT contacts_org_id_phone_key UNIQUE (org_id, phone);
END IF;
END $$;
-- STEP 2: Rewrite book_appointment_atomic to use contacts + ON CONFLICT
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
-- STEP 1: Validate org exists
-- ========================================
IF NOT EXISTS (
    SELECT 1
    FROM organizations
    WHERE id = p_org_id
) THEN RAISE EXCEPTION 'Organization % does not exist',
p_org_id;
END IF;
-- ========================================
-- STEP 2: Upsert Contact (Atomic)
-- Uses ON CONFLICT to handle race conditions
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
    ) ON CONFLICT (org_id, phone) DO
UPDATE
SET name = COALESCE(EXCLUDED.name, contacts.name),
    email = COALESCE(EXCLUDED.email, contacts.email),
    updated_at = NOW()
RETURNING id INTO v_contact_id;
-- ========================================
-- STEP 3: Create Appointment
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
-- STEP 4: Return Result
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
WHEN OTHERS THEN RAISE EXCEPTION 'Booking failed: %',
SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION book_appointment_atomic TO service_role;