-- ============================================
-- WARDEN CRITICAL FIX: Backfill org_id from user_id Data
-- Date: 2025-01-10
-- Purpose: Populate org_id columns for all existing records (1:1 mapping to default org)
-- Context: Zero-Trust Warden Phase 1 - Data Migration
-- 
-- PREREQUISITES:
--   1. org_id columns exist on all tables (migration: 20250110_add_org_id_to_existing_tables.sql)
--   2. Default organization exists: 'a0000000-0000-0000-0000-000000000001'
--
-- NEXT STEPS:
--   1. Add NOT NULL constraints (migration: 20250110_add_org_id_not_null_constraints.sql)
--   2. Update JWT app_metadata (script: backend/scripts/update-user-org-metadata.ts)
--   3. Deploy immutability triggers (migration: 20250110_create_org_id_immutability_triggers.sql)
-- ============================================

-- Default organization ID (created in foundation migration)
DO $$
DECLARE
  default_org_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  -- Ensure default organization exists
  INSERT INTO organizations (id, name, status)
  VALUES (default_org_id, 'Default Organization', 'active')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================
-- BACKFILL STRATEGY
-- ============================================
-- 1. Tables with user_id: Set org_id = default_org_id (1:1 mapping)
-- 2. Tables without user_id but with FK relationships: Backfill via JOINs
-- 3. Orphaned records: Set to default org (defensive)

-- ============================================
-- PHASE 1: Direct user_id Tables (1:1 Mapping)
-- ============================================
-- For tables with user_id, set org_id = default_org_id for all records

-- Critical tables
UPDATE call_logs 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE calls 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE leads 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE knowledge_base 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE knowledge_base_changelog 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE kb_sync_log 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

-- Secondary tables with user_id
UPDATE agent_configurations 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE billing_cycles 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE call_lists 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE campaign_phone_numbers 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE campaign_summaries 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE campaigns 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE cold_call_logs 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE contacts 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE compliance_audit_logs 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE consent_records 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE credential_tokens 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE credit_transactions 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE customer_twilio_keys 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE daily_lead_uploads 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE dnc_list 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE embeddings 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE knowledge_base_chunks 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE knowledge_base_documents 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE notification_history 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE notification_rate_limits 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE notification_templates 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE onboarding_events 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE payment_events_log 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE payments 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE phone_assistants 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE sentiment_analysis 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE telephony_audit_log 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE usage_events 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE usage_records 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE user_active_calls 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE user_phone_numbers 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE user_twilio_subaccounts 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

-- ============================================
-- PHASE 2: FK Relationship Tables (JOIN Backfill)
-- ============================================
-- For tables without user_id but with FK relationships, backfill via JOINs

-- campaign_leads: Backfill from leads table
UPDATE campaign_leads cl
SET org_id = l.org_id
FROM leads l
WHERE cl.lead_id = l.id 
  AND cl.org_id IS NULL
  AND l.org_id IS NOT NULL;

-- campaign_leads: Set default org for orphaned records (defensive)
UPDATE campaign_leads 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

-- voicemail_audit_log: Backfill from contacts or campaigns
UPDATE voicemail_audit_log va
SET org_id = c.org_id
FROM contacts c
WHERE va.contact_id = c.id 
  AND va.org_id IS NULL
  AND c.org_id IS NOT NULL;

UPDATE voicemail_audit_log va
SET org_id = cam.org_id
FROM campaigns cam
WHERE va.campaign_id = cam.id 
  AND va.org_id IS NULL
  AND cam.org_id IS NOT NULL;

-- voicemail_audit_log: Set default org for orphaned records (defensive)
UPDATE voicemail_audit_log 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

-- ============================================
-- PHASE 3: Orphaned Records (Defensive Default)
-- ============================================
-- For any records that still have NULL org_id, set to default org
-- This is defensive - should not happen if data integrity is maintained

DO $$
DECLARE
  default_org_id UUID := 'a0000000-0000-0000-0000-000000000001';
  tables_to_check TEXT[] := ARRAY[
    'call_logs', 'calls', 'leads', 'knowledge_base', 'knowledge_base_changelog',
    'kb_sync_log', 'campaign_leads', 'voicemail_audit_log', 'agent_configurations',
    'billing_cycles', 'call_lists', 'campaign_phone_numbers', 'campaign_summaries',
    'campaigns', 'cold_call_logs', 'contacts', 'compliance_audit_logs',
    'consent_records', 'credential_tokens', 'credit_transactions',
    'customer_twilio_keys', 'daily_lead_uploads', 'dnc_list', 'embeddings',
    'knowledge_base_chunks', 'knowledge_base_documents', 'notification_history',
    'notification_rate_limits', 'notification_templates', 'onboarding_events',
    'payment_events_log', 'payments', 'phone_assistants', 'sentiment_analysis',
    'telephony_audit_log', 'usage_events', 'usage_records', 'user_active_calls',
    'user_phone_numbers', 'user_twilio_subaccounts'
  ];
  table_name TEXT;
  null_count INTEGER;
BEGIN
  FOREACH table_name IN ARRAY tables_to_check
  LOOP
    -- Check if table exists and has org_id column
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = table_name 
        AND column_name = 'org_id'
    ) THEN
      -- Count NULL org_id values
      EXECUTE format('SELECT COUNT(*) FROM %I WHERE org_id IS NULL', table_name) INTO null_count;
      
      -- If NULL values exist, set to default org
      IF null_count > 0 THEN
        EXECUTE format('UPDATE %I SET org_id = $1 WHERE org_id IS NULL', table_name) USING default_org_id;
        RAISE NOTICE 'Backfilled % NULL org_id values in table %', null_count, table_name;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After applying this migration, verify with:
--
-- -- Check for NULL org_id values (should return 0 for all tables)
-- SELECT 
--   'call_logs' as table_name,
--   COUNT(*) FILTER (WHERE org_id IS NULL) as null_count
-- FROM call_logs
-- UNION ALL
-- SELECT 'calls', COUNT(*) FILTER (WHERE org_id IS NULL) FROM calls
-- UNION ALL
-- SELECT 'leads', COUNT(*) FILTER (WHERE org_id IS NULL) FROM leads
-- UNION ALL
-- SELECT 'knowledge_base', COUNT(*) FILTER (WHERE org_id IS NULL) FROM knowledge_base
-- UNION ALL
-- SELECT 'campaigns', COUNT(*) FILTER (WHERE org_id IS NULL) FROM campaigns
-- ORDER BY table_name;
--
-- -- Verify default org assignment
-- SELECT 
--   'call_logs' as table_name,
--   COUNT(*) FILTER (WHERE org_id = 'a0000000-0000-0000-0000-000000000001') as default_org_count,
--   COUNT(*) as total_count
-- FROM call_logs
-- UNION ALL
-- SELECT 'calls', COUNT(*) FILTER (WHERE org_id = 'a0000000-0000-0000-0000-000000000001'), COUNT(*) FROM calls
-- UNION ALL
-- SELECT 'leads', COUNT(*) FILTER (WHERE org_id = 'a0000000-0000-0000-0000-000000000001'), COUNT(*) FROM leads
-- ORDER BY table_name;
--
-- -- Check data integrity (no records lost)
-- SELECT 
--   'call_logs' as table_name,
--   COUNT(*) as total_records
-- FROM call_logs
-- UNION ALL
-- SELECT 'calls', COUNT(*) FROM calls
-- UNION ALL
-- SELECT 'leads', COUNT(*) FROM leads
-- ORDER BY table_name;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next: Add NOT NULL constraints (migration: 20250110_add_org_id_not_null_constraints.sql)
