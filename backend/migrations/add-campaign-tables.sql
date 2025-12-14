-- ============================================
-- VOXANNE CAMPAIGN ENGINE - DATABASE MIGRATION
-- Campaign orchestration tables for 90-day outreach
-- ============================================

-- 1. LEAD SCORING SYSTEM
-- Prioritize leads by conversion probability
CREATE TABLE IF NOT EXISTS lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  total_score INTEGER NOT NULL DEFAULT 0,
  persona_score INTEGER DEFAULT 0,      -- Plastic surgeon=10, Skin care=9, Med spa=7
  geography_score INTEGER DEFAULT 0,    -- London=10, Leeds=8, smaller cities=5
  engagement_score INTEGER DEFAULT 0,   -- Website quality, review count, social presence
  priority_tier TEXT CHECK (priority_tier IN ('A', 'B', 'C')),
  scoring_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_scores_tier ON lead_scores(priority_tier);
CREATE INDEX IF NOT EXISTS idx_lead_scores_total ON lead_scores(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_lead_scores_lead_id ON lead_scores(lead_id);

-- 2. LEAD PERSONALIZATION DATA
-- Store research for personalized outreach
ALTER TABLE leads ADD COLUMN IF NOT EXISTS personalization_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS opted_out BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_personalization ON leads USING GIN (personalization_data);
CREATE INDEX IF NOT EXISTS idx_leads_opted_out ON leads(opted_out);

-- Example structure:
-- {
--   "google_review_count": 47,
--   "common_complaint": "phone lines busy",
--   "recent_review_keywords": ["hard to reach", "voicemail", "booking"],
--   "website_has_online_booking": false,
--   "estimated_procedures_per_month": 120,
--   "competitor_using_ai": false,
--   "pain_point_identified": "Patients mention phone issues in 12% of reviews"
-- }

CREATE INDEX IF NOT EXISTS idx_leads_personalization ON leads USING GIN (personalization_data);

-- 3. CAMPAIGN SEQUENCE TRACKING
-- Track where each lead is in the multi-touch sequence
CREATE TABLE IF NOT EXISTS campaign_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  sequence_name TEXT NOT NULL,          -- 'tier_a_blitz', 'tier_b_expansion', 'tier_c_nurture'
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'opted_out')),
  last_contact_at TIMESTAMPTZ,
  next_contact_at TIMESTAMPTZ,
  next_action TEXT,                     -- 'send_email_2', 'make_call', 'send_demo'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, sequence_name)
);

CREATE INDEX IF NOT EXISTS idx_campaign_sequences_status ON campaign_sequences(status);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_next_contact ON campaign_sequences(next_contact_at);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_lead_id ON campaign_sequences(lead_id);

-- 4. EMAIL TRACKING
-- Track all outreach emails with engagement metrics
CREATE TABLE IF NOT EXISTS email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES campaign_sequences(id) ON DELETE SET NULL,
  email_subject TEXT NOT NULL,
  email_variant TEXT,                   -- 'email_1_pattern_interrupt', 'email_2_demo', etc.
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc_email TEXT,                        -- CC recipient (e.g., austyneguale@gmail.com)
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced BOOLEAN DEFAULT false,
  bounce_reason TEXT,
  spam_complaint BOOLEAN DEFAULT false,
  tracking_pixel_id TEXT,               -- For open tracking
  demo_link_clicked BOOLEAN DEFAULT false,
  resend_message_id TEXT,               -- Resend API message ID
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_lead ON email_tracking(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_opened ON email_tracking(opened_at);
CREATE INDEX IF NOT EXISTS idx_email_tracking_sent ON email_tracking(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_tracking_variant ON email_tracking(email_variant);

-- 5. CALL TRACKING
-- Track all AI outbound calls
CREATE TABLE IF NOT EXISTS call_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES campaign_sequences(id) ON DELETE SET NULL,
  vapi_call_id TEXT,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  called_at TIMESTAMPTZ DEFAULT NOW(),
  answered BOOLEAN DEFAULT false,
  voicemail BOOLEAN DEFAULT false,
  duration_seconds INTEGER,
  demo_sent BOOLEAN DEFAULT false,
  meeting_booked BOOLEAN DEFAULT false,
  call_outcome TEXT CHECK (call_outcome IN (
    'answered_interested', 
    'answered_not_interested', 
    'answered_callback_requested',
    'voicemail_left',
    'no_answer',
    'busy',
    'failed'
  )),
  call_notes TEXT,
  transcript TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'not_analyzed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_tracking_lead ON call_tracking(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_tracking_answered ON call_tracking(answered);
CREATE INDEX IF NOT EXISTS idx_call_tracking_outcome ON call_tracking(call_outcome);
CREATE INDEX IF NOT EXISTS idx_call_tracking_called_at ON call_tracking(called_at DESC);

-- 6. PIPELINE STAGES
-- Track lead progression through sales pipeline
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN (
    'not_contacted', 
    'contacted', 
    'demo_sent', 
    'demo_viewed',
    'meeting_booked', 
    'meeting_held',
    'proposal_sent',
    'negotiating',
    'closed_won', 
    'closed_lost'
  )),
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  exited_at TIMESTAMPTZ,
  days_in_stage INTEGER,
  notes TEXT,
  lost_reason TEXT,                     -- If closed_lost: 'no_budget', 'competitor', 'timing', etc.
  won_tier TEXT,                        -- If closed_won: 'essentials', 'growth', 'premium', 'enterprise'
  won_mrr DECIMAL(10,2),                -- If closed_won: monthly revenue
  won_setup_fee DECIMAL(10,2),          -- If closed_won: one-time setup fee
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_lead ON pipeline_stages(lead_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_stage ON pipeline_stages(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_current ON pipeline_stages(lead_id, exited_at) WHERE exited_at IS NULL;

-- 7. EMAIL TEMPLATES
-- Store reusable email templates with merge tags
CREATE TABLE IF NOT EXISTS outreach_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,                   -- 'email_1_pattern_interrupt'
  subject TEXT NOT NULL,                -- '[FirstName], I analyzed [ClinicName]'s Google reviews'
  body_html TEXT NOT NULL,
  body_text TEXT,
  sequence_step INTEGER,                -- 1, 2, 3, 4, 5
  persona_target TEXT,                  -- 'plastic_surgeon', 'skin_care', 'med_spa', 'all'
  merge_tags JSONB DEFAULT '[]'::jsonb, -- ['FirstName', 'ClinicName', 'City', 'PainPoint']
  is_active BOOLEAN DEFAULT true,
  send_delay_hours INTEGER DEFAULT 0,   -- Hours after previous step
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_templates_step ON outreach_templates(sequence_step);
CREATE INDEX IF NOT EXISTS idx_outreach_templates_persona ON outreach_templates(persona_target);

-- 8. CAMPAIGN METRICS (Aggregated)
-- Daily/weekly rollups for dashboard
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  metric_date DATE NOT NULL,
  tier TEXT CHECK (tier IN ('A', 'B', 'C', 'all')),
  
  -- Email metrics
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  
  -- Call metrics
  calls_made INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  calls_voicemail INTEGER DEFAULT 0,
  
  -- Conversion metrics
  demos_sent INTEGER DEFAULT 0,
  demos_viewed INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  meetings_held INTEGER DEFAULT 0,
  deals_closed INTEGER DEFAULT 0,
  
  -- Revenue metrics
  mrr_added DECIMAL(10,2) DEFAULT 0,
  setup_fees_collected DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, metric_date, tier)
);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date ON campaign_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_org ON campaign_metrics(org_id);

-- 9. TRIGGERS FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lead_scores_updated_at ON lead_scores;
CREATE TRIGGER update_lead_scores_updated_at
  BEFORE UPDATE ON lead_scores
  FOR EACH ROW EXECUTE FUNCTION update_campaign_updated_at();

DROP TRIGGER IF EXISTS update_campaign_sequences_updated_at ON campaign_sequences;
CREATE TRIGGER update_campaign_sequences_updated_at
  BEFORE UPDATE ON campaign_sequences
  FOR EACH ROW EXECUTE FUNCTION update_campaign_updated_at();

DROP TRIGGER IF EXISTS update_outreach_templates_updated_at ON outreach_templates;
CREATE TRIGGER update_outreach_templates_updated_at
  BEFORE UPDATE ON outreach_templates
  FOR EACH ROW EXECUTE FUNCTION update_campaign_updated_at();

-- 10. INSERT DEFAULT EMAIL TEMPLATES
INSERT INTO outreach_templates (name, subject, body_html, body_text, sequence_step, persona_target, merge_tags, send_delay_hours)
VALUES 
  (
    'email_1_pattern_interrupt',
    '[FirstName], I analyzed [ClinicName]''s Google reviews',
    '<p>Hi [FirstName],</p>
<p>I was researching aesthetic clinics in [City] and noticed something about [ClinicName]:</p>
<p><strong>[PainPoint]</strong></p>
<p>At £200-500 per botox/filler appointment, even 3 missed calls per week = £36,000/year in lost revenue.</p>
<p>I built an AI receptionist (Voxanne) specifically for clinics like yours. It answers 100% of calls, books appointments, and sends reminders - 24/7.</p>
<p>Would you like to see a 2-minute demo of how it handles a real patient call?</p>
<p>Best,<br>Austyn<br>Founder, CallWaiting AI</p>',
    'Hi [FirstName],

I was researching aesthetic clinics in [City] and noticed something about [ClinicName]:

[PainPoint]

At £200-500 per botox/filler appointment, even 3 missed calls per week = £36,000/year in lost revenue.

I built an AI receptionist (Voxanne) specifically for clinics like yours. It answers 100% of calls, books appointments, and sends reminders - 24/7.

Would you like to see a 2-minute demo of how it handles a real patient call?

Best,
Austyn
Founder, CallWaiting AI',
    1,
    'all',
    '["FirstName", "ClinicName", "City", "PainPoint"]',
    0
  ),
  (
    'email_2_demo_offer',
    'Here''s the demo - Voxanne handling a botox booking call',
    '<p>[FirstName],</p>
<p>I saw you opened my last email about the missed call analysis.</p>
<p>Here''s that demo I mentioned: <a href="[DemoUrl]">Watch 2-min Demo</a></p>
<p>You''ll see Voxanne:</p>
<ul>
<li>Answer a patient calling about botox pricing</li>
<li>Check appointment availability in real-time</li>
<li>Book the consultation and send confirmation</li>
<li>All in under 90 seconds</li>
</ul>
<p>[CompetitorName] in [City] just started using us - they''re now capturing calls during lunch and after-hours.</p>
<p>Want to chat about how this works for [ClinicName]?</p>
<p>Austyn</p>',
    '[FirstName],

I saw you opened my last email about the missed call analysis.

Here''s that demo I mentioned: [DemoUrl]

You''ll see Voxanne:
- Answer a patient calling about botox pricing
- Check appointment availability in real-time
- Book the consultation and send confirmation
- All in under 90 seconds

[CompetitorName] in [City] just started using us - they''re now capturing calls during lunch and after-hours.

Want to chat about how this works for [ClinicName]?

Austyn',
    2,
    'all',
    '["FirstName", "ClinicName", "City", "CompetitorName", "DemoUrl"]',
    48
  ),
  (
    'email_3_case_study',
    'How [SimilarClinic] went from 40% to 95% answer rate',
    '<p>Quick story:</p>
<p>[SimilarClinic] (also in [Region]) had the same problem:</p>
<ul>
<li>40% of calls went to voicemail</li>
<li>Receptionists overwhelmed during lunch rush</li>
<li>Patients booking with competitors who answered first</li>
</ul>
<p>After 30 days with Voxanne:</p>
<ul>
<li>95% answer rate (even during peak hours)</li>
<li>28 more bookings/month</li>
<li>£8,400 additional monthly revenue</li>
</ul>
<p>Setup took 20 minutes.</p>
<p>Want to see if we can do the same for [ClinicName]?</p>
<p><a href="[CalendarLink]">Book 15-min call</a></p>',
    'Quick story:

[SimilarClinic] (also in [Region]) had the same problem:
- 40% of calls went to voicemail
- Receptionists overwhelmed during lunch rush
- Patients booking with competitors who answered first

After 30 days with Voxanne:
- 95% answer rate (even during peak hours)
- 28 more bookings/month
- £8,400 additional monthly revenue

Setup took 20 minutes.

Want to see if we can do the same for [ClinicName]?

Book 15-min call: [CalendarLink]',
    3,
    'all',
    '["ClinicName", "SimilarClinic", "Region", "CalendarLink"]',
    72
  ),
  (
    'email_4_scarcity',
    '[FirstName] - last call (3 spots left)',
    '<p>[FirstName],</p>
<p>I''ve been trying to reach you about Voxanne for [ClinicName].</p>
<p>Quick heads-up: We''re onboarding 10 UK aesthetic clinics this month. <strong>3 spots left.</strong></p>
<p>Once we''re full, we pause new signups (we don''t overextend our setup team).</p>
<p>If you want to see the demo before the deadline, reply "DEMO" and I''ll send it over.</p>
<p>Otherwise, I''ll follow up in Q1 when we have capacity again.</p>
<p>Best,<br>Austyn</p>
<p>P.S. - [CompetitorClinic] in [City] signed up last week. First-mover advantage is real in local markets.</p>',
    '[FirstName],

I''ve been trying to reach you about Voxanne for [ClinicName].

Quick heads-up: We''re onboarding 10 UK aesthetic clinics this month. 3 spots left.

Once we''re full, we pause new signups (we don''t overextend our setup team).

If you want to see the demo before the deadline, reply "DEMO" and I''ll send it over.

Otherwise, I''ll follow up in Q1 when we have capacity again.

Best,
Austyn

P.S. - [CompetitorClinic] in [City] signed up last week. First-mover advantage is real in local markets.',
    4,
    'all',
    '["FirstName", "ClinicName", "City", "CompetitorClinic"]',
    96
  )
ON CONFLICT DO NOTHING;

-- 11. ENSURE OPT-OUT FOOTER PRESENT ON ALL OUTREACH TEMPLATES
UPDATE outreach_templates 
SET body_text = body_text || E'\n\nReply "STOP" to opt out - I''ll remove you immediately.',
    body_html = body_html || '<p style="font-size:12px;color:#666;margin-top:20px;">Reply <strong>"STOP"</strong> to opt out - I''ll remove you immediately.</p>'
WHERE name IN ('email_1_pattern_interrupt', 'email_2_demo_offer', 'email_3_case_study', 'email_4_scarcity');

-- ============================================
-- MIGRATION COMPLETE
-- Run this in Supabase SQL Editor
-- ============================================
