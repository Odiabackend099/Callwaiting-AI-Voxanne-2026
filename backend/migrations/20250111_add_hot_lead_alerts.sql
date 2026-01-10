-- Hot Lead Alerts Table
-- Tracks SMS alerts sent for hot leads (manual + automatic)
-- Part of Phase 2: Hot Lead SMS Alerts implementation
-- Create hot_lead_alerts table
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
CREATE INDEX idx_hot_lead_alerts_org_id ON hot_lead_alerts(org_id);
CREATE INDEX idx_hot_lead_alerts_call_id ON hot_lead_alerts(call_id);
CREATE INDEX idx_hot_lead_alerts_created_at ON hot_lead_alerts(created_at DESC);
-- Enable RLS
ALTER TABLE hot_lead_alerts ENABLE ROW LEVEL SECURITY;
-- RLS Policy: Users can view their org's hot lead alerts
CREATE POLICY "Users can view their org's hot lead alerts" ON hot_lead_alerts FOR
SELECT USING (org_id = auth_org_id());
-- RLS Policy: Service role can manage all hot lead alerts
CREATE POLICY "Service role can manage hot lead alerts" ON hot_lead_alerts FOR ALL USING (true) WITH CHECK (true);
-- Add hot_lead_alert_phone column to integration_settings table
-- This stores the clinic manager's phone number for SMS alerts
ALTER TABLE IF EXISTS integration_settings
ADD COLUMN IF NOT EXISTS hot_lead_alert_phone TEXT;
-- Add validation constraint for E.164 phone format
-- E.164 format: +[country code][number], e.g., +12025551234 or +441632960000
ALTER TABLE IF EXISTS integration_settings
ADD CONSTRAINT valid_alert_phone CHECK (
    hot_lead_alert_phone IS NULL
    OR hot_lead_alert_phone ~ '^\+[1-9]\d{1,14}$'
  );
-- Add comment for documentation
COMMENT ON COLUMN integration_settings.hot_lead_alert_phone IS 'Phone number to receive SMS alerts for hot leads (E.164 format, e.g., +12345678900)';
COMMENT ON TABLE hot_lead_alerts IS 'Tracks SMS alerts sent to clinic managers for high-value leads. Prevents duplicate alerts per call via UNIQUE constraint.';
COMMENT ON COLUMN hot_lead_alerts.lead_score IS 'Lead scoring (0-100): 70+ is hot tier. Used to auto-trigger alerts at call end.';
-- Grant permissions
GRANT SELECT ON hot_lead_alerts TO authenticated;
GRANT SELECT ON hot_lead_alerts TO anon;