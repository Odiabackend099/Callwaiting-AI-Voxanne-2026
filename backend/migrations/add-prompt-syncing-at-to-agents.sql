-- Add prompt_syncing_at column to agents table for concurrent sync prevention
ALTER TABLE agents ADD COLUMN IF NOT EXISTS prompt_syncing_at TIMESTAMP NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_agents_prompt_syncing_at ON agents(prompt_syncing_at);
