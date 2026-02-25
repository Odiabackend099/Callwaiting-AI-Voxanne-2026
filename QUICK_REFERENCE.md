# Voxanne AI Authentication Flow - QA Report Quick Reference

## 🎯 TL;DR

**2 CRITICAL bugs found that can permanently trap users:**

| Bug | Scenario | User Impact | Fix Time |
|-----|----------|-------------|----------|
| 🔴 **Org Created Too Early** | User signs up but doesn't confirm email → can't sign in for 24 hours → verification link expires → STUCK FOREVER | Unconfirmed users locked out | 2h |
| 🔴 **no_org Error Hidden** | Trigger partially fails (org created, JWT not updated) → user can login but middleware rejects them → redirected to /login with error=no_org but NO ERROR DISPLAYED → user sees blank form → STUCK | User in redirect loop with no explanation | 1h |

**3 MORE HIGH-PRIORITY issues** (poor UX, not stuck):

| Issue | Scenario | User Impact | Fix Time |
|-------|----------|-------------|----------|
| 🟡 **Vague Network Error** | Network drops during signup → "An unexpected error occurred" → user doesn't know if account was created | User confusion (might try again) | 1.5h |
| 🟡 **PKCE Error Hidden** | OAuth on different browser → redirected to /login?error=bad_code_verifier → no error displayed | User sees blank form, confused | 2h |
| 🟡 **Service Down Error** | Supabase outage → 503 error → "An unexpected error occurred" | User thinks THEY did something wrong | 1h |

---

## 📊 Failure Mode Breakdown

### Critical (Stuck Users)
```
Rank #1: Trigger fails silently (no JWT update)
  Path: Sign up → Org created ✅ → JWT not updated ❌ → Access denied → 
        Redirect to /login?error=no_org → ERROR NOT DISPLAYED → STUCK

Rank #2: Unconfirmed email trap
  Path: Sign up → Verification email sent → User waits 24+ hours → 
        Link expires → Can't login, can't sign up again, can't resend → STUCK FOREVER
```

### High (Confusion)
```
Rank #3: Network drops during signup
  Path: User clicks Create → Network timeout → "Unexpected error" → 
        User thinks it failed BUT IT MIGHT HAVE SUCCEEDED → User confusion

Rank #5: PKCE mismatch on different browser
  Path: Click OAuth on Desktop → Click link on Mobile → code_verifier missing → 
        /login?error=bad_code_verifier → ERROR NOT DISPLAYED → Blank form
```

### Medium (Service Issues)
```
Rank #4: Supabase outage
  Path: Supabase down → 503 error → "Unexpected error occurred" → 
        User assumes THEIR error, not service outage
```

---

## ✅ Top 5 Fixes

### Fix #1: Display no_org Error (1 hour) 🔴 CRITICAL
**File:** `src/app/(auth)/verify-email/page.tsx`
```typescript
// Add before other status checks:
if (error === 'no_org') {
  return (
    <div className="text-center">
      <h1>Setup Incomplete</h1>
      <p>Account created but setup failed. Contact support@voxanne.ai</p>
    </div>
  );
}
```

### Fix #2: Defer Org Creation Until Email Confirmed (2 hours) 🔴 CRITICAL
**File:** `backend/supabase/migrations/20260209_fix_auto_org_trigger.sql`
```sql
-- In trigger, add:
IF NEW.email_confirmed_at IS NULL THEN
  RAISE NOTICE 'Deferring org creation until email verified';
  RETURN NEW;
END IF;
-- Then create org/profile/JWT only if email confirmed
```

**File:** `src/app/(auth)/verify-email/page.tsx`
```typescript
// After email verification, call:
const res = await fetch('/api/auth/complete-signup', { method: 'POST' });
// This endpoint creates org/profile/JWT after email proven valid
```

### Fix #3: Improve Network Error Messages (1.5 hours) 🟡 HIGH
**File:** `src/app/(auth)/sign-up/page.tsx`
```typescript
catch (err: any) {
  if (err.name === 'AbortError' || err.message?.includes('timeout')) {
    setError(
      'Connection lost. Your account may have been created. ' +
      'Check your email or try signing in.'
    );
  } else if (err.message?.includes('503')) {
    setError('Service unavailable. Try again in a few minutes.');
  } else {
    setError('An unexpected error occurred. Please try again.');
  }
}
```

### Fix #4: Display Auth Errors on Pages (2 hours) 🟡 MEDIUM
**Create:** `src/components/auth/AuthErrorBanner.tsx`
```typescript
export function AuthErrorBanner({ error }: { error?: string }) {
  const messages: Record<string, string> = {
    'bad_code_verifier': 'Authentication expired. Try OAuth again on same browser.',
    'no_org': 'Account setup incomplete. Contact support.',
    'auth_failed': 'Authentication failed. Try again.',
  };
  
  if (!error) return null;
  return <div className="bg-red-50 p-4">{messages[error] || error}</div>;
}
```

**Use in:** `src/app/(auth)/verify-email/page.tsx`, login page
```typescript
const error = searchParams.get('error');
return <AuthErrorBanner error={error} />;
```

### Fix #5: Orphaned User Detection (3 hours) 🟡 MEDIUM
**Create:** `backend/src/routes/admin-health.ts`
```typescript
// Endpoint: GET /api/admin/health/orphaned-users
// Finds auth.users without org_id
// Sends Slack alert if found
```

---

## 🧪 Test These Scenarios

```bash
# Scenario 1: Network drops during signup
1. DevTools Network → Throttle to Offline
2. Sign up, click Create Account
3. Verify error says "may have been created"

# Scenario 2: Unconfirmed email trap
1. Sign up
2. Don't click verification link
3. Wait 24 hours (or expire in DB)
4. Try to sign in → error: "Email not confirmed"
5. Try to sign up again → error: "Already registered"
6. TRY TO RESEND VERIFICATION → No button (THIS IS THE BUG)

# Scenario 3: PKCE mismatch
1. Click OAuth on Chrome
2. Google starts auth
3. Paste callback URL into Safari
4. Error page shows blank form (THIS IS THE BUG)
5. Check URL for ?error=bad_code_verifier → NOT DISPLAYED

# Scenario 4: Orphaned user
1. Sign up
2. Manually set org_id = NULL in auth.users
3. Try to access /dashboard
4. Redirected to /login?error=no_org
5. No error message shown (THIS IS THE BUG)
```

---

## 📋 Implementation Checklist

### Day 1 (4 hours) - UX Fixes
- [ ] Fix #1: Add no_org error display (1h)
  - File: verify-email/page.tsx
  - Test: Check /login?error=no_org shows message
  
- [ ] Fix #3: Better error messages (1.5h)
  - File: sign-up/page.tsx
  - Test: Network off, Supabase 503, normal signup
  
- [ ] Fix #4: Error banner component (1.5h)
  - File: Create AuthErrorBanner.tsx
  - Files: Add to verify-email/page.tsx, login
  - Test: OAuth failure shows message

### Day 2 (2 hours) - Trigger Refactor
- [ ] Fix #2 Step 1: Modify trigger (0.5h)
  - File: migrations/20260209_fix_auto_org_trigger.sql
  - Add: IF email_confirmed_at IS NULL THEN RETURN NEW
  
- [ ] Fix #2 Step 2: Create /api/auth/complete-signup (1h)
  - Endpoint: Creates org/profile/JWT after email verified
  - Test: Sign up → don't confirm → confirm → org created
  
- [ ] Fix #2 Step 3: Call endpoint (0.5h)
  - File: verify-email/page.tsx
  - After verifyOtp succeeds → POST /api/auth/complete-signup

### Day 3 (3 hours) - Monitoring
- [ ] Fix #5: Orphaned user detection (3h)
  - File: Create admin-health.ts
  - Creates: Database function + Slack alerting + Cron job
  - Test: Manually create orphaned user → Slack alert

---

## ⏱️ Timeline

| Phase | Tasks | Duration | Risk |
|-------|-------|----------|------|
| **Day 1** | Fixes #1, #3, #4 (UX) | 4h | Low |
| **Day 2** | Fix #2 (Trigger refactor) | 2h | Medium |
| **Day 3** | Fix #5 (Monitoring) | 3h | Low |
| **TOTAL** | All 5 fixes | 9 hours | Medium |

---

## 🚀 Go/No-Go Decision

**Current State:** 🔴 **PRODUCTION RISK** (2 critical stuck-user bugs)

**Recommendation:**
- ✅ OK for internal testing
- ❌ NOT OK for beta/paying customers (Fixes #1-4 needed first)
- 🟡 Should have Fix #5 before scaling beyond 10 users

**Do before launch:**
1. Fix #1 (no_org display) — required
2. Fix #2 (email confirmation) — required
3. Fix #3 (network errors) — recommended
4. Fix #4 (error display) — recommended
5. Fix #5 (monitoring) — nice to have

---

## 📚 Full Reports

- **Detailed Analysis:** `AUTHENTICATION_FAILURE_MODES_QA_REPORT.md` (9,000+ words)
- **Implementation Guide:** `AUTH_CRITICAL_FIXES_SUMMARY.md` (code examples)
- **Ranked Scenarios:** `AUTH_FAILURE_MODES_RANKED.txt` (all 10 scenarios)

---

**Report Date:** 2026-02-25
**Confidence Level:** 95%
**Status:** Ready for implementation
