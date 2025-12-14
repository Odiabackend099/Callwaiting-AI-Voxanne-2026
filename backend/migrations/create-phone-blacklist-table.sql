-- Create phone_blacklist table for blocking calls to specific numbers
CREATE TABLE IF NOT EXISTS phone_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  phone VARCHAR(20) NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(org_id, phone)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_blacklist_org_phone ON phone_blacklist(org_id, phone);

-- Enable RLS
ALTER TABLE phone_blacklist ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only see blacklist for their org
CREATE POLICY phone_blacklist_org_isolation ON phone_blacklist
  FOR ALL USING (org_id IN (
    SELECT org_id FROM user_org_roles WHERE user_id = auth.uid()
  ));
