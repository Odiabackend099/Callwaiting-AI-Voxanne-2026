-- ============================================
-- Migration: Add metadata column to org_credentials
-- Purpose: Store user-visible information (email, display name) for OAuth connections
-- Date: 2026-01-16
-- ============================================

-- Step 1: Add metadata column (JSONB for flexible storage)
-- This column stores non-encrypted user-visible data like email addresses
ALTER TABLE org_credentials
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Step 2: Add index for faster metadata queries (using GIN for JSON queries)
CREATE INDEX IF NOT EXISTS idx_org_credentials_metadata
ON org_credentials USING GIN (metadata);

-- Step 3: Add helpful comment explaining the column
COMMENT ON COLUMN org_credentials.metadata IS 'User-visible metadata stored as JSONB (e.g., email, display name). NOT encrypted - only non-sensitive data.';

-- Step 4: Force schema cache refresh to make PostgREST aware of the new column
-- This resolves PGRST205 "Could not find the table" errors
SELECT reload_schema_cache();

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify migration success:

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'org_credentials' AND column_name = 'metadata';
-- Expected: metadata | jsonb |

-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'org_credentials' AND indexname = 'idx_org_credentials_metadata';
-- Expected: idx_org_credentials_metadata
