-- Update existing agents to use VAPI voice names
-- Replace 'Kylie' with 'paige' (case insensitive)
UPDATE agents
SET voice = 'paige'
WHERE voice = 'Kylie' OR voice ILIKE '%kylie%';

-- Migrate Deepgram voice IDs to VAPI equivalents
UPDATE agents
SET voice = CASE
  WHEN voice LIKE '%asteria%' THEN 'lily'
  WHEN voice LIKE '%luna%' THEN 'savannah'
  WHEN voice LIKE '%athena%' THEN 'hana'
  WHEN voice LIKE '%orion%' THEN 'cole'
  WHEN voice LIKE '%hera%' THEN 'neha'
  WHEN voice LIKE '%arcas%' THEN 'elliot'
  WHEN voice LIKE '%perseus%' THEN 'spencer'
  ELSE 'paige' -- Default fallback
END
WHERE voice LIKE 'aura-%';

-- Ensure voice column has a default
ALTER TABLE agents
ALTER COLUMN voice SET DEFAULT 'paige';
