-- ============================================
-- Add vapi_phone_number_id to agents table
-- ============================================
-- This column stores the VAPI phone number ID for outbound caller ID
-- Previously this was stored in the deprecated outbound_agent_config table
-- Now agents table is the single source of truth (SSOT)
-- ============================================

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS vapi_phone_number_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_vapi_phone_number_id
ON agents(vapi_phone_number_id)
WHERE vapi_phone_number_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN agents.vapi_phone_number_id IS 'VAPI phone number ID used as caller ID for outbound calls';
