-- ============================================
-- ATOMIC CONFIG UPDATE RPC FUNCTION
-- Wraps agents + integrations updates in a single transaction
-- ============================================

-- 1. CREATE THE ATOMIC UPDATE FUNCTION
CREATE OR REPLACE FUNCTION update_agent_and_integrations(
  p_org_id UUID,
  p_agent_id UUID,
  -- Agent fields (all optional - only non-null values will be updated)
  p_agent_voice TEXT DEFAULT NULL,
  p_agent_language TEXT DEFAULT NULL,
  p_agent_system_prompt TEXT DEFAULT NULL,
  p_agent_first_message TEXT DEFAULT NULL,
  p_agent_max_call_duration INTEGER DEFAULT NULL,
  -- Vapi integration fields
  p_vapi_public_key TEXT DEFAULT NULL,
  p_vapi_secret_key TEXT DEFAULT NULL,
  p_vapi_phone_number_id TEXT DEFAULT NULL,
  -- Twilio integration fields
  p_twilio_account_sid TEXT DEFAULT NULL,
  p_twilio_auth_token TEXT DEFAULT NULL,
  p_twilio_from_number TEXT DEFAULT NULL,
  -- Validation cache fields
  p_vapi_validated_at TIMESTAMPTZ DEFAULT NULL,
  p_vapi_validation_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent_updated BOOLEAN := FALSE;
  v_vapi_updated BOOLEAN := FALSE;
  v_twilio_updated BOOLEAN := FALSE;
  v_result JSONB;
  v_existing_vapi_config JSONB;
  v_existing_twilio_config JSONB;
  v_new_vapi_config JSONB;
  v_new_twilio_config JSONB;
BEGIN
  -- ========== VALIDATE INPUTS ==========
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_FAILED: org_id is required';
  END IF;

  -- ========== UPDATE AGENT (if any agent fields provided) ==========
  IF p_agent_id IS NOT NULL AND (
    p_agent_voice IS NOT NULL OR
    p_agent_language IS NOT NULL OR
    p_agent_system_prompt IS NOT NULL OR
    p_agent_first_message IS NOT NULL OR
    p_agent_max_call_duration IS NOT NULL
  ) THEN
    UPDATE agents
    SET
      voice = COALESCE(p_agent_voice, voice),
      language = COALESCE(p_agent_language, language),
      system_prompt = COALESCE(p_agent_system_prompt, system_prompt),
      first_message = COALESCE(p_agent_first_message, first_message),
      max_call_duration = COALESCE(p_agent_max_call_duration, max_call_duration),
      updated_at = NOW()
    WHERE id = p_agent_id
      AND org_id = p_org_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'AGENT_NOT_FOUND: Agent % for org % not found', p_agent_id, p_org_id;
    END IF;

    v_agent_updated := TRUE;
  END IF;

  -- ========== UPSERT VAPI INTEGRATION (if any vapi fields provided) ==========
  IF p_vapi_public_key IS NOT NULL OR
     p_vapi_secret_key IS NOT NULL OR
     p_vapi_phone_number_id IS NOT NULL OR
     p_vapi_validated_at IS NOT NULL THEN

    -- Get existing config to merge with
    SELECT config INTO v_existing_vapi_config
    FROM integrations
    WHERE org_id = p_org_id AND provider = 'vapi';

    -- Build new config by merging
    v_new_vapi_config := COALESCE(v_existing_vapi_config, '{}'::jsonb);
    
    IF p_vapi_public_key IS NOT NULL THEN
      v_new_vapi_config := v_new_vapi_config || jsonb_build_object('vapi_public_key', p_vapi_public_key);
    END IF;
    IF p_vapi_secret_key IS NOT NULL THEN
      v_new_vapi_config := v_new_vapi_config || jsonb_build_object('vapi_api_key', p_vapi_secret_key, 'vapi_secret_key', p_vapi_secret_key);
    END IF;
    IF p_vapi_phone_number_id IS NOT NULL THEN
      v_new_vapi_config := v_new_vapi_config || jsonb_build_object('vapi_phone_number_id', p_vapi_phone_number_id);
    END IF;
    IF p_vapi_validated_at IS NOT NULL THEN
      v_new_vapi_config := v_new_vapi_config || jsonb_build_object('validated_at', p_vapi_validated_at);
    END IF;
    IF p_vapi_validation_status IS NOT NULL THEN
      v_new_vapi_config := v_new_vapi_config || jsonb_build_object('validation_status', p_vapi_validation_status);
    END IF;

    INSERT INTO integrations (org_id, provider, config, connected, updated_at)
    VALUES (p_org_id, 'vapi', v_new_vapi_config, TRUE, NOW())
    ON CONFLICT (org_id, provider) DO UPDATE
    SET config = v_new_vapi_config,
        connected = TRUE,
        updated_at = NOW();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INTEGRATION_UPSERT_FAILED: Failed to upsert Vapi integration for org %', p_org_id;
    END IF;

    v_vapi_updated := TRUE;
  END IF;

  -- ========== UPSERT TWILIO INTEGRATION (if any twilio fields provided) ==========
  IF p_twilio_account_sid IS NOT NULL OR
     p_twilio_auth_token IS NOT NULL OR
     p_twilio_from_number IS NOT NULL THEN

    -- Get existing config to merge with
    SELECT config INTO v_existing_twilio_config
    FROM integrations
    WHERE org_id = p_org_id AND provider = 'twilio';

    -- Build new config by merging
    v_new_twilio_config := COALESCE(v_existing_twilio_config, '{}'::jsonb);
    
    IF p_twilio_account_sid IS NOT NULL THEN
      v_new_twilio_config := v_new_twilio_config || jsonb_build_object('twilio_account_sid', p_twilio_account_sid);
    END IF;
    IF p_twilio_auth_token IS NOT NULL THEN
      v_new_twilio_config := v_new_twilio_config || jsonb_build_object('twilio_auth_token', p_twilio_auth_token);
    END IF;
    IF p_twilio_from_number IS NOT NULL THEN
      v_new_twilio_config := v_new_twilio_config || jsonb_build_object('twilio_from_number', p_twilio_from_number);
    END IF;

    INSERT INTO integrations (org_id, provider, config, connected, updated_at)
    VALUES (p_org_id, 'twilio', v_new_twilio_config, TRUE, NOW())
    ON CONFLICT (org_id, provider) DO UPDATE
    SET config = v_new_twilio_config,
        connected = TRUE,
        updated_at = NOW();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INTEGRATION_UPSERT_FAILED: Failed to upsert Twilio integration for org %', p_org_id;
    END IF;

    v_twilio_updated := TRUE;
  END IF;

  -- ========== BUILD RESULT ==========
  v_result := jsonb_build_object(
    'success', TRUE,
    'agent_updated', v_agent_updated,
    'vapi_updated', v_vapi_updated,
    'twilio_updated', v_twilio_updated,
    'org_id', p_org_id,
    'agent_id', p_agent_id
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise with original message (preserves our structured prefixes)
    RAISE;
END;
$$;

-- 2. GRANT EXECUTE TO AUTHENTICATED USERS
GRANT EXECUTE ON FUNCTION update_agent_and_integrations TO authenticated;
GRANT EXECUTE ON FUNCTION update_agent_and_integrations TO service_role;

-- 3. ADD COMMENT FOR DOCUMENTATION
COMMENT ON FUNCTION update_agent_and_integrations IS 
'Atomic update of agent config and integrations in a single transaction.
Error prefixes:
- VALIDATION_FAILED: Input validation error
- AGENT_NOT_FOUND: Agent does not exist for the given org
- INTEGRATION_UPSERT_FAILED: Failed to upsert integration record

Called from Express via supabase.rpc("update_agent_and_integrations", {...})';

-- Done
SELECT 'Atomic config update RPC function created' AS status;
