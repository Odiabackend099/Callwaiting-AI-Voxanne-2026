-- ============================================
-- FOUNDER CONSOLE - DATABASE MIGRATION
-- Adds fields required for Voice AI Founder Console
-- ============================================

-- 1. Add max_call_duration to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS max_call_duration INTEGER DEFAULT 600;

-- 2. Add language/locale to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en-GB';

-- 3. Add first_message to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS first_message TEXT;

-- 4. Add role column to agents if not exists
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'inbound';

-- 5. Ensure integrations.config is JSONB
-- (This should already be the case, but just to be safe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'integrations' 
    AND column_name = 'config' 
    AND data_type != 'jsonb'
  ) THEN
    ALTER TABLE integrations ALTER COLUMN config TYPE JSONB USING config::JSONB;
  END IF;
END $$;

-- 6. Add index on call_tracking for faster recent queries
CREATE INDEX IF NOT EXISTS idx_call_tracking_called_at ON call_tracking(called_at DESC);

-- 7. Add index on call_tracking for lead lookups
CREATE INDEX IF NOT EXISTS idx_call_tracking_lead_id ON call_tracking(lead_id);

-- 8. Add status column to call_tracking if not exists
ALTER TABLE call_tracking ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queued';

-- 9. Add started_at and ended_at to call_tracking
ALTER TABLE call_tracking ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE call_tracking ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- 10. Create call_transcripts table for storing live transcripts
CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES call_tracking(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('agent', 'client')),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id ON call_transcripts(call_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_timestamp ON call_transcripts(timestamp);

-- 11. Add unique constraint on integrations for org_id + provider
-- First check if it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'integrations_org_id_provider_key'
  ) THEN
    ALTER TABLE integrations ADD CONSTRAINT integrations_org_id_provider_key UNIQUE (org_id, provider);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Constraint already exists
END $$;

-- Done
SELECT 'Founder Console migration complete' AS status;
