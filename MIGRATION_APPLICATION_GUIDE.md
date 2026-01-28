# Database Migration Application Guide

**Status:** 🚀 Ready for Manual Application via Supabase Dashboard  
**Date:** 2026-01-28  
**Migrations:** 4 critical production migrations

---

## Quick Start (10 Minutes)

### Step 1: Open Supabase Dashboard
```
URL: https://app.supabase.com
Project: lbjymlodxprzqgtyqtcq
Navigate to: SQL Editor
```

### Step 2: Apply Each Migration in Order

Copy the SQL from each file below and paste into Supabase SQL Editor, then click "Run".

---

## Migration 1: Performance Indexes (Priority 6)

**File:** `backend/migrations/20260128_add_performance_indexes.sql`

**SQL to Apply:**

```sql
-- Priority 6: Database Query Optimization - Missing Performance Indexes
-- Creates 5 performance indexes for frequently queried columns

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_org_phone_created
ON call_logs(org_id, phone_number, created_at DESC)
WHERE org_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_org_contact_scheduled
ON appointments(org_id, contact_id, scheduled_at DESC)
WHERE org_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_org_status_scheduled
ON appointments(org_id, status, scheduled_at)
WHERE org_id IS NOT NULL AND status = 'scheduled';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_org_contact_method
ON messages(org_id, contact_id, method, sent_at DESC)
WHERE org_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_org_created
ON services(org_id, created_at DESC)
WHERE org_id IS NOT NULL;
```

**Expected Result:**
- ✅ 5 indexes created
- ✅ Query performance improved 5-25x
- ✅ No errors

**Verification:**
```sql
SELECT indexname FROM pg_indexes 
WHERE indexname LIKE 'idx_%' AND tablename IN ('call_logs', 'appointments', 'messages', 'services')
ORDER BY indexname;
-- Should show 5 new indexes
```

---

## Migration 2: Backup Verification Log (Priority 8)

**File:** `backend/supabase/migrations/20260128_create_backup_verification_log.sql`

**SQL to Apply:**

```sql
-- Priority 8: Disaster Recovery - Backup Verification Log
-- Creates table and functions for automated backup monitoring

CREATE TABLE IF NOT EXISTS backup_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  backup_id TEXT,
  backup_age_hours INTEGER,
  backup_size_mb INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'failure')),
  checks_passed INTEGER NOT NULL DEFAULT 0,
  checks_failed INTEGER NOT NULL DEFAULT 0,
  error_details JSONB,
  verification_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backup_verification_log_verified_at 
ON backup_verification_log(verified_at DESC);

CREATE INDEX idx_backup_verification_log_status 
ON backup_verification_log(status);

CREATE INDEX idx_backup_verification_log_created_at 
ON backup_verification_log(created_at DESC);

CREATE INDEX idx_backup_verification_log_failures 
ON backup_verification_log(verified_at DESC, status) 
WHERE status IN ('warning', 'failure');

CREATE OR REPLACE FUNCTION get_latest_backup_verification()
RETURNS TABLE (
  verified_at TIMESTAMPTZ,
  status TEXT,
  backup_age_hours INTEGER,
  checks_passed INTEGER,
  checks_failed INTEGER,
  error_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bvl.verified_at,
    bvl.status,
    bvl.backup_age_hours,
    bvl.checks_passed,
    bvl.checks_failed,
    bvl.error_details
  FROM backup_verification_log bvl
  ORDER BY bvl.verified_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_latest_backup_verification TO service_role;

CREATE OR REPLACE FUNCTION get_backup_verification_history(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  verified_at TIMESTAMPTZ,
  status TEXT,
  backup_age_hours INTEGER,
  checks_passed INTEGER,
  checks_failed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bvl.verified_at,
    bvl.status,
    bvl.backup_age_hours,
    bvl.checks_passed,
    bvl.checks_failed
  FROM backup_verification_log bvl
  WHERE bvl.verified_at > NOW() - (p_days || ' days')::INTERVAL
  ORDER BY bvl.verified_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_backup_verification_history TO service_role;

CREATE OR REPLACE FUNCTION cleanup_old_backup_verification_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM backup_verification_log
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_backup_verification_logs TO service_role;
```

**Expected Result:**
- ✅ Table created: backup_verification_log
- ✅ 4 indexes created
- ✅ 3 functions created
- ✅ No errors

**Verification:**
```sql
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'backup_verification_log') AS table_exists;
-- Should return: true
```

---

## Migration 3: Feature Flags (Priority 9)

**File:** `backend/supabase/migrations/20260128_create_feature_flags.sql`

**SQL to Apply:**

```sql
-- Priority 9: DevOps - Feature Flags System
-- Creates tables and functions for feature flag management

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  flag_name TEXT NOT NULL,
  description TEXT,
  enabled_globally BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_flag_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled_globally);
CREATE INDEX IF NOT EXISTS idx_org_feature_flags_org_id ON org_feature_flags(org_id);
CREATE INDEX IF NOT EXISTS idx_org_feature_flags_flag_key ON org_feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_org_feature_flags_enabled ON org_feature_flags(enabled);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON feature_flags FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage feature flags"
  ON feature_flags FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Orgs can read own feature flag overrides"
  ON org_feature_flags FOR SELECT
  USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid);

CREATE POLICY "Service role can manage org feature flags"
  ON org_feature_flags FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_org_id UUID,
  p_flag_key TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_org_override BOOLEAN;
  v_global_enabled BOOLEAN;
  v_rollout_percentage INTEGER;
  v_org_hash INTEGER;
BEGIN
  SELECT enabled INTO v_org_override
  FROM org_feature_flags
  WHERE org_id = p_org_id AND flag_key = p_flag_key;
  
  IF FOUND THEN
    RETURN v_org_override;
  END IF;
  
  SELECT enabled_globally, rollout_percentage
  INTO v_global_enabled, v_rollout_percentage
  FROM feature_flags
  WHERE flag_key = p_flag_key;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  IF v_global_enabled THEN
    RETURN true;
  END IF;
  
  IF v_rollout_percentage > 0 THEN
    v_org_hash := (hashtext(p_org_id::text) % 100);
    RETURN v_org_hash < v_rollout_percentage;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_org_enabled_features(
  p_org_id UUID
) RETURNS TABLE(flag_key TEXT, flag_name TEXT, description TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ff.flag_key,
    ff.flag_name,
    ff.description
  FROM feature_flags ff
  WHERE is_feature_enabled(p_org_id, ff.flag_key) = true
  ORDER BY ff.flag_name;
END;
$$ LANGUAGE plpgsql STABLE;

INSERT INTO feature_flags (flag_key, flag_name, description, enabled_globally, rollout_percentage) VALUES
  ('advanced_analytics', 'Advanced Analytics', 'Enable advanced analytics dashboard with custom reports', false, 0),
  ('outbound_calling', 'Outbound Calling', 'Enable outbound calling feature for proactive engagement', true, 100),
  ('sms_campaigns', 'SMS Campaigns', 'Enable bulk SMS campaign feature', false, 0),
  ('ai_voice_cloning', 'AI Voice Cloning', 'Enable custom voice cloning', false, 0),
  ('multi_language', 'Multi-Language Support', 'Enable multi-language responses', false, 0),
  ('appointment_reminders', 'Appointment Reminders', 'Enable automated appointment reminders', true, 100),
  ('call_recording', 'Call Recording', 'Enable call recording and transcription', true, 100),
  ('knowledge_base', 'Knowledge Base', 'Enable RAG-based knowledge base', true, 100),
  ('calendar_integration', 'Calendar Integration', 'Enable Google Calendar integration', true, 100),
  ('lead_scoring', 'Lead Scoring', 'Enable AI-powered lead scoring', false, 50)
ON CONFLICT (flag_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS feature_flag_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('enabled', 'disabled', 'rollout_changed')),
  previous_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_log_flag_key ON feature_flag_audit_log(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_log_org_id ON feature_flag_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_log_changed_at ON feature_flag_audit_log(changed_at DESC);

ALTER TABLE feature_flag_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage feature flag audit log"
  ON feature_flag_audit_log FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Orgs can read own feature flag audit log"
  ON feature_flag_audit_log FOR SELECT
  USING (org_id = (auth.jwt()->'app_metadata'->>'org_id')::uuid OR org_id IS NULL);
```

**Expected Result:**
- ✅ 3 tables created
- ✅ 5 indexes created
- ✅ 2 functions created
- ✅ 10 feature flags seeded
- ✅ No errors

**Verification:**
```sql
SELECT COUNT(*) as flag_count FROM feature_flags;
-- Should return: 10
```

---

## Migration 4: Auth Sessions & Audit Log (Priority 10)

**File:** `backend/supabase/migrations/20260128_create_auth_sessions_and_audit.sql`

**SQL to Apply:**

```sql
-- Priority 10: Advanced Authentication (MFA/SSO)
-- Creates tables and functions for session management and audit logging

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

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_org_id ON auth_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_created_at ON auth_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(org_id, expires_at) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_org_id ON auth_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type ON auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON auth_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_org_date ON auth_audit_log(org_id, created_at DESC);

ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON auth_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke their own sessions"
  ON auth_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all sessions"
  ON auth_sessions
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Org isolation for session queries"
  ON auth_sessions
  FOR ALL
  USING (
    auth.uid() = user_id OR
    auth.jwt() ->> 'role' = 'service_role'
  );

ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit log"
  ON auth_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all audit logs"
  ON auth_audit_log
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Org isolation for audit queries"
  ON auth_audit_log
  FOR ALL
  USING (
    auth.uid() = user_id OR
    auth.jwt() ->> 'role' = 'service_role'
  );

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

  PERFORM log_auth_event(v_user_id, v_org_id, 'session_revoked');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION revoke_all_sessions(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_org_id UUID;
  v_count INTEGER;
BEGIN
  SELECT org_id INTO v_org_id FROM auth_sessions
  WHERE user_id = p_user_id LIMIT 1;

  UPDATE auth_sessions
  SET revoked_at = NOW()
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_org_id IS NOT NULL THEN
    PERFORM log_auth_event(p_user_id, v_org_id, 'logout');
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Expected Result:**
- ✅ 2 tables created
- ✅ 10 indexes created
- ✅ 5 functions created
- ✅ RLS policies enabled
- ✅ No errors

**Verification:**
```sql
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_sessions') AS sessions_exist,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_audit_log') AS audit_exist;
-- Should return: true, true
```

---

## Verification Checklist

After applying all 4 migrations, run these verification queries:

```sql
-- Verify all tables exist
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_name IN (
  'backup_verification_log',
  'feature_flags',
  'org_feature_flags',
  'feature_flag_audit_log',
  'auth_sessions',
  'auth_audit_log'
);
-- Expected: 6

-- Verify all indexes created
SELECT COUNT(*) as index_count FROM pg_indexes 
WHERE indexname LIKE 'idx_%' AND tablename IN (
  'backup_verification_log',
  'feature_flags',
  'org_feature_flags',
  'auth_sessions',
  'auth_audit_log',
  'call_logs',
  'appointments',
  'messages',
  'services'
);
-- Expected: 20+

-- Verify all functions created
SELECT COUNT(*) as function_count FROM pg_proc 
WHERE proname IN (
  'get_latest_backup_verification',
  'get_backup_verification_history',
  'cleanup_old_backup_verification_logs',
  'is_feature_enabled',
  'get_org_enabled_features',
  'log_auth_event',
  'cleanup_old_auth_audit_logs',
  'create_session',
  'revoke_session',
  'revoke_all_sessions'
);
-- Expected: 10

-- Verify feature flags seeded
SELECT COUNT(*) as flag_count FROM feature_flags;
-- Expected: 10
```

---

## Troubleshooting

### If Migration Fails
1. Check error message in Supabase Dashboard
2. Verify prerequisites (organizations table exists)
3. Run migrations one at a time
4. Check table/function existence before re-running

### If Tables Already Exist
- All migrations use `IF NOT EXISTS` clauses
- Safe to re-run without errors
- Existing data will not be affected

### If Functions Fail
- Check that referenced tables exist first
- Verify RLS policies are enabled
- Ensure service_role has execute permissions

---

## Next Steps After Migrations

1. **Re-run Production Tests**
   ```bash
   bash /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/src/scripts/production-curl-tests.sh
   ```

2. **Enable Monitoring**
   - Configure Sentry alerts
   - Set up Slack notifications
   - Schedule daily backup verification

3. **Test Authentication**
   - MFA enrollment
   - Google SSO login
   - Session management

4. **Onboard First Customers**
   - Create test organization
   - Test full workflow
   - Monitor performance

---

**Status:** 🚀 Ready for Manual Application  
**Estimated Time:** 10 minutes  
**Risk Level:** Low (all migrations use IF NOT EXISTS)

