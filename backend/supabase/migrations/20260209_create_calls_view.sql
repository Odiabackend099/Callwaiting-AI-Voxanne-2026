/**
 * Migration: Create Live-Resolution View
 *
 * Purpose: Provide backward-compatible API with live name resolution from contacts table
 * Part of: Strategic SSOT Fix - Phase 1
 * Date: 2026-02-09
 *
 * This migration creates a database view that implements read-time enrichment
 * (live JOINs) instead of write-time enrichment (frozen snapshots). The view
 * always resolves caller names from contacts.name (SSOT), ensuring dashboard
 * displays are always up-to-date even when contact names change.
 *
 * Key Architecture:
 * - contacts.name is SINGLE SOURCE OF TRUTH for caller identity
 * - View performs LEFT JOIN to contacts table (never writes)
 * - Fallback chain: contact name → phone number → 'Unknown'
 * - Backward-compatible with existing API queries
 */

-- ============================================================================
-- STEP 1: Create view that always resolves fresh names from contacts
-- ============================================================================

CREATE OR REPLACE VIEW calls_with_caller_names AS
SELECT
  -- All original calls table columns
  c.id,
  c.vapi_call_id,
  c.org_id,
  c.contact_id,
  c.phone_number,
  c.call_direction,
  c.status,
  c.duration_seconds,
  c.recording_url,
  c.transcript,
  c.sentiment_label,
  c.sentiment_score,
  c.sentiment_summary,
  c.sentiment_urgency,
  c.ended_reason,
  c.started_at,
  c.ended_at,
  c.created_at,
  c.updated_at,

  -- DEPRECATED COLUMNS (still included for backward compatibility)
  -- These will be removed in Phase 3 (March 2026)
  c.caller_name as deprecated_caller_name,
  c.from_number as deprecated_from_number,

  -- ====================================================================
  -- SSOT RESOLUTION: Always get name from contacts table (never stale)
  -- ====================================================================
  COALESCE(
    ct.name,              -- Priority 1: Contact name (SSOT)
    c.phone_number,       -- Priority 2: Phone number fallback
    'Unknown'             -- Priority 3: Last resort
  ) AS resolved_caller_name,

  -- Include contact metadata for dashboard enrichment
  ct.email as contact_email,
  ct.lead_status as contact_lead_status,
  ct.lead_score as contact_lead_score,
  ct.service_interests as contact_service_interests,
  ct.last_contacted_at as contact_last_seen,
  ct.created_at as contact_created_at,

  -- Computed fields for dashboard convenience
  CASE
    WHEN ct.name IS NOT NULL THEN 'contact'
    WHEN c.phone_number IS NOT NULL THEN 'phone'
    ELSE 'unknown'
  END AS name_source

FROM calls c
LEFT JOIN contacts ct ON c.contact_id = ct.id;

-- Add helpful comment explaining the view
COMMENT ON VIEW calls_with_caller_names IS
  'Live caller name resolution view (SSOT implementation).
   Always JOINs with contacts table to get fresh names - never stale.
   Use this view instead of querying calls table directly.
   Created: 2026-02-09 as part of Strategic SSOT Fix.
   Phase 3 (March 2026): Will remove deprecated_caller_name and deprecated_from_number columns.';

-- ============================================================================
-- STEP 2: Grant access to authenticated users
-- ============================================================================

-- Allow authenticated users to read from the view
GRANT SELECT ON calls_with_caller_names TO authenticated;

-- Allow service role full access (for backend queries)
GRANT SELECT ON calls_with_caller_names TO service_role;

-- ============================================================================
-- STEP 3: Create performance index (if not already created in migration 1)
-- ============================================================================

-- Index to optimize the JOIN (contact_id → contacts.id)
CREATE INDEX IF NOT EXISTS idx_calls_contact_id
ON calls(contact_id)
WHERE contact_id IS NOT NULL;

-- Index to optimize org_id filtering (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_calls_org_created
ON calls(org_id, created_at DESC);

-- ============================================================================
-- STEP 4: Verify view returns expected data
-- ============================================================================

-- Test query to verify view works correctly
DO $$
DECLARE
  total_calls INTEGER;
  resolved_with_contact INTEGER;
  resolved_with_phone INTEGER;
  resolved_as_unknown INTEGER;
BEGIN
  -- Count resolution sources
  SELECT COUNT(*) INTO total_calls FROM calls_with_caller_names;
  SELECT COUNT(*) INTO resolved_with_contact FROM calls_with_caller_names WHERE name_source = 'contact';
  SELECT COUNT(*) INTO resolved_with_phone FROM calls_with_caller_names WHERE name_source = 'phone';
  SELECT COUNT(*) INTO resolved_as_unknown FROM calls_with_caller_names WHERE name_source = 'unknown';

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Live-Resolution View Verification';
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'Total calls: %', total_calls;
  RAISE NOTICE 'Resolved from contact: % (%%)', resolved_with_contact, ROUND(100.0 * resolved_with_contact / NULLIF(total_calls, 0), 1);
  RAISE NOTICE 'Resolved from phone: % (%%)', resolved_with_phone, ROUND(100.0 * resolved_with_phone / NULLIF(total_calls, 0), 1);
  RAISE NOTICE 'Resolved as "Unknown": % (%%)', resolved_as_unknown, ROUND(100.0 * resolved_as_unknown / NULLIF(total_calls, 0), 1);
  RAISE NOTICE '=================================================';

  -- Warn if many calls are still "Unknown"
  IF resolved_as_unknown > 0 THEN
    RAISE WARNING '% calls still resolve to "Unknown" - these have no contact_id and no phone_number', resolved_as_unknown;
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing after deployment)
-- ============================================================================

-- Uncomment these queries to verify migration success:
--
-- -- Check view returns real names (not "Unknown")
-- SELECT
--   id,
--   phone_number,
--   resolved_caller_name,
--   name_source,
--   CASE
--     WHEN resolved_caller_name LIKE '+%' THEN 'Phone fallback (OK)'
--     WHEN resolved_caller_name = 'Unknown' THEN 'FAIL - No contact, no phone'
--     ELSE 'PASS - Real name from contact'
--   END as resolution_status
-- FROM calls_with_caller_names
-- ORDER BY created_at DESC
-- LIMIT 10;
-- -- Expected: 0 rows with "FAIL" status for calls with phone numbers
--
-- -- Compare old caller_name vs new resolved_caller_name
-- SELECT
--   id,
--   deprecated_caller_name as old_name,
--   resolved_caller_name as new_name,
--   name_source,
--   CASE
--     WHEN deprecated_caller_name = resolved_caller_name THEN 'SAME'
--     ELSE 'DIFFERENT (view is fresher)'
--   END as comparison
-- FROM calls_with_caller_names
-- WHERE deprecated_caller_name IS NOT NULL
-- ORDER BY created_at DESC
-- LIMIT 10;
-- -- Expected: Many rows showing "DIFFERENT" (view resolves live names)
--
-- -- Verify JOIN performance (should use idx_calls_contact_id)
-- EXPLAIN ANALYZE
-- SELECT resolved_caller_name, contact_lead_score
-- FROM calls_with_caller_names
-- WHERE org_id = 'some-org-id'
-- ORDER BY created_at DESC
-- LIMIT 20;
-- -- Expected: "Index Scan using idx_calls_org_created" and "Index Scan using contacts_pkey"
