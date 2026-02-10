-- Migration: Add managed_telephony feature flag
-- Created: 2026-02-09
-- Purpose: Enable managed phone number provisioning feature
--
-- This flag was missing from the original feature flags migration (20260128).
-- The managed-telephony routes were added on Feb 9, 2026, but the feature flag
-- was never seeded, causing all endpoints to return 403 Forbidden.

-- Add managed_telephony feature flag (enabled globally at 100% rollout)
INSERT INTO feature_flags (
  flag_key,
  flag_name,
  description,
  enabled_globally,
  rollout_percentage,
  created_at,
  updated_at
)
VALUES (
  'managed_telephony',
  'Managed Telephony',
  'Enable one-click phone number provisioning via Twilio subaccounts. Allows organizations to purchase and manage phone numbers without providing their own Twilio credentials.',
  true,  -- Enable globally
  100,   -- 100% rollout (all orgs)
  NOW(),
  NOW()
)
ON CONFLICT (flag_key) DO UPDATE SET
  enabled_globally = EXCLUDED.enabled_globally,
  rollout_percentage = EXCLUDED.rollout_percentage,
  updated_at = NOW();

-- Verify the flag was created
DO $$
DECLARE
  flag_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM feature_flags WHERE flag_key = 'managed_telephony'
  ) INTO flag_exists;

  IF flag_exists THEN
    RAISE NOTICE 'SUCCESS: managed_telephony feature flag created/updated';
  ELSE
    RAISE EXCEPTION 'FAILED: managed_telephony feature flag was not created';
  END IF;
END $$;
