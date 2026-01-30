-- Migration: Add voice_provider column to agents table
-- Date: 2026-01-29
-- Purpose: Store voice provider alongside voice ID to prevent VAPI sync failures
-- Ticket: Agent Configuration System Fix
-- Root Cause: Missing voice_provider column caused agents to fail VAPI sync

-- =============================================================================
-- Step 1: Add voice_provider column (nullable initially to avoid breaking existing rows)
-- =============================================================================

ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_provider TEXT;

-- =============================================================================
-- Step 2: Backfill existing rows with intelligent defaults based on voice ID patterns
-- =============================================================================

UPDATE agents
SET voice_provider = CASE
    -- Vapi native voices (legacy + current)
    WHEN voice IN ('Rohan', 'Elliot', 'Savannah', 'jennifer', 'kylie', 'neha', 'rohan', 'elliot', 'savannah') THEN 'vapi'

    -- ElevenLabs voices (24-character alphanumeric IDs like '21m00Tcm4TlvDq8ikWAM')
    WHEN voice ~ '^[A-Za-z0-9]{24}$' THEN 'elevenlabs'

    -- OpenAI TTS voices
    WHEN voice IN ('alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer') THEN 'openai'

    -- Google Cloud TTS voices (pattern: en-US-Neural2-A, en-GB-Neural2-C, etc.)
    WHEN voice LIKE 'en-US-Neural%' OR voice LIKE 'en-GB-Neural%' OR voice LIKE '%-Neural2-%' THEN 'google'

    -- Azure Neural voices (pattern: en-US-JennyNeural, en-US-AmberNeural, etc.)
    WHEN voice LIKE '%-Neural' OR voice LIKE '%Neural' THEN 'azure'

    -- PlayHT voices (jennifer, marcus, etc.)
    WHEN voice IN ('jennifer', 'marcus') AND voice NOT IN ('Rohan', 'Elliot', 'Savannah') THEN 'playht'

    -- Default to vapi for any unrecognized voices
    ELSE 'vapi'
END
WHERE voice_provider IS NULL AND voice IS NOT NULL;

-- =============================================================================
-- Step 3: Add index for performance (queries often filter by voice_provider)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_agents_voice_provider ON agents(voice_provider);

-- =============================================================================
-- Step 4: Add column comment for documentation
-- =============================================================================

COMMENT ON COLUMN agents.voice_provider IS 'Voice provider: vapi, elevenlabs, openai, google, azure, playht, rime. Must match voice ID to provider for successful VAPI sync.';

-- =============================================================================
-- Step 5: Verification queries (for manual testing)
-- =============================================================================

-- Verify column exists
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'agents' AND column_name = 'voice_provider';

-- Check distribution of voice providers
-- SELECT voice_provider, COUNT(*) as count
-- FROM agents
-- WHERE voice_provider IS NOT NULL
-- GROUP BY voice_provider
-- ORDER BY count DESC;

-- Check for any NULL voice_providers (should be zero if backfill worked)
-- SELECT COUNT(*) as null_voice_providers
-- FROM agents
-- WHERE voice IS NOT NULL AND voice_provider IS NULL;

-- Sample agents with voice and voice_provider
-- SELECT id, role, voice, voice_provider, created_at
-- FROM agents
-- ORDER BY created_at DESC
-- LIMIT 10;
