-- Normalize voice field to use SSOT (Single Source of Truth) active voices only
-- Migrate any legacy/invalid voices to Rohan (default Vapi native voice)

-- Set any NULL or empty voice IDs to Rohan (default)
UPDATE agents
SET voice = 'Rohan',
    voice_provider = 'vapi'
WHERE voice IS NULL
   OR voice = ''
   OR voice_provider IS NULL;

-- Set default for voice column
ALTER TABLE agents
ALTER COLUMN voice SET DEFAULT 'Rohan';

-- Set default for voice_provider column
ALTER TABLE agents
ALTER COLUMN voice_provider SET DEFAULT 'vapi';
