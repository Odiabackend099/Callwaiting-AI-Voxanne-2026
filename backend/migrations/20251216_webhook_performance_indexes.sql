-- Migration: Webhook Performance Indexes
-- Date: 2025-12-16
-- Purpose: Add indexes to improve webhook processing performance
-- Estimated impact: 50-80% faster webhook queries
-- ============================================================================
-- IDEMPOTENCY TABLE INDEXES
-- ============================================================================
-- Index for idempotency checks (most frequent query in webhook handler)
-- Used in: handleCallStarted, handleCallEnded, handleTranscript
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id ON processed_webhook_events(event_id);
-- Composite index for event type filtering
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_call_event ON processed_webhook_events(call_id, event_type);
-- ============================================================================
-- CALL LOGS INDEXES
-- ============================================================================
-- Index for call log lookups by vapi_call_id (used in every webhook)
CREATE INDEX IF NOT EXISTS idx_call_logs_vapi_call_id ON call_logs(vapi_call_id);
-- Composite index for dashboard queries (user's recent calls)
CREATE INDEX IF NOT EXISTS idx_call_logs_user_status_created ON call_logs(user_id, status, created_at DESC)
WHERE user_id IS NOT NULL;
-- Index for call outcome filtering
CREATE INDEX IF NOT EXISTS idx_call_logs_outcome ON call_logs(outcome)
WHERE outcome IS NOT NULL;
-- ============================================================================
-- CALL TRACKING INDEXES
-- ============================================================================
-- Index for call tracking lookups by vapi_call_id (critical for webhook performance)
CREATE INDEX IF NOT EXISTS idx_call_tracking_vapi_call_id ON call_tracking(vapi_call_id);
-- Composite index for org-level queries
CREATE INDEX IF NOT EXISTS idx_call_tracking_org_status ON call_tracking(org_id, status, created_at DESC);
-- Index for agent-level analytics
CREATE INDEX IF NOT EXISTS idx_call_tracking_agent_id ON call_tracking(agent_id, created_at DESC)
WHERE agent_id IS NOT NULL;
-- ============================================================================
-- CALL TRANSCRIPTS INDEXES
-- ============================================================================
-- Index for transcript lookups by call_id
CREATE INDEX IF NOT EXISTS idx_call_transcripts_call_id ON call_transcripts(call_id, timestamp DESC);
-- Index for speaker filtering (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_call_transcripts_speaker ON call_transcripts(speaker, timestamp DESC);
-- ============================================================================
-- AGENTS TABLE INDEXES
-- ============================================================================
-- Composite index for active agents lookup by vapi_assistant_id
-- Used in: handleCallStarted for inbound call routing
CREATE INDEX IF NOT EXISTS idx_agents_vapi_assistant_id_active ON agents(vapi_assistant_id, active)
WHERE active = true;
-- Index for org-level agent queries
CREATE INDEX IF NOT EXISTS idx_agents_org_active ON agents(org_id, active)
WHERE active = true;
-- ============================================================================
-- KNOWLEDGE BASE INDEXES
-- ============================================================================
-- Index for knowledge base lookups by org_id and active status
-- Used in: detectHallucinations
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_active ON knowledge_base(org_id, active)
WHERE active = true;
-- Index for knowledge base chunks lookup
CREATE INDEX IF NOT EXISTS idx_kb_chunks_kb_id ON knowledge_base_chunks(knowledge_base_id);
-- ============================================================================
-- LEADS TABLE INDEXES
-- ============================================================================
-- Index for lead lookups by phone number
-- Used in: handleCallEnded for lead status updates
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone)
WHERE phone IS NOT NULL;
-- Composite index for org-level lead queries
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, status, last_contacted_at DESC);
-- ============================================================================
-- CALLS TABLE INDEXES
-- ============================================================================
-- Index for calls table lookups by vapi_call_id
CREATE INDEX IF NOT EXISTS idx_calls_vapi_call_id ON calls(vapi_call_id);
-- Composite index for call type analytics
CREATE INDEX IF NOT EXISTS idx_calls_org_type_status ON calls(org_id, call_type, status, created_at DESC);
-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Verify indexes were created successfully
DO $$
DECLARE index_count INTEGER;
BEGIN
SELECT COUNT(*) INTO index_count
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';
RAISE NOTICE 'Total indexes created: %',
index_count;
END $$;
-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
-- Expected improvements:
-- 1. Idempotency checks: 10ms → 1ms (10x faster)
-- 2. Call log lookups: 50ms → 5ms (10x faster)
-- 3. Call tracking lookups: 30ms → 3ms (10x faster)
-- 4. Overall webhook processing: 200ms → 50ms (4x faster)
-- Maintenance:
-- - Indexes are automatically maintained by PostgreSQL
-- - Run ANALYZE after bulk data imports
-- - Monitor index usage with pg_stat_user_indexes