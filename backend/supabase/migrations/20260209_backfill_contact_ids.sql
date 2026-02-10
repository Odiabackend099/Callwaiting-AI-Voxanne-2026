/**
 * Migration: Backfill contact_id for Existing Calls
 *
 * Purpose: Link existing inbound calls to contacts via phone number matching
 * Part of: Strategic SSOT Fix - Phase 1
 * Date: 2026-02-09
 *
 * This migration establishes foreign key relationships between existing calls
 * and contacts, enabling the contact-centric data model where contacts.name
 * is the single source of truth for caller identity.
 */

-- ============================================================================
-- STEP 1: Backfill contact_id for inbound calls
-- ============================================================================

-- Link inbound calls to contacts via phone lookup
-- This connects historical calls to their contacts, enabling live name resolution
UPDATE calls
SET contact_id = (
  SELECT id
  FROM contacts
  WHERE contacts.org_id = calls.org_id
    AND contacts.phone = calls.phone_number
  LIMIT 1
)
WHERE call_direction = 'inbound'
  AND contact_id IS NULL
  AND phone_number IS NOT NULL;

-- ============================================================================
-- STEP 2: Verify coverage
-- ============================================================================

-- Generate report showing backfill success rate
DO $$
DECLARE
  inbound_total INTEGER;
  inbound_linked INTEGER;
  inbound_pct NUMERIC;
  outbound_total INTEGER;
  outbound_linked INTEGER;
  outbound_pct NUMERIC;
BEGIN
  -- Count inbound calls
  SELECT
    COUNT(*),
    COUNT(contact_id),
    ROUND(100.0 * COUNT(contact_id) / NULLIF(COUNT(*), 0), 1)
  INTO inbound_total, inbound_linked, inbound_pct
  FROM calls
  WHERE call_direction = 'inbound';

  -- Count outbound calls
  SELECT
    COUNT(*),
    COUNT(contact_id),
    ROUND(100.0 * COUNT(contact_id) / NULLIF(COUNT(*), 0), 1)
  INTO outbound_total, outbound_linked, outbound_pct
  FROM calls
  WHERE call_direction = 'outbound';

  -- Log results
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Contact ID Backfill Results';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Inbound:  % total, % linked (%%)', inbound_total, inbound_linked, inbound_pct;
  RAISE NOTICE 'Outbound: % total, % linked (%%)', outbound_total, outbound_linked, outbound_pct;
  RAISE NOTICE '=================================================';

  -- Verify expected coverage
  IF inbound_pct < 50 THEN
    RAISE WARNING 'Inbound contact_id coverage below expected 55%% (actual: %%)', inbound_pct;
  END IF;

  IF outbound_pct < 95 THEN
    RAISE WARNING 'Outbound contact_id coverage below expected 100%% (actual: %%)', outbound_pct;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Create index for future JOIN performance
-- ============================================================================

-- Index to optimize the view JOIN (created in migration 3)
-- This index is created here to support both backfill verification and future queries
CREATE INDEX IF NOT EXISTS idx_calls_contact_id
ON calls(contact_id)
WHERE contact_id IS NOT NULL;

-- Index to optimize phone number lookups during contact auto-creation
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone
ON contacts(org_id, phone);

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing after deployment)
-- ============================================================================

-- Uncomment these queries to verify migration success:
--
-- -- Check backfill coverage by direction
-- SELECT
--   call_direction,
--   COUNT(*) as total_calls,
--   COUNT(contact_id) as calls_with_contact_id,
--   ROUND(100.0 * COUNT(contact_id) / COUNT(*), 1) as coverage_pct
-- FROM calls
-- GROUP BY call_direction;
--
-- -- Expected result:
-- -- inbound:  ~55% coverage (5/11 calls have matching contacts)
-- -- outbound: 100% coverage (already set by webhook)
--
-- -- Find orphaned calls (no contact_id despite having phone number)
-- SELECT
--   id,
--   phone_number,
--   call_direction,
--   created_at
-- FROM calls
-- WHERE contact_id IS NULL
--   AND phone_number IS NOT NULL
-- ORDER BY created_at DESC;
