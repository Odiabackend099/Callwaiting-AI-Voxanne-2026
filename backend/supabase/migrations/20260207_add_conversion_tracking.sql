-- Add conversion tracking fields to onboarding_submissions
-- These capture UTM attribution, plan pre-selection, and form completion timing

ALTER TABLE onboarding_submissions
ADD COLUMN IF NOT EXISTS utm_source TEXT,
ADD COLUMN IF NOT EXISTS utm_medium TEXT,
ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
ADD COLUMN IF NOT EXISTS plan TEXT,
ADD COLUMN IF NOT EXISTS time_to_complete_seconds INTEGER;

COMMENT ON COLUMN onboarding_submissions.utm_source IS 'UTM source parameter from landing URL';
COMMENT ON COLUMN onboarding_submissions.utm_medium IS 'UTM medium parameter from landing URL';
COMMENT ON COLUMN onboarding_submissions.utm_campaign IS 'UTM campaign parameter from landing URL';
COMMENT ON COLUMN onboarding_submissions.plan IS 'Pre-selected pricing plan from URL param';
COMMENT ON COLUMN onboarding_submissions.time_to_complete_seconds IS 'Seconds from page load to form submission';
