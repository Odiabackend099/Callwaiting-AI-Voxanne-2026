-- Phase 1 Test Data Insertion
-- Run this to create test contacts and transfer configuration

-- Get the first organization ID (you can replace this with your specific org ID)
DO $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Get first organization
  SELECT id INTO v_org_id
  FROM organizations
  ORDER BY created_at DESC
  LIMIT 1;

  RAISE NOTICE 'Using Organization ID: %', v_org_id;

  -- 1. Create main test contact for identity injection
  INSERT INTO contacts (
    org_id,
    name,
    phone,
    email,
    lead_status,
    lead_score,
    service_interests,
    notes,
    last_contact_at,
    created_at,
    updated_at
  ) VALUES (
    v_org_id,
    'John Smith',
    '+15551234567',
    'john.smith@example.com',
    'contacted'::lead_status_type,
    'warm'::lead_score_type,
    '["botox", "consultation"]'::jsonb,
    'Test contact for Phase 1 identity injection - SQL INSERT',
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (org_id, phone) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  RAISE NOTICE '✅ Created/Updated: John Smith (+15551234567)';

  -- 2. Create additional test contacts for caller lookup
  INSERT INTO contacts (
    org_id,
    name,
    phone,
    email,
    lead_status,
    lead_score,
    service_interests,
    notes,
    created_at,
    updated_at
  ) VALUES
  (
    v_org_id,
    'Sarah Johnson',
    '+15551112222',
    'sarah.johnson@example.com',
    'qualified'::lead_status_type,
    'warm'::lead_score_type,
    '["consultation"]'::jsonb,
    'Test contact for caller lookup by name - SQL INSERT',
    NOW(),
    NOW()
  ),
  (
    v_org_id,
    'Michael Chen',
    '+15553334444',
    'michael.chen@example.com',
    'new'::lead_status_type,
    'cold'::lead_score_type,
    '["consultation"]'::jsonb,
    'Test contact for caller lookup by email - SQL INSERT',
    NOW(),
    NOW()
  ),
  (
    v_org_id,
    'Emily Rodriguez',
    '+15555556666',
    'emily.rodriguez@example.com',
    'contacted'::lead_status_type,
    'warm'::lead_score_type,
    '["consultation"]'::jsonb,
    'Test contact for multiple match scenario - SQL INSERT',
    NOW(),
    NOW()
  )
  ON CONFLICT (org_id, phone) DO UPDATE
  SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    notes = EXCLUDED.notes,
    updated_at = NOW();

  RAISE NOTICE '✅ Created/Updated 3 additional test contacts';

  -- 3. Configure transfer settings
  INSERT INTO integration_settings (
    org_id,
    transfer_phone_number,
    transfer_departments,
    updated_at
  ) VALUES (
    v_org_id,
    '+15559876543',
    '{"general": "+15559876543", "billing": "+15551111111", "medical": "+15552222222"}'::jsonb,
    NOW()
  )
  ON CONFLICT (org_id) DO UPDATE
  SET
    transfer_phone_number = EXCLUDED.transfer_phone_number,
    transfer_departments = EXCLUDED.transfer_departments,
    updated_at = NOW();

  RAISE NOTICE '✅ Transfer configuration saved';

  -- 4. Verify setup
  RAISE NOTICE '';
  RAISE NOTICE '📊 Setup Complete!';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Test Instructions:';
  RAISE NOTICE '';
  RAISE NOTICE '1. IDENTITY INJECTION TEST:';
  RAISE NOTICE '   - Call from: +15551234567';
  RAISE NOTICE '   - Expected: AI says "Hi John, great to hear from you again!"';
  RAISE NOTICE '';
  RAISE NOTICE '2. WARM HANDOFF TEST:';
  RAISE NOTICE '   - Say: "I want to speak to a human"';
  RAISE NOTICE '   - Expected: Call transfers to +15559876543';
  RAISE NOTICE '';
  RAISE NOTICE '3. CALLER LOOKUP TEST:';
  RAISE NOTICE '   - Say: "I''m Sarah Johnson"';
  RAISE NOTICE '   - Expected: AI finds contact';
  RAISE NOTICE '';

END $$;

-- Verification query
SELECT
  name,
  phone,
  email,
  lead_status::text,
  lead_score::text,
  notes
FROM contacts
WHERE notes LIKE '%SQL INSERT%'
ORDER BY created_at DESC;
