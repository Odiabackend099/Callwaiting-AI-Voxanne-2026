CREATE OR REPLACE FUNCTION insert_managed_number_atomic(p_org_id UUID, p_subaccount_id UUID, p_phone_number TEXT, p_twilio_phone_sid TEXT, p_vapi_phone_id TEXT, p_vapi_credential_id TEXT, p_country_code TEXT, p_number_type TEXT, p_clinic_name TEXT, p_routing_direction TEXT DEFAULT 'inbound') RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_managed_number_id UUID;
  v_outbound_agent_id UUID;
BEGIN
  IF p_routing_direction NOT IN ('inbound', 'outbound', 'unassigned') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid routing_direction: must be inbound, outbound, or unassigned');
  END IF;
  INSERT INTO managed_phone_numbers (org_id, subaccount_id, phone_number, twilio_phone_sid, vapi_phone_id, vapi_credential_id, country_code, number_type, routing_direction, status, voice_enabled, sms_enabled, provisioned_at, created_at, updated_at)
  VALUES (p_org_id, p_subaccount_id, p_phone_number, p_twilio_phone_sid, p_vapi_phone_id, p_vapi_credential_id, p_country_code, p_number_type, p_routing_direction, 'active', true, true, NOW(), NOW(), NOW())
  RETURNING id INTO v_managed_number_id;
  IF p_routing_direction = 'inbound' THEN
    INSERT INTO phone_number_mapping (org_id, inbound_phone_number, vapi_phone_number_id, clinic_name, is_active, created_at, updated_at)
    VALUES (p_org_id, p_phone_number, p_vapi_phone_id, p_clinic_name, true, NOW(), NOW())
    ON CONFLICT (org_id, inbound_phone_number) DO UPDATE SET vapi_phone_number_id = EXCLUDED.vapi_phone_number_id, clinic_name = EXCLUDED.clinic_name, is_active = EXCLUDED.is_active, updated_at = NOW();
  END IF;
  UPDATE organizations SET telephony_mode = 'managed', updated_at = NOW() WHERE id = p_org_id;
  SELECT id INTO v_outbound_agent_id FROM agents WHERE org_id = p_org_id AND role = 'outbound' LIMIT 1;
  IF v_outbound_agent_id IS NOT NULL THEN
    IF p_routing_direction = 'outbound' THEN
      UPDATE agents SET vapi_phone_number_id = p_vapi_phone_id, linked_phone_number_id = v_managed_number_id, updated_at = NOW() WHERE id = v_outbound_agent_id;
    ELSIF p_routing_direction = 'inbound' THEN
      UPDATE agents SET vapi_phone_number_id = COALESCE(vapi_phone_number_id, p_vapi_phone_id), updated_at = NOW() WHERE id = v_outbound_agent_id AND vapi_phone_number_id IS NULL;
    END IF;
  END IF;
  RETURN jsonb_build_object('success', true, 'managed_number_id', v_managed_number_id, 'routing_direction', p_routing_direction, 'outbound_agent_updated', (v_outbound_agent_id IS NOT NULL));
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Atomic insert failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;
