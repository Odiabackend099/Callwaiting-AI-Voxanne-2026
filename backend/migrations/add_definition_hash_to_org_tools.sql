-- Phase 7: Add tool versioning via definition_hash
-- This column tracks the SHA-256 hash of tool definitions to detect changes

-- Add definition_hash column to org_tools table
ALTER TABLE org_tools
ADD COLUMN IF NOT EXISTS definition_hash VARCHAR(64);

-- Create index on definition_hash for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_tools_definition_hash ON org_tools(definition_hash);

-- Add comment explaining the purpose
COMMENT ON COLUMN org_tools.definition_hash IS 'SHA-256 hash of tool definition JSON - used to detect when tool definition has changed and needs re-registration';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_org_tools_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS org_tools_update_timestamp ON org_tools;
CREATE TRIGGER org_tools_update_timestamp
  BEFORE UPDATE ON org_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_org_tools_timestamp();
