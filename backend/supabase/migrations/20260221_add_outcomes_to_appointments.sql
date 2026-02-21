-- Migration: Add outcome and sentiment columns to appointments table
-- Date: 2026-02-21
-- Purpose: Sync appointments schema with calls table for outcome tracking
-- Author: Claude Code (Anthropic)
-- Context: Appointments table was created before outcome tracking was added
--          Outcomes were only added to calls table, causing UX issues
--          This migration aligns appointments with calls schema

-- Add outcome columns (matching calls table schema)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS outcome_summary TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add sentiment columns (matching calls table schema)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS sentiment_label TEXT,
  ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC,
  ADD COLUMN IF NOT EXISTS sentiment_summary TEXT,
  ADD COLUMN IF NOT EXISTS sentiment_urgency TEXT;

-- Create index for outcome queries (improves dashboard performance)
CREATE INDEX IF NOT EXISTS idx_appointments_outcome
  ON appointments(outcome)
  WHERE outcome IS NOT NULL;

-- Create index for sentiment queries (improves analytics performance)
CREATE INDEX IF NOT EXISTS idx_appointments_sentiment_label
  ON appointments(sentiment_label)
  WHERE sentiment_label IS NOT NULL;

-- Backfill existing appointments with outcomes from linked calls
-- This is a one-time data migration for historical appointments
UPDATE appointments apt
SET
  outcome = c.outcome,
  outcome_summary = c.outcome_summary,
  notes = c.notes,
  sentiment_label = c.sentiment_label,
  sentiment_score = c.sentiment_score,
  sentiment_summary = c.sentiment_summary,
  sentiment_urgency = c.sentiment_urgency,
  updated_at = NOW()
FROM calls c
WHERE apt.call_id = c.id
  AND apt.outcome IS NULL  -- Only update if not already set (idempotent)
  AND c.outcome IS NOT NULL; -- Only if call has outcome data

-- Log backfill results for verification
DO $$
DECLARE
  updated_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Count total appointments
  SELECT COUNT(*) INTO total_count FROM appointments;

  -- Count appointments with outcomes after backfill
  SELECT COUNT(*) INTO updated_count
  FROM appointments
  WHERE outcome IS NOT NULL;

  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Appointment Outcomes Migration Complete';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Total appointments: %', total_count;
  RAISE NOTICE 'Appointments with outcomes: %', updated_count;
  RAISE NOTICE 'Coverage: % %%', ROUND((updated_count::NUMERIC / NULLIF(total_count, 0) * 100), 2);
  RAISE NOTICE '==============================================';
END $$;

-- Add helpful comments for future developers
COMMENT ON COLUMN appointments.outcome IS 'Short outcome summary from call (e.g., "Appointment Booked", "Call Completed")';
COMMENT ON COLUMN appointments.outcome_summary IS 'Detailed outcome description from AI analysis of the call';
COMMENT ON COLUMN appointments.notes IS 'Additional notes about the appointment or call';
COMMENT ON COLUMN appointments.sentiment_label IS 'Sentiment classification: positive, neutral, or negative';
COMMENT ON COLUMN appointments.sentiment_score IS 'Numeric sentiment score from 0.0 (negative) to 1.0 (positive)';
COMMENT ON COLUMN appointments.sentiment_summary IS 'Human-readable sentiment summary from AI analysis';
COMMENT ON COLUMN appointments.sentiment_urgency IS 'Urgency level: low, medium, high, or critical';
