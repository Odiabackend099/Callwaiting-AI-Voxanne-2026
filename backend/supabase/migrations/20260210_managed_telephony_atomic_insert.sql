-- Migration: Atomic Database Insert for Managed Telephony
-- Created: 2026-02-10
-- Purpose: Ensure all-or-nothing database operations during number provisioning
--
-- Changes:
-- 1. Create atomic function to insert managed number + update related tables
-- 2. All operations wrapped in single transaction (COMMIT or ROLLBACK together)
--
-- CRITICAL: This prevents partial database state if any operation fails

-- ============================================================================
-- Function: insert_managed_number_atomic
-- ============================================================================
-- Atomically inserts a managed phone number and updates all related tables
--
-- This function ensures that if ANY of these operations fail:
-- - managed_phone_numbers INSERT
-- - phone_number_mapping UPSERT
-- - organizations UPDATE (telephony_mode)
-- - agents UPDATE (vapi_phone_number_id for outbound agent)
--
-- Then ALL operations are rolled back (transaction fails completely)
--
-- Returns: JSONB with success status and managed_number_id
-- ============================================================================

CREATE OR REPLACE FUNCTION insert_managed_number_atomic(
  p_org_id UUID,
  p_subaccount_id UUID,
  p_phone_number TEXT,
  p_twilio_phone_sid TEXT,
  p_vapi_phone_id TEXT,
  p_vapi_credential_id TEXT,
  p_country_code TEXT,
  p_number_type TEXT,
  p_clinic_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_managed_number_id UUID;
  v_outbound_agent_id UUID;
BEGIN
  -- ======================================================================
  -- OPERATION 1: Insert into managed_phone_numbers
  -- ======================================================================
  INSERT INTO managed_phone_numbers (
    org_id,
    subaccount_id,
    phone_number,
    twilio_phone_sid,
    vapi_phone_id,
    vapi_credential_id,
    country_code,
    number_type,
    status,
    voice_enabled,
    sms_enabled,
    provisioned_at,
    created_at,
    updated_at
  ) VALUES (
    p_org_id,
    p_subaccount_id,
    p_phone_number,
    p_twilio_phone_sid,
    p_vapi_phone_id,
    p_vapi_credential_id,
    p_country_code,
    p_number_type,
    'active',
    true,
    true,
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_managed_number_id;

  -- ======================================================================
  -- OPERATION 2: Insert/Update phone_number_mapping for inbound routing
  -- ======================================================================
  INSERT INTO phone_number_mapping (
    org_id,
    inbound_phone_number,
    vapi_phone_number_id,
    clinic_name,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    p_org_id,
    p_phone_number,
    p_vapi_phone_id,
    p_clinic_name,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (org_id, inbound_phone_number) DO UPDATE
  SET
    vapi_phone_number_id = EXCLUDED.vapi_phone_number_id,
    clinic_name = EXCLUDED.clinic_name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

  -- ======================================================================
  -- OPERATION 3: Update organizations.telephony_mode to 'managed'
  -- ======================================================================
  UPDATE organizations
  SET
    telephony_mode = 'managed',
    updated_at = NOW()
  WHERE id = p_org_id;

  -- ======================================================================
  -- OPERATION 4: Update outbound agent (if exists) with vapi_phone_number_id
  -- ======================================================================
  -- Find outbound agent for this org (if one exists)
  SELECT id INTO v_outbound_agent_id
  FROM agents
  WHERE org_id = p_org_id
    AND role = 'outbound'
  LIMIT 1;

  -- If outbound agent exists, update it with the new phone number
  IF v_outbound_agent_id IS NOT NULL THEN
    UPDATE agents
    SET
      vapi_phone_number_id = p_vapi_phone_id,
      updated_at = NOW()
    WHERE id = v_outbound_agent_id;
  END IF;

  -- ======================================================================
  -- RETURN SUCCESS
  -- ======================================================================
  RETURN jsonb_build_object(
    'success', true,
    'managed_number_id', v_managed_number_id,
    'outbound_agent_updated', (v_outbound_agent_id IS NOT NULL)
  );

EXCEPTION
  -- If ANY operation fails, the entire transaction is rolled back
  WHEN OTHERS THEN
    -- Log error details for debugging
    RAISE WARNING 'Atomic insert failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;

    -- Return error response
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_managed_number_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_managed_number_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Add helpful comment for database documentation
COMMENT ON FUNCTION insert_managed_number_atomic IS
'Atomically inserts managed phone number and updates all related tables.
All operations succeed or fail together (transaction-scoped).
Returns JSONB: {success: boolean, managed_number_id?: UUID, error?: string}';

-- ============================================================================
-- Verification Queries (for testing)
-- ============================================================================
-- Run these queries after migration to verify it worked:
--
-- 1. Verify function exists:
--    SELECT proname, proargtypes
--    FROM pg_proc
--    WHERE proname = 'insert_managed_number_atomic';
--
-- 2. Test successful insert (replace UUIDs with real values):
--    SELECT insert_managed_number_atomic(
--      '00000000-0000-0000-0000-000000000001'::UUID,  -- org_id
--      '00000000-0000-0000-0000-000000000002'::UUID,  -- subaccount_id
--      '+15551234567',                                 -- phone_number
--      'PN1234567890abcdef1234567890abcdef',          -- twilio_phone_sid
--      'vapi-123456',                                  -- vapi_phone_id
--      'cred-123456',                                  -- vapi_credential_id
--      'US',                                           -- country_code
--      'local',                                        -- number_type
--      'Test Clinic'                                   -- clinic_name
--    );
--
-- 3. Verify data was inserted:
--    SELECT * FROM managed_phone_numbers WHERE phone_number = '+15551234567';
--    SELECT * FROM phone_number_mapping WHERE inbound_phone_number = '+15551234567';
--    SELECT telephony_mode FROM organizations WHERE id = '00000000-0000-0000-0000-000000000001';
--
-- 4. Test error handling (should rollback all changes):
--    -- First insert should succeed
--    SELECT insert_managed_number_atomic(...);
--
--    -- Second insert with same phone should fail (unique constraint)
--    -- All operations should be rolled back
--    SELECT insert_managed_number_atomic(...);  -- Same phone_number
-- ============================================================================
