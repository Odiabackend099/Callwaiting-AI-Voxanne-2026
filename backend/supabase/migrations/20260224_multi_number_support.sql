-- Migration: Multi-Number Support (1 Inbound + 1 Outbound per Org)
-- Created: 2026-02-24
-- Purpose: Fix all database blockers preventing outbound number provisioning
--
-- Root Causes Fixed:
--   1. RPC insert_managed_number_atomic used p_type parameter but constraint
--      checked routing_direction column → parameter mismatch
--   2. org_credentials had UNIQUE(org_id, provider) which blocked ANY second
--      Twilio row regardless of direction
--
-- Changes Applied (via Supabase Management API):
--   Phase 1: Replaced RPC with correct p_routing_direction version
--   Phase 2: Dropped unique_org_provider, created unique_org_provider_type
--
-- Prerequisites (already applied in earlier migrations):
--   - 20260222_add_routing_direction.sql: routing_direction column + indexes
--   - 20260224_fix_managed_number_direction_constraint.sql: per-direction unique index
--
-- This file documents what was applied via API. Run it only on fresh databases.

-- ============================================================================
-- PHASE 1: Replace RPC with direction-aware version
-- ============================================================================

DROP FUNCTION IF EXISTS insert_managed_number_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION insert_managed_number_atomic(
  p_org_id UUID,
  p_subaccount_id UUID,
  p_phone_number TEXT,
  p_twilio_phone_sid TEXT,
  p_vapi_phone_id TEXT,
  p_vapi_credential_id TEXT,
  p_country_code TEXT,
  p_number_type TEXT,
  p_clinic_name TEXT,
  p_routing_direction TEXT DEFAULT 'inbound'
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
  -- Validate routing_direction
  IF p_routing_direction NOT IN ('inbound', 'outbound', 'unassigned') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid routing_direction: must be inbound, outbound, or unassigned'
    );
  END IF;

  -- Insert into managed_phone_numbers with routing_direction
  INSERT INTO managed_phone_numbers (
    org_id, subaccount_id, phone_number, twilio_phone_sid,
    vapi_phone_id, vapi_credential_id, country_code, number_type,
    routing_direction, status, voice_enabled, sms_enabled,
    provisioned_at, created_at, updated_at
  ) VALUES (
    p_org_id, p_subaccount_id, p_phone_number, p_twilio_phone_sid,
    p_vapi_phone_id, p_vapi_credential_id, p_country_code, p_number_type,
    p_routing_direction, 'active', true, true, NOW(), NOW(), NOW()
  )
  RETURNING id INTO v_managed_number_id;

  -- For INBOUND: create phone_number_mapping (routes calls to AI)
  -- For OUTBOUND: skip mapping (outbound numbers don't receive inbound calls)
  IF p_routing_direction = 'inbound' THEN
    INSERT INTO phone_number_mapping (
      org_id, inbound_phone_number, vapi_phone_number_id,
      clinic_name, is_active, created_at, updated_at
    ) VALUES (
      p_org_id, p_phone_number, p_vapi_phone_id,
      p_clinic_name, true, NOW(), NOW()
    )
    ON CONFLICT (org_id, inbound_phone_number) DO UPDATE
    SET
      vapi_phone_number_id = EXCLUDED.vapi_phone_number_id,
      clinic_name = EXCLUDED.clinic_name,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();
  END IF;

  -- Update org telephony mode
  UPDATE organizations
  SET telephony_mode = 'managed', updated_at = NOW()
  WHERE id = p_org_id;

  -- For OUTBOUND: set vapi_phone_number_id + linked_phone_number_id on outbound agent
  -- For INBOUND: only set if agent has no phone number yet
  SELECT id INTO v_outbound_agent_id
  FROM agents
  WHERE org_id = p_org_id AND role = 'outbound'
  LIMIT 1;

  IF v_outbound_agent_id IS NOT NULL THEN
    IF p_routing_direction = 'outbound' THEN
      UPDATE agents
      SET
        vapi_phone_number_id = p_vapi_phone_id,
        linked_phone_number_id = v_managed_number_id,
        updated_at = NOW()
      WHERE id = v_outbound_agent_id;
    ELSIF p_routing_direction = 'inbound' THEN
      UPDATE agents
      SET
        vapi_phone_number_id = COALESCE(vapi_phone_number_id, p_vapi_phone_id),
        updated_at = NOW()
      WHERE id = v_outbound_agent_id
        AND vapi_phone_number_id IS NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'managed_number_id', v_managed_number_id,
    'routing_direction', p_routing_direction,
    'outbound_agent_updated', (v_outbound_agent_id IS NOT NULL)
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Atomic insert failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION insert_managed_number_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_managed_number_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================================
-- PHASE 2: Fix org_credentials constraint for per-direction rows
-- ============================================================================

-- Drop old constraint that blocked any second Twilio row
ALTER TABLE org_credentials DROP CONSTRAINT IF EXISTS unique_org_provider;

-- Create direction-aware constraint: allows 1 inbound + 1 outbound per org
ALTER TABLE org_credentials ADD CONSTRAINT unique_org_provider_type UNIQUE (org_id, provider, type);

-- Drop redundant partial index (covered by new full constraint)
DROP INDEX IF EXISTS idx_org_credentials_one_per_org_type;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- 1. Verify RPC uses p_routing_direction:
--    SELECT pg_get_functiondef(oid) FROM pg_proc
--    WHERE proname = 'insert_managed_number_atomic';
--
-- 2. Verify constraint:
--    SELECT conname, pg_get_constraintdef(oid)
--    FROM pg_constraint
--    WHERE conrelid = 'org_credentials'::regclass AND contype = 'u';
--    Expected: unique_org_provider_type UNIQUE(org_id, provider, type)
--
-- 3. Test: Buy outbound number should NOT get constraint violation

-- ============================================================================
-- ROLLBACK
-- ============================================================================

-- To rollback:
-- 1. Restore old RPC (run 20260224_add_type_to_managed_number_atomic.sql)
-- 2. ALTER TABLE org_credentials DROP CONSTRAINT unique_org_provider_type;
-- 3. ALTER TABLE org_credentials ADD CONSTRAINT unique_org_provider UNIQUE (org_id, provider);
