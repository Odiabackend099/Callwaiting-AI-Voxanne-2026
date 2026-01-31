-- =====================================================
-- MIGRATION: Fix Unified Calls Table Schema
-- Date: 2026-01-31
-- Purpose: Add missing columns and fix schema mismatch
-- =====================================================

-- =====================================================
-- STEP 1: Add missing sentiment columns
-- =====================================================

ALTER TABLE IF EXISTS calls
ADD COLUMN IF NOT EXISTS sentiment_label TEXT,
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC,
ADD COLUMN IF NOT EXISTS sentiment_summary TEXT,
ADD COLUMN IF NOT EXISTS sentiment_urgency TEXT;

-- =====================================================
-- STEP 2: Add phone_number and caller_name columns
-- =====================================================

ALTER TABLE IF EXISTS calls
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS caller_name TEXT;

-- =====================================================
-- STEP 3: Migrate data from from_number → phone_number for inbound calls
-- =====================================================

UPDATE calls
SET phone_number = from_number
WHERE call_direction = 'inbound' AND phone_number IS NULL AND from_number IS NOT NULL;

-- =====================================================
-- STEP 4: Set caller_name to 'Unknown Caller' for inbound calls without a name
-- =====================================================

UPDATE calls
SET caller_name = 'Unknown Caller'
WHERE call_direction = 'inbound' AND caller_name IS NULL;

-- =====================================================
-- STEP 5: Set phone_number to 'Unknown' for inbound calls without a phone
-- =====================================================

UPDATE calls
SET phone_number = 'Unknown'
WHERE call_direction = 'inbound' AND phone_number IS NULL;

-- =====================================================
-- STEP 6: Verify migration
-- =====================================================

DO $$
DECLARE
  total_calls INTEGER;
  inbound_with_phone INTEGER;
  inbound_with_name INTEGER;
  sentiment_fields_populated INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_calls FROM calls;
  SELECT COUNT(*) INTO inbound_with_phone FROM calls WHERE call_direction = 'inbound' AND phone_number IS NOT NULL;
  SELECT COUNT(*) INTO inbound_with_name FROM calls WHERE call_direction = 'inbound' AND caller_name IS NOT NULL;
  SELECT COUNT(*) INTO sentiment_fields_populated FROM calls WHERE sentiment_label IS NOT NULL OR sentiment_score IS NOT NULL;

  RAISE NOTICE '✅ Schema Fix Complete!';
  RAISE NOTICE '  - Total calls: %', total_calls;
  RAISE NOTICE '  - Inbound calls with phone_number: % / %', inbound_with_phone, total_calls;
  RAISE NOTICE '  - Inbound calls with caller_name: % / %', inbound_with_name, total_calls;
  RAISE NOTICE '  - Calls with sentiment populated: %', sentiment_fields_populated;
END $$;
