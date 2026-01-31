-- ========================================
-- Create org_tools table
-- SSOT for tool registration and linking
-- ========================================

-- Create org_tools table if it doesn't exist
CREATE TABLE IF NOT EXISTS org_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    vapi_tool_id TEXT NOT NULL,
    definition_hash TEXT,
    encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, tool_name),
    UNIQUE(vapi_tool_id)  -- Ensure tool ID is globally unique in Vapi
);

-- Index for fast lookups by org
CREATE INDEX IF NOT EXISTS idx_org_tools_org_id ON org_tools(org_id);
CREATE INDEX IF NOT EXISTS idx_org_tools_tool_name ON org_tools(tool_name);
CREATE INDEX IF NOT EXISTS idx_org_tools_vapi_tool_id ON org_tools(vapi_tool_id);

-- Enable RLS
ALTER TABLE org_tools ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see org_tools for their organization
DROP POLICY IF EXISTS org_tools_org_isolation ON org_tools;
CREATE POLICY org_tools_org_isolation ON org_tools
    FOR ALL
    USING (org_id = (SELECT auth.jwt() -> 'app_metadata' ->> 'org_id')::UUID);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_org_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_org_tools_updated_at_trigger ON org_tools;

CREATE TRIGGER update_org_tools_updated_at_trigger
    BEFORE UPDATE ON org_tools
    FOR EACH ROW
    EXECUTE FUNCTION update_org_tools_updated_at();

-- Verify creation
SELECT 'org_tools table created successfully' as status;
