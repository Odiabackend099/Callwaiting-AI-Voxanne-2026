-- Migration: Data Retention & GDPR Compliance
-- Date: 2026-01-28
-- Priority: 7 - HIPAA Compliance
--
-- Purpose: Add soft delete columns to support GDPR data deletion requests
-- while maintaining audit trails for compliance.
--
-- GDPR Requirements:
-- - Right to erasure (Article 17): Users can request deletion of their data
-- - Data retention: Records can be retained for legitimate business purposes
-- - Audit trail: Maintain logs of deletion requests for compliance verification
--
-- Implementation: Soft delete pattern
-- - deleted_at: Timestamp when record was marked for deletion (NULL = active)
-- - deleted_by: User ID who requested deletion (for audit trail)
-- - deletion_reason: Legal basis for retention vs. deletion
--
-- Cleanup Strategy:
-- - Immediate: Mark as deleted (user can no longer see data)
-- - 30 days: Hard delete from primary tables (background job)
-- - 7 years: Retain in audit_logs table (legal requirement)

BEGIN;

-- =====================================================================
-- 1. Add soft delete columns to call_logs table
-- =====================================================================
-- Contains call transcripts (PHI), recordings, customer phone numbers

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- Index for performance (filter out deleted records)
CREATE INDEX IF NOT EXISTS idx_call_logs_deleted_at
  ON call_logs(org_id, deleted_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN call_logs.deleted_at IS 'GDPR soft delete timestamp - NULL = active record';
COMMENT ON COLUMN call_logs.deleted_by IS 'User who requested deletion (audit trail)';
COMMENT ON COLUMN call_logs.deletion_reason IS 'Legal basis: gdpr_request, retention_expired, user_request';

-- =====================================================================
-- 2. Add soft delete columns to contacts table
-- =====================================================================
-- Contains personal data: name, phone, email, notes

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at
  ON contacts(org_id, deleted_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN contacts.deleted_at IS 'GDPR soft delete timestamp - NULL = active record';
COMMENT ON COLUMN contacts.deleted_by IS 'User who requested deletion (audit trail)';
COMMENT ON COLUMN contacts.deletion_reason IS 'Legal basis: gdpr_request, retention_expired, user_request';

-- =====================================================================
-- 3. Add soft delete columns to appointments table
-- =====================================================================
-- Contains PHI: appointment notes, health conditions discussed

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_deleted_at
  ON appointments(org_id, deleted_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN appointments.deleted_at IS 'GDPR soft delete timestamp - NULL = active record';
COMMENT ON COLUMN appointments.deleted_by IS 'User who requested deletion (audit trail)';
COMMENT ON COLUMN appointments.deletion_reason IS 'Legal basis: gdpr_request, retention_expired, user_request';

-- =====================================================================
-- 4. Add soft delete columns to messages table (SMS)
-- =====================================================================
-- Contains personal communications, appointment confirmations

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
  ON messages(org_id, deleted_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN messages.deleted_at IS 'GDPR soft delete timestamp - NULL = active record';
COMMENT ON COLUMN messages.deleted_by IS 'User who requested deletion (audit trail)';
COMMENT ON COLUMN messages.deletion_reason IS 'Legal basis: gdpr_request, retention_expired, user_request';

-- =====================================================================
-- 5. Add soft delete columns to call_transcripts table
-- =====================================================================
-- Contains PHI: conversation details, medical conditions

ALTER TABLE call_transcripts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

-- No org_id on this table, uses call_id foreign key
CREATE INDEX IF NOT EXISTS idx_call_transcripts_deleted_at
  ON call_transcripts(deleted_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN call_transcripts.deleted_at IS 'GDPR soft delete timestamp - NULL = active record';
COMMENT ON COLUMN call_transcripts.deleted_by IS 'User who requested deletion (audit trail)';
COMMENT ON COLUMN call_transcripts.deletion_reason IS 'Legal basis: gdpr_request, retention_expired, user_request';

-- =====================================================================
-- 6. Create data_deletion_requests tracking table
-- =====================================================================
-- Audit log of all GDPR deletion requests for compliance verification

CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),

  -- Request details
  requester_email TEXT NOT NULL,
  requester_phone TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by UUID REFERENCES auth.users(id), -- NULL if external request

  -- Scope of deletion
  scope TEXT NOT NULL CHECK (scope IN ('user_data', 'call_data', 'contact_data', 'all_data')),
  contact_id UUID REFERENCES contacts(id), -- If deleting specific contact
  phone_number TEXT, -- If deleting by phone number
  email TEXT, -- If deleting by email

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),

  -- Results
  records_deleted JSONB DEFAULT '{}', -- {"call_logs": 10, "contacts": 1, "messages": 5}
  error_message TEXT,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Compliance metadata
  legal_basis TEXT NOT NULL CHECK (legal_basis IN ('gdpr_article_17', 'ccpa_request', 'user_request', 'retention_policy')),
  verification_method TEXT, -- "email_confirmation", "phone_verification", "admin_approval"
  verification_code TEXT, -- For self-service deletion requests
  verified_at TIMESTAMPTZ
);

-- RLS Policy: Org isolation
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their deletion requests"
  ON data_deletion_requests
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM user_org_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can create deletion requests"
  ON data_deletion_requests
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM user_org_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Indexes for performance
CREATE INDEX idx_deletion_requests_org_status
  ON data_deletion_requests(org_id, status);

CREATE INDEX idx_deletion_requests_contact
  ON data_deletion_requests(contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX idx_deletion_requests_phone
  ON data_deletion_requests(phone_number)
  WHERE phone_number IS NOT NULL;

COMMENT ON TABLE data_deletion_requests IS 'GDPR Article 17 - Right to Erasure audit log';
COMMENT ON COLUMN data_deletion_requests.scope IS 'What data to delete: user_data, call_data, contact_data, all_data';
COMMENT ON COLUMN data_deletion_requests.legal_basis IS 'Legal framework: GDPR Article 17, CCPA, or internal policy';
COMMENT ON COLUMN data_deletion_requests.records_deleted IS 'JSON summary of deleted records per table';

-- =====================================================================
-- 7. Create helper function: Mark contact for deletion
-- =====================================================================
-- Soft delete contact and all associated data (calls, appointments, messages)

CREATE OR REPLACE FUNCTION mark_contact_for_deletion(
  p_contact_id UUID,
  p_org_id UUID,
  p_deleted_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'gdpr_request'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_counts JSONB := '{}';
  v_count INT;
BEGIN
  -- Mark contact as deleted
  UPDATE contacts
  SET
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    deletion_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_contact_id AND org_id = p_org_id AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := jsonb_build_object('contacts', v_count);

  -- Mark associated appointments as deleted
  UPDATE appointments
  SET
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    deletion_reason = p_reason
  WHERE contact_id = p_contact_id AND org_id = p_org_id AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('appointments', v_count);

  -- Mark associated call logs as deleted
  UPDATE call_logs
  SET
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    deletion_reason = p_reason
  WHERE
    (lead_id IN (SELECT id FROM leads WHERE contact_id = p_contact_id)
     OR to_number IN (SELECT phone FROM contacts WHERE id = p_contact_id))
    AND org_id = p_org_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('call_logs', v_count);

  -- Mark associated messages as deleted
  UPDATE messages
  SET
    deleted_at = NOW(),
    deleted_by = p_deleted_by,
    deletion_reason = p_reason
  WHERE
    to_number IN (SELECT phone FROM contacts WHERE id = p_contact_id)
    AND org_id = p_org_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('messages', v_count);

  RETURN v_deleted_counts;
END;
$$;

COMMENT ON FUNCTION mark_contact_for_deletion IS 'GDPR-compliant soft delete: marks contact and associated data for deletion';

-- =====================================================================
-- 8. Create helper function: Hard delete expired records
-- =====================================================================
-- Permanently delete records marked for deletion > 30 days ago
-- Called by background job (cron)

CREATE OR REPLACE FUNCTION hard_delete_expired_records(
  p_retention_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ := NOW() - (p_retention_days || ' days')::INTERVAL;
  v_deleted_counts JSONB := '{}';
  v_count INT;
BEGIN
  -- Hard delete call_transcripts (permanent)
  DELETE FROM call_transcripts
  WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := jsonb_build_object('call_transcripts', v_count);

  -- Hard delete messages (permanent)
  DELETE FROM messages
  WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('messages', v_count);

  -- Hard delete appointments (permanent)
  DELETE FROM appointments
  WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('appointments', v_count);

  -- Hard delete call_logs (permanent)
  DELETE FROM call_logs
  WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('call_logs', v_count);

  -- Hard delete contacts (permanent)
  DELETE FROM contacts
  WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted_counts := v_deleted_counts || jsonb_build_object('contacts', v_count);

  RETURN v_deleted_counts;
END;
$$;

COMMENT ON FUNCTION hard_delete_expired_records IS 'Permanently delete records soft-deleted > 30 days ago (GDPR cleanup)';

-- =====================================================================
-- 9. Update RLS policies to respect soft deletes
-- =====================================================================
-- Ensure deleted records are not returned in normal queries

-- Drop and recreate RLS policies for call_logs
DROP POLICY IF EXISTS "Org members can view call logs" ON call_logs;
CREATE POLICY "Org members can view active call logs"
  ON call_logs
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM user_org_roles
      WHERE user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );

-- Drop and recreate RLS policies for contacts
DROP POLICY IF EXISTS "Org members can view contacts" ON contacts;
CREATE POLICY "Org members can view active contacts"
  ON contacts
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM user_org_roles
      WHERE user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );

-- Drop and recreate RLS policies for appointments
DROP POLICY IF EXISTS "Org members can view appointments" ON appointments;
CREATE POLICY "Org members can view active appointments"
  ON appointments
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM user_org_roles
      WHERE user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );

-- Drop and recreate RLS policies for messages
DROP POLICY IF EXISTS "Org members can view messages" ON messages;
CREATE POLICY "Org members can view active messages"
  ON messages
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM user_org_roles
      WHERE user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );

-- =====================================================================
-- 10. Verification queries
-- =====================================================================

-- Verify columns were added
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name = 'call_logs' AND column_name = 'deleted_at') = 1,
    'call_logs.deleted_at column missing';

  ASSERT (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name = 'contacts' AND column_name = 'deleted_at') = 1,
    'contacts.deleted_at column missing';

  ASSERT (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name = 'appointments' AND column_name = 'deleted_at') = 1,
    'appointments.deleted_at column missing';

  ASSERT (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name = 'messages' AND column_name = 'deleted_at') = 1,
    'messages.deleted_at column missing';

  ASSERT (SELECT COUNT(*) FROM information_schema.tables
          WHERE table_name = 'data_deletion_requests') = 1,
    'data_deletion_requests table missing';

  RAISE NOTICE 'Data retention migration applied successfully';
END $$;

COMMIT;

-- =====================================================================
-- Usage Examples
-- =====================================================================

-- Example 1: Soft delete a contact (GDPR request)
-- SELECT mark_contact_for_deletion(
--   p_contact_id := '123e4567-e89b-12d3-a456-426614174000',
--   p_org_id := '789e4567-e89b-12d3-a456-426614174000',
--   p_deleted_by := auth.uid(),
--   p_reason := 'gdpr_request'
-- );

-- Example 2: Hard delete expired records (run daily via cron)
-- SELECT hard_delete_expired_records(30);

-- Example 3: Query active records (deleted_at IS NULL filter automatic via RLS)
-- SELECT * FROM contacts WHERE org_id = 'xxx'; -- Only returns non-deleted

-- Example 4: View all deletion requests for compliance audit
-- SELECT * FROM data_deletion_requests
-- WHERE org_id = 'xxx'
-- ORDER BY requested_at DESC;
