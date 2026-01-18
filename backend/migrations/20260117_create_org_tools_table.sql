-- Create org_tools table for tracking registered tools per organization
-- This table acts as the "blueprint registry" that enables automatic tool sync

CREATE TABLE IF NOT EXISTS org_tools (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tool_name VARCHAR(255) NOT NULL,
  vapi_tool_id VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  -- Unique constraint: each org can only have one instance of each tool
  UNIQUE(org_id, tool_name)
);

-- Create index for fast lookups by org_id
CREATE INDEX idx_org_tools_org_id ON org_tools(org_id);
CREATE INDEX idx_org_tools_tool_name ON org_tools(tool_name);

-- Add RLS policies
ALTER TABLE org_tools ENABLE ROW LEVEL SECURITY;

-- Policy: org admins can view their tools
CREATE POLICY "org_tools_read_own" ON org_tools
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM organization_users
      WHERE organization_id = org_id AND role = 'admin'
    )
  );

-- Policy: service role can manage all tools
CREATE POLICY "org_tools_service_role" ON org_tools
  FOR ALL USING (
    -- Allow service role (authenticated as backend)
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- Comment on table
COMMENT ON TABLE org_tools IS 'Tracks which Vapi tools are registered for each organization. Acts as the "blueprint" for automatic tool synchronization.';
COMMENT ON COLUMN org_tools.org_id IS 'Organization that owns this tool';
COMMENT ON COLUMN org_tools.tool_name IS 'Name of the tool (e.g., "bookClinicAppointment")';
COMMENT ON COLUMN org_tools.vapi_tool_id IS 'The ID returned by Vapi when the tool was registered';
COMMENT ON COLUMN org_tools.enabled IS 'Whether this tool is active for this org';
