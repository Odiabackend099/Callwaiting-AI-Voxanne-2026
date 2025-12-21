-- Migration: Create Atomic Transaction RPC Functions for Webhook Handlers
-- Date: 2025-12-21
-- Purpose: Wrap multi-table operations in PostgreSQL transactions to ensure atomicity
-- Context: Phase 1 Critical Fix - Addresses CRITICAL #3 from CODE_REVIEW.md
-- UPDATED: December 21, 2025 - Fixed 8 issues identified in RPC Functions Senior Review

-- ===== FUNCTION 1: Atomic Call Started Handler =====
-- Creates call_tracking and call_logs in single atomic transaction
-- Auto-rollback if ANY step fails - prevents orphaned records
-- CRITICAL FIXES APPLIED:
--   1. Added comprehensive input validation
--   2. Added agent existence and org membership verification
--   3. Handles duplicate vapi_call_id idempotently (HIGH #1)
--   4. Added TEXT parameter length validation (HIGH #2)
--   5. Fixed SECURITY DEFINER + authenticated authorization bypass (CRITICAL #3)
--   6. Use SECURITY INVOKER to prevent privilege escalation
--   7. Only grant to service_role (not authenticated users)
CREATE OR REPLACE FUNCTION create_inbound_call_atomically(
  p_org_id UUID,
  p_vapi_call_id TEXT,
  p_agent_id UUID,
  p_phone_number TEXT,
  p_lead_id UUID,
  p_metadata JSONB DEFAULT NULL
) RETURNS TABLE (
  call_tracking_id UUID,
  call_logs_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_tracking_id UUID;
  v_logs_id UUID;
  v_error_msg TEXT;
  v_agent_exists BOOLEAN;
  v_vapi_call_normalized TEXT;
BEGIN
  BEGIN
    -- ===== CRITICAL FIX #1: Input Validation =====
    -- Verify all required parameters are present and valid
    IF p_org_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: org_id parameter is required and cannot be NULL';
    END IF;

    IF TRIM(COALESCE(p_vapi_call_id, '')) = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: vapi_call_id is required and cannot be empty string';
    END IF;

    IF p_agent_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: agent_id parameter is required and cannot be NULL';
    END IF;

    -- Normalize and validate vapi_call_id
    v_vapi_call_normalized := TRIM(p_vapi_call_id);

    -- ===== CRITICAL FIX #2: Length Validation =====
    -- Prevent database bloat from excessively large parameters
    IF LENGTH(v_vapi_call_normalized) > 256 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: vapi_call_id exceeds 256 character limit (received % chars)',
        LENGTH(v_vapi_call_normalized);
    END IF;

    -- ===== CRITICAL FIX #3: Agent Integrity Check =====
    -- Verify agent exists AND belongs to the specified organization
    -- Prevents orphaned records pointing to non-existent agents
    SELECT EXISTS(
      SELECT 1 FROM agents
      WHERE id = p_agent_id AND org_id = p_org_id AND deleted_at IS NULL
    ) INTO v_agent_exists;

    IF NOT v_agent_exists THEN
      RAISE EXCEPTION 'INTEGRITY_ERROR: Agent % does not exist in organization % or is deleted',
        p_agent_id::TEXT, p_org_id::TEXT;
    END IF;

    -- Step 1: Insert call_tracking record
    INSERT INTO call_tracking (
      org_id, agent_id, vapi_call_id, phone, status,
      called_at, metadata, created_at, updated_at
    ) VALUES (
      p_org_id, p_agent_id, v_vapi_call_normalized, p_phone_number, 'ringing',
      NOW(), COALESCE(p_metadata, '{}'), NOW(), NOW()
    )
    RETURNING id INTO v_tracking_id;

    -- Step 2: Insert call_logs record
    INSERT INTO call_logs (
      org_id, agent_id, vapi_call_id, lead_id, to_number,
      status, started_at, metadata, created_at, updated_at
    ) VALUES (
      p_org_id, p_agent_id, v_vapi_call_normalized, p_lead_id, p_phone_number,
      'in_progress', NOW(), COALESCE(p_metadata, '{}'), NOW(), NOW()
    )
    RETURNING id INTO v_logs_id;

    -- Both inserts succeeded
    RETURN QUERY SELECT v_tracking_id, v_logs_id, true, NULL::TEXT;

  EXCEPTION WHEN unique_violation THEN
    -- ===== CRITICAL FIX #4: Duplicate vapi_call_id Handling =====
    -- Distinguish between idempotent retry and collision in different org
    -- This allows webhook retries to succeed without duplicating data
    v_vapi_call_normalized := TRIM(COALESCE(p_vapi_call_id, ''));

    SELECT id INTO v_tracking_id
    FROM call_tracking
    WHERE vapi_call_id = v_vapi_call_normalized AND org_id = p_org_id AND deleted_at IS NULL
    LIMIT 1;

    IF v_tracking_id IS NOT NULL THEN
      -- Idempotent case: Call already created for this org with same vapi_call_id
      -- Return existing IDs with success flag to allow webhook retry to succeed
      SELECT id INTO v_logs_id
      FROM call_logs
      WHERE vapi_call_id = v_vapi_call_normalized AND org_id = p_org_id AND deleted_at IS NULL
      LIMIT 1;

      RETURN QUERY SELECT v_tracking_id, v_logs_id, true,
        'IDEMPOTENT_RETRY: Call already exists in system for this organization'::TEXT;
    ELSE
      -- Collision case: Same vapi_call_id exists in different org
      -- This indicates potential data corruption or ID collision risk
      v_error_msg := format(
        'COLLISION_ERROR: vapi_call_id %L already exists in different organization. ' ||
        'Possible ID collision or data corruption. SQLSTATE: %s Message: %s',
        v_vapi_call_normalized, SQLSTATE, SQLERRM
      );
      RETURN QUERY SELECT NULL::UUID, NULL::UUID, false, v_error_msg;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Any other error triggers auto-rollback of both inserts
    -- Format error message consistently for client parsing
    v_error_msg := format('DATABASE_ERROR_%s: %s', SQLSTATE, SQLERRM);
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, false, v_error_msg;
  END;
END $$
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public;

-- ===== CRITICAL FIX #5: Authorization Bypass Prevention =====
-- Changed from SECURITY DEFINER to SECURITY INVOKER
-- SECURITY INVOKER = function runs with CALLER privileges (not owner)
-- This prevents authenticated users from bypassing org_id checks
-- ONLY grant to service_role (removed authenticated from original)
-- Application layer MUST validate org_id ownership before calling this function
GRANT EXECUTE ON FUNCTION create_inbound_call_atomically(UUID, TEXT, UUID, TEXT, UUID, JSONB)
TO service_role;

-- ===== FUNCTION 2: Atomic Call Ended Handler =====
-- Updates call_logs and call_tracking in single atomic transaction
-- Ensures consistency if service crashes mid-operation
-- CRITICAL FIXES APPLIED:
--   1. Fixed error handling to require at least call_logs update (CRITICAL #2)
--   2. Improved error message formatting
--   3. Performance index verification documented
CREATE OR REPLACE FUNCTION update_call_completed_atomically(
  p_org_id UUID,
  p_vapi_call_id TEXT,
  p_duration_seconds INTEGER,
  p_call_tracking_id UUID DEFAULT NULL
) RETURNS TABLE (
  call_logs_updated BOOLEAN,
  call_tracking_updated BOOLEAN,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_logs_updated BOOLEAN := false;
  v_tracking_updated BOOLEAN := false;
  v_error_msg TEXT;
BEGIN
  BEGIN
    -- Input validation
    IF p_org_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: org_id is required';
    END IF;

    IF TRIM(COALESCE(p_vapi_call_id, '')) = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: vapi_call_id is required and cannot be empty';
    END IF;

    -- Normalize vapi_call_id
    p_vapi_call_id := TRIM(p_vapi_call_id);

    -- Step 1: Update call_logs with completion status
    -- This index lookup uses: idx_call_logs_org_vapi_call_id(org_id, vapi_call_id)
    UPDATE call_logs
    SET
      status = 'completed',
      ended_at = NOW(),
      duration_seconds = p_duration_seconds,
      updated_at = NOW()
    WHERE vapi_call_id = p_vapi_call_id
      AND org_id = p_org_id
      AND deleted_at IS NULL;

    v_logs_updated := FOUND;

    -- Step 2: Update call_tracking if tracking ID provided
    IF p_call_tracking_id IS NOT NULL THEN
      UPDATE call_tracking
      SET
        status = 'completed',
        ended_at = NOW(),
        duration_seconds = p_duration_seconds,
        answered = true,
        updated_at = NOW()
      WHERE id = p_call_tracking_id
        AND org_id = p_org_id
        AND deleted_at IS NULL;

      v_tracking_updated := FOUND;
    END IF;

    -- ===== CRITICAL FIX #2: Error Handling =====
    -- CRITICAL: Require at least call_logs to be updated
    -- If call_logs doesn't exist, return error instead of silent success
    -- This prevents client from assuming call was completed when it wasn't
    IF NOT v_logs_updated THEN
      RAISE EXCEPTION 'INTEGRITY_ERROR: No call_logs found for vapi_call_id % in organization %',
        p_vapi_call_id, p_org_id;
    END IF;

    -- Both updates succeeded (or tracking was not applicable)
    RETURN QUERY SELECT v_logs_updated, v_tracking_updated, true, NULL::TEXT;

  EXCEPTION WHEN OTHERS THEN
    -- Any error triggers auto-rollback of both updates
    v_error_msg := format('DATABASE_ERROR_%s: %s', SQLSTATE, SQLERRM);
    RETURN QUERY SELECT false, false, false, v_error_msg;
  END;
END $$
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public;

-- Only grant to service_role (prevents privilege escalation)
GRANT EXECUTE ON FUNCTION update_call_completed_atomically(UUID, TEXT, INTEGER, UUID)
TO service_role;

-- ===== FUNCTION 3: Atomic End-of-Call Report Handler =====
-- Updates call_logs and calls table in single atomic transaction
-- Ensures recording metadata is synchronized atomically
-- CRITICAL FIXES APPLIED:
--   1. Fixed NULL handling inconsistency (HIGH #3)
--   2. Always update calls table (not conditional on recording params)
--   3. Validate transcript length
CREATE OR REPLACE FUNCTION update_call_with_recording_atomically(
  p_org_id UUID,
  p_vapi_call_id TEXT,
  p_recording_url TEXT DEFAULT NULL,
  p_recording_storage_path TEXT DEFAULT NULL,
  p_transcript TEXT DEFAULT NULL,
  p_call_type TEXT DEFAULT NULL
) RETURNS TABLE (
  call_logs_updated BOOLEAN,
  calls_updated BOOLEAN,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_logs_updated BOOLEAN := false;
  v_calls_updated BOOLEAN := false;
  v_error_msg TEXT;
BEGIN
  BEGIN
    -- Input validation
    IF p_org_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: org_id is required';
    END IF;

    IF TRIM(COALESCE(p_vapi_call_id, '')) = '' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: vapi_call_id is required and cannot be empty';
    END IF;

    -- Normalize vapi_call_id
    p_vapi_call_id := TRIM(p_vapi_call_id);

    -- Validate transcript length to prevent database bloat
    IF LENGTH(COALESCE(p_transcript, '')) > 1000000 THEN  -- 1MB limit
      RAISE EXCEPTION 'VALIDATION_ERROR: transcript exceeds 1MB size limit';
    END IF;

    -- Step 1: Update call_logs with recording metadata
    UPDATE call_logs
    SET
      outcome = 'completed',
      recording_url = p_recording_url,
      recording_storage_path = p_recording_storage_path,
      transcript = p_transcript,
      updated_at = NOW()
    WHERE vapi_call_id = p_vapi_call_id
      AND org_id = p_org_id
      AND deleted_at IS NULL;

    v_logs_updated := FOUND;

    -- ===== CRITICAL FIX #3: NULL Handling Consistency =====
    -- ALWAYS update calls table (not conditional)
    -- This prevents data inconsistency where call_logs.outcome='completed'
    -- but calls.status remains NULL or outdated
    -- The conditional check previously prevented calls update if params were NULL
    -- Now we always mark call as completed regardless of recording status
    UPDATE calls
    SET
      call_type = COALESCE(p_call_type, call_type),
      recording_storage_path = COALESCE(p_recording_storage_path, recording_storage_path),
      status = 'completed',  -- ALWAYS update status, never conditional
      updated_at = NOW()
    WHERE vapi_call_id = p_vapi_call_id
      AND org_id = p_org_id
      AND deleted_at IS NULL;

    v_calls_updated := FOUND;

    -- Both updates succeeded
    RETURN QUERY SELECT v_logs_updated, v_calls_updated, true, NULL::TEXT;

  EXCEPTION WHEN OTHERS THEN
    -- Any error triggers auto-rollback of both updates
    v_error_msg := format('DATABASE_ERROR_%s: %s', SQLSTATE, SQLERRM);
    RETURN QUERY SELECT false, false, false, v_error_msg;
  END;
END $$
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public;

-- Only grant to service_role (prevents privilege escalation)
GRANT EXECUTE ON FUNCTION update_call_with_recording_atomically(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
TO service_role;

-- ===== REQUIRED INDEXES FOR PERFORMANCE =====
-- These indexes MUST exist for optimal performance
-- Verify they exist in migration: 20251221_add_org_id_not_null_constraints.sql
-- If missing, queries will degrade as table grows
-- Required indexes (performance optimizations):
-- - idx_call_logs_org_vapi_call_id(org_id, vapi_call_id) - for call_logs lookups
-- - idx_call_tracking_org_vapi_call_id(org_id, vapi_call_id) - for call_tracking lookups

-- ===== DOCUMENTATION =====
-- Usage in webhook handlers:
--
-- EXAMPLE 1: Atomic call creation (handleCallStarted)
-- SELECT * FROM create_inbound_call_atomically(
--   p_org_id := agent.org_id,
--   p_vapi_call_id := call.id,
--   p_agent_id := agent.id,
--   p_phone_number := call.customer?.number,
--   p_lead_id := lead?.id,
--   p_metadata := metadata_json
-- );
--
-- EXAMPLE 2: Atomic call completion (handleCallEnded)
-- SELECT * FROM update_call_completed_atomically(
--   p_org_id := org_id,
--   p_vapi_call_id := call.id,
--   p_duration_seconds := call.duration,
--   p_call_tracking_id := call_tracking.id
-- );
--
-- EXAMPLE 3: Atomic recording update (handleEndOfCallReport)
-- SELECT * FROM update_call_with_recording_atomically(
--   p_org_id := org_id,
--   p_vapi_call_id := call.id,
--   p_recording_url := signed_url,
--   p_recording_storage_path := storage_path,
--   p_transcript := artifact.transcript,
--   p_call_type := call_type
-- );
--
-- Benefits:
-- 1. All-or-nothing atomicity: Either all updates succeed or all rollback
-- 2. No orphaned records: If one table fails, other is automatically rolled back
-- 3. No race conditions: Transaction boundary prevents intermediate states
-- 4. Multi-tenant safety: org_id filter prevents cross-org updates
-- 5. Error handling: Returns success flag + error message for debugging
-- 6. Input validation: Required parameters verified before operations
-- 7. Authorization: SECURITY INVOKER prevents privilege escalation
-- 8. Idempotency: Duplicate calls handled gracefully

-- ===== CRITICAL FIXES SUMMARY =====
-- CRITICAL #1: Missing input validation - FIXED (lines 44-67)
-- CRITICAL #2: Incorrect error handling - FIXED (lines 181-184)
-- CRITICAL #3: SECURITY DEFINER + authenticated bypass - FIXED (SECURITY INVOKER + service_role only)
-- HIGH #1: Duplicate vapi_call_id handling - FIXED (lines 109-135)
-- HIGH #2: Text parameter length validation - FIXED (lines 60-63, 273-275)
-- HIGH #3: NULL handling inconsistency - FIXED (lines 309-318)
-- MEDIUM #2: Performance indexes - DOCUMENTED (lines 340-342)
-- Idempotency with graceful error messages - IMPLEMENTED

-- ===== VERSION HISTORY =====
-- v1.0 (2025-12-21): Initial atomic transaction functions for Phase 1 critical fixes
-- v1.1 (2025-12-21): Applied 8 critical/high priority security and logic fixes
