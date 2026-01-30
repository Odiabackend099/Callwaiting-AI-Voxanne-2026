-- Add outcome_summary column to call_logs table
-- This stores a 3-5 sentence summary of the call outcome
-- Populated from Vapi webhook event.analysis.summary

ALTER TABLE call_logs
ADD COLUMN outcome_summary TEXT;

-- Create index for better query performance when filtering by outcome_summary
CREATE INDEX CONCURRENTLY idx_call_logs_outcome_summary
ON call_logs(outcome_summary)
WHERE outcome_summary IS NOT NULL;

-- Comment explaining the column
COMMENT ON COLUMN call_logs.outcome_summary IS
  'Call outcome summary: AI-generated 3-5 sentence summary of the call result, ' ||
  'including what the caller asked, what the AI provided, and any actions taken. ' ||
  'Example: "Patient inquired about Botox treatments and pricing. AI provided ' ||
  'information about treatments offered and prices. Patient requested appointment booking."';
