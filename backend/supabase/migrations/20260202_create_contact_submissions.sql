-- Migration: Create contact_submissions table
-- Description: Stores contact form submissions from website
-- Created: 2026-02-02

CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'new', -- new, contacted, converted, archived
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add constraint to validate status values
ALTER TABLE contact_submissions
  ADD CONSTRAINT contact_submissions_status_check
  CHECK (status IN ('new', 'contacted', 'converted', 'archived'));

-- Add email format validation (basic)
ALTER TABLE contact_submissions
  ADD CONSTRAINT contact_submissions_email_check
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email
  ON contact_submissions(email);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_date
  ON contact_submissions(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created
  ON contact_submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status
  ON contact_submissions(status);

-- Partial index for new submissions only
CREATE INDEX IF NOT EXISTS idx_contact_submissions_new
  ON contact_submissions(submitted_at DESC)
  WHERE status = 'new';

-- Full-text search index on message and subject
CREATE INDEX IF NOT EXISTS idx_contact_submissions_search
  ON contact_submissions USING gin(to_tsvector('english', subject || ' ' || message));

-- Add table comment
COMMENT ON TABLE contact_submissions IS 'Stores contact form submissions from website';
COMMENT ON COLUMN contact_submissions.submitted_at IS 'When the form was submitted';
COMMENT ON COLUMN contact_submissions.status IS 'Submission status: new, contacted, converted, or archived';
COMMENT ON COLUMN contact_submissions.notes IS 'Internal notes about follow-up actions';
