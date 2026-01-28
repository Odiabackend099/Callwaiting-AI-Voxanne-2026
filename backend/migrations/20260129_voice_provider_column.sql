-- Migration: Add voice provider column and migrate legacy voices
-- Date: 2026-01-29
-- Purpose: Support 100+ voices across 7 providers (Vapi, ElevenLabs, OpenAI, Google, Azure, PlayHT, Rime)
-- This migration adds voice_provider column and auto-migrates legacy voice data to 2026 active voices

BEGIN;

-- 1. Add voice_provider column to agents table
ALTER TABLE agents
ADD COLUMN voice_provider TEXT;

-- 2. Add CHECK constraint for valid providers
ALTER TABLE agents
ADD CONSTRAINT agents_voice_provider_check
CHECK (voice_provider IN (
  'vapi',
  'elevenlabs',
  'openai',
  'google',
  'azure',
  'playht',
  'rime',
  NULL  -- Allow NULL for backward compatibility
));

-- 3. Migrate legacy Vapi voices to 2026 active voices
UPDATE agents
SET
  voice = CASE
    -- Female legacy voices → Savannah
    WHEN LOWER(voice) IN ('neha', 'paige', 'hana', 'lily', 'kylie', 'leah', 'tara', 'jess', 'mia', 'zoe') THEN 'Savannah'
    -- Male legacy voices → Rohan
    WHEN LOWER(voice) IN ('harry', 'cole', 'spencer', 'leo', 'dan', 'zac') THEN 'Rohan'
    -- Active voices (normalize case)
    WHEN LOWER(voice) = 'rohan' THEN 'Rohan'
    WHEN LOWER(voice) = 'elliot' THEN 'Elliot'
    WHEN LOWER(voice) = 'savannah' THEN 'Savannah'
    -- Unknown voices default to Rohan
    ELSE 'Rohan'
  END,
  voice_provider = 'vapi'
WHERE voice_provider IS NULL AND voice IS NOT NULL;

-- 4. Handle NULL voice fields (set to Rohan as default)
UPDATE agents
SET
  voice = 'Rohan',
  voice_provider = 'vapi'
WHERE voice_provider IS NULL AND voice IS NULL;

-- 5. Create index for performance (frequently queried combination)
CREATE INDEX idx_agents_voice_provider
ON agents(org_id, voice_provider, voice);

-- 6. Add column comment for documentation
COMMENT ON COLUMN agents.voice_provider IS '2026 voice provider (vapi, elevenlabs, openai, google, azure, playht, rime). Maps to voice registry for multi-provider voice support.';

COMMIT;
