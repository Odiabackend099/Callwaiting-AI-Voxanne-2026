-- ============================================
-- Outbound Agent Configuration Table
-- ============================================
-- Creates the outbound agent configuration table that mirrors inbound_agent_config
-- This table stores agent-specific configuration for outbound calling agents
-- ============================================

CREATE TABLE IF NOT EXISTS outbound_agent_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,

    -- Vapi integration
    vapi_api_key TEXT,
    vapi_assistant_id TEXT,

    -- Agent configuration
    system_prompt TEXT,
    first_message TEXT,
    voice_id TEXT DEFAULT 'Paige',
    language TEXT DEFAULT 'en-US',
    max_call_duration INTEGER DEFAULT 600,

    -- Status tracking
    is_active BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(org_id) -- One outbound config per organization
);

-- Create indexes for common queries
CREATE INDEX idx_outbound_agent_config_org ON outbound_agent_config(org_id);
CREATE INDEX idx_outbound_agent_config_active ON outbound_agent_config(is_active);
CREATE INDEX idx_outbound_agent_config_assistant ON outbound_agent_config(vapi_assistant_id) WHERE vapi_assistant_id IS NOT NULL;

-- Auto-update timestamp on modification
CREATE TRIGGER update_outbound_agent_config_updated_at_trigger
  BEFORE UPDATE ON outbound_agent_config
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Enable RLS for security
ALTER TABLE outbound_agent_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy for authenticated users
CREATE POLICY outbound_agent_config_org_policy
  ON outbound_agent_config
  FOR ALL
  TO authenticated
  USING (org_id = public.auth_org_id())
  WITH CHECK (org_id = public.auth_org_id());

-- RLS Policy for service role (backend access)
CREATE POLICY outbound_agent_config_service_role_bypass
  ON outbound_agent_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Backfill from agents table if outbound agents exist
INSERT INTO outbound_agent_config (
    org_id,
    vapi_api_key,
    vapi_assistant_id,
    system_prompt,
    first_message,
    voice_id,
    language,
    max_call_duration,
    is_active,
    last_synced_at,
    created_at,
    updated_at
)
SELECT
    org_id,
    NULL as vapi_api_key, -- Will be fetched from org_credentials
    vapi_assistant_id,
    system_prompt,
    first_message,
    voice as voice_id,
    language,
    max_call_duration,
    true as is_active,
    last_synced_at,
    created_at,
    updated_at
FROM agents
WHERE role = 'outbound' AND org_id IS NOT NULL
ON CONFLICT (org_id) DO NOTHING;

COMMENT ON TABLE outbound_agent_config IS 'Stores configuration for outbound calling agents. Mirrors inbound_agent_config structure.';
