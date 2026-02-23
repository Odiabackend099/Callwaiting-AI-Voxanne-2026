-- Migration: 20260223_add_voice_params_to_agents.sql
-- Purpose: Add ElevenLabs voice parameter columns (stability, similarity_boost)
--          to the agents table (active code path) AND legacy config tables.
--          These are only used when voice_provider = 'elevenlabs'.
--          Values are 0.0-1.0 checked constraints.
--
-- IMPORTANT: These columns are optional (nullable). NULL means "use provider default".
--            Do NOT set values for non-ElevenLabs voices — they are silently ignored by Vapi.

-- PRIMARY: agents table (active code path — used by POST /agent/behavior + GET /agent/config)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS voice_stability NUMERIC
    CHECK (voice_stability IS NULL OR (voice_stability >= 0.0 AND voice_stability <= 1.0)),
  ADD COLUMN IF NOT EXISTS voice_similarity_boost NUMERIC
    CHECK (voice_similarity_boost IS NULL OR (voice_similarity_boost >= 0.0 AND voice_similarity_boost <= 1.0));

COMMENT ON COLUMN agents.voice_stability IS
  'ElevenLabs only: voice stability 0.0-1.0 (lower = more expressive, higher = more consistent). NULL = provider default.';
COMMENT ON COLUMN agents.voice_similarity_boost IS
  'ElevenLabs only: similarity boost 0.0-1.0 (higher = voice sounds closer to original). NULL = provider default.';

-- LEGACY: inbound_agent_config / outbound_agent_config (used by deprecated sync-agents route)
ALTER TABLE inbound_agent_config
  ADD COLUMN IF NOT EXISTS voice_stability NUMERIC
    CHECK (voice_stability IS NULL OR (voice_stability >= 0.0 AND voice_stability <= 1.0)),
  ADD COLUMN IF NOT EXISTS voice_similarity_boost NUMERIC
    CHECK (voice_similarity_boost IS NULL OR (voice_similarity_boost >= 0.0 AND voice_similarity_boost <= 1.0));

ALTER TABLE outbound_agent_config
  ADD COLUMN IF NOT EXISTS voice_stability NUMERIC
    CHECK (voice_stability IS NULL OR (voice_stability >= 0.0 AND voice_stability <= 1.0)),
  ADD COLUMN IF NOT EXISTS voice_similarity_boost NUMERIC
    CHECK (voice_similarity_boost IS NULL OR (voice_similarity_boost >= 0.0 AND voice_similarity_boost <= 1.0));

COMMENT ON COLUMN inbound_agent_config.voice_stability IS
  'ElevenLabs only: voice stability 0.0-1.0 (lower = more expressive, higher = more consistent). NULL = provider default.';
COMMENT ON COLUMN inbound_agent_config.voice_similarity_boost IS
  'ElevenLabs only: similarity boost 0.0-1.0 (higher = voice sounds closer to original). NULL = provider default.';
COMMENT ON COLUMN outbound_agent_config.voice_stability IS
  'ElevenLabs only: voice stability 0.0-1.0 (lower = more expressive, higher = more consistent). NULL = provider default.';
COMMENT ON COLUMN outbound_agent_config.voice_similarity_boost IS
  'ElevenLabs only: similarity boost 0.0-1.0 (higher = voice sounds closer to original). NULL = provider default.';
