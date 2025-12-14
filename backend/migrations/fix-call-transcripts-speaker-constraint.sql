-- Fix call_transcripts speaker constraint to accept 'agent' and 'customer'
-- Previously was 'agent' and 'client', but Vapi webhooks use 'customer'

-- Drop the old constraint
ALTER TABLE call_transcripts DROP CONSTRAINT IF EXISTS call_transcripts_speaker_check;

-- Add the new constraint that accepts both 'agent' and 'customer'
ALTER TABLE call_transcripts ADD CONSTRAINT call_transcripts_speaker_check 
  CHECK (speaker IN ('agent', 'customer'));
