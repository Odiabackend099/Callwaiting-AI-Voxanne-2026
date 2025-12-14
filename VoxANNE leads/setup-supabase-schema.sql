-- VOXANNE LEAD GENERATION - SUPABASE SCHEMA
-- Run this in Supabase SQL Editor to set up tracking tables

-- ============================================
-- LEADS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  clinic_name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT DEFAULT 'UK',
  phone TEXT,
  website TEXT,
  category TEXT,
  source TEXT CHECK (source IN ('email', 'call', 'scrape', 'referral')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'replied', 'demo_booked', 'converted', 'unsubscribed')),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  contacted_at TIMESTAMP,
  replied_at TIMESTAMP,
  demo_date TIMESTAMP,
  converted_at TIMESTAMP,
  
  -- Value
  monthly_value DECIMAL(10, 2),
  tier TEXT CHECK (tier IN ('Essentials', 'Growth', 'Premium')),
  
  -- Metadata
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  created_by TEXT DEFAULT 'system'
);

CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_city ON leads(city);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

-- ============================================
-- EMAIL TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  message_id TEXT UNIQUE,
  tracking_id TEXT UNIQUE,
  
  -- Email details
  subject TEXT,
  sequence_number INT,
  
  -- Tracking
  sent_at TIMESTAMP DEFAULT now(),
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  replied_at TIMESTAMP,
  bounced_at TIMESTAMP,
  
  -- Metadata
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  bounce_reason TEXT,
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_email_tracking_lead_id ON email_tracking(lead_id);
CREATE INDEX idx_email_tracking_email ON email_tracking(email);
CREATE INDEX idx_email_tracking_tracking_id ON email_tracking(tracking_id);
CREATE INDEX idx_email_tracking_sent_at ON email_tracking(sent_at DESC);

-- ============================================
-- CONVERSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  
  -- Conversion details
  demo_date TIMESTAMP,
  converted_date TIMESTAMP DEFAULT now(),
  tier TEXT CHECK (tier IN ('Essentials', 'Growth', 'Premium')),
  monthly_value DECIMAL(10, 2),
  
  -- Lifecycle
  onboarded_at TIMESTAMP,
  first_call_at TIMESTAMP,
  churn_date TIMESTAMP,
  
  -- Metadata
  notes TEXT,
  source_channel TEXT,
  sales_rep TEXT,
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_conversions_lead_id ON conversions(lead_id);
CREATE INDEX idx_conversions_email ON conversions(email);
CREATE INDEX idx_conversions_converted_date ON conversions(converted_date DESC);
CREATE INDEX idx_conversions_tier ON conversions(tier);

-- ============================================
-- CALL TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS call_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  phone TEXT,
  
  -- Call details
  call_date TIMESTAMP DEFAULT now(),
  duration_seconds INT,
  call_type TEXT CHECK (call_type IN ('inbound', 'outbound', 'demo')),
  
  -- Voxanne metrics
  agent_name TEXT DEFAULT 'Voxanne',
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  
  -- Outcomes
  demo_booked BOOLEAN DEFAULT FALSE,
  demo_date TIMESTAMP,
  objections TEXT[],
  next_steps TEXT,
  
  -- Recording
  recording_url TEXT,
  transcript TEXT,
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_call_tracking_lead_id ON call_tracking(lead_id);
CREATE INDEX idx_call_tracking_phone ON call_tracking(phone);
CREATE INDEX idx_call_tracking_call_date ON call_tracking(call_date DESC);
CREATE INDEX idx_call_tracking_demo_booked ON call_tracking(demo_booked);

-- ============================================
-- CAMPAIGN METRICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL,
  campaign_week INT,
  
  -- Metrics
  emails_sent INT DEFAULT 0,
  emails_opened INT DEFAULT 0,
  emails_clicked INT DEFAULT 0,
  emails_replied INT DEFAULT 0,
  emails_bounced INT DEFAULT 0,
  
  -- Rates
  open_rate DECIMAL(5, 2),
  click_rate DECIMAL(5, 2),
  reply_rate DECIMAL(5, 2),
  bounce_rate DECIMAL(5, 2),
  
  -- Conversions
  demos_booked INT DEFAULT 0,
  customers_acquired INT DEFAULT 0,
  total_mrr DECIMAL(10, 2),
  
  -- Dates
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_campaign_metrics_campaign_name ON campaign_metrics(campaign_name);
CREATE INDEX idx_campaign_metrics_period ON campaign_metrics(period_start, period_end);

-- ============================================
-- VIEWS FOR ANALYTICS
-- ============================================

-- Lead funnel view
CREATE OR REPLACE VIEW lead_funnel AS
SELECT
  'Total Leads' as stage,
  COUNT(*) as count,
  NULL::DECIMAL as conversion_rate
FROM leads
UNION ALL
SELECT
  'Contacted',
  COUNT(*),
  (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM leads))
FROM leads
WHERE contacted_at IS NOT NULL
UNION ALL
SELECT
  'Replied',
  COUNT(*),
  (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM leads WHERE contacted_at IS NOT NULL))
FROM leads
WHERE replied_at IS NOT NULL
UNION ALL
SELECT
  'Demo Booked',
  COUNT(*),
  (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM leads WHERE replied_at IS NOT NULL))
FROM leads
WHERE demo_date IS NOT NULL
UNION ALL
SELECT
  'Converted',
  COUNT(*),
  (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM leads WHERE demo_date IS NOT NULL))
FROM leads
WHERE converted_at IS NOT NULL;

-- City performance view
CREATE OR REPLACE VIEW city_performance AS
SELECT
  city,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN contacted_at IS NOT NULL THEN 1 END) as contacted,
  COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as replied,
  COUNT(CASE WHEN converted_at IS NOT NULL THEN 1 END) as converted,
  ROUND(COUNT(CASE WHEN converted_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as conversion_rate,
  COALESCE(SUM(monthly_value), 0) as total_mrr
FROM leads
GROUP BY city
ORDER BY conversion_rate DESC;

-- Weekly metrics view
CREATE OR REPLACE VIEW weekly_metrics AS
SELECT
  DATE_TRUNC('week', created_at)::DATE as week_start,
  COUNT(*) as new_leads,
  COUNT(CASE WHEN source = 'email' THEN 1 END) as email_leads,
  COUNT(CASE WHEN source = 'call' THEN 1 END) as call_leads,
  COUNT(CASE WHEN source = 'scrape' THEN 1 END) as scraped_leads
FROM leads
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week_start DESC;

-- ============================================
-- ROW LEVEL SECURITY (Optional)
-- ============================================

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for automation)
CREATE POLICY "Service role can do anything" ON leads
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do anything" ON email_tracking
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do anything" ON conversions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do anything" ON call_tracking
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can do anything" ON campaign_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- INSERT INTO leads (email, clinic_name, city, country, source, status)
-- VALUES
--   ('test1@example.com', 'Test Clinic 1', 'London', 'UK', 'email', 'pending'),
--   ('test2@example.com', 'Test Clinic 2', 'Manchester', 'UK', 'email', 'contacted'),
--   ('test3@example.com', 'Test Clinic 3', 'Birmingham', 'UK', 'email', 'replied');

-- ============================================
-- GRANTS
-- ============================================

-- Grant read access to authenticated users
GRANT SELECT ON leads TO authenticated;
GRANT SELECT ON email_tracking TO authenticated;
GRANT SELECT ON conversions TO authenticated;
GRANT SELECT ON call_tracking TO authenticated;
GRANT SELECT ON campaign_metrics TO authenticated;
GRANT SELECT ON lead_funnel TO authenticated;
GRANT SELECT ON city_performance TO authenticated;
GRANT SELECT ON weekly_metrics TO authenticated;

-- Grant full access to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
