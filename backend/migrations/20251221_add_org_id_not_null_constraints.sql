-- Migration: Add NOT NULL Constraints to org_id Columns
-- Date: 2025-12-21
-- Purpose: Enforce org_id at database level to prevent null values that could compromise multi-tenant isolation
-- Context: Phase 1 Critical Fix - Defense in depth against data leakage

-- NOTE: These constraints should already exist in schema, but explicitly enforcing them
-- If tables were created before this constraint, migration ensures it's in place

-- ===== call_logs Table =====
-- Ensure org_id cannot be NULL in call_logs
-- This prevents accidental org_id omission in INSERT statements
ALTER TABLE call_logs
ADD CONSTRAINT call_logs_org_id_not_null CHECK (org_id IS NOT NULL);

-- ===== call_tracking Table =====
-- Ensure org_id cannot be NULL in call_tracking
ALTER TABLE call_tracking
ADD CONSTRAINT call_tracking_org_id_not_null CHECK (org_id IS NOT NULL);

-- ===== calls Table =====
-- Ensure org_id cannot be NULL in calls
ALTER TABLE calls
ADD CONSTRAINT calls_org_id_not_null CHECK (org_id IS NOT NULL);

-- ===== recording_upload_queue Table =====
-- Ensure org_id cannot be NULL in recording_upload_queue
ALTER TABLE recording_upload_queue
ADD CONSTRAINT recording_upload_queue_org_id_not_null CHECK (org_id IS NOT NULL);

-- ===== COMPOSITE UNIQUE INDEXES FOR IDEMPOTENCY =====
-- Prevents same event_id across different orgs (defense in depth)
-- Even though event_id should be globally unique, this adds extra safety
CREATE UNIQUE INDEX IF NOT EXISTS idx_processed_events_org_event
ON processed_webhook_events(org_id, event_id);

-- ===== COMPOSITE UNIQUE INDEXES FOR MULTI-TENANT SAFETY =====
-- Ensures vapi_call_id uniqueness is scoped per organization
-- Prevents accidental collisions if vapi_call_id somehow repeats across orgs

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_logs_org_vapi_call_id
ON call_logs(org_id, vapi_call_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_tracking_org_vapi_call_id
ON call_tracking(org_id, vapi_call_id);

-- ===== VERIFY DATA INTEGRITY =====
-- These queries help verify that no NULL org_id values exist in critical tables
-- Run these manually to confirm data integrity after migration:
--
-- SELECT COUNT(*) FROM call_logs WHERE org_id IS NULL;
-- SELECT COUNT(*) FROM call_tracking WHERE org_id IS NULL;
-- SELECT COUNT(*) FROM calls WHERE org_id IS NULL;
-- SELECT COUNT(*) FROM recording_upload_queue WHERE org_id IS NULL;
--
-- All should return 0 rows

-- ===== ROLLBACK PLAN =====
-- If these constraints cause issues with existing data:
--
-- ALTER TABLE call_logs DROP CONSTRAINT call_logs_org_id_not_null;
-- ALTER TABLE call_tracking DROP CONSTRAINT call_tracking_org_id_not_null;
-- ALTER TABLE calls DROP CONSTRAINT calls_org_id_not_null;
-- ALTER TABLE recording_upload_queue DROP CONSTRAINT recording_upload_queue_org_id_not_null;
--
-- DROP INDEX IF EXISTS idx_processed_events_org_event;
-- DROP INDEX IF EXISTS idx_call_logs_org_vapi_call_id;
-- DROP INDEX IF EXISTS idx_call_tracking_org_vapi_call_id;

-- ===== VERSION HISTORY =====
-- v1.0 (2025-12-21): Initial NOT NULL constraints for Phase 1 critical fixes
