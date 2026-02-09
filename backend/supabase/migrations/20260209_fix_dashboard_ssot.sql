-- Dashboard SSOT Fix Migration
-- Date: 2026-02-09
-- Purpose: Fix dashboard data population pipeline to establish Single Source of Truth
-- Reference: Documentation-backed plan from Vapi/Twilio/Supabase research

-- ============================================================
-- 1. CREATE hot_lead_alerts TABLE
-- Referenced by vapi-webhook.ts:653 and analytics.ts:165
-- Both silently fail because this table was never deployed
-- ============================================================

CREATE TABLE IF NOT EXISTS hot_lead_alerts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  -- Lead information
  lead_name TEXT NOT NULL,
  lead_phone TEXT NOT NULL,
  service_interest TEXT,
  urgency_level TEXT CHECK (urgency_level IN ('high', 'medium', 'low')) DEFAULT 'high',
  summary TEXT,
  lead_score INTEGER CHECK (
    lead_score >= 0
    AND lead_score <= 100
  ),
  -- Alert delivery tracking
  sms_message_id TEXT,
  alert_sent_at TIMESTAMP WITH TIME ZONE,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent duplicate alerts for same call
  UNIQUE(org_id, call_id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_hot_lead_alerts_org_id ON hot_lead_alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_hot_lead_alerts_call_id ON hot_lead_alerts(call_id);
CREATE INDEX IF NOT EXISTS idx_hot_lead_alerts_created_at ON hot_lead_alerts(created_at DESC);

-- Enable RLS
ALTER TABLE hot_lead_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their org's hot lead alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hot_lead_alerts' AND policyname = 'Users can view their org hot lead alerts'
  ) THEN
    CREATE POLICY "Users can view their org hot lead alerts" ON hot_lead_alerts
    FOR SELECT USING (org_id = (SELECT auth.jwt()->>'org_id')::uuid);
  END IF;
END $$;

-- RLS Policy: Service role can manage all hot lead alerts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'hot_lead_alerts' AND policyname = 'Service role can manage hot lead alerts'
  ) THEN
    CREATE POLICY "Service role can manage hot lead alerts" ON hot_lead_alerts
    FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Grant permissions
GRANT SELECT ON hot_lead_alerts TO authenticated;
GRANT SELECT ON hot_lead_alerts TO anon;

-- Add hot_lead_alert_phone column to integration_settings (if table exists)
ALTER TABLE IF EXISTS integration_settings
ADD COLUMN IF NOT EXISTS hot_lead_alert_phone TEXT;

-- Comments
COMMENT ON TABLE hot_lead_alerts IS 'Tracks hot lead alerts for dashboard Recent Activity. Created by webhook when lead_score >= 60.';
COMMENT ON COLUMN hot_lead_alerts.lead_score IS 'Lead scoring (0-100): 80+ high, 70+ medium, 60+ low urgency.';

-- ============================================================
-- 2. ADD is_test_call COLUMN TO calls TABLE
-- Per Vapi docs: call.type === "webCall" identifies browser test calls
-- Dashboard should filter these out by default
-- ============================================================

ALTER TABLE calls ADD COLUMN IF NOT EXISTS is_test_call BOOLEAN DEFAULT false;

-- ============================================================
-- 3. SYNC from_number FROM phone_number (backward compatibility)
-- Webhook writes phone_number, dashboard reads from_number
-- Sync until all code migrates to phone_number
-- ============================================================

UPDATE calls SET from_number = phone_number
WHERE from_number IS NULL AND phone_number IS NOT NULL;

-- ============================================================
-- 4. ADD DEFAULT FOR vapi_call_id
-- Per Supabase/PostgreSQL docs: NULL in UNIQUE conflict column
-- bypasses uniqueness, creating duplicate rows silently.
-- Default prevents NULL values from entering.
-- ============================================================

ALTER TABLE calls ALTER COLUMN vapi_call_id SET DEFAULT gen_random_uuid()::text;

-- Rollback (if needed):
-- DROP TABLE IF EXISTS hot_lead_alerts;
-- ALTER TABLE calls DROP COLUMN IF EXISTS is_test_call;
-- ALTER TABLE calls ALTER COLUMN vapi_call_id DROP DEFAULT;
