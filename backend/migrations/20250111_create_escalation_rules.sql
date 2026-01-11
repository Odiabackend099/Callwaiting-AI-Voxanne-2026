-- ============================================
-- TIER 1 - T1.2: Create Escalation Rules Foundation
-- Date: 2025-01-11
-- Purpose: Create tables and infrastructure for call escalation/transfer logic
-- 
-- TABLES CREATED:
--   1. escalation_rules: Defines when and how to transfer calls
--   2. transfer_queue: Logs all transfer attempts
-- 
-- FEATURES:
--   - 4 trigger types: wait_time, sentiment, ai_request, manual
--   - Configurable transfer destinations
--   - Priority-based rule evaluation
--   - Complete audit trail of transfers
-- ============================================
-- ===== escalation_rules Table =====
-- Defines when and how to transfer calls
CREATE TABLE IF NOT EXISTS escalation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    -- NULL = applies to all agents
    -- Trigger configuration
    trigger_type TEXT NOT NULL CHECK (
        trigger_type IN ('wait_time', 'sentiment', 'ai_request', 'manual')
    ),
    trigger_value JSONB,
    -- e.g., {"max_wait_seconds": 300, "sentiment_threshold": -0.5}
    -- Transfer destination
    transfer_number TEXT NOT NULL,
    -- E.164 format phone number
    transfer_type TEXT DEFAULT 'external' CHECK (transfer_type IN ('external', 'internal')),
    -- Metadata
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    priority INT DEFAULT 0,
    -- Higher priority rules checked first
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_transfer_number CHECK (transfer_number ~ '^\+[1-9]\d{1,14}$')
);
-- ===== transfer_queue Table =====
-- Logs all transfer attempts for audit trail
CREATE TABLE IF NOT EXISTS transfer_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    escalation_rule_id UUID REFERENCES escalation_rules(id) ON DELETE
    SET NULL,
        from_agent_id UUID REFERENCES agents(id) ON DELETE
    SET NULL,
        to_number TEXT NOT NULL,
        reason TEXT NOT NULL,
        -- 'wait_time_exceeded', 'negative_sentiment', 'ai_requested', etc.
        trigger_data JSONB,
        -- Snapshot of trigger conditions at time of transfer
        status TEXT DEFAULT 'pending' CHECK (
            status IN ('pending', 'initiated', 'completed', 'failed')
        ),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
);
-- ===== Indexes =====
-- Escalation rules indexes
CREATE INDEX idx_escalation_rules_org_agent ON escalation_rules(org_id, agent_id);
CREATE INDEX idx_escalation_rules_enabled ON escalation_rules(org_id, enabled, priority DESC)
WHERE enabled = true;
CREATE INDEX idx_escalation_rules_trigger_type ON escalation_rules(org_id, trigger_type)
WHERE enabled = true;
-- Transfer queue indexes
CREATE INDEX idx_transfer_queue_call ON transfer_queue(call_id);
CREATE INDEX idx_transfer_queue_status ON transfer_queue(org_id, status, created_at DESC);
CREATE INDEX idx_transfer_queue_rule ON transfer_queue(escalation_rule_id)
WHERE escalation_rule_id IS NOT NULL;
-- ===== RLS Policies =====
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_queue ENABLE ROW LEVEL SECURITY;
-- Escalation rules policies
DROP POLICY IF EXISTS "escalation_rules_org_policy" ON escalation_rules;
CREATE POLICY "escalation_rules_org_policy" ON escalation_rules FOR ALL TO authenticated USING (
    org_id = (
        SELECT public.auth_org_id()
    )
) WITH CHECK (
    org_id = (
        SELECT public.auth_org_id()
    )
);
-- Transfer queue policies
DROP POLICY IF EXISTS "transfer_queue_org_policy" ON transfer_queue;
CREATE POLICY "transfer_queue_org_policy" ON transfer_queue FOR ALL TO authenticated USING (
    org_id = (
        SELECT public.auth_org_id()
    )
) WITH CHECK (
    org_id = (
        SELECT public.auth_org_id()
    )
);
-- Service role bypass for both tables
CREATE POLICY "escalation_rules_service_role_bypass" ON escalation_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "transfer_queue_service_role_bypass" ON transfer_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
-- ===== Immutability Triggers =====
-- Prevent org_id from being changed after creation
CREATE TRIGGER org_id_immutable_escalation_rules BEFORE
UPDATE ON escalation_rules FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();
CREATE TRIGGER org_id_immutable_transfer_queue BEFORE
UPDATE ON transfer_queue FOR EACH ROW EXECUTE FUNCTION prevent_org_id_change();
-- ===== Updated At Trigger =====
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_escalation_rules_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER escalation_rules_updated_at BEFORE
UPDATE ON escalation_rules FOR EACH ROW EXECUTE FUNCTION update_escalation_rules_updated_at();
-- ===== Comments =====
COMMENT ON TABLE escalation_rules IS 'Defines when and how to transfer/escalate calls. Supports wait_time, sentiment, ai_request, and manual triggers.';
COMMENT ON COLUMN escalation_rules.trigger_type IS 'Type of trigger: wait_time (max wait), sentiment (negative sentiment), ai_request (AI requests transfer), manual (user-initiated)';
COMMENT ON COLUMN escalation_rules.trigger_value IS 'JSONB configuration for trigger. Examples: {"max_wait_seconds": 300}, {"sentiment_threshold": -0.5}';
COMMENT ON COLUMN escalation_rules.priority IS 'Higher priority rules are evaluated first. Use to create fallback chains.';
COMMENT ON TABLE transfer_queue IS 'Audit log of all call transfer attempts. Tracks status, errors, and trigger conditions.';
COMMENT ON COLUMN transfer_queue.trigger_data IS 'Snapshot of conditions at time of transfer (e.g., actual wait time, sentiment score)';
-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After applying this migration, verify with:
--
-- -- Check tables exist
-- \dt escalation_rules transfer_queue
--
-- -- Check RLS is enabled
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('escalation_rules', 'transfer_queue');
--
-- -- Check policies exist
-- SELECT tablename, policyname 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('escalation_rules', 'transfer_queue')
-- ORDER BY tablename, policyname;
--
-- -- Test creating a rule
-- INSERT INTO escalation_rules (org_id, name, trigger_type, trigger_value, transfer_number)
-- VALUES ((SELECT public.auth_org_id()), 'Test Rule', 'wait_time', '{"max_wait_seconds": 300}', '+15551234567');
-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next: Apply T1.3 (User/Team Management)