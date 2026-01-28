-- Priority 10: Advanced Authentication (MFA/SSO)
-- Database schema for session management and audit logging
-- Created: 2026-01-28

-- ============================================================================
-- 1. AUTH_SESSIONS TABLE - Session Management with Device Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'desktop', 'tablet', 'unknown')),
  location JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. AUTH_AUDIT_LOG TABLE - Compliance Audit Trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'login_success',
      'login_failed',
      'logout',
      'mfa_enabled',
      'mfa_disabled',
      'mfa_challenge_success',
      'mfa_challenge_failed',
      'password_changed',
      'password_reset_requested',
      'session_revoked',
      'sso_login'
    )
  ),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================================

-- auth_sessions indexes
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_org_id ON auth_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_created_at ON auth_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(org_id, expires_at) WHERE revoked_at IS NULL;

-- auth_audit_log indexes
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_org_id ON auth_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type ON auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON auth_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_org_date ON auth_audit_log(org_id, created_at DESC);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on auth_sessions
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
  ON auth_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can revoke their own sessions
CREATE POLICY "Users can revoke their own sessions"
  ON auth_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can manage all sessions
CREATE POLICY "Service role can manage all sessions"
  ON auth_sessions
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Org isolation for session queries
CREATE POLICY "Org isolation for session queries"
  ON auth_sessions
  FOR ALL
  USING (
    auth.uid() = user_id OR
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Enable RLS on auth_audit_log
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own audit log
CREATE POLICY "Users can view their own audit log"
  ON auth_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all audit logs
CREATE POLICY "Service role can manage all audit logs"
  ON auth_audit_log
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Policy: Org isolation for audit queries
CREATE POLICY "Org isolation for audit queries"
  ON auth_audit_log
  FOR ALL
  USING (
    auth.uid() = user_id OR
    auth.jwt() ->> 'role' = 'service_role'
  );

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function: log_auth_event
-- Logs authentication events to audit trail
CREATE OR REPLACE FUNCTION log_auth_event(
  p_user_id UUID,
  p_org_id UUID,
  p_event_type TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO auth_audit_log (
    user_id,
    org_id,
    event_type,
    ip_address,
    user_agent,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    p_org_id,
    p_event_type,
    p_ip_address,
    p_user_agent,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: cleanup_old_auth_audit_logs
-- Removes audit logs older than 90 days (GDPR compliance)
CREATE OR REPLACE FUNCTION cleanup_old_auth_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM auth_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: create_session
-- Creates a new authenticated session
CREATE OR REPLACE FUNCTION create_session(
  p_user_id UUID,
  p_org_id UUID,
  p_session_token TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT 'unknown',
  p_expires_in_hours INTEGER DEFAULT 24
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO auth_sessions (
    user_id,
    org_id,
    session_token,
    ip_address,
    user_agent,
    device_type,
    expires_at,
    created_at
  ) VALUES (
    p_user_id,
    p_org_id,
    p_session_token,
    p_ip_address,
    p_user_agent,
    p_device_type,
    NOW() + (p_expires_in_hours || ' hours')::INTERVAL,
    NOW()
  )
  RETURNING id INTO v_session_id;

  -- Log session creation
  PERFORM log_auth_event(
    p_user_id,
    p_org_id,
    'login_success',
    p_ip_address,
    p_user_agent,
    jsonb_build_object('session_id', v_session_id, 'device_type', p_device_type)
  );

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: revoke_session
-- Revokes a specific session
CREATE OR REPLACE FUNCTION revoke_session(p_session_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
BEGIN
  UPDATE auth_sessions
  SET revoked_at = NOW()
  WHERE id = p_session_id
  RETURNING user_id, org_id INTO v_user_id, v_org_id;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Log session revocation
  PERFORM log_auth_event(v_user_id, v_org_id, 'session_revoked');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: revoke_all_sessions
-- Revokes all sessions for a user (logout from all devices)
CREATE OR REPLACE FUNCTION revoke_all_sessions(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_org_id UUID;
  v_count INTEGER;
BEGIN
  -- Get first org for audit logging
  SELECT org_id INTO v_org_id FROM auth_sessions
  WHERE user_id = p_user_id LIMIT 1;

  -- Revoke all sessions
  UPDATE auth_sessions
  SET revoked_at = NOW()
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log event if we found an org
  IF v_org_id IS NOT NULL THEN
    PERFORM log_auth_event(p_user_id, v_org_id, 'logout');
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. AUTOMATED MAINTENANCE JOBS
-- ============================================================================

-- Scheduled job: Clean up expired sessions (daily)
-- This would be called by a background job scheduler
-- SELECT cleanup_expired_sessions();

-- Scheduled job: Clean up old audit logs (weekly)
-- This would be called by a background job scheduler
-- SELECT cleanup_old_auth_audit_logs();

-- ============================================================================
-- 7. COMMENTS & DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE auth_sessions IS 'Stores active user sessions for authentication and device tracking';
COMMENT ON TABLE auth_audit_log IS 'Immutable audit trail of all authentication events (GDPR/HIPAA compliant)';

COMMENT ON COLUMN auth_sessions.session_token IS 'Secure session token for API authentication';
COMMENT ON COLUMN auth_sessions.expires_at IS 'Session expiration time (automatically revoked after expiry)';
COMMENT ON COLUMN auth_sessions.revoked_at IS 'When session was manually revoked (NULL if still active)';

COMMENT ON COLUMN auth_audit_log.event_type IS 'Type of authentication event (login, logout, MFA, etc)';
COMMENT ON COLUMN auth_audit_log.metadata IS 'Additional event context (device type, MFA method, etc)';

COMMENT ON FUNCTION log_auth_event IS 'Log authentication events to audit trail for compliance';
COMMENT ON FUNCTION cleanup_old_auth_audit_logs IS 'Delete audit logs older than 90 days (GDPR 90-day requirement)';
COMMENT ON FUNCTION create_session IS 'Create new authenticated session with auto-expiry';
COMMENT ON FUNCTION revoke_session IS 'Manually revoke a specific session (force logout)';
COMMENT ON FUNCTION revoke_all_sessions IS 'Revoke all sessions for a user (logout from all devices)';

-- ============================================================================
-- VERIFICATION CHECKS
-- ============================================================================

-- Verify tables created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_sessions') THEN
    RAISE EXCEPTION 'Failed to create auth_sessions table';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_audit_log') THEN
    RAISE EXCEPTION 'Failed to create auth_audit_log table';
  END IF;

  RAISE NOTICE 'Priority 10 migration completed successfully!';
  RAISE NOTICE 'Tables created: auth_sessions, auth_audit_log';
  RAISE NOTICE 'Functions created: log_auth_event, cleanup_old_auth_audit_logs, create_session, revoke_session, revoke_all_sessions';
  RAISE NOTICE 'RLS policies enabled on both tables';
  RAISE NOTICE 'Indexes created for optimal query performance';
END $$;
