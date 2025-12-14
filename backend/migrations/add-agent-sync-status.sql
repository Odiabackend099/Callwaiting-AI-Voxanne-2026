-- Add sync tracking fields to agents table
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'synced', 'failed')),
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Add index for quick status lookups
CREATE INDEX IF NOT EXISTS idx_agents_sync_status ON agents(sync_status);
