-- Migration: Add Call Recording & Sentiment Analysis Columns
-- Description: Adds fields for storage path, sentiment metrics, and clinical summary.
-- Author: Implementation Plan Phase 1
-- 1. Add columns to 'calls' table
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS recording_path TEXT,
    ADD COLUMN IF NOT EXISTS sentiment_label TEXT,
    -- 'Positive', 'Neutral', 'Negative'
ADD COLUMN IF NOT EXISTS sentiment_score FLOAT,
    -- 0.0 to 1.0
ADD COLUMN IF NOT EXISTS sentiment_summary TEXT,
    -- 2-sentence clinical summary
ADD COLUMN IF NOT EXISTS direction TEXT;
-- 'inbound' or 'outbound'
-- 2. Add check constraint for direction
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calls_direction_check'
) THEN
ALTER TABLE calls
ADD CONSTRAINT calls_direction_check CHECK (direction IN ('inbound', 'outbound'));
END IF;
END $$;
-- 3. Add check constraint for sentiment_score
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calls_sentiment_score_check'
) THEN
ALTER TABLE calls
ADD CONSTRAINT calls_sentiment_score_check CHECK (
        sentiment_score >= 0.0
        AND sentiment_score <= 1.0
    );
END IF;
END $$;
-- 4. Create an index on direction for filtering
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);
CREATE INDEX IF NOT EXISTS idx_calls_sentiment_label ON calls(sentiment_label);
-- 5. Comments for documentation
COMMENT ON COLUMN calls.recording_path IS 'Path to audio file in Supabase Storage (call-recordings bucket)';
COMMENT ON COLUMN calls.sentiment_summary IS 'AI-generated clinical summary of patient interaction';