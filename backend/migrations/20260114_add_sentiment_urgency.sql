-- Add sentiment_urgency column to calls and call_logs tables
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS sentiment_urgency TEXT CHECK (sentiment_urgency IN ('High', 'Medium', 'Low'));
ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS sentiment_urgency TEXT CHECK (sentiment_urgency IN ('High', 'Medium', 'Low'));
-- Create index for filtering by urgency
CREATE INDEX IF NOT EXISTS idx_calls_sentiment_urgency ON calls(sentiment_urgency);
CREATE INDEX IF NOT EXISTS idx_call_logs_sentiment_urgency ON call_logs(sentiment_urgency);