-- Migration: Managed Telephony Advisory Locks & Constraints
-- Created: 2026-02-10
-- Purpose: Prevent race conditions in managed number provisioning
--
-- Changes:
-- 1. Create function to acquire advisory locks for provisioning
-- 2. Add partial unique index: only one active managed number per org
--
-- CRITICAL: This migration prevents double-booking of phone numbers during concurrent requests

-- ============================================================================
-- Function: acquire_managed_telephony_provision_lock
-- ============================================================================
-- Acquires a transaction-scoped advisory lock for managed telephony provisioning
-- Returns true if lock acquired, false if already locked by another session
--
-- Usage in application:
--   SELECT acquire_managed_telephony_provision_lock('org-uuid-here');
--   -- Returns: true (lock acquired) or false (locked by another transaction)
--
-- Lock is automatically released when transaction commits or rolls back
-- ============================================================================

CREATE OR REPLACE FUNCTION acquire_managed_telephony_provision_lock(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  lock_key BIGINT;
BEGIN
  -- Generate deterministic lock key from org_id
  -- Using hashtext to convert UUID to integer (64-bit)
  -- Same org_id always produces same lock_key
  lock_key := abs(hashtext(p_org_id::text));

  -- Try to acquire advisory lock (transaction-scoped)
  -- pg_try_advisory_xact_lock returns:
  --   - true if lock acquired successfully
  --   - false if lock is already held by another transaction
  --
  -- Lock is automatically released when transaction ends
  -- (no need to call pg_advisory_unlock)
  RETURN pg_try_advisory_xact_lock(lock_key);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION acquire_managed_telephony_provision_lock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_managed_telephony_provision_lock(UUID) TO service_role;

-- Add helpful comment for database documentation
COMMENT ON FUNCTION acquire_managed_telephony_provision_lock IS
'Acquires transaction-scoped advisory lock for managed telephony provisioning.
Returns true if lock acquired, false if already locked.
Lock is automatically released when transaction commits or rolls back.';

-- ============================================================================
-- Constraint: Only One Active Managed Number Per Organization
-- ============================================================================
-- This partial unique index enforces the one-number-per-org business rule
-- at the database level, providing defense-in-depth protection.
--
-- Why partial index?
-- - Only enforces uniqueness WHERE status = 'active'
-- - Allows multiple historical records (status = 'released', 'failed', etc.)
-- - More efficient than full unique index (smaller index size)
--
-- This prevents:
-- 1. Race conditions: Two concurrent requests both creating numbers
-- 2. Application bugs: Code accidentally creating duplicate active numbers
-- 3. API abuse: Malicious attempts to provision multiple numbers
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_managed_per_org
ON managed_phone_numbers (org_id)
WHERE status = 'active';

-- Add helpful comment for database documentation
COMMENT ON INDEX idx_one_active_managed_per_org IS
'Enforces one-number-per-org business rule: only one active managed phone number per organization.
Partial index only applies WHERE status = ''active'', allowing historical records.';

-- ============================================================================
-- Verification Queries (for testing)
-- ============================================================================
-- Run these queries after migration to verify it worked:
--
-- 1. Verify function exists:
--    SELECT proname, proargtypes, prosrc
--    FROM pg_proc
--    WHERE proname = 'acquire_managed_telephony_provision_lock';
--
-- 2. Verify index exists:
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE tablename = 'managed_phone_numbers'
--    AND indexname = 'idx_one_active_managed_per_org';
--
-- 3. Test lock acquisition (should return true):
--    BEGIN;
--    SELECT acquire_managed_telephony_provision_lock('00000000-0000-0000-0000-000000000001');
--    ROLLBACK;
--
-- 4. Test concurrent lock (should return false in second session):
--    -- Session 1:
--    BEGIN;
--    SELECT acquire_managed_telephony_provision_lock('00000000-0000-0000-0000-000000000001');
--    -- (keep transaction open)
--
--    -- Session 2 (different connection):
--    BEGIN;
--    SELECT acquire_managed_telephony_provision_lock('00000000-0000-0000-0000-000000000001');
--    -- Should return FALSE because Session 1 holds the lock
--    ROLLBACK;
--
--    -- Session 1:
--    ROLLBACK; -- Release the lock
-- ============================================================================
