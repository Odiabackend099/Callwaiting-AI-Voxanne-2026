-- Migration: Create chat_widget_leads table
-- Description: Tracks leads from chat widget conversations
-- Created: 2026-02-02

CREATE TABLE IF NOT EXISTS chat_widget_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  is_hot_lead BOOLEAN DEFAULT false,
  clinic_name TEXT,
  clinic_type TEXT,
  call_volume TEXT,
  pain_points TEXT[],
  conversation_summary JSONB,
  contact_email TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  status TEXT DEFAULT 'new', -- new, contacted, qualified, converted, lost
  lead_score INTEGER DEFAULT 0, -- 0-100 scoring
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint to validate status values
ALTER TABLE chat_widget_leads
  ADD CONSTRAINT chat_widget_leads_status_check
  CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost'));

-- Add constraint to validate lead score range
ALTER TABLE chat_widget_leads
  ADD CONSTRAINT chat_widget_leads_score_check
  CHECK (lead_score >= 0 AND lead_score <= 100);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_session
  ON chat_widget_leads(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_hot
  ON chat_widget_leads(is_hot_lead)
  WHERE is_hot_lead = true;

CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_created
  ON chat_widget_leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_status
  ON chat_widget_leads(status);

CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_score
  ON chat_widget_leads(lead_score DESC);

-- Partial index for new hot leads
CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_new_hot
  ON chat_widget_leads(created_at DESC)
  WHERE is_hot_lead = true AND status = 'new';

-- GIN index for JSONB conversation summary
CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_summary
  ON chat_widget_leads USING gin(conversation_summary);

-- GIN index for pain_points array
CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_pain_points
  ON chat_widget_leads USING gin(pain_points);

-- Add table comments
COMMENT ON TABLE chat_widget_leads IS 'Tracks leads from chat widget conversations';
COMMENT ON COLUMN chat_widget_leads.session_id IS 'Unique chat session identifier';
COMMENT ON COLUMN chat_widget_leads.is_hot_lead IS 'Whether this is a high-value lead';
COMMENT ON COLUMN chat_widget_leads.clinic_type IS 'Type of clinic (e.g., dental, dermatology, primary care)';
COMMENT ON COLUMN chat_widget_leads.call_volume IS 'Estimated call volume (e.g., "50-100/day")';
COMMENT ON COLUMN chat_widget_leads.pain_points IS 'Array of identified pain points';
COMMENT ON COLUMN chat_widget_leads.conversation_summary IS 'JSON summary of chat conversation';
COMMENT ON COLUMN chat_widget_leads.lead_score IS 'Lead quality score (0-100)';
COMMENT ON COLUMN chat_widget_leads.status IS 'Lead status: new, contacted, qualified, converted, or lost';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_chat_widget_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_chat_widget_leads_updated_at
  BEFORE UPDATE ON chat_widget_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_widget_leads_updated_at();

-- Create function to auto-calculate lead score
CREATE OR REPLACE FUNCTION calculate_lead_score()
RETURNS TRIGGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  -- Base score for having clinic information
  IF NEW.clinic_name IS NOT NULL THEN
    score := score + 20;
  END IF;

  -- Score for clinic type (certain types are higher value)
  IF NEW.clinic_type IN ('dental', 'dermatology', 'plastic surgery') THEN
    score := score + 20;
  END IF;

  -- Score for call volume (indicates business size)
  IF NEW.call_volume IS NOT NULL THEN
    score := score + 15;
  END IF;

  -- Score for number of pain points (more pain = more likely to buy)
  IF NEW.pain_points IS NOT NULL THEN
    score := score + (LEAST(array_length(NEW.pain_points, 1), 3) * 10);
  END IF;

  -- Score for contact information
  IF NEW.contact_email IS NOT NULL THEN
    score := score + 10;
  END IF;

  IF NEW.contact_phone IS NOT NULL THEN
    score := score + 10;
  END IF;

  -- Bonus for hot leads
  IF NEW.is_hot_lead THEN
    score := score + 25;
  END IF;

  NEW.lead_score := LEAST(score, 100); -- Cap at 100
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_lead_score
  BEFORE INSERT OR UPDATE ON chat_widget_leads
  FOR EACH ROW
  EXECUTE FUNCTION calculate_lead_score();
