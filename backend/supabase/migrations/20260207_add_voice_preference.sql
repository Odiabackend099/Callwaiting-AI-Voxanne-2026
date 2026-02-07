-- Add voice_preference column to onboarding_submissions table
-- Migration: 20260207_add_voice_preference.sql
-- Purpose: Add voice preference field to capture user's preferred AI voice type

-- Add voice_preference column
ALTER TABLE onboarding_submissions
ADD COLUMN voice_preference TEXT;

-- Add check constraint for valid values
ALTER TABLE onboarding_submissions
ADD CONSTRAINT voice_preference_valid
CHECK (voice_preference IN ('AI (Neutral)', 'Male Voice', 'Female Voice', NULL));

-- Set default value for existing rows (in case there are any)
UPDATE onboarding_submissions
SET voice_preference = 'AI (Neutral)'
WHERE voice_preference IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN onboarding_submissions.voice_preference
IS 'Preferred voice type for AI agent: AI (Neutral), Male Voice, or Female Voice';
