-- Migration: Fix managed_phone_numbers unique constraint to be direction-aware
-- Created: 2026-02-24
-- Purpose: Allow 1 inbound + 1 outbound managed number per org (Bug 3 fix)
--
-- Root cause:
--   20260210_managed_telephony_locks.sql created idx_one_active_managed_per_org
--   which enforced UNIQUE (org_id) WHERE status = 'active' — one number total per org.
--   20260222_add_routing_direction.sql made insert_managed_number_atomic() direction-aware
--   but did NOT update this unique index. As a result, purchasing a second number
--   (inbound=existing, outbound=new) triggers a constraint violation despite the
--   application-level validation in phone-validation-service.ts correctly allowing it.
--
-- Fix:
--   Drop the old per-org index.
--   Create a new per-direction index: UNIQUE (org_id, routing_direction) WHERE active.
--   This allows 1 inbound + 1 outbound per org while still preventing duplicates
--   within the same direction.
--
-- Safety:
--   Existing single-number orgs are unaffected (1 row with routing_direction='inbound').
--   New constraint is strictly less restrictive than the old one.
--   No data loss, no downtime.

-- Step 1: Drop old per-org constraint (enforced 1 total active number per org)
DROP INDEX IF EXISTS idx_one_active_managed_per_org;

-- Step 2: Create new per-direction constraint (1 active number per direction per org)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_managed_per_org_direction
ON managed_phone_numbers (org_id, routing_direction)
WHERE status = 'active';

COMMENT ON INDEX idx_one_active_managed_per_org_direction IS
'Enforces one active managed number per routing direction per org.
Allows 1 inbound + 1 outbound per org. Replaces idx_one_active_managed_per_org
which only allowed 1 total. Partial index: only WHERE status = ''active''.';
