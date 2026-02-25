# Voxanne AI Authentication: Top 5 Critical Fixes

## Quick Summary

| Priority | Issue | Severity | Impact | ETA |
|----------|-------|----------|--------|-----|
| 1️⃣ | no_org error not displayed | 🔴 CRITICAL | Users stuck in redirect loop | 1h |
| 2️⃣ | Org created before email confirmed | 🔴 CRITICAL | Unconfirmed users trapped forever | 2h |
| 3️⃣ | Network errors show generic message | 🟡 HIGH | User confusion about signup status | 1.5h |
| 4️⃣ | PKCE/auth errors not visible | 🟡 MEDIUM | Silent failures on OAuth | 2h |
| 5️⃣ | No orphaned user detection | 🟡 MEDIUM | Can't find broken signups | 3h |

---

## FIX #1: Display no_org Error (1 hour) 🔴 CRITICAL

**Problem:** User gets org_id but middleware fails to see it → redirects to /login?error=no_org but /login doesn't display the error.

**Root Cause:** Migration trigger updates JWT but sometimes fails halfway. When user tries to access dashboard, middleware rejects them with no explanation.

**File to Fix:** `src/app/(auth)/verify-email/page.tsx`

**Code:**
```typescript
// Add at top of VerifyEmailContent component
const searchParams = useSearchParams();
const error = searchParams.get('error');

// Add this UI before the other status checks
if (error === 'no_org') {
  return (
    <div className="h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md text-center">
        <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-red-900 mb-2">Setup Incomplete</h1>
        <p className="text-gray-600 mb-4">
          Your account was created but setup failed. Our team has been notified.
        </p>
        <a
          href="mailto:support@voxanne.ai"
          className="text-surgical-600 font-medium hover:underline"
        >
          Contact support@voxanne.ai
        </a>
      </div>
    </div>
  );
}
```

**Why This Fixes:** Users will see clear explanation instead of silent redirect.

---

## FIX #2: Defer Org Creation Until Email Confirmed (2 hours) 🔴 CRITICAL

**Problem:** Trigger creates organization for UNCONFIRMED users. If user never confirms email (link expires after 24h), they're stuck with orphaned org and can never sign up again.

**Root Cause:** `handle_new_user_signup()` trigger fires on INSERT, but user hasn't confirmed email yet.

**File to Fix:** `backend/supabase/migrations/20260209_fix_auto_org_trigger.sql`

**Code:** Split org creation into two steps:

**Step 1:** Modify trigger to skip unconfirmed users
```sql
-- In handle_new_user_signup() function, add this at line 28:
IF NEW.email_confirmed_at IS NULL THEN
  RAISE NOTICE 'User email unconfirmed. Org creation deferred until email verified.';
  RETURN NEW;
END IF;

-- Rest of trigger stays the same (only runs if email_confirmed_at is NOT NULL)
```

**Step 2:** Create org on email verification
Create new endpoint `/api/auth/complete-signup`:
```typescript
// backend/src/routes/auth-complete.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = createServerClient(...);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Email not confirmed' }, { status: 400 });
  }

  if (user.app_metadata?.org_id) {
    return NextResponse.json({ success: true }); // Already created
  }

  // Create org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: `${user.email} Organization`,
      email: user.email,
      status: 'active',
    })
    .select('id')
    .single();

  if (orgError) throw orgError;

  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email,
      org_id: org.id,
      role: 'owner',
    });

  if (profileError) throw profileError;

  // Update JWT with org_id
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { app_metadata: { org_id: org.id } }
  );

  if (updateError) throw updateError;

  return NextResponse.json({ success: true, org_id: org.id });
}
```

**Step 3:** Call endpoint after email verification
In `src/app/(auth)/verify-email/page.tsx` line 43-50:
```typescript
const { error } = await supabase.auth.verifyOtp({
  type: 'signup',
  token_hash: tokenHash,
});

if (error) {
  setStatus('error');
  setMessage('Verification failed. Please try again.');
  return;
}

// 🔴 NEW: Complete signup (create org)
const completeRes = await fetch('/api/auth/complete-signup', {
  method: 'POST',
});

if (!completeRes.ok) {
  setStatus('error');
  setMessage('Setup failed. Please contact support.');
  return;
}

setStatus('success');
setMessage('Email verified successfully!');
setTimeout(() => router.push('/dashboard'), 1000);
```

**Why This Fixes:** Users can't get trapped with unconfirmed email. Org only created after email proven valid.

---

## FIX #3: Improve Network Error Messages (1.5 hours) 🟡 HIGH

**Problem:** When network drops during signup, user sees generic "An unexpected error occurred" and doesn't know if account was created or not.

**Root Cause:** No distinction between network errors and API errors.

**File to Fix:** `src/app/(auth)/sign-up/page.tsx` lines 40-68

**Code:**
```typescript
const handleSignUp = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  // Validation checks (unchanged)...

  setLoading(true);

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthCallbackUrl() },
    });

    if (error) {
      // 🔴 NEW: Better error messages
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Try signing in.');
      } else if (error.message.includes('rate limit')) {
        setError('Too many attempts. Please wait 15 minutes before trying again.');
      } else {
        setError(error.message || 'Signup failed. Please try again.');
      }
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push('/dashboard');
      return;
    }

    setEmailSent(true);
    setLoading(false);
  } catch (err: any) {
    // 🔴 NEW: Distinguish error types
    const message = err?.message || '';

    if (
      err.name === 'AbortError' ||
      message.includes('timeout') ||
      message.includes('Failed to fetch')
    ) {
      setError(
        'Connection lost. Your account may have been created. Check your email or try signing in.'
      );
    } else if (message.includes('503') || message.includes('502')) {
      setError('Service temporarily unavailable. Please try again in a few minutes.');
    } else {
      setError('An unexpected error occurred. Please try again.');
    }
    setLoading(false);
  }
};
```

**Why This Fixes:** Users understand if it's their network vs. service issue vs. already-created account.

---

## FIX #4: Display Auth Errors on All Pages (2 hours) 🟡 MEDIUM

**Problem:** PKCE mismatch, OAuth failures, and other errors get silently swallowed. User sees blank page or generic form.

**Root Cause:** `auth/callback/route.ts` redirects with error codes but `/login` and `/verify-email` don't display them.

**Files to Fix:**
1. `src/app/(auth)/verify-email/page.tsx` (lines 10-20)
2. `src/app/(auth)/login/page.tsx` (if exists)

**Code:**

Create reusable error display component:
```typescript
// src/components/auth/AuthErrorBanner.tsx
interface AuthErrorBannerProps {
  error?: string | null;
  hint?: string | null;
}

export function AuthErrorBanner({ error, hint }: AuthErrorBannerProps) {
  if (!error) return null;

  const messages: Record<string, string> = {
    'bad_code_verifier': 'Authentication link expired or used in wrong browser. Please start signup again.',
    'invalid_grant': 'Authentication failed. Please try signing up again.',
    'auth_failed': 'Authentication failed. Please try again.',
    'auth_error': 'Authentication error. Please try again.',
  };

  const message = messages[error] || error;

  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
      <p className="font-medium">{message}</p>
      {hint && <p className="text-xs text-red-600 mt-1">Details: {hint}</p>}
    </div>
  );
}
```

Use in verify-email:
```typescript
// src/app/(auth)/verify-email/page.tsx line 11
function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const hint = searchParams.get('hint');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* 🔴 NEW: Add error banner */}
        <AuthErrorBanner error={error} hint={hint} />

        {/* Rest of content unchanged */}
        <div className="text-center">
          {/* ... */}
        </div>
      </div>
    </div>
  );
}
```

**Why This Fixes:** Users see clear explanation for OAuth/PKCE failures instead of blank page.

---

## FIX #5: Add Orphaned User Detection (3 hours) 🟡 MEDIUM

**Problem:** If trigger fails halfway (org created, JWT not updated), we can't detect these broken users.

**Root Cause:** No monitoring for users without org_id.

**File to Create:** `backend/src/routes/admin-health.ts`

**Code:**
```typescript
import { Router } from 'express';
import { createServerClient } from '@supabase/ssr';

const router = Router();

// GET /api/admin/health/orphaned-users
router.get('/orphaned-users', async (req, res) => {
  try {
    // Verify admin auth (add your auth check here)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.ADMIN_API_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find auth.users with no org_id in app_metadata
    const { data: orphans, error } = await supabase
      .rpc('find_orphaned_users', {
        hours_ago: 24,
      });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Alert if found
    if (orphans && orphans.length > 0) {
      await fetch(process.env.SLACK_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `⚠️ ALERT: ${orphans.length} orphaned users in last 24h`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Orphaned Users Detected*\n${orphans
                  .map((u: any) => `• ${u.email} (${u.created_at})`)
                  .join('\n')}`,
              },
            },
          ],
        }),
      });
    }

    return res.json({
      status: 'ok',
      orphaned_count: orphans?.length || 0,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Health check failed' });
  }
});

export default router;
```

Create database function:
```sql
-- backend/supabase/migrations/20260225_orphaned_users_detection.sql
CREATE OR REPLACE FUNCTION find_orphaned_users(hours_ago INT DEFAULT 24)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  has_profile BOOLEAN,
  has_org BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.created_at,
    EXISTS(SELECT 1 FROM profiles WHERE id = u.id) as has_profile,
    EXISTS(SELECT 1 FROM organizations WHERE email = u.email) as has_org
  FROM auth.users u
  WHERE
    u.created_at >= NOW() - (hours_ago || ' hours')::INTERVAL
    AND (
      u.raw_app_meta_data->>'org_id' IS NULL
      OR NOT EXISTS(SELECT 1 FROM profiles WHERE id = u.id)
    )
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql;
```

Add cron job:
```typescript
// backend/src/jobs/monitor-orphaned-users.ts
import cron from 'node-cron';

export function scheduleOrphanedUserMonitoring() {
  // Run hourly
  cron.schedule('0 * * * *', async () => {
    try {
      const res = await fetch(
        'http://localhost:3000/api/admin/health/orphaned-users',
        {
          headers: {
            'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
          },
        }
      );
      const data = await res.json();
      console.log('Orphaned user check:', data);
    } catch (err) {
      console.error('Failed to check orphaned users:', err);
    }
  });
}
```

**Why This Fixes:** Can detect and fix broken signups before customers notice.

---

## Implementation Checklist

### Day 1 (4 hours) - Quick Wins
- [ ] Fix #1: Add no_org error display (1h)
- [ ] Fix #3: Improve error messages (1.5h)
- [ ] Fix #4: Create error banner component (1.5h)
- **Test:** Signup with network off, OAuth failure, etc.

### Day 2 (2 hours) - Trigger Refactor
- [ ] Fix #2 Step 1: Modify trigger (0.5h)
- [ ] Fix #2 Step 2: Create `/api/auth/complete-signup` (1h)
- [ ] Fix #2 Step 3: Call endpoint after email verification (0.5h)
- **Test:** Signup flow, email verification, dashboard access

### Day 3 (3 hours) - Monitoring
- [ ] Fix #5: Create orphaned user detection (2h)
- [ ] Fix #5: Add cron job (1h)
- [ ] Set up Slack alerting
- **Test:** Manual trigger failure, verify alerts fire

---

## Testing Plan

### Scenario 1: Network Drops During Signup
```
1. Open signup in DevTools (Network tab)
2. Fill form, click Create Account
3. Throttle connection to "Offline"
4. Verify error message mentions "Check your email or try signing in"
5. Restore connection, refresh
6. Verify user can sign in (was created despite network error)
```

### Scenario 2: Email Never Confirmed
```
1. Sign up with email
2. Don't click verification link
3. Wait 24 hours (or manually expire link in Supabase)
4. Try to sign in with email/password
5. Verify error: "Email not confirmed"
6. Try to resend verification
7. Verify new link works
```

### Scenario 3: Trigger Failure (Org not created)
```
1. Stop Postgres (simulate constraint violation)
2. Attempt signup
3. Verify error message displays
4. Verify auth.users NOT created (trigger rolled back)
5. Resume Postgres
6. Retry signup
7. Verify it succeeds
```

### Scenario 4: Orphaned User Detection
```
1. Manually insert user into auth.users without org_id
2. Run health check: curl /api/admin/health/orphaned-users
3. Verify Slack alert received
4. Verify count is correct
```

---

## Deployment Order

1. **Develop & Test** Fixes #1, #3, #4 (low risk UX improvements)
2. **Deploy to Staging** - Test full signup flow
3. **Develop & Test** Fix #2 (trigger refactor - higher risk)
4. **Deploy to Staging** - Run email verification tests
5. **Deploy to Production** Fixes #1-4
6. **Monitor** for 48 hours for no_org errors
7. **Develop** Fix #5 (monitoring - can deploy anytime)
8. **Deploy** Fix #5 to catch future issues

---

## Success Metrics

- ✅ Zero "no_org" silent redirects (all errors visible)
- ✅ Zero unconfirmed users trapped forever (org created only after email verified)
- ✅ Zero orphaned users (org + profile + JWT all created together)
- ✅ Network errors have clear messages
- ✅ OAuth/PKCE errors displayed on screen
- ✅ Orphaned users detected within 1 hour (via Slack alerts)

