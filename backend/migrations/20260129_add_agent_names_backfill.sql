-- Migration: Backfill agent names for existing agents
-- Date: 2026-01-29
-- Purpose: Set default names for agents that don't have names yet

BEGIN;

-- 1. Backfill names for existing agents (if null or empty)
UPDATE agents
SET
  name = CASE
    WHEN role = 'inbound' THEN 'Inbound Agent'
    WHEN role = 'outbound' THEN 'Outbound Agent'
    ELSE 'Agent'
  END,
  updated_at = NOW()
WHERE name IS NULL OR name = '';

-- 2. Update assistant_org_mapping with agent names (for reference)
UPDATE assistant_org_mapping aom
SET
  assistant_name = CASE
    WHEN aom.assistant_role = 'inbound' THEN 'Inbound Agent'
    WHEN aom.assistant_role = 'outbound' THEN 'Outbound Agent'
    ELSE 'Agent'
  END,
  updated_at = NOW()
WHERE assistant_name IS NULL OR assistant_name = '';

-- 3. Create index for faster name lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_agents_name
ON agents(org_id, role, name);

-- 4. Add comment for documentation
COMMENT ON COLUMN agents.name IS 'Human-readable agent name (e.g., "Receptionist Robin", "Sales Sam")';

-- 5. Verify the update worked
-- SELECT COUNT(*) as agents_with_names FROM agents WHERE name IS NOT NULL AND name != '';
-- SELECT COUNT(*) as total_agents FROM agents;

COMMIT;
