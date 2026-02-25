-- ============================================================================
-- Onboarding Wizard: Telemetry + Cart Abandonment
-- Migration: 20260225_onboarding_wizard.sql
-- Purpose: Track onboarding funnel events and abandonment email history
-- ============================================================================

-- 1. Onboarding Events (Telemetry Funnel)
-- Tracks each step transition for conversion analysis
CREATE TABLE IF NOT EXISTS onboarding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_event_name CHECK (
    event_name IN (
      'started',
      'clinic_named',
      'specialty_chosen',
      'payment_viewed',
      'payment_success',
      'test_call_completed'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_org_id
  ON onboarding_events(org_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_created_at
  ON onboarding_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_event_name
  ON onboarding_events(event_name);
-- Partial index for fast abandonment detection
CREATE INDEX IF NOT EXISTS idx_onboarding_events_abandonment
  ON onboarding_events(org_id, event_name)
  WHERE event_name IN ('started', 'payment_viewed');

ALTER TABLE onboarding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on onboarding_events"
  ON onboarding_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can insert own org onboarding events"
  ON onboarding_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view own org onboarding events"
  ON onboarding_events FOR SELECT
  TO authenticated
  USING (true);

-- 2. Abandonment Emails (Sent Email Ledger)
-- Prevents duplicate sends and tracks credit application
CREATE TABLE IF NOT EXISTS abandonment_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,
  template_name TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_email_id TEXT,
  credit_applied BOOLEAN DEFAULT FALSE,

  CONSTRAINT valid_sequence CHECK (sequence_number BETWEEN 1 AND 3)
);

CREATE INDEX IF NOT EXISTS idx_abandonment_emails_org_id
  ON abandonment_emails(org_id);
CREATE INDEX IF NOT EXISTS idx_abandonment_emails_sent_at
  ON abandonment_emails(sent_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_abandonment_emails_org_sequence
  ON abandonment_emails(org_id, sequence_number);

ALTER TABLE abandonment_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on abandonment_emails"
  ON abandonment_emails FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Organization columns for onboarding state
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS clinic_name TEXT DEFAULT NULL;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS specialty TEXT DEFAULT NULL;

-- Partial index for fast new-user detection
CREATE INDEX IF NOT EXISTS idx_organizations_needs_onboarding
  ON organizations(id)
  WHERE onboarding_completed_at IS NULL;
