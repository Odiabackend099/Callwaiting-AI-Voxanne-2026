-- Priority 9: Feature Flags System
-- Created: 2026-01-28
-- Purpose: Enable/disable features per organization with gradual rollout capability

-- Feature flags table (global feature definitions)
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  flag_name TEXT NOT NULL,
  description TEXT,
  enabled_globally BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization-specific feature flag overrides
CREATE TABLE IF NOT EXISTS org_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, flag_key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_flag_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled_globally);
CREATE INDEX IF NOT EXISTS idx_org_feature_flags_org_id ON org_feature_flags(org_id);
CREATE INDEX IF NOT EXISTS idx_org_feature_flags_flag_key ON org_feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_org_feature_flags_enabled ON org_feature_flags(enabled);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_flags
CREATE POLICY "Anyone can read feature flags"
  ON feature_flags FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage feature flags"
  ON feature_flags FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies for org_feature_flags
CREATE POLICY "Orgs can read own feature flag overrides"
  ON org_feature_flags FOR SELECT
  USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);

CREATE POLICY "Service role can manage org feature flags"
  ON org_feature_flags FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Helper function to check if feature is enabled for organization
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_org_id UUID,
  p_flag_key TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_org_override BOOLEAN;
  v_global_enabled BOOLEAN;
  v_rollout_percentage INTEGER;
  v_org_hash INTEGER;
BEGIN
  -- Check for org-specific override first
  SELECT enabled INTO v_org_override
  FROM org_feature_flags
  WHERE org_id = p_org_id AND flag_key = p_flag_key;
  
  IF FOUND THEN
    RETURN v_org_override;
  END IF;
  
  -- Check global flag settings
  SELECT enabled_globally, rollout_percentage
  INTO v_global_enabled, v_rollout_percentage
  FROM feature_flags
  WHERE flag_key = p_flag_key;
  
  IF NOT FOUND THEN
    RETURN false; -- Flag doesn't exist, default to disabled
  END IF;
  
  -- If globally enabled, return true
  IF v_global_enabled THEN
    RETURN true;
  END IF;
  
  -- Gradual rollout based on org_id hash
  IF v_rollout_percentage > 0 THEN
    -- Use consistent hashing to determine if org is in rollout percentage
    v_org_hash := (hashtext(p_org_id::text) % 100);
    RETURN v_org_hash < v_rollout_percentage;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get all enabled features for an organization
CREATE OR REPLACE FUNCTION get_org_enabled_features(
  p_org_id UUID
) RETURNS TABLE(flag_key TEXT, flag_name TEXT, description TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ff.flag_key,
    ff.flag_name,
    ff.description
  FROM feature_flags ff
  WHERE is_feature_enabled(p_org_id, ff.flag_key) = true
  ORDER BY ff.flag_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to update feature flag
CREATE OR REPLACE FUNCTION update_feature_flag(
  p_flag_key TEXT,
  p_enabled_globally BOOLEAN DEFAULT NULL,
  p_rollout_percentage INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE feature_flags
  SET 
    enabled_globally = COALESCE(p_enabled_globally, enabled_globally),
    rollout_percentage = COALESCE(p_rollout_percentage, rollout_percentage),
    updated_at = NOW()
  WHERE flag_key = p_flag_key;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Seed default feature flags
INSERT INTO feature_flags (flag_key, flag_name, description, enabled_globally, rollout_percentage) VALUES
  ('advanced_analytics', 'Advanced Analytics', 'Enable advanced analytics dashboard with custom reports and data exports', false, 0),
  ('outbound_calling', 'Outbound Calling', 'Enable outbound calling feature for proactive customer engagement', true, 100),
  ('sms_campaigns', 'SMS Campaigns', 'Enable bulk SMS campaign feature for marketing and reminders', false, 0),
  ('ai_voice_cloning', 'AI Voice Cloning', 'Enable custom voice cloning for personalized agent voices', false, 0),
  ('multi_language', 'Multi-Language Support', 'Enable multi-language agent responses (Spanish, French, etc.)', false, 0),
  ('appointment_reminders', 'Appointment Reminders', 'Enable automated appointment reminder system via SMS/Email', true, 100),
  ('call_recording', 'Call Recording', 'Enable call recording and transcription features', true, 100),
  ('knowledge_base', 'Knowledge Base', 'Enable RAG-based knowledge base for contextual responses', true, 100),
  ('calendar_integration', 'Calendar Integration', 'Enable Google Calendar and Outlook integration', true, 100),
  ('lead_scoring', 'Lead Scoring', 'Enable AI-powered lead scoring and qualification', false, 50)
ON CONFLICT (flag_key) DO NOTHING;

-- Create audit log for feature flag changes
CREATE TABLE IF NOT EXISTS feature_flag_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('enabled', 'disabled', 'rollout_changed')),
  previous_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_log_flag_key ON feature_flag_audit_log(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_log_org_id ON feature_flag_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_log_changed_at ON feature_flag_audit_log(changed_at DESC);

-- Enable RLS on audit log
ALTER TABLE feature_flag_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage feature flag audit log"
  ON feature_flag_audit_log FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Orgs can read own feature flag audit log"
  ON feature_flag_audit_log FOR SELECT
  USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid OR org_id IS NULL);

-- Trigger to log feature flag changes
CREATE OR REPLACE FUNCTION log_feature_flag_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO feature_flag_audit_log (flag_key, org_id, action, previous_value, new_value)
    VALUES (
      NEW.flag_key,
      CASE WHEN TG_TABLE_NAME = 'org_feature_flags' THEN NEW.org_id ELSE NULL END,
      CASE 
        WHEN OLD.enabled != NEW.enabled THEN 
          CASE WHEN NEW.enabled THEN 'enabled' ELSE 'disabled' END
        ELSE 'rollout_changed'
      END,
      row_to_json(OLD),
      row_to_json(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feature_flags_audit_trigger
  AFTER UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION log_feature_flag_change();

CREATE TRIGGER org_feature_flags_audit_trigger
  AFTER UPDATE ON org_feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION log_feature_flag_change();

-- Comments for documentation
COMMENT ON TABLE feature_flags IS 'Global feature flag definitions with rollout controls';
COMMENT ON TABLE org_feature_flags IS 'Organization-specific feature flag overrides';
COMMENT ON TABLE feature_flag_audit_log IS 'Audit trail for all feature flag changes';
COMMENT ON FUNCTION is_feature_enabled IS 'Check if a feature is enabled for an organization (considers overrides and rollout percentage)';
COMMENT ON FUNCTION get_org_enabled_features IS 'Get all enabled features for an organization';
COMMENT ON FUNCTION update_feature_flag IS 'Update feature flag settings (admin use only)';
