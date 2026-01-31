-- Add vapi_assistant_id_outbound column to agents table
-- This column stores the Vapi assistant ID for outbound calls

ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS vapi_assistant_id_outbound TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agents_vapi_assistant_id_outbound 
ON agents(vapi_assistant_id_outbound);

-- Add comment
COMMENT ON COLUMN agents.vapi_assistant_id_outbound IS 'Vapi assistant ID for outbound calls';
