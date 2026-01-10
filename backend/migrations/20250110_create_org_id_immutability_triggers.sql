-- ============================================
-- WARDEN CRITICAL FIX: org_id Immutability Triggers
-- Date: 2025-01-10
-- Purpose: Prevent org_id modification at database level (SSOT enforcement)
-- Context: Zero-Trust Warden Phase 1 - Identity Architecture Fix
-- ============================================

-- STEP 1: Create trigger function to prevent org_id changes
-- This function blocks any UPDATE that attempts to change org_id
-- Exception is raised with clear error message

CREATE OR REPLACE FUNCTION prevent_org_id_change()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce if org_id column exists in both OLD and NEW
  IF OLD.org_id IS NOT NULL AND NEW.org_id IS NOT NULL AND OLD.org_id != NEW.org_id THEN
    RAISE EXCEPTION 'org_id is immutable. Cannot change from % to %. Violation detected in table: %', 
      OLD.org_id, NEW.org_id, TG_TABLE_NAME
    USING ERRCODE = 'P0001', 
          HINT = 'org_id is the Single Source of Truth (SSOT) for tenant identity and cannot be modified after creation.';
  END IF;
  RETURN NEW;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION prevent_org_id_change() IS 
'Prevents modification of org_id column. This enforces SSOT at the database level. If org_id needs to change, the record must be deleted and recreated.';

-- ============================================
-- STEP 2: Apply triggers to ALL org-scoped tables with direct org_id column
-- ============================================

-- Core call-related tables
CREATE TRIGGER org_id_immutable_call_logs 
  BEFORE UPDATE ON call_logs 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER org_id_immutable_call_tracking 
  BEFORE UPDATE ON call_tracking 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER org_id_immutable_calls 
  BEFORE UPDATE ON calls 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

-- Lead and agent tables
CREATE TRIGGER org_id_immutable_leads 
  BEFORE UPDATE ON leads 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER org_id_immutable_agents 
  BEFORE UPDATE ON agents 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

-- Knowledge base tables
CREATE TRIGGER org_id_immutable_knowledge_base 
  BEFORE UPDATE ON knowledge_base 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER org_id_immutable_knowledge_base_changelog 
  BEFORE UPDATE ON knowledge_base_changelog 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

-- Integration and configuration tables
CREATE TRIGGER org_id_immutable_integrations 
  BEFORE UPDATE ON integrations 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER org_id_immutable_inbound_agent_config 
  BEFORE UPDATE ON inbound_agent_config 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

-- Recording and media tables
CREATE TRIGGER org_id_immutable_recording_upload_queue 
  BEFORE UPDATE ON recording_upload_queue 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

-- Campaign and outreach tables (with direct org_id)
CREATE TRIGGER org_id_immutable_outreach_templates 
  BEFORE UPDATE ON outreach_templates 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER org_id_immutable_campaign_metrics 
  BEFORE UPDATE ON campaign_metrics 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

-- Data import tables
CREATE TRIGGER org_id_immutable_imports 
  BEFORE UPDATE ON imports 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

-- Other tables
CREATE TRIGGER org_id_immutable_phone_blacklist 
  BEFORE UPDATE ON phone_blacklist 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER org_id_immutable_hallucination_flags 
  BEFORE UPDATE ON hallucination_flags 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

CREATE TRIGGER org_id_immutable_kb_sync_log 
  BEFORE UPDATE ON kb_sync_log 
  FOR EACH ROW 
  EXECUTE FUNCTION prevent_org_id_change();

-- ============================================
-- NOTE: Tables with org_id via Foreign Keys
-- ============================================
-- NOTE: Before applying these triggers, ensure:
--   1. organizations table exists (migration: 20250110_create_organizations_table_foundation.sql)
--   2. org_id columns exist on all target tables (from previous migrations)
--   3. org_id columns have been backfilled with data
--
-- These tables inherit org_id through FK relationships and are protected by FK constraints:
--   - lead_scores (via leads.org_id)
--   - campaign_sequences (via leads.org_id)
--   - email_tracking (via leads.org_id)
--   - pipeline_stages (via leads.org_id)
--   - import_errors (via imports.org_id)
--   - recording_upload_metrics (via call_logs.org_id)
--   - call_transcripts (via call_logs/calls.org_id)
--
-- If org_id needs to change on these tables, the FK constraint will prevent it
-- (you can't have a lead_score pointing to a lead with a different org_id)
-- 
-- Therefore, explicit triggers are not needed on FK-only tables, but they're still safe to add
-- if the FK relationship might change in the future.

-- ============================================
-- VERIFICATION
-- ============================================
-- After deployment, test in Supabase SQL Editor:
--
-- -- Test 1: Attempt to change org_id (should fail)
-- UPDATE call_logs 
-- SET org_id = 'different-org-id' 
-- WHERE id = 'some-existing-id';
-- -- Expected: ERROR: org_id is immutable. Cannot change from <old> to <new>
--
-- -- Test 2: Update other columns (should succeed)
-- UPDATE call_logs 
-- SET status = 'completed' 
-- WHERE id = 'some-existing-id';
-- -- Expected: SUCCESS (other columns can still be updated)
--
-- -- Test 3: Insert new row (should succeed)
-- INSERT INTO call_logs (org_id, vapi_call_id, ...) 
-- VALUES ('some-org-id', 'call-id', ...);
-- -- Expected: SUCCESS (inserts are allowed, only updates are blocked)
--
-- ============================================
-- ROLLBACK PLAN
-- ============================================
-- If these triggers cause issues, drop them with:
--
-- DROP TRIGGER IF EXISTS org_id_immutable_call_logs ON call_logs;
-- DROP TRIGGER IF EXISTS org_id_immutable_call_tracking ON call_tracking;
-- -- ... (repeat for all tables)
--
-- Then drop the function:
-- DROP FUNCTION IF EXISTS prevent_org_id_change();
--
-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- All org-scoped tables with direct org_id columns are now protected from modification.
-- This enforces SSOT at the database level: org_id cannot be changed after creation.
-- 
-- Next steps:
--   1. Verify triggers work (run verification tests above)
--   2. Update RLS policies to use auth.org_id() function
--   3. Audit service role queries (migration: 20250110_audit_service_role_queries.sql)
