-- ============================================
-- WARDEN CRITICAL FIX: Add NOT NULL Constraints to ALL org_id Columns
-- Date: 2025-01-10
-- Purpose: Enforce org_id at database level to prevent null values (SSOT enforcement)
-- Context: Zero-Trust Warden Phase 1 - Schema Enforcement
-- 
-- PREREQUISITES:
--   1. org_id columns exist on all tables (migration: 20250110_add_org_id_to_existing_tables.sql)
--   2. All org_id values have been backfilled (migration: 20250110_backfill_org_id_from_user_id.sql)
--   3. Verification confirms zero NULL org_id values exist
--
-- NEXT STEPS:
--   1. Update JWT app_metadata (script: backend/scripts/update-user-org-metadata.ts)
--   2. Deploy immutability triggers (migration: 20250110_create_org_id_immutability_triggers.sql)
-- ============================================

-- ============================================
-- CRITICAL TABLES (Most Frequently Queried)
-- ============================================

-- Call-related tables
ALTER TABLE call_logs
  ADD CONSTRAINT IF NOT EXISTS call_logs_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE calls
  ADD CONSTRAINT IF NOT EXISTS calls_org_id_not_null 
  CHECK (org_id IS NOT NULL);

-- Lead and agent tables
ALTER TABLE leads
  ADD CONSTRAINT IF NOT EXISTS leads_org_id_not_null 
  CHECK (org_id IS NOT NULL);

-- Knowledge base tables
ALTER TABLE knowledge_base
  ADD CONSTRAINT IF NOT EXISTS knowledge_base_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE knowledge_base_changelog
  ADD CONSTRAINT IF NOT EXISTS knowledge_base_changelog_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE kb_sync_log
  ADD CONSTRAINT IF NOT EXISTS kb_sync_log_org_id_not_null 
  CHECK (org_id IS NOT NULL);

-- Campaign-related tables
ALTER TABLE campaign_leads
  ADD CONSTRAINT IF NOT EXISTS campaign_leads_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE campaigns
  ADD CONSTRAINT IF NOT EXISTS campaigns_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE voicemail_audit_log
  ADD CONSTRAINT IF NOT EXISTS voicemail_audit_log_org_id_not_null 
  CHECK (org_id IS NOT NULL);

-- ============================================
-- SECONDARY TABLES (Have user_id, now have org_id)
-- ============================================

ALTER TABLE agent_configurations
  ADD CONSTRAINT IF NOT EXISTS agent_configurations_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE billing_cycles
  ADD CONSTRAINT IF NOT EXISTS billing_cycles_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE call_lists
  ADD CONSTRAINT IF NOT EXISTS call_lists_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE campaign_phone_numbers
  ADD CONSTRAINT IF NOT EXISTS campaign_phone_numbers_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE campaign_summaries
  ADD CONSTRAINT IF NOT EXISTS campaign_summaries_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE cold_call_logs
  ADD CONSTRAINT IF NOT EXISTS cold_call_logs_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE contacts
  ADD CONSTRAINT IF NOT EXISTS contacts_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE compliance_audit_logs
  ADD CONSTRAINT IF NOT EXISTS compliance_audit_logs_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE consent_records
  ADD CONSTRAINT IF NOT EXISTS consent_records_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE credential_tokens
  ADD CONSTRAINT IF NOT EXISTS credential_tokens_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE credit_transactions
  ADD CONSTRAINT IF NOT EXISTS credit_transactions_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE customer_twilio_keys
  ADD CONSTRAINT IF NOT EXISTS customer_twilio_keys_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE daily_lead_uploads
  ADD CONSTRAINT IF NOT EXISTS daily_lead_uploads_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE dnc_list
  ADD CONSTRAINT IF NOT EXISTS dnc_list_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE embeddings
  ADD CONSTRAINT IF NOT EXISTS embeddings_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE knowledge_base_chunks
  ADD CONSTRAINT IF NOT EXISTS knowledge_base_chunks_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE knowledge_base_documents
  ADD CONSTRAINT IF NOT EXISTS knowledge_base_documents_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE notification_history
  ADD CONSTRAINT IF NOT EXISTS notification_history_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE notification_rate_limits
  ADD CONSTRAINT IF NOT EXISTS notification_rate_limits_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE notification_templates
  ADD CONSTRAINT IF NOT EXISTS notification_templates_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE onboarding_events
  ADD CONSTRAINT IF NOT EXISTS onboarding_events_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE payment_events_log
  ADD CONSTRAINT IF NOT EXISTS payment_events_log_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE payments
  ADD CONSTRAINT IF NOT EXISTS payments_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE phone_assistants
  ADD CONSTRAINT IF NOT EXISTS phone_assistants_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE sentiment_analysis
  ADD CONSTRAINT IF NOT EXISTS sentiment_analysis_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE telephony_audit_log
  ADD CONSTRAINT IF NOT EXISTS telephony_audit_log_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE usage_events
  ADD CONSTRAINT IF NOT EXISTS usage_events_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE usage_records
  ADD CONSTRAINT IF NOT EXISTS usage_records_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE user_active_calls
  ADD CONSTRAINT IF NOT EXISTS user_active_calls_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE user_phone_numbers
  ADD CONSTRAINT IF NOT EXISTS user_phone_numbers_org_id_not_null 
  CHECK (org_id IS NOT NULL);

ALTER TABLE user_twilio_subaccounts
  ADD CONSTRAINT IF NOT EXISTS user_twilio_subaccounts_org_id_not_null 
  CHECK (org_id IS NOT NULL);

-- ============================================
-- CONDITIONAL TABLES (May Not Exist)
-- ============================================
-- These tables are referenced in immutability triggers migration
-- but may not exist in current database schema

DO $$
BEGIN
  -- call_tracking table (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'call_tracking') THEN
    ALTER TABLE call_tracking
      ADD CONSTRAINT IF NOT EXISTS call_tracking_org_id_not_null 
      CHECK (org_id IS NOT NULL);
  END IF;

  -- agents table (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') THEN
    ALTER TABLE agents
      ADD CONSTRAINT IF NOT EXISTS agents_org_id_not_null 
      CHECK (org_id IS NOT NULL);
  END IF;

  -- integrations table (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'integrations') THEN
    ALTER TABLE integrations
      ADD CONSTRAINT IF NOT EXISTS integrations_org_id_not_null 
      CHECK (org_id IS NOT NULL);
  END IF;

  -- recording_upload_queue table (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'recording_upload_queue') THEN
    ALTER TABLE recording_upload_queue
      ADD CONSTRAINT IF NOT EXISTS recording_upload_queue_org_id_not_null 
      CHECK (org_id IS NOT NULL);
  END IF;

  -- imports table (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'imports') THEN
    ALTER TABLE imports
      ADD CONSTRAINT IF NOT EXISTS imports_org_id_not_null 
      CHECK (org_id IS NOT NULL);
  END IF;

  -- outreach_templates table (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outreach_templates') THEN
    ALTER TABLE outreach_templates
      ADD CONSTRAINT IF NOT EXISTS outreach_templates_org_id_not_null 
      CHECK (org_id IS NOT NULL);
  END IF;

  -- phone_blacklist table (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'phone_blacklist') THEN
    ALTER TABLE phone_blacklist
      ADD CONSTRAINT IF NOT EXISTS phone_blacklist_org_id_not_null 
      CHECK (org_id IS NOT NULL);
  END IF;

  -- hallucination_flags table (if exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hallucination_flags') THEN
    ALTER TABLE hallucination_flags
      ADD CONSTRAINT IF NOT EXISTS hallucination_flags_org_id_not_null 
      CHECK (org_id IS NOT NULL);
  END IF;
END $$;

-- ============================================
-- COMPOSITE UNIQUE INDEXES FOR MULTI-TENANT SAFETY
-- ============================================
-- Ensures vapi_call_id uniqueness is scoped per organization
-- Prevents accidental collisions if vapi_call_id somehow repeats across orgs

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_logs_org_vapi_call_id
ON call_logs(org_id, vapi_call_id) 
WHERE vapi_call_id IS NOT NULL;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After applying this migration, verify with:
--
-- -- Check for NULL org_id values (should return 0 for all tables)
-- SELECT 
--   table_name,
--   COUNT(*) FILTER (WHERE org_id IS NULL) as null_count,
--   COUNT(*) as total_count
-- FROM call_logs
-- GROUP BY table_name
-- UNION ALL
-- SELECT 'calls', COUNT(*) FILTER (WHERE org_id IS NULL), COUNT(*) FROM calls
-- UNION ALL
-- SELECT 'leads', COUNT(*) FILTER (WHERE org_id IS NULL), COUNT(*) FROM leads
-- ORDER BY table_name;
--
-- -- Test constraint (should fail)
-- INSERT INTO call_logs (org_id, vapi_call_id) VALUES (NULL, 'test');
-- -- Expected: ERROR: new row for relation "call_logs" violates check constraint "call_logs_org_id_not_null"
--
-- -- Test valid insert (should succeed)
-- INSERT INTO call_logs (org_id, vapi_call_id) 
-- VALUES ('a0000000-0000-0000-0000-000000000001', 'test-valid');
-- -- Expected: SUCCESS

-- ============================================
-- ROLLBACK PLAN
-- ============================================
-- If these constraints cause issues with existing data:
--
-- ALTER TABLE call_logs DROP CONSTRAINT IF EXISTS call_logs_org_id_not_null;
-- ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_org_id_not_null;
-- ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_org_id_not_null;
-- -- ... (repeat for all tables)
--
-- DROP INDEX IF EXISTS idx_call_logs_org_vapi_call_id;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next: Update JWT app_metadata (script: backend/scripts/update-user-org-metadata.ts)
-- Then: Deploy immutability triggers (migration: 20250110_create_org_id_immutability_triggers.sql)
