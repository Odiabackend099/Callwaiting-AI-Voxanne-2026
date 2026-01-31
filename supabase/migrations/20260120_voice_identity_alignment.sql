-- Migration: Fix legacy voice names to match Vapi's 2026 API specification
-- Date: 2026-01-20
-- Purpose: Align all agent voice_id values with Vapi's exact voice IDs
-- 
-- Vapi accepts these EXACT voice IDs (case-sensitive):
-- Elliot, Kylie, Rohan, Lily, Savannah, Hana, Neha, Cole, Harry, Paige, Spencer, Leah, Tara, Jess, Leo, Dan, Mia, Zac, Zoe

BEGIN;

-- 0. Add voice_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agents' AND column_name = 'voice_id'
  ) THEN
    ALTER TABLE public.agents ADD COLUMN voice_id TEXT DEFAULT 'Neha';
  END IF;
END$$;

-- 1. Fix "jennifer" (legacy default) → "Neha" (current healthcare voice)
UPDATE public.agents 
SET voice_id = 'Neha'
WHERE voice_id ILIKE 'jennifer' 
  AND voice_id != 'Neha';

-- 2. Fix "sam" (generic name) → "Rohan" (professional voice)
UPDATE public.agents 
SET voice_id = 'Rohan'
WHERE voice_id ILIKE 'sam';

-- 3. Normalize case: "kylie" → "Kylie"
UPDATE public.agents 
SET voice_id = 'Kylie'
WHERE voice_id = 'kylie';

-- 4. Normalize case for other voice IDs (lowercase to proper case)
UPDATE public.agents SET voice_id = 'Neha' WHERE voice_id = 'neha';
UPDATE public.agents SET voice_id = 'Paige' WHERE voice_id = 'paige';
UPDATE public.agents SET voice_id = 'Hana' WHERE voice_id = 'hana';
UPDATE public.agents SET voice_id = 'Rohan' WHERE voice_id = 'rohan';
UPDATE public.agents SET voice_id = 'Elliot' WHERE voice_id = 'elliot';
UPDATE public.agents SET voice_id = 'Lily' WHERE voice_id = 'lily';
UPDATE public.agents SET voice_id = 'Cole' WHERE voice_id = 'cole';
UPDATE public.agents SET voice_id = 'Harry' WHERE voice_id = 'harry';
UPDATE public.agents SET voice_id = 'Savannah' WHERE voice_id = 'savannah';
UPDATE public.agents SET voice_id = 'Spencer' WHERE voice_id = 'spencer';

-- 5. Set all NULL voice_id values to default "Neha"
UPDATE public.agents 
SET voice_id = 'Neha'
WHERE voice_id IS NULL OR voice_id = '';

-- 6. Verify: List any remaining invalid voice_id values (should be empty)
-- SELECT DISTINCT voice_id FROM public.agents 
-- WHERE voice_id NOT IN ('Elliot', 'Kylie', 'Rohan', 'Lily', 'Savannah', 'Hana', 'Neha', 'Cole', 'Harry', 'Paige', 'Spencer', 'Leah', 'Tara', 'Jess', 'Leo', 'Dan', 'Mia', 'Zac', 'Zoe');

COMMIT;
