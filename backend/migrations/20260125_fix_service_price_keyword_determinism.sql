-- Migration: Fix non-deterministic get_service_price_by_keyword() function
-- Date: 2026-01-25
--
-- ISSUE: The function uses LIMIT 1 without ORDER BY, resulting in random service
-- selection when multiple services match the same keyword. This causes inconsistent
-- pricing calculations for the same keyword across different queries.
--
-- SOLUTION: Add ORDER BY to ensure deterministic behavior:
--   - First by created_at (ASC): Returns oldest service for keyword
--   - Alternative: ORDER BY price DESC for highest price match
--
-- Current behavior (BROKEN):
--   SELECT price FROM services WHERE ... LIMIT 1;
--   -> Random row if multiple matches
--
-- Fixed behavior:
--   SELECT price FROM services WHERE ... ORDER BY created_at ASC LIMIT 1;
--   -> Always returns same service

-- Drop the old function
DROP FUNCTION IF EXISTS get_service_price_by_keyword(UUID, TEXT);

-- Create corrected version with deterministic ordering
CREATE OR REPLACE FUNCTION get_service_price_by_keyword(
  p_org_id UUID,
  p_keyword TEXT
) RETURNS DECIMAL AS $$
DECLARE
  v_price DECIMAL;
BEGIN
  SELECT price INTO v_price
  FROM services
  WHERE org_id = p_org_id
    AND p_keyword = ANY(keywords)
  ORDER BY created_at ASC  -- Deterministic: first created service wins
  LIMIT 1;

  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_service_price_by_keyword(UUID, TEXT) TO authenticated;

-- Comment documenting the fix
COMMENT ON FUNCTION get_service_price_by_keyword(UUID, TEXT) IS
'Get service price by keyword, deterministically.
Returns price of first (oldest) matching service.
If no match found, returns 0.
Deterministic ordering ensures consistent pricing across calls.';
