-- ============================================
-- WARDEN CRITICAL FIX: Add org_id Columns to All Existing Tables
-- Date: 2025-01-10
-- Purpose: Migrate from user-based to org-based multi-tenant model
-- Context: Zero-Trust Warden Phase 1 - Schema Migration
-- 
-- PREREQUISITES:
--   1. organizations table exists (migration: 20250110_create_organizations_table_foundation.sql)
--   2. Default organization exists: 'a0000000-0000-0000-0000-000000000001'
--
-- NEXT STEPS:
--   1. Backfill org_id data (migration: 20250110_backfill_org_id_from_user_id.sql)
--   2. Add NOT NULL constraints (migration: 20250110_add_org_id_not_null_constraints.sql)
--   3. Deploy immutability triggers (migration: 20250110_create_org_id_immutability_triggers.sql)
-- ============================================

-- ============================================
-- CRITICAL TABLES (Referenced in Immutability Triggers Migration)
-- ============================================

-- 1. Call-related tables
ALTER TABLE call_logs 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE call_tracking 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE calls 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 2. Lead and agent tables
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Note: agents table may not exist yet - check first
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') THEN
    ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Knowledge base tables
ALTER TABLE knowledge_base 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE knowledge_base_changelog 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 4. Integration and configuration tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'integrations') THEN
    ALTER TABLE integrations 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inbound_agent_config') THEN
    ALTER TABLE inbound_agent_config 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Recording and media tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recording_upload_queue') THEN
    ALTER TABLE recording_upload_queue 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Campaign and outreach tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outreach_templates') THEN
    ALTER TABLE outreach_templates 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_metrics') THEN
    ALTER TABLE campaign_metrics 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7. Data import tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'imports') THEN
    ALTER TABLE imports 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 8. Other tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'phone_blacklist') THEN
    ALTER TABLE phone_blacklist 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hallucination_flags') THEN
    ALTER TABLE hallucination_flags 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE kb_sync_log 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================
-- SECONDARY TABLES (Have user_id, should have org_id)
-- ============================================

-- Agent and configuration tables
ALTER TABLE agent_configurations 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Billing tables
ALTER TABLE billing_cycles 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Campaign-related tables
ALTER TABLE call_lists 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE campaign_phone_numbers 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE campaign_summaries 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE campaigns 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Call-related tables
ALTER TABLE cold_call_logs 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Compliance and consent tables
ALTER TABLE compliance_audit_logs 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE consent_records 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Credential and token tables
ALTER TABLE credential_tokens 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE credit_transactions 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE customer_twilio_keys 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Data import and tracking tables
ALTER TABLE daily_lead_uploads 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE dnc_list 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Embeddings and knowledge base related
ALTER TABLE embeddings 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE knowledge_base_chunks 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE knowledge_base_documents 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Notification tables
ALTER TABLE notification_history 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE notification_rate_limits 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE notification_templates 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Onboarding and payment tables
ALTER TABLE onboarding_events 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE payment_events_log 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Phone and telephony tables
ALTER TABLE phone_assistants 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE sentiment_analysis 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE telephony_audit_log 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Usage tracking tables
ALTER TABLE usage_events 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE usage_records 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE user_active_calls 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE user_phone_numbers 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE user_twilio_subaccounts 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================
-- FK-ONLY TABLES (Should have org_id for direct filtering)
-- ============================================

-- campaign_leads (FK to leads, but should have own org_id for filtering)
ALTER TABLE campaign_leads 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- disposition_rules (FK to campaigns, but should have own org_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disposition_rules') THEN
    ALTER TABLE disposition_rules 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- rag_query_logs (FK to agents, but should have own org_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rag_query_logs') THEN
    ALTER TABLE rag_query_logs 
      ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- voicemail_audit_log (FK to campaigns/contacts, but should have own org_id)
ALTER TABLE voicemail_audit_log 
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
-- Indexes are critical for multi-tenant query performance
-- Every org_id column should have an index

-- Critical tables (most frequently queried)
CREATE INDEX IF NOT EXISTS idx_call_logs_org_id ON call_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_call_tracking_org_id ON call_tracking(org_id);
CREATE INDEX IF NOT EXISTS idx_calls_org_id ON calls(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_id ON knowledge_base(org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_changelog_org_id ON knowledge_base_changelog(org_id);
CREATE INDEX IF NOT EXISTS idx_kb_sync_log_org_id ON kb_sync_log(org_id);

-- Secondary tables
CREATE INDEX IF NOT EXISTS idx_agent_configurations_org_id ON agent_configurations(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_org_id ON billing_cycles(org_id);
CREATE INDEX IF NOT EXISTS idx_call_lists_org_id ON call_lists(org_id);
CREATE INDEX IF NOT EXISTS idx_campaign_phone_numbers_org_id ON campaign_phone_numbers(org_id);
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_org_id ON campaign_summaries(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_id ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_cold_call_logs_org_id ON cold_call_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_org_id ON compliance_audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_org_id ON consent_records(org_id);
CREATE INDEX IF NOT EXISTS idx_credential_tokens_org_id ON credential_tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_org_id ON credit_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_customer_twilio_keys_org_id ON customer_twilio_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_daily_lead_uploads_org_id ON daily_lead_uploads(org_id);
CREATE INDEX IF NOT EXISTS idx_dnc_list_org_id ON dnc_list(org_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_org_id ON embeddings(org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_chunks_org_id ON knowledge_base_chunks(org_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_documents_org_id ON knowledge_base_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_org_id ON notification_history(org_id);
CREATE INDEX IF NOT EXISTS idx_notification_rate_limits_org_id ON notification_rate_limits(org_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_org_id ON notification_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_org_id ON onboarding_events(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_log_org_id ON payment_events_log(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_phone_assistants_org_id ON phone_assistants(org_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_analysis_org_id ON sentiment_analysis(org_id);
CREATE INDEX IF NOT EXISTS idx_telephony_audit_log_org_id ON telephony_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_org_id ON usage_events(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_org_id ON usage_records(org_id);
CREATE INDEX IF NOT EXISTS idx_user_active_calls_org_id ON user_active_calls(org_id);
CREATE INDEX IF NOT EXISTS idx_user_phone_numbers_org_id ON user_phone_numbers(org_id);
CREATE INDEX IF NOT EXISTS idx_user_twilio_subaccounts_org_id ON user_twilio_subaccounts(org_id);

-- FK-only tables
CREATE INDEX IF NOT EXISTS idx_campaign_leads_org_id ON campaign_leads(org_id);
CREATE INDEX IF NOT EXISTS idx_voicemail_audit_log_org_id ON voicemail_audit_log(org_id);

-- Conditional indexes (only if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') THEN
    CREATE INDEX IF NOT EXISTS idx_agents_org_id ON agents(org_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'integrations') THEN
    CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON integrations(org_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inbound_agent_config') THEN
    CREATE INDEX IF NOT EXISTS idx_inbound_agent_config_org_id ON inbound_agent_config(org_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recording_upload_queue') THEN
    CREATE INDEX IF NOT EXISTS idx_recording_upload_queue_org_id ON recording_upload_queue(org_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outreach_templates') THEN
    CREATE INDEX IF NOT EXISTS idx_outreach_templates_org_id ON outreach_templates(org_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_metrics') THEN
    CREATE INDEX IF NOT EXISTS idx_campaign_metrics_org_id ON campaign_metrics(org_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'imports') THEN
    CREATE INDEX IF NOT EXISTS idx_imports_org_id ON imports(org_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'phone_blacklist') THEN
    CREATE INDEX IF NOT EXISTS idx_phone_blacklist_org_id ON phone_blacklist(org_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hallucination_flags') THEN
    CREATE INDEX IF NOT EXISTS idx_hallucination_flags_org_id ON hallucination_flags(org_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disposition_rules') THEN
    CREATE INDEX IF NOT EXISTS idx_disposition_rules_org_id ON disposition_rules(org_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rag_query_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_rag_query_logs_org_id ON rag_query_logs(org_id);
  END IF;
END $$;

-- ============================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================
-- These indexes optimize multi-tenant queries that filter by org_id + other columns

-- Call logs: org_id + status, org_id + created_at (most common queries)
CREATE INDEX IF NOT EXISTS idx_call_logs_org_status ON call_logs(org_id, status);
CREATE INDEX IF NOT EXISTS idx_call_logs_org_created_at ON call_logs(org_id, created_at DESC);

-- Call tracking: org_id + answered, org_id + called_at
CREATE INDEX IF NOT EXISTS idx_call_tracking_org_answered ON call_tracking(org_id, answered);
CREATE INDEX IF NOT EXISTS idx_call_tracking_org_called_at ON call_tracking(org_id, called_at DESC);

-- Leads: org_id + status, org_id + created_at
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_org_created_at ON leads(org_id, created_at DESC);

-- Knowledge base: org_id + active (filters active KB per org)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_active ON knowledge_base(org_id, active);

-- Campaigns: org_id + status (filters active campaigns per org)
CREATE INDEX IF NOT EXISTS idx_campaigns_org_status ON campaigns(org_id, status);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After applying this migration, verify with:
--
-- -- Check all org_id columns exist
-- SELECT table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND column_name = 'org_id'
-- ORDER BY table_name;
--
-- -- Check all foreign keys exist
-- SELECT 
--   tc.table_name, 
--   kcu.column_name, 
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_schema = 'public'
--   AND kcu.column_name = 'org_id'
-- ORDER BY tc.table_name;
--
-- -- Check all indexes exist
-- SELECT indexname, tablename
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE '%org_id%'
-- ORDER BY tablename, indexname;
--
-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next: Backfill org_id data (migration: 20250110_backfill_org_id_from_user_id.sql)
