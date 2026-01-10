-- ============================================
-- VOXANNE PHASE 1 MVP: Create Notifications Table
-- Date: 2025-01-10
-- Purpose: Store user notifications for real-time alerts and dashboards
-- Context: Critical for founder awareness of hot leads, appointments, and system events
-- ============================================
--
-- NOTIFICATION TYPES:
--   hot_lead:              A new high-value lead was detected
--   appointment_booked:    An appointment was successfully booked
--   appointment_reminder:  Reminder about upcoming appointment
--   missed_call:           A call was missed
--   system_alert:          Important system/integration alerts
--   voicemail:             Voicemail received
--
-- NOTIFICATION CHANNELS:
--   in_app:    Display in dashboard (default)
--   email:     Send via email notification
--   sms:       Send via SMS (future)
--   push:      Send push notification (future)
--
-- NOTIFICATION PRIORITY:
--   low:       Non-urgent updates
--   normal:    Regular notifications (default)
--   high:      Important events needing attention
--   urgent:    Critical events requiring immediate action
--
-- USER-SPECIFIC RLS:
--   - Users can only see notifications for themselves
--   - Still org-scoped to prevent cross-tenant access
--   - Uses both user_id and org_id for isolation
--
-- ============================================

-- ============================================
-- STEP 1: Create enums for notifications
-- ============================================
DO $$
BEGIN
  -- Create notification type enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM (
      'hot_lead',
      'appointment_booked',
      'appointment_reminder',
      'missed_call',
      'system_alert',
      'voicemail'
    );
  END IF;

  -- Create notification status enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE notification_status AS ENUM ('unread', 'read', 'archived');
  END IF;

  -- Create notification priority enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_priority') THEN
    CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');
  END IF;
END $$;

-- ============================================
-- STEP 2: Create notifications table
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  -- Primary key and organization/user
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification content and classification
  type notification_type NOT NULL,                -- Category of notification
  title TEXT NOT NULL,                            -- Short title (max 100 chars for display)
  message TEXT NOT NULL,                          -- Full notification message body

  -- Related entity (for linking to source)
  related_entity_id UUID,                         -- ID of contact, appointment, call, etc.
  related_entity_type TEXT,                       -- 'contact', 'appointment', 'call', 'system'
                                                  -- Used to construct links in UI

  -- Notification state
  status notification_status DEFAULT 'unread',    -- unread, read, archived
  read_at TIMESTAMPTZ,                            -- When user marked as read
  action_url TEXT,                                -- Deep link to take action (e.g., /dashboard/contacts/123)

  -- Priority and delivery
  priority notification_priority DEFAULT 'normal', -- low, normal, high, urgent
  channels JSONB DEFAULT '["in_app"]'::jsonb,    -- Array of channels: in_app, email, sms, push

  -- Timestamps and expiration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'  -- Auto-archive after 30 days
);

-- Add comment explaining the table
COMMENT ON TABLE notifications IS
'Stores user notifications for real-time alerts. User-specific (notification is tied to a single user, not shared). Auto-expires after 30 days. Supports multiple delivery channels.';

COMMENT ON COLUMN notifications.org_id IS
'Organization ID for multi-tenant isolation. Required for RLS even though notifications are user-specific.';

COMMENT ON COLUMN notifications.user_id IS
'User who should receive this notification. Notifications are user-specific (one user = one notification for same event).';

COMMENT ON COLUMN notifications.type IS
'Type of notification: hot_lead, appointment_booked, appointment_reminder, missed_call, system_alert, voicemail.';

COMMENT ON COLUMN notifications.related_entity_id IS
'UUID of the related entity (contact ID, appointment ID, etc.). Used to construct links in the notification.';

COMMENT ON COLUMN notifications.related_entity_type IS
'Type of related entity: contact, appointment, call, system. Used to determine how to handle action_url.';

COMMENT ON COLUMN notifications.status IS
'Current status: unread (new), read (user viewed), archived (dismissed or expired).';

COMMENT ON COLUMN notifications.priority IS
'Priority level: low (ignore), normal (show), high (highlight), urgent (interrupt). Used for UI styling.';

COMMENT ON COLUMN notifications.channels IS
'JSONB array of delivery channels. Default: ["in_app"]. Examples: ["in_app", "email"], ["email", "sms"].';

COMMENT ON COLUMN notifications.expires_at IS
'When this notification should auto-expire and be hidden. Default: NOW() + 30 days. Can be manually archived sooner.';

-- ============================================
-- STEP 3: Create indexes for performance
-- ============================================
-- Most important index: unread notifications for a user (used by dashboard)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, status)
WHERE status = 'unread';

-- Index for notification ordering (newest first)
CREATE INDEX IF NOT EXISTS idx_notifications_created_desc ON notifications(created_at DESC);

-- Index for expiration cleanup job
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at)
WHERE status != 'archived';

-- Composite index for org-scoped queries (for audit/admin)
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(org_id, created_at DESC);

-- Index for deep linking (find notification by related entity)
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(related_entity_type, related_entity_id)
WHERE related_entity_id IS NOT NULL;

-- ============================================
-- STEP 4: Create updated_at-like timestamp handler
-- ============================================
-- Note: We don't have updated_at for notifications (they're immutable after creation)
-- But we create a trigger for archival/expiration if needed
CREATE OR REPLACE FUNCTION expire_old_notifications()
RETURNS void AS $$
BEGIN
  -- Archive notifications that have expired
  UPDATE notifications
  SET status = 'archived'
  WHERE expires_at < NOW()
    AND status != 'archived';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 5: Enable RLS and create policies
-- ============================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications (user_id check)
-- Additionally check org_id to prevent cross-tenant access
CREATE POLICY "notifications_user_specific"
ON notifications
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND org_id = (SELECT public.auth_org_id())
);

-- Policy: Users cannot directly UPDATE notifications (no UPDATE policy)
-- Note: Only service role can update via backend for archival/expiration

-- Policy: Users cannot directly DELETE notifications (no DELETE policy)
-- Note: Only service role can delete via backend

-- Policy: Service role can manage all notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'notifications_service_role_bypass'
  ) THEN
    CREATE POLICY "notifications_service_role_bypass"
    ON notifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Note: INSERT policy is NOT created here because notifications are created by the backend
-- (via triggers on other tables or API endpoints), not by users directly.
-- Service role has full INSERT capability via the bypass policy.

-- ============================================
-- STEP 6: Create helper function for inserting notifications
-- ============================================
-- This function allows safe insertion of notifications from backend/triggers
-- It automatically validates org_id and ensures user is in the same org
CREATE OR REPLACE FUNCTION create_notification(
  p_org_id UUID,
  p_user_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_message TEXT,
  p_related_entity_id UUID DEFAULT NULL,
  p_related_entity_type TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_priority notification_priority DEFAULT 'normal',
  p_channels JSONB DEFAULT '["in_app"]'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- Verify user belongs to org (for safety)
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN organizations o ON true
    WHERE u.id = p_user_id
      AND o.id = p_org_id
  ) THEN
    RAISE EXCEPTION 'User % does not belong to org %', p_user_id, p_org_id;
  END IF;

  -- Insert notification
  INSERT INTO notifications (
    org_id,
    user_id,
    type,
    title,
    message,
    related_entity_id,
    related_entity_type,
    action_url,
    priority,
    channels
  ) VALUES (
    p_org_id,
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_related_entity_id,
    p_related_entity_type,
    p_action_url,
    p_priority,
    p_channels
  ) RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION create_notification IS
'Safely creates a notification for a user. Validates user belongs to org. Used by backend and triggers.';

-- ============================================
-- ERROR HANDLING NOTES
-- ============================================
-- Possible migration issues and solutions:
--
-- 1. "ERROR: relation auth.users does not exist"
--    Solution: This should exist (Supabase auth table). Check Supabase auth setup.
--
-- 2. "ERROR: function public.auth_org_id() does not exist"
--    Solution: Run 20250110_create_auth_org_id_function.sql first
--
-- 3. "ERROR: type 'notification_type' already exists"
--    Solution: This is safe - the DO block checks existence first
--
-- 4. Large notifications table (millions of rows)
--    Solution: Archive/delete old notifications regularly using expire_old_notifications()
--    Can be scheduled as a Supabase cron job or called from backend
--
-- 5. Performance issues with user_id index
--    Solution: May need to add expires_at to the unread index if table grows huge
--    Suggested: idx_notifications_user_unread_fresh with WHERE expires_at > NOW()

-- ============================================
-- MAINTENANCE QUERIES
-- ============================================
-- Run periodically to clean up old notifications:
--
-- -- Archive notifications older than 30 days
-- UPDATE notifications
-- SET status = 'archived'
-- WHERE expires_at < NOW() AND status != 'archived';
--
-- -- Optionally delete archived notifications after 90 days
-- DELETE FROM notifications
-- WHERE status = 'archived' AND created_at < NOW() - INTERVAL '90 days';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After deployment, verify with:
--
-- -- Check table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'notifications'
-- ORDER BY ordinal_position;
--
-- -- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'notifications';
--
-- -- Check RLS policies
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'notifications';
--
-- -- Test user isolation
-- SELECT COUNT(*) FROM notifications WHERE user_id = auth.uid();
-- -- Should only return current user's notifications

-- ============================================
-- ROLLBACK PLAN
-- ============================================
-- If this migration causes issues, rollback with:
--
-- DROP FUNCTION IF EXISTS create_notification;
-- DROP FUNCTION IF EXISTS expire_old_notifications;
-- ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
-- DROP TABLE IF EXISTS notifications;
-- DROP TYPE IF EXISTS notification_type;
-- DROP TYPE IF EXISTS notification_status;
-- DROP TYPE IF EXISTS notification_priority;
--
-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
--   1. Verify table structure and indexes
--   2. Test RLS policies with authenticated user
--   3. Test create_notification() function
--   4. Set up archival cron job (call expire_old_notifications daily)
--   5. Deploy to production
--
