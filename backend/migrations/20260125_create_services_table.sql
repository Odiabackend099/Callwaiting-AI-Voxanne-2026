-- Migration: Create Services Table for Pricing Engine
-- Description: Enables organizations to define service-specific pricing for pipeline value calculation
-- Date: 2026-01-25

-- 1. Create services table
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_services_org_id ON services(org_id);
CREATE INDEX IF NOT EXISTS idx_services_keywords ON services USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_services_org_created ON services(org_id, created_at DESC);

-- 3. Enable Row Level Security
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for multi-tenant isolation
CREATE POLICY services_org_isolation ON services
  FOR ALL TO authenticated
  USING (org_id = (SELECT public.auth_org_id()))
  WITH CHECK (org_id = (SELECT public.auth_org_id()));

-- Policy: Service role has full access for backend operations
CREATE POLICY services_service_role ON services
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON services TO authenticated;

-- 6. Seed default services for all organizations
-- This creates standard beauty/medical services that can be customized per organization
INSERT INTO services (org_id, name, price, keywords)
SELECT
  id as org_id,
  'Botox',
  400.00,
  ARRAY['botox', 'wrinkle', 'injection', 'anti-wrinkle']
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO services (org_id, name, price, keywords)
SELECT
  id as org_id,
  'Facelift',
  8000.00,
  ARRAY['facelift', 'face lift', 'facial', 'lift']
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO services (org_id, name, price, keywords)
SELECT
  id as org_id,
  'Rhinoplasty',
  6000.00,
  ARRAY['rhinoplasty', 'nose job', 'nose', 'nasal']
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO services (org_id, name, price, keywords)
SELECT
  id as org_id,
  'Breast Augmentation',
  7500.00,
  ARRAY['breast augmentation', 'breast', 'augmentation', 'implant']
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO services (org_id, name, price, keywords)
SELECT
  id as org_id,
  'Liposuction',
  5000.00,
  ARRAY['liposuction', 'lipo', 'fat removal']
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO services (org_id, name, price, keywords)
SELECT
  id as org_id,
  'Fillers',
  500.00,
  ARRAY['filler', 'fillers', 'dermal filler', 'juvederm']
FROM organizations
ON CONFLICT DO NOTHING;

INSERT INTO services (org_id, name, price, keywords)
SELECT
  id as org_id,
  'Consultation',
  150.00,
  ARRAY['consultation', 'consult', 'appointment', 'visit']
FROM organizations
ON CONFLICT DO NOTHING;

-- 7. Create function to get service price by keyword
CREATE OR REPLACE FUNCTION get_service_price_by_keyword(
  p_org_id UUID,
  p_keyword TEXT
) RETURNS DECIMAL AS $$
DECLARE
  v_price DECIMAL;
BEGIN
  SELECT price INTO v_price
  FROM services
  WHERE org_id = p_org_id
    AND p_keyword = ANY(keywords)
  LIMIT 1;

  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. Grant access to function
GRANT EXECUTE ON FUNCTION get_service_price_by_keyword TO authenticated;
