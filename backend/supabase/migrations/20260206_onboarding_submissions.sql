-- Simple table for onboarding submissions
CREATE TABLE onboarding_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User data
  company_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  greeting_script TEXT NOT NULL,
  pdf_url TEXT,

  -- Workflow
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for admin queries
CREATE INDEX idx_onboarding_submissions_status
  ON onboarding_submissions(status)
  WHERE status = 'pending';

-- RLS (admin only)
ALTER TABLE onboarding_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON onboarding_submissions FOR ALL TO service_role
  USING (true);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'onboarding-documents',
  'onboarding-documents',
  false, -- Private
  10485760, -- 10MB
  ARRAY['application/pdf']::text[]
);

-- RLS for storage
CREATE POLICY "Service role can manage onboarding docs"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'onboarding-documents')
  WITH CHECK (bucket_id = 'onboarding-documents');
