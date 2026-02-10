/**
 * Migration: Validate & Clean Contact Names
 *
 * Purpose: Prevent garbage data in contacts.name (no "Unknown Caller", no phone numbers)
 * Part of: Strategic SSOT Fix - Phase 1
 * Date: 2026-02-09
 *
 * This migration enforces data quality constraints to ensure contacts.name
 * contains real, human-readable names (not "Unknown Caller" or phone numbers).
 * This is critical for the SSOT model where contacts.name is the single source
 * of truth for caller identity.
 */

-- ============================================================================
-- STEP 1: Clean up invalid names before adding constraint
-- ============================================================================

-- Replace "Unknown Caller" with phone number (better than generic placeholder)
-- This allows the dashboard view to fallback to phone display
UPDATE contacts
SET name = phone
WHERE name = 'Unknown Caller'
   OR name = 'Unknown'
   OR name IS NULL
   OR name = ''
   OR TRIM(name) = '';

-- Log cleanup results
DO $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO cleaned_count
  FROM contacts
  WHERE name = phone;  -- Names that were set to phone number

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Contact Name Cleanup Results';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Cleaned % invalid contact names', cleaned_count;
  RAISE NOTICE '=================================================';
END $$;

-- ============================================================================
-- STEP 2: Add CHECK constraint to prevent future garbage
-- ============================================================================

-- Prevent "Unknown Caller" from being stored in contacts.name
-- This ensures contacts table only contains real, identifiable names
ALTER TABLE contacts
ADD CONSTRAINT contacts_name_must_be_real
CHECK (
  name IS NOT NULL
  AND LENGTH(TRIM(name)) >= 2
  AND name != 'Unknown Caller'
  AND name != 'Unknown'
  AND name !~ '^\+?[0-9\-\(\) ]+$'  -- Not a phone number pattern
);

-- Add helpful comment explaining the constraint
COMMENT ON CONSTRAINT contacts_name_must_be_real ON contacts IS
  'Ensures contacts.name contains real names, not placeholders like "Unknown Caller" or phone numbers.
   Phone numbers can be stored as names temporarily during auto-creation, but should be enriched with real names ASAP.
   Added: 2026-02-09 as part of Strategic SSOT Fix';

-- ============================================================================
-- STEP 3: Normalize phone numbers to E.164 format
-- ============================================================================

-- Clean phone numbers: remove formatting characters, keep only digits and '+'
UPDATE contacts
SET phone = regexp_replace(phone, '[^0-9+]', '', 'g')
WHERE phone IS NOT NULL
  AND phone !~ '^\+[1-9][0-9]{1,14}$';

-- Log normalization results
DO $$
DECLARE
  normalized_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO normalized_count
  FROM contacts
  WHERE phone ~ '^\+[1-9][0-9]{1,14}$';

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Phone Number Normalization Results';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '% contacts now have E.164 format phone numbers', normalized_count;
  RAISE NOTICE '=================================================';
END $$;

-- ============================================================================
-- STEP 4: Add phone format constraint (E.164 standard)
-- ============================================================================

-- Enforce E.164 phone number format: +[country code][number]
-- Example: +12125551234 (US), +442071234567 (UK)
ALTER TABLE contacts
ADD CONSTRAINT contacts_phone_must_be_e164
CHECK (phone ~ '^\+[1-9][0-9]{1,14}$');

-- Add helpful comment explaining E.164 format
COMMENT ON CONSTRAINT contacts_phone_must_be_e164 ON contacts IS
  'Enforces E.164 international phone number format: +[country code][number].
   This prevents formatting inconsistencies and enables reliable phone number matching.
   Added: 2026-02-09 as part of Strategic SSOT Fix';

-- ============================================================================
-- STEP 5: Normalize calls table phone_number format
-- ============================================================================

-- Clean phone numbers in calls table (for JOIN compatibility)
UPDATE calls
SET phone_number = regexp_replace(phone_number, '[^0-9+]', '', 'g')
WHERE phone_number IS NOT NULL
  AND phone_number !~ '^\+[1-9][0-9]{1,14}$';

-- Log calls table normalization
DO $$
DECLARE
  normalized_calls INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO normalized_calls
  FROM calls
  WHERE phone_number IS NOT NULL
    AND phone_number ~ '^\+[1-9][0-9]{1,14}$';

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Calls Table Phone Number Normalization';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '% calls now have E.164 format phone numbers', normalized_calls;
  RAISE NOTICE '=================================================';
END $$;

-- ============================================================================
-- STEP 6: Create unique constraint on org_id + phone
-- ============================================================================

-- Prevent duplicate contacts with same phone number in same organization
-- This is critical for contact auto-creation logic
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_phone_unique
ON contacts(org_id, phone);

-- Add helpful comment
COMMENT ON INDEX idx_contacts_org_phone_unique IS
  'Ensures one contact per phone number per organization.
   Prevents duplicates during inbound call auto-creation.
   Added: 2026-02-09 as part of Strategic SSOT Fix';

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing after deployment)
-- ============================================================================

-- Uncomment these queries to verify migration success:
--
-- -- Check for any remaining invalid names (should be 0)
-- SELECT COUNT(*) as invalid_names
-- FROM contacts
-- WHERE name = 'Unknown Caller'
--    OR name ~ '^\+[0-9]';
-- -- Expected: 0
--
-- -- Verify all phones are E.164 format
-- SELECT COUNT(*) as invalid_phones
-- FROM contacts
-- WHERE phone !~ '^\+[1-9][0-9]{1,14}$';
-- -- Expected: 0
--
-- -- Check for duplicate phone numbers (should be 0)
-- SELECT org_id, phone, COUNT(*) as duplicate_count
-- FROM contacts
-- GROUP BY org_id, phone
-- HAVING COUNT(*) > 1;
-- -- Expected: 0 rows (no duplicates)
