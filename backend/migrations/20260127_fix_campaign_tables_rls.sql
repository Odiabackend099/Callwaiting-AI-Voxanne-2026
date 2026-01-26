-- ============================================
-- CRITICAL SECURITY FIX: Campaign Tables RLS
-- Fixes multi-tenant data isolation for campaign engine
-- Date: 2026-01-27
-- Risk Level: CRITICAL - Without this, cross-tenant data access possible
-- ============================================

-- ============================================================================
-- STEP 1: Add org_id to tables that don't have it (via leads FK)
-- ============================================================================

-- 1a. lead_scores - Add org_id derived from leads table
ALTER TABLE lead_scores ADD COLUMN IF NOT EXISTS org_id UUID;

-- Populate org_id from leads table
UPDATE lead_scores ls
SET org_id = l.org_id
FROM leads l
WHERE ls.lead_id = l.id
AND ls.org_id IS NULL;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lead_scores_org_id_fkey'
  ) THEN
    ALTER TABLE lead_scores
    ADD CONSTRAINT lead_scores_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lead_scores_org_id ON lead_scores(org_id);

-- 1b. campaign_sequences - Add org_id derived from leads table
ALTER TABLE campaign_sequences ADD COLUMN IF NOT EXISTS org_id UUID;

UPDATE campaign_sequences cs
SET org_id = l.org_id
FROM leads l
WHERE cs.lead_id = l.id
AND cs.org_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'campaign_sequences_org_id_fkey'
  ) THEN
    ALTER TABLE campaign_sequences
    ADD CONSTRAINT campaign_sequences_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_sequences_org_id ON campaign_sequences(org_id);

-- 1c. email_tracking - Add org_id derived from leads table
ALTER TABLE email_tracking ADD COLUMN IF NOT EXISTS org_id UUID;

UPDATE email_tracking et
SET org_id = l.org_id
FROM leads l
WHERE et.lead_id = l.id
AND et.org_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'email_tracking_org_id_fkey'
  ) THEN
    ALTER TABLE email_tracking
    ADD CONSTRAINT email_tracking_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_tracking_org_id ON email_tracking(org_id);

-- 1d. call_tracking - Add org_id derived from leads table
ALTER TABLE call_tracking ADD COLUMN IF NOT EXISTS org_id UUID;

UPDATE call_tracking ct
SET org_id = l.org_id
FROM leads l
WHERE ct.lead_id = l.id
AND ct.org_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'call_tracking_org_id_fkey'
  ) THEN
    ALTER TABLE call_tracking
    ADD CONSTRAINT call_tracking_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_call_tracking_org_id ON call_tracking(org_id);

-- 1e. pipeline_stages - Add org_id derived from leads table
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS org_id UUID;

UPDATE pipeline_stages ps
SET org_id = l.org_id
FROM leads l
WHERE ps.lead_id = l.id
AND ps.org_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pipeline_stages_org_id_fkey'
  ) THEN
    ALTER TABLE pipeline_stages
    ADD CONSTRAINT pipeline_stages_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org_id ON pipeline_stages(org_id);

-- ============================================================================
-- STEP 2: Enable RLS on all campaign tables
-- ============================================================================

ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Create RLS policies (standard pattern using auth_org_id())
-- ============================================================================

-- 3a. lead_scores policies
DROP POLICY IF EXISTS lead_scores_org_isolation ON lead_scores;
CREATE POLICY lead_scores_org_isolation ON lead_scores
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS lead_scores_service_role ON lead_scores;
CREATE POLICY lead_scores_service_role ON lead_scores
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 3b. campaign_sequences policies
DROP POLICY IF EXISTS campaign_sequences_org_isolation ON campaign_sequences;
CREATE POLICY campaign_sequences_org_isolation ON campaign_sequences
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS campaign_sequences_service_role ON campaign_sequences;
CREATE POLICY campaign_sequences_service_role ON campaign_sequences
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 3c. email_tracking policies
DROP POLICY IF EXISTS email_tracking_org_isolation ON email_tracking;
CREATE POLICY email_tracking_org_isolation ON email_tracking
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS email_tracking_service_role ON email_tracking;
CREATE POLICY email_tracking_service_role ON email_tracking
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 3d. call_tracking policies
DROP POLICY IF EXISTS call_tracking_org_isolation ON call_tracking;
CREATE POLICY call_tracking_org_isolation ON call_tracking
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS call_tracking_service_role ON call_tracking;
CREATE POLICY call_tracking_service_role ON call_tracking
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 3e. pipeline_stages policies
DROP POLICY IF EXISTS pipeline_stages_org_isolation ON pipeline_stages;
CREATE POLICY pipeline_stages_org_isolation ON pipeline_stages
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS pipeline_stages_service_role ON pipeline_stages;
CREATE POLICY pipeline_stages_service_role ON pipeline_stages
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 3f. outreach_templates policies (already has org_id)
DROP POLICY IF EXISTS outreach_templates_org_isolation ON outreach_templates;
CREATE POLICY outreach_templates_org_isolation ON outreach_templates
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS outreach_templates_service_role ON outreach_templates;
CREATE POLICY outreach_templates_service_role ON outreach_templates
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 3g. campaign_metrics policies (already has org_id)
DROP POLICY IF EXISTS campaign_metrics_org_isolation ON campaign_metrics;
CREATE POLICY campaign_metrics_org_isolation ON campaign_metrics
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

DROP POLICY IF EXISTS campaign_metrics_service_role ON campaign_metrics;
CREATE POLICY campaign_metrics_service_role ON campaign_metrics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 4: Add org_id immutability triggers (prevent tampering)
-- ============================================================================

-- Reuse existing function or create if not exists
CREATE OR REPLACE FUNCTION prevent_org_id_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.org_id IS NOT NULL AND NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'Cannot change org_id after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to campaign tables
DROP TRIGGER IF EXISTS org_id_immutable_lead_scores ON lead_scores;
CREATE TRIGGER org_id_immutable_lead_scores
  BEFORE UPDATE ON lead_scores
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

DROP TRIGGER IF EXISTS org_id_immutable_campaign_sequences ON campaign_sequences;
CREATE TRIGGER org_id_immutable_campaign_sequences
  BEFORE UPDATE ON campaign_sequences
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

DROP TRIGGER IF EXISTS org_id_immutable_email_tracking ON email_tracking;
CREATE TRIGGER org_id_immutable_email_tracking
  BEFORE UPDATE ON email_tracking
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

DROP TRIGGER IF EXISTS org_id_immutable_call_tracking ON call_tracking;
CREATE TRIGGER org_id_immutable_call_tracking
  BEFORE UPDATE ON call_tracking
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

DROP TRIGGER IF EXISTS org_id_immutable_pipeline_stages ON pipeline_stages;
CREATE TRIGGER org_id_immutable_pipeline_stages
  BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW
  WHEN (OLD.org_id IS DISTINCT FROM NEW.org_id)
  EXECUTE FUNCTION prevent_org_id_change();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- 1. Added org_id column to 5 tables: lead_scores, campaign_sequences,
--    email_tracking, call_tracking, pipeline_stages
-- 2. Enabled RLS on all 7 campaign tables
-- 3. Created org_isolation policies using standard auth_org_id() pattern
-- 4. Created service_role bypass policies for backend operations
-- 5. Added org_id immutability triggers to prevent tampering
--
-- Run this verification query after applying:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE tablename IN ('lead_scores', 'campaign_sequences', 'email_tracking',
--                     'call_tracking', 'pipeline_stages', 'outreach_templates',
--                     'campaign_metrics');
-- ============================================================================
