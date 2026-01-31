-- =====================================================
-- Migration: Unify calls and call_logs tables
-- Date: 2026-01-31
-- Purpose: Create single unified 'calls' table for both inbound and outbound calls
-- Risk: MEDIUM-HIGH (data migration with table renames)
-- Rollback: Documented in Step 8
-- =====================================================

-- =====================================================
-- STEP 1: CREATE UNIFIED CALLS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS calls_unified (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vapi_call_id TEXT UNIQUE NOT NULL,

  -- Contact linking (NULL for inbound, populated for outbound)
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Call direction & type
  call_direction TEXT NOT NULL CHECK (call_direction IN ('inbound', 'outbound')),
  call_type TEXT NOT NULL DEFAULT 'inbound',  -- For backward compatibility

  -- Caller information (inbound only)
  phone_number TEXT,  -- E.164 format for inbound calls
  caller_name TEXT,   -- Name from inbound caller or NULL

  -- Call metadata
  call_sid TEXT,      -- Twilio SID or vapi-{call_id}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER,
  status TEXT,

  -- Recording & transcript
  recording_url TEXT,
  recording_storage_path TEXT,
  transcript TEXT,

  -- Analytics (all 4 sentiment fields)
  sentiment TEXT,              -- Legacy field (nullable)
  sentiment_label TEXT,        -- 'positive', 'neutral', 'negative'
  sentiment_score NUMERIC,     -- 0.0 to 1.0
  sentiment_summary TEXT,      -- Human-readable summary
  sentiment_urgency TEXT,      -- 'low', 'medium', 'high', 'critical'

  -- Outcomes
  outcome TEXT,                -- Short outcome
  outcome_summary TEXT,        -- Detailed summary
  notes TEXT,                  -- Additional notes

  -- Metadata (JSONB for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_calls_unified_org_created
  ON calls_unified(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_unified_vapi_call_id
  ON calls_unified(vapi_call_id);

CREATE INDEX IF NOT EXISTS idx_calls_unified_contact_id
  ON calls_unified(contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calls_unified_direction
  ON calls_unified(call_direction);

CREATE INDEX IF NOT EXISTS idx_calls_unified_phone_number
  ON calls_unified(phone_number)
  WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calls_unified_created_at
  ON calls_unified(created_at DESC);

-- =====================================================
-- STEP 3: MIGRATE DATA FROM call_logs (INBOUND)
-- =====================================================

INSERT INTO calls_unified (
  id, org_id, vapi_call_id, contact_id, call_direction, call_type,
  phone_number, caller_name, call_sid, created_at, updated_at,
  duration_seconds, status, recording_url, recording_storage_path,
  transcript, sentiment, sentiment_label, sentiment_score,
  sentiment_summary, sentiment_urgency, outcome_summary, metadata
)
SELECT
  id,
  org_id,
  vapi_call_id,
  NULL as contact_id,  -- Inbound calls don't have contact_id initially
  'inbound' as call_direction,
  COALESCE(call_type, 'inbound') as call_type,
  phone_number,
  caller_name,
  COALESCE(call_sid, 'vapi-' || vapi_call_id) as call_sid,
  created_at,
  updated_at,
  duration_seconds,
  status,
  recording_url,
  recording_storage_path,
  transcript,
  sentiment,
  sentiment_label,
  sentiment_score,
  sentiment_summary,
  sentiment_urgency,
  outcome_summary,
  COALESCE(metadata, '{}'::jsonb) as metadata
FROM call_logs
ON CONFLICT (vapi_call_id) DO NOTHING;

-- =====================================================
-- STEP 4: MIGRATE DATA FROM calls (OUTBOUND)
-- =====================================================

DO $$
BEGIN
  -- Only migrate if calls table exists and has data
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'calls'
  ) THEN
    -- Check if calls table has any rows
    IF (SELECT COUNT(*) FROM calls) > 0 THEN
      INSERT INTO calls_unified (
        id, org_id, vapi_call_id, contact_id, call_direction, call_type,
        phone_number, caller_name, call_sid, created_at, updated_at,
        duration_seconds, status, recording_url, transcript,
        sentiment_score, outcome, notes
      )
      SELECT
        id,
        org_id,
        vapi_call_id,
        contact_id,
        'outbound' as call_direction,
        COALESCE(call_type, 'outbound') as call_type,
        NULL as phone_number,  -- Outbound uses contact_id, not direct phone
        NULL as caller_name,   -- Outbound doesn't have caller_name
        call_sid,
        created_at,
        updated_at,
        duration_seconds,
        status,
        recording_url,
        transcript,
        sentiment_score,
        outcome,
        notes
      FROM calls
      ON CONFLICT (vapi_call_id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- =====================================================
-- STEP 5: RENAME OLD TABLES (FOR ROLLBACK SAFETY)
-- =====================================================

-- Rename call_logs to call_logs_legacy
ALTER TABLE IF EXISTS call_logs RENAME TO call_logs_legacy;

-- Rename calls to calls_legacy (only if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'calls'
  ) THEN
    ALTER TABLE calls RENAME TO calls_legacy;
  END IF;
END $$;

-- =====================================================
-- STEP 6: RENAME UNIFIED TABLE TO CANONICAL NAME
-- =====================================================

ALTER TABLE calls_unified RENAME TO calls;

-- Rename indexes to match new table name
ALTER INDEX IF EXISTS idx_calls_unified_org_created RENAME TO idx_calls_org_created;
ALTER INDEX IF EXISTS idx_calls_unified_vapi_call_id RENAME TO idx_calls_vapi_call_id;
ALTER INDEX IF EXISTS idx_calls_unified_contact_id RENAME TO idx_calls_contact_id;
ALTER INDEX IF EXISTS idx_calls_unified_direction RENAME TO idx_calls_direction;
ALTER INDEX IF EXISTS idx_calls_unified_phone_number RENAME TO idx_calls_phone_number;
ALTER INDEX IF EXISTS idx_calls_unified_created_at RENAME TO idx_calls_created_at;

-- =====================================================
-- STEP 7: ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own org calls" ON calls;
DROP POLICY IF EXISTS "Service role full access" ON calls;

-- Policy: Users can view calls from their org
CREATE POLICY "Users can view own org calls"
  ON calls FOR SELECT
  USING (
    org_id = (
      NULLIF(current_setting('request.jwt.claims', true), '')::json->>'org_id'
    )::uuid
  );

-- Policy: Service role has full access
CREATE POLICY "Service role full access"
  ON calls FOR ALL
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- =====================================================
-- STEP 8: VERIFY DATA INTEGRITY
-- =====================================================

DO $$
DECLARE
  legacy_call_logs_count INTEGER;
  legacy_calls_count INTEGER;
  unified_inbound_count INTEGER;
  unified_outbound_count INTEGER;
  unified_total_count INTEGER;
BEGIN
  -- Count legacy tables
  SELECT COUNT(*) INTO legacy_call_logs_count FROM call_logs_legacy;

  -- Count calls_legacy if it exists
  legacy_calls_count := 0;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'calls_legacy'
  ) THEN
    SELECT COUNT(*) INTO legacy_calls_count FROM calls_legacy;
  END IF;

  -- Count unified table
  SELECT COUNT(*) INTO unified_total_count FROM calls;
  SELECT COUNT(*) INTO unified_inbound_count FROM calls WHERE call_direction = 'inbound';
  SELECT COUNT(*) INTO unified_outbound_count FROM calls WHERE call_direction = 'outbound';

  -- Verify counts match
  IF legacy_call_logs_count != unified_inbound_count THEN
    RAISE EXCEPTION 'Migration failed: call_logs_legacy had % rows, calls has % inbound rows',
      legacy_call_logs_count, unified_inbound_count;
  END IF;

  IF legacy_calls_count > 0 AND legacy_calls_count != unified_outbound_count THEN
    RAISE EXCEPTION 'Migration failed: calls_legacy had % rows, calls has % outbound rows',
      legacy_calls_count, unified_outbound_count;
  END IF;

  -- Success message
  RAISE NOTICE '✅ Migration successful!';
  RAISE NOTICE '  - Migrated % inbound calls from call_logs_legacy', legacy_call_logs_count;
  RAISE NOTICE '  - Migrated % outbound calls from calls_legacy', legacy_calls_count;
  RAISE NOTICE '  - Total rows in unified calls table: %', unified_total_count;
  RAISE NOTICE '  - call_direction breakdown: % inbound, % outbound',
    unified_inbound_count, unified_outbound_count;
END $$;

-- =====================================================
-- STEP 9: ROLLBACK PROCEDURE (IF NEEDED)
-- =====================================================

/*
-- EMERGENCY ROLLBACK (run if migration fails):

BEGIN;

-- Rename tables back
ALTER TABLE calls RENAME TO calls_unified_failed;
ALTER TABLE call_logs_legacy RENAME TO call_logs;

-- Only rename calls_legacy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'calls_legacy'
  ) THEN
    ALTER TABLE calls_legacy RENAME TO calls;
  END IF;
END $$;

-- Drop failed unified table
DROP TABLE IF EXISTS calls_unified_failed CASCADE;

COMMIT;

-- Restart backend to reconnect to old tables
*/

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Summary of changes:
-- ✅ Created unified 'calls' table with call_direction field
-- ✅ Migrated all inbound calls from call_logs
-- ✅ Migrated all outbound calls from calls (if any)
-- ✅ Renamed old tables to *_legacy for rollback safety
-- ✅ Created 6 performance indexes
-- ✅ Enabled RLS with appropriate policies
-- ✅ Verified data integrity

-- Next steps:
-- 1. Update backend webhook handler to log to 'calls' table
-- 2. Update backend dashboard queries to read from 'calls' table
-- 3. Test end-to-end with both inbound and outbound calls
-- 4. Monitor for 7 days, then drop legacy tables
