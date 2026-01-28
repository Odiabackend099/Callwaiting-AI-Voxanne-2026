# Priority 10: Advanced Authentication (MFA, SSO) - Implementation Plan

**Created:** 2026-01-28  
**Status:** Planning Phase  
**Estimated Effort:** 3-4 days (compressed to 1 day for MVP)  
**Risk Level:** Low (Supabase handles complexity)

---

## Executive Summary

Priority 10 implements advanced authentication features required for enterprise customers:
- **Multi-Factor Authentication (MFA)** for enhanced security
- **Single Sign-On (SSO)** with Google Workspace for enterprise integration
- **Session Management** for security and compliance
- **Authentication Audit Logging** for compliance and debugging

---

## Business Value

### Quantifiable Benefits
- **Security Posture:** +50% (MFA reduces account takeover by 99.9%)
- **Enterprise Sales:** Unlocks $100K+ deals (MFA/SSO are table stakes)
- **Compliance:** Meets SOC 2, ISO 27001 requirements
- **User Experience:** SSO reduces login friction for enterprise teams

### Strategic Benefits
- **Competitive Advantage:** Match enterprise competitors (Salesforce, HubSpot)
- **Customer Trust:** Demonstrates security commitment
- **Regulatory Compliance:** HIPAA, GDPR, SOC 2 requirements
- **Team Collaboration:** SSO enables seamless team access

---

## Phase 1: Multi-Factor Authentication (MFA)

### Objectives
- Enable TOTP-based MFA via Supabase Auth
- Add MFA enrollment flow in dashboard
- Enforce MFA for admin users
- Add MFA recovery codes

### Implementation

#### 1.1 Enable MFA in Supabase Dashboard

**Steps:**
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Phone" provider (for SMS-based MFA)
3. Enable "Authenticator App" (TOTP)
4. Configure MFA settings:
   - Require MFA for admin roles: ✅
   - Allow users to disable MFA: ❌
   - MFA challenge timeout: 5 minutes

#### 1.2 Frontend MFA Enrollment Flow

**File:** `src/components/auth/MFAEnrollment.tsx`

```typescript
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import QRCode from 'qrcode.react';

export function MFAEnrollment() {
  const [qrCode, setQRCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [step, setStep] = useState<'enroll' | 'verify' | 'complete'>('enroll');

  const enrollMFA = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
    });

    if (error) {
      console.error('MFA enrollment failed:', error);
      return;
    }

    setQRCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStep('verify');
  };

  const verifyMFA = async () => {
    const { data, error } = await supabase.auth.mfa.challenge({
      factorId: secret,
    });

    if (error) {
      console.error('MFA verification failed:', error);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: secret,
      challengeId: data.id,
      code: verificationCode,
    });

    if (verifyError) {
      console.error('MFA code verification failed:', verifyError);
      return;
    }

    // Generate recovery codes
    const codes = generateRecoveryCodes(10);
    setRecoveryCodes(codes);
    setStep('complete');
  };

  return (
    <div className="mfa-enrollment">
      {step === 'enroll' && (
        <div>
          <h2>Enable Two-Factor Authentication</h2>
          <p>Secure your account with an authenticator app</p>
          <button onClick={enrollMFA}>Get Started</button>
        </div>
      )}

      {step === 'verify' && (
        <div>
          <h2>Scan QR Code</h2>
          <QRCode value={qrCode} size={256} />
          <p>Secret: {secret}</p>
          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
          />
          <button onClick={verifyMFA}>Verify</button>
        </div>
      )}

      {step === 'complete' && (
        <div>
          <h2>MFA Enabled Successfully!</h2>
          <h3>Recovery Codes</h3>
          <p>Save these codes in a safe place. Each can be used once.</p>
          <ul>
            {recoveryCodes.map((code, i) => (
              <li key={i}>{code}</li>
            ))}
          </ul>
          <button onClick={() => downloadRecoveryCodes(recoveryCodes)}>
            Download Codes
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 1.3 MFA Challenge Flow

**File:** `src/components/auth/MFAChallenge.tsx`

```typescript
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export function MFAChallenge({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const verifyCode = async () => {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp[0];

    if (!totpFactor) {
      setError('MFA not configured');
      return;
    }

    const { data: challenge } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setError('Invalid code. Please try again.');
      return;
    }

    onSuccess();
  };

  return (
    <div className="mfa-challenge">
      <h2>Two-Factor Authentication</h2>
      <p>Enter the 6-digit code from your authenticator app</p>
      <input
        type="text"
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={6}
      />
      {error && <p className="error">{error}</p>}
      <button onClick={verifyCode}>Verify</button>
    </div>
  );
}
```

---

## Phase 2: Single Sign-On (SSO) with Google Workspace

### Objectives
- Configure Google Workspace SSO
- Add SSO login button
- Map Google Workspace users to organizations
- Handle SSO errors gracefully

### Implementation

#### 2.1 Configure Google OAuth in Supabase

**Steps:**
1. Go to Supabase Dashboard → Authentication → Providers
2. Enable "Google" provider
3. Configure OAuth settings:
   - Client ID: (from Google Cloud Console)
   - Client Secret: (from Google Cloud Console)
   - Authorized redirect URIs: `https://[project-ref].supabase.co/auth/v1/callback`
   - Scopes: `openid email profile`

#### 2.2 Google Cloud Console Setup

**Steps:**
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized JavaScript origins: `https://voxanne.ai`
5. Authorized redirect URIs: `https://[project-ref].supabase.co/auth/v1/callback`
6. Copy Client ID and Client Secret

#### 2.3 Frontend SSO Login Button

**File:** `src/components/auth/SSOLogin.tsx`

```typescript
'use client';

import { supabase } from '@/lib/supabase';

export function SSOLogin() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          hd: 'yourdomain.com', // Optional: restrict to specific domain
        },
      },
    });

    if (error) {
      console.error('SSO login failed:', error);
    }
  };

  return (
    <button onClick={signInWithGoogle} className="sso-button">
      <img src="/google-icon.svg" alt="Google" />
      Sign in with Google
    </button>
  );
}
```

#### 2.4 SSO Callback Handler

**File:** `src/app/auth/callback/route.ts`

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
```

---

## Phase 3: Session Management & Audit Logging

### Objectives
- Track active sessions
- Force logout capability
- Concurrent session limits
- Authentication audit log

### Implementation

#### 3.1 Session Tracking Table

**File:** `backend/supabase/migrations/20260128_create_auth_sessions.sql`

```sql
-- Active sessions table
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  device_type TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

-- Indexes
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_org_id ON auth_sessions(org_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX idx_auth_sessions_active ON auth_sessions(user_id, revoked_at) WHERE revoked_at IS NULL;

-- RLS
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON auth_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage sessions"
  ON auth_sessions FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Authentication audit log
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
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
  )),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_org_id ON auth_audit_log(org_id);
CREATE INDEX idx_auth_audit_log_event_type ON auth_audit_log(event_type);
CREATE INDEX idx_auth_audit_log_created_at ON auth_audit_log(created_at DESC);

-- RLS
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit log"
  ON auth_audit_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage audit log"
  ON auth_audit_log FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Helper function to log auth events
CREATE OR REPLACE FUNCTION log_auth_event(
  p_user_id UUID,
  p_org_id UUID,
  p_event_type TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO auth_audit_log (user_id, org_id, event_type, ip_address, user_agent, metadata)
  VALUES (p_user_id, p_org_id, p_event_type, p_ip_address, p_user_agent, p_metadata);
END;
$$ LANGUAGE plpgsql;

-- Cleanup old audit logs (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_auth_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM auth_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

#### 3.2 Session Management Service

**File:** `backend/src/services/session-management.ts`

```typescript
import { supabase } from '../config/supabase';

export class SessionManagementService {
  /**
   * Get active sessions for user
   */
  static async getActiveSessions(userId: string) {
    const { data, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('last_activity_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    return data;
  }

  /**
   * Revoke session (force logout)
   */
  static async revokeSession(sessionId: string, reason: string) {
    const { error } = await supabase
      .from('auth_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: reason,
      })
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to revoke session: ${error.message}`);
    }
  }

  /**
   * Revoke all sessions for user (except current)
   */
  static async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    const { error } = await supabase
      .from('auth_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revoked_reason: 'User logged out from all devices',
      })
      .eq('user_id', userId)
      .neq('id', currentSessionId)
      .is('revoked_at', null);

    if (error) {
      throw new Error(`Failed to revoke sessions: ${error.message}`);
    }
  }

  /**
   * Log authentication event
   */
  static async logAuthEvent(
    userId: string,
    orgId: string,
    eventType: string,
    metadata?: any
  ) {
    const { error } = await supabase.rpc('log_auth_event', {
      p_user_id: userId,
      p_org_id: orgId,
      p_event_type: eventType,
      p_metadata: metadata,
    });

    if (error) {
      console.error('Failed to log auth event:', error);
    }
  }
}
```

---

## Testing Strategy

### Automated Tests

1. **MFA Enrollment Test:**
   - Verify QR code generation
   - Test code verification
   - Verify recovery codes generated

2. **MFA Challenge Test:**
   - Test valid code acceptance
   - Test invalid code rejection
   - Test recovery code usage

3. **SSO Login Test:**
   - Verify OAuth redirect
   - Test callback handling
   - Verify user creation/mapping

4. **Session Management Test:**
   - Test session creation
   - Test session revocation
   - Test concurrent session limits

5. **Audit Logging Test:**
   - Verify events logged
   - Test log retention
   - Verify RLS policies

### Manual Tests

1. **MFA Flow:**
   - Enroll with Google Authenticator
   - Login with MFA code
   - Use recovery code

2. **SSO Flow:**
   - Login with Google Workspace
   - Verify org mapping
   - Test SSO errors

3. **Session Management:**
   - View active sessions
   - Revoke specific session
   - Logout from all devices

---

## Success Criteria

### Phase 1: MFA
- ✅ MFA enrollment flow works
- ✅ MFA challenge on login works
- ✅ Recovery codes generated and work
- ✅ Admin users can enforce MFA

### Phase 2: SSO
- ✅ Google Workspace SSO works
- ✅ Users mapped to correct organization
- ✅ SSO errors handled gracefully
- ✅ SSO login button visible

### Phase 3: Session Management
- ✅ Active sessions tracked
- ✅ Force logout works
- ✅ Audit log captures all events
- ✅ Old logs cleaned up automatically

---

## Timeline

**Day 1 (Today):**
- ✅ Planning document created
- ⏳ Phase 1: MFA implementation (4 hours)
- ⏳ Phase 2: SSO configuration (2 hours)
- ⏳ Phase 3: Session management (2 hours)

**Day 2:**
- Test all components
- Run automated test suite
- Document in claude.md

**Day 3:**
- First production deployment
- Monitor and iterate

---

## Risk Mitigation

**Risk 1: MFA Lockout**
- Mitigation: Recovery codes, admin override
- Fallback: Email-based recovery

**Risk 2: SSO Configuration Errors**
- Mitigation: Test with test Google Workspace account
- Fallback: Password login always available

**Risk 3: Session Management Overhead**
- Mitigation: Efficient indexes, cleanup jobs
- Fallback: Disable session tracking if performance issues

---

## Next Steps After Priority 10

1. **Ongoing:** Monitor authentication metrics
2. **Ongoing:** Refine MFA/SSO based on user feedback
3. **Future:** Add SAML support for enterprise SSO
4. **Future:** Add biometric authentication
5. **Future:** Add passwordless authentication (magic links)
