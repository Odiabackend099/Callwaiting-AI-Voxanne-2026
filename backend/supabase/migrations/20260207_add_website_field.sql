-- Add website field to onboarding_submissions table
-- Migration: 20260207_add_website_field.sql
-- Purpose: Capture company website URL for AI personalization

-- Add website column (optional)
ALTER TABLE onboarding_submissions
ADD COLUMN IF NOT EXISTS website TEXT;

-- Add comment to document the column
COMMENT ON COLUMN onboarding_submissions.website
IS 'Company website URL for AI agent knowledge base personalization';
