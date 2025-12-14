-- Ensure integrations table exists and has config column
CREATE TABLE IF NOT EXISTS integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  provider TEXT NOT NULL,
  connected BOOLEAN DEFAULT false,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, provider)
);

-- Ensure config column exists if table already existed
ALTER TABLE integrations
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Add encrypted api key column for future use
ALTER TABLE integrations
ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;
