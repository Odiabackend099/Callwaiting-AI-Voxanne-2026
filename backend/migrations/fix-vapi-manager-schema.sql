-- Migration: Fix schema for Vapi Configuration Manager
-- Purpose: Add missing columns and update constraints for new endpoints
-- Date: 2025-12-11

-- ============================================================================
-- 1. ADD ORG_ID TO call_tracking TABLE
-- ============================================================================
-- This column is required for multi-org support and filtering metrics by organization

ALTER TABLE call_tracking
  ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_call_tracking_org ON call_tracking(org_id);

-- Backfill existing records with org_id from leads table
UPDATE call_tracking ct
SET org_id = l.org_id
FROM leads l
WHERE ct.lead_id = l.id AND ct.org_id IS NULL;

-- ============================================================================
-- 2. ADD ORG_ID TO call_logs TABLE
-- ============================================================================
-- This column is required for filtering recordings by organization

ALTER TABLE call_logs
  ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_call_logs_org ON call_logs(org_id);

-- Backfill existing records with org_id from leads table
UPDATE call_logs cl
SET org_id = l.org_id
FROM leads l
WHERE cl.lead_id = l.id AND cl.org_id IS NULL;

-- ============================================================================
-- 3. UPDATE call_outcome CHECK CONSTRAINT IN call_tracking
-- ============================================================================
-- Add new outcome values for test calls and in-progress states

ALTER TABLE call_tracking
  DROP CONSTRAINT IF EXISTS call_tracking_call_outcome_check;

ALTER TABLE call_tracking
  ADD CONSTRAINT call_tracking_call_outcome_check CHECK (call_outcome IN (
    'answered_interested',
    'answered_not_interested',
    'answered_callback_requested',
    'voicemail_left',
    'no_answer',
    'busy',
    'failed',
    'queued',
    'in_progress',
    'ringing'
  ));

-- ============================================================================
-- 4. VERIFY call_logs TABLE HAS REQUIRED COLUMNS
-- ============================================================================
-- These columns are expected by the recordings endpoint

-- Check if recording_url exists, add if missing
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- Check if to_number exists, add if missing
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS to_number TEXT;

-- Check if started_at exists, add if missing
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();

-- Check if duration_seconds exists, add if missing
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Check if transcript exists, add if missing
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS transcript TEXT;

-- Check if vapi_call_id exists, add if missing
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS vapi_call_id TEXT;

-- ============================================================================
-- 5. ADD MISSING COLUMNS TO AgentTab CONFIG
-- ============================================================================
-- Ensure agents table has firstMessage column for agent greetings

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS first_message TEXT DEFAULT 'Hello! This is CallWaiting AI calling...';

-- ============================================================================
-- 6. CREATE INDEX FOR PERFORMANCE
-- ============================================================================
-- Optimize queries for recordings by org_id and recording_url

CREATE INDEX IF NOT EXISTS idx_call_logs_recording_url ON call_logs(recording_url) WHERE recording_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_logs_vapi_call_id ON call_logs(vapi_call_id);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary of changes:
-- 1. ✓ Added org_id column to call_tracking table
-- 2. ✓ Added org_id column to call_logs table
-- 3. ✓ Updated call_outcome enum to include: queued, in_progress, ringing
-- 4. ✓ Verified all required columns exist in call_logs
-- 5. ✓ Added first_message column to agents table
-- 6. ✓ Created performance indexes

-- The following endpoints are now ready to use:
-- - POST /api/founder-console/vapi/validate
-- - POST /api/founder-console/test-call
-- - GET /api/founder-console/metrics/usage
-- - GET /api/founder-console/recordings
-- - DELETE /api/founder-console/recordings/:id
