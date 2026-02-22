-- Migration: Add Routing Direction to Managed Phone Numbers
-- Created: 2026-02-22
-- Purpose: Enable 1:N phone number model with per-number routing direction
--
-- Changes:
-- 1. Add routing_direction column to managed_phone_numbers (inbound/outbound/unassigned)
-- 2. Add linked_phone_number_id FK on agents table
-- 3. Create performance indexes
-- 4. Backfill existing numbers as 'inbound'
-- 5. Replace insert_managed_number_atomic() RPC with direction-aware version
--
-- SAFETY: All existing numbers default to 'inbound'. No data loss. No downtime.

-- ============================================================================
-- STEP 1: Add routing_direction column to managed_phone_numbers
-- ============================================================================
ALTER TABLE managed_phone_numbers
  ADD COLUMN IF NOT EXISTS routing_direction TEXT NOT NULL DEFAULT 'inbound'
    CHECK (routing_direction IN ('inbound', 'outbound', 'unassigned'));

COMMENT ON COLUMN managed_phone_numbers.routing_direction IS
  'Call routing purpose: inbound (AI receptionist), outbound (caller ID for sales/callbacks), unassigned (reserved)';

-- ============================================================================
-- STEP 2: Add linked_phone_number_id FK on agents table
-- ============================================================================
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS linked_phone_number_id UUID REFERENCES managed_phone_numbers(id) ON DELETE SET NULL;

COMMENT ON COLUMN agents.linked_phone_number_id IS
  'FK to managed_phone_numbers. Supplements vapi_phone_number_id for managed telephony routing.';

-- ============================================================================
-- STEP 3: Create performance indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_managed_numbers_direction
  ON managed_phone_numbers(org_id, routing_direction, status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_agents_linked_phone
  ON agents(linked_phone_number_id) WHERE linked_phone_number_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Backfill existing numbers to 'inbound'
-- ============================================================================
-- All existing managed numbers are used for inbound by default
UPDATE managed_phone_numbers
SET routing_direction = 'inbound'
WHERE routing_direction IS NULL OR routing_direction = 'inbound';

-- Backfill linked_phone_number_id on outbound agents that have a matching vapi_phone_number_id
UPDATE agents a
SET linked_phone_number_id = mn.id
FROM managed_phone_numbers mn
WHERE a.org_id = mn.org_id
  AND a.role = 'outbound'
  AND a.vapi_phone_number_id = mn.vapi_phone_id
  AND mn.status = 'active'
  AND a.linked_phone_number_id IS NULL;

-- ============================================================================
-- STEP 5: Replace insert_managed_number_atomic() with direction-aware version
-- ============================================================================
-- Drop old function signature (9 params) and grants
DROP FUNCTION IF EXISTS insert_managed_number_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

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

  -- ======================================================================
  -- OPERATION 1: Insert into managed_phone_numbers with routing_direction
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
    routing_direction,
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
    p_routing_direction,
    'active',
    true,
    true,
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_managed_number_id;

  -- ======================================================================
  -- OPERATION 2: For INBOUND numbers — create phone_number_mapping
  -- For OUTBOUND numbers — skip mapping (outbound numbers don't receive inbound calls)
  -- ======================================================================
  IF p_routing_direction = 'inbound' THEN
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
  END IF;

  -- ======================================================================
  -- OPERATION 3: Update organizations.telephony_mode to 'managed'
  -- ======================================================================
  UPDATE organizations
  SET
    telephony_mode = 'managed',
    updated_at = NOW()
  WHERE id = p_org_id;

  -- ======================================================================
  -- OPERATION 4: For OUTBOUND direction — update outbound agent with phone IDs
  -- For INBOUND direction — update outbound agent too (legacy behavior preserved)
  -- ======================================================================
  SELECT id INTO v_outbound_agent_id
  FROM agents
  WHERE org_id = p_org_id
    AND role = 'outbound'
  LIMIT 1;

  IF v_outbound_agent_id IS NOT NULL THEN
    IF p_routing_direction = 'outbound' THEN
      -- Outbound number: set both vapi_phone_number_id and linked_phone_number_id
      UPDATE agents
      SET
        vapi_phone_number_id = p_vapi_phone_id,
        linked_phone_number_id = v_managed_number_id,
        updated_at = NOW()
      WHERE id = v_outbound_agent_id;
    ELSIF p_routing_direction = 'inbound' THEN
      -- Inbound number: only set vapi_phone_number_id if agent has none
      -- (preserve existing outbound number assignment)
      UPDATE agents
      SET
        vapi_phone_number_id = COALESCE(vapi_phone_number_id, p_vapi_phone_id),
        updated_at = NOW()
      WHERE id = v_outbound_agent_id
        AND vapi_phone_number_id IS NULL;
    END IF;
  END IF;

  -- ======================================================================
  -- RETURN SUCCESS
  -- ======================================================================
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

-- Grant execute permissions for both old and new signatures
GRANT EXECUTE ON FUNCTION insert_managed_number_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_managed_number_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION insert_managed_number_atomic IS
'Atomically inserts managed phone number with routing direction.
Direction-aware: inbound numbers get phone_number_mapping, outbound numbers update agent.
All operations succeed or fail together (transaction-scoped).
Returns JSONB: {success: boolean, managed_number_id?: UUID, routing_direction?: string, error?: string}';
