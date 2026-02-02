-- ========================================================================
-- MIGRATION: Create tables for website routes (Calendly, Contact Form, Chat Widget)
-- ========================================================================
-- Created: 2026-02-02
-- Purpose: Optional tables for storing data from new website routes
-- Note: Routes will work without these tables (graceful degradation)
-- ========================================================================

-- ========================================================================
-- TABLE: calendly_bookings
-- Purpose: Store Calendly webhook events for tracking and analytics
-- ========================================================================
CREATE TABLE IF NOT EXISTS calendly_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  invitee_name TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_phone TEXT,
  invitee_uri TEXT,
  appointment_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  cancel_url TEXT,
  reschedule_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for calendly_bookings
CREATE INDEX IF NOT EXISTS idx_calendly_bookings_email ON calendly_bookings(invitee_email);
CREATE INDEX IF NOT EXISTS idx_calendly_bookings_created ON calendly_bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendly_bookings_start_time ON calendly_bookings(start_time DESC);

-- Comments
COMMENT ON TABLE calendly_bookings IS 'Stores Calendly webhook events for appointment tracking';
COMMENT ON COLUMN calendly_bookings.event_type IS 'Event type from Calendly (invitee.created, invitee.canceled)';
COMMENT ON COLUMN calendly_bookings.invitee_uri IS 'Calendly URI for the invitee';
COMMENT ON COLUMN calendly_bookings.appointment_type IS 'Name of the event type (e.g., "30 Minute Meeting")';

-- ========================================================================
-- TABLE: contact_submissions
-- Purpose: Store contact form submissions for follow-up and analytics
-- ========================================================================
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  company TEXT,
  is_urgent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for contact_submissions
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created ON contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_urgent ON contact_submissions(is_urgent) WHERE is_urgent = true;

-- Comments
COMMENT ON TABLE contact_submissions IS 'Stores contact form submissions from website';
COMMENT ON COLUMN contact_submissions.is_urgent IS 'Auto-detected from subject keywords (urgent, emergency, critical, etc.)';
COMMENT ON COLUMN contact_submissions.company IS 'Optional company name provided by user';

-- ========================================================================
-- TABLE: chat_widget_leads
-- Purpose: Store chat widget conversations and lead qualification scores
-- ========================================================================
CREATE TABLE IF NOT EXISTS chat_widget_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  lead_score INTEGER NOT NULL,
  lead_status TEXT NOT NULL CHECK (lead_status IN ('hot', 'warm', 'cold')),
  tags TEXT[] DEFAULT '{}',
  conversation_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat_widget_leads
CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_session ON chat_widget_leads(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_status ON chat_widget_leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_created ON chat_widget_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_widget_leads_score ON chat_widget_leads(lead_score DESC);

-- Comments
COMMENT ON TABLE chat_widget_leads IS 'Stores chat widget conversations and AI-generated lead scores';
COMMENT ON COLUMN chat_widget_leads.session_id IS 'Unique session identifier for tracking conversations';
COMMENT ON COLUMN chat_widget_leads.lead_score IS 'AI-calculated score (0-100): hot ≥60, warm ≥30, cold <30';
COMMENT ON COLUMN chat_widget_leads.lead_status IS 'Lead qualification: hot, warm, or cold';
COMMENT ON COLUMN chat_widget_leads.tags IS 'Array of tags (industry, pain points, intent signals)';
COMMENT ON COLUMN chat_widget_leads.conversation_summary IS 'First 500 characters of user messages';

-- ========================================================================
-- HELPER VIEWS
-- ========================================================================

-- View: Hot leads from chat widget (score ≥ 70)
CREATE OR REPLACE VIEW hot_chat_leads AS
SELECT
  id,
  session_id,
  lead_score,
  tags,
  conversation_summary,
  created_at
FROM chat_widget_leads
WHERE lead_status = 'hot' AND lead_score >= 70
ORDER BY created_at DESC;

COMMENT ON VIEW hot_chat_leads IS 'Hot leads from chat widget requiring immediate follow-up';

-- View: Urgent contact submissions
CREATE OR REPLACE VIEW urgent_contacts AS
SELECT
  id,
  name,
  email,
  phone,
  subject,
  message,
  company,
  created_at
FROM contact_submissions
WHERE is_urgent = true
ORDER BY created_at DESC;

COMMENT ON VIEW urgent_contacts IS 'Urgent contact form submissions requiring immediate attention';

-- View: Upcoming Calendly appointments
CREATE OR REPLACE VIEW upcoming_appointments AS
SELECT
  id,
  invitee_name,
  invitee_email,
  invitee_phone,
  appointment_type,
  start_time,
  end_time,
  created_at
FROM calendly_bookings
WHERE start_time > NOW()
ORDER BY start_time ASC;

COMMENT ON VIEW upcoming_appointments IS 'Future appointments booked via Calendly';

-- ========================================================================
-- ANALYTICS FUNCTIONS
-- ========================================================================

-- Function: Get contact form statistics
CREATE OR REPLACE FUNCTION get_contact_form_stats(days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_submissions BIGINT,
  urgent_submissions BIGINT,
  unique_companies BIGINT,
  avg_response_time INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_submissions,
    COUNT(*) FILTER (WHERE is_urgent = true)::BIGINT as urgent_submissions,
    COUNT(DISTINCT company) FILTER (WHERE company IS NOT NULL)::BIGINT as unique_companies,
    INTERVAL '24 hours' as avg_response_time -- Placeholder, implement actual tracking
  FROM contact_submissions
  WHERE created_at > NOW() - (days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_contact_form_stats IS 'Get contact form statistics for the last N days';

-- Function: Get chat widget lead conversion stats
CREATE OR REPLACE FUNCTION get_chat_widget_stats(days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_sessions BIGINT,
  hot_leads BIGINT,
  warm_leads BIGINT,
  cold_leads BIGINT,
  avg_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_sessions,
    COUNT(*) FILTER (WHERE lead_status = 'hot')::BIGINT as hot_leads,
    COUNT(*) FILTER (WHERE lead_status = 'warm')::BIGINT as warm_leads,
    COUNT(*) FILTER (WHERE lead_status = 'cold')::BIGINT as cold_leads,
    AVG(lead_score)::NUMERIC(5,2) as avg_score
  FROM chat_widget_leads
  WHERE created_at > NOW() - (days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_chat_widget_stats IS 'Get chat widget lead statistics for the last N days';

-- Function: Get Calendly booking statistics
CREATE OR REPLACE FUNCTION get_calendly_stats(days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_bookings BIGINT,
  cancellations BIGINT,
  unique_invitees BIGINT,
  avg_bookings_per_day NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE event_type = 'invitee.created')::BIGINT as total_bookings,
    COUNT(*) FILTER (WHERE event_type = 'invitee.canceled')::BIGINT as cancellations,
    COUNT(DISTINCT invitee_email)::BIGINT as unique_invitees,
    (COUNT(*) FILTER (WHERE event_type = 'invitee.created')::NUMERIC / GREATEST(days, 1))::NUMERIC(5,2) as avg_bookings_per_day
  FROM calendly_bookings
  WHERE created_at > NOW() - (days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_calendly_stats IS 'Get Calendly booking statistics for the last N days';

-- ========================================================================
-- CLEANUP FUNCTIONS (Optional - for data retention)
-- ========================================================================

-- Function: Cleanup old contact submissions (90 days)
CREATE OR REPLACE FUNCTION cleanup_old_contact_submissions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM contact_submissions
  WHERE created_at < NOW() - INTERVAL '90 days'
  RETURNING COUNT(*) INTO deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_contact_submissions IS 'Delete contact submissions older than 90 days (GDPR compliance)';

-- Function: Cleanup old chat widget leads (90 days)
CREATE OR REPLACE FUNCTION cleanup_old_chat_widget_leads()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM chat_widget_leads
  WHERE created_at < NOW() - INTERVAL '90 days'
  RETURNING COUNT(*) INTO deleted_count;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_chat_widget_leads IS 'Delete chat widget leads older than 90 days (GDPR compliance)';

-- ========================================================================
-- EXAMPLE QUERIES
-- ========================================================================

-- Get contact form stats for last 30 days
-- SELECT * FROM get_contact_form_stats(30);

-- Get chat widget stats for last 7 days
-- SELECT * FROM get_chat_widget_stats(7);

-- Get Calendly stats for last 30 days
-- SELECT * FROM get_calendly_stats(30);

-- Get all hot leads from chat widget
-- SELECT * FROM hot_chat_leads LIMIT 10;

-- Get urgent contact submissions
-- SELECT * FROM urgent_contacts LIMIT 10;

-- Get upcoming Calendly appointments
-- SELECT * FROM upcoming_appointments LIMIT 10;

-- Cleanup old data (run monthly)
-- SELECT cleanup_old_contact_submissions();
-- SELECT cleanup_old_chat_widget_leads();

-- ========================================================================
-- MIGRATION COMPLETE
-- ========================================================================
-- Tables created: 3 (calendly_bookings, contact_submissions, chat_widget_leads)
-- Indexes created: 10 (for query performance)
-- Views created: 3 (hot_chat_leads, urgent_contacts, upcoming_appointments)
-- Functions created: 5 (analytics + cleanup)
-- ========================================================================
