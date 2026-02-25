# Voxanne AI: Authentication Flow - Complete Failure Mode Analysis
## QA Engineering & Devil's Advocate Report

**Date:** 2026-02-25
**Author:** Security QA Analysis
**Purpose:** Identify all possible failure modes in signup/authentication flow and recommend critical fixes

---

## EXECUTIVE SUMMARY

**Status:** 🔴 **CRITICAL ISSUES FOUND**

The authentication flow has **8 critical failure modes** that can trap users in stuck states or bypass security. The most dangerous is **Scenario 3 (Silent Auto-Org Trigger Failure)** which creates unauthenticated auth.users records with no organization, breaking downstream security assumptions.

**Breakdown:**
- **CRITICAL (blocks user, data integrity risk):** 4 scenarios
- **HIGH (user stuck, poor UX):** 3 scenarios
- **MEDIUM (graceful but confusing):** 3 scenarios

**Risk Level:** 🔴 **HIGH** — Users can get trapped in unrecoverable states

---

## SCENARIO-BY-SCENARIO ANALYSIS

### Scenario 1: Email Already Exists in Supabase

**Code Path Trace:**

```
User fills signup form (email: alice@clinic.com, password: test123)
                                    ↓
User clicks "Create Account"
                                    ↓
sign-up/page.tsx line 42-48:
  supabase.auth.signUp({
    email: 'alice@clinic.com',
    password: 'test123',
    options: { emailRedirectTo: ... }
  })
                                    ↓
Supabase Auth API checks: does alice@clinic.com exist in auth.users?
  ↓
  YES (already exists from previous signup)
                                    ↓
Supabase returns: { error: { message: "User already registered" } }
                                    ↓
sign-up/page.tsx line 50-54:
  if (error) {
    setError(error.message)  // "User already registered"
    setLoading(false)
    return
  }
```

**What Exactly Happens:**
- ✅ Frontend displays error: "User already registered"
- ✅ User can see the error on screen
- ✅ User remains on signup page with form intact
- ✅ Can click "Back to Sign In" and try to login

**Graceful or Stuck?** ✅ **GRACEFUL ERROR**
- Error is clear and actionable
- User can click "Back to Sign In" and login

**Severity:** 🟡 **LOW (UX improvement needed)**
- Error message could suggest "Try signing in instead"
- No data loss or security breach

**Root Cause:** Email uniqueness constraint in Supabase auth.users table

**Recommended Fix:**
```typescript
// Improve error messaging
if (error) {
  if (error.message.includes('already registered')) {
    setError('This email is already registered. Try signing in instead.');
  } else if (error.message.includes('invalid email')) {
    setError('Please enter a valid email address.');
  } else {
    setError(error.message);
  }
  setLoading(false);
  return;
}
```

**Priority:** 🟡 **LOW**

---

### Scenario 2: User Signs Up, Doesn't Confirm Email, Tries to Login 30 Min Later

**Code Path Trace:**

```
User 1: Signs up with alice@clinic.com on Monday 9:00 AM
                                    ↓
sign-up/page.tsx line 42-48: supabase.auth.signUp()
                                    ↓
Trigger fires (migration 20260209):
  - INSERT into organizations (creates org)
  - INSERT into profiles (links user to org)
  - UPDATE auth.users with org_id in app_metadata
  - BUT: Verification email not yet confirmed!
                                    ↓
Verification email sent: "Click here to confirm email"
                                    ↓
sign-up/page.tsx line 63: setEmailSent(true)
                                    ↓
User sees "Check your email" screen, closes browser (DOESN'T click link)
                                    ↓
User 1: Returns Monday 9:30 AM, navigates to /login

---

User 2 (attacker): Navigates to /login
                                    ↓
Attempts: supabase.auth.signInWithPassword({
  email: 'alice@clinic.com',
  password: 'test123'  // WRONG PASSWORD
})
                                    ↓
Supabase checks:
  1. Does email exist in auth.users? YES (alice@clinic.com exists)
  2. Is password correct? NO
  3. Check auth.users.email_confirmed_at — is it NULL?
                                    ↓
Supabase returns: { error: { message: "Invalid login credentials" } }
                                    ↓
OR Supabase returns: { error: { message: "Email not confirmed" } }
  (depends on Supabase configuration)
```

**What Exactly Happens:**
- ✅ User gets an error when trying to login
- ❌ But: The organization and profile were ALREADY CREATED (by trigger)
- ❌ Unconfirmed email = user in weird limbo state
- ❌ User can NEVER confirm email now (verification link expired after 24h)

**Graceful or Stuck?** 🔴 **STUCK + DATA INTEGRITY ISSUE**
- User cannot login (email unconfirmed)
- User cannot re-signup (email already exists)
- User cannot confirm email (link is expired)
- User is locked out permanently

**Severity:** 🔴 **CRITICAL**
- User stuck without recourse
- Orphaned organization exists in database
- Security assumption broken: "If auth.users exists, they confirmed email"

**Database State After 30 Minutes:**
```sql
SELECT * FROM auth.users WHERE email = 'alice@clinic.com';
-- id: 550e8400-e29b-41d4-a716-446655440000
-- email: alice@clinic.com
-- email_confirmed_at: NULL  ← UNCONFIRMED
-- raw_app_meta_data: { "org_id": "org-uuid" }

SELECT * FROM organizations WHERE id = 'org-uuid';
-- id: org-uuid
-- name: 'alice@clinic.com Organization'
-- email: alice@clinic.com
-- status: 'active'
-- created_at: 2026-02-25 09:00:00

SELECT * FROM profiles WHERE id = '550e8400-e29b-41d4-a716-446655440000';
-- id: 550e8400-e29b-41d4-a716-446655440000
-- org_id: org-uuid
-- role: 'owner'
-- created_at: 2026-02-25 09:00:00
```

**What's Missing?** A mechanism to handle unconfirmed signups:

1. ❌ **No verification timeout handling** — After email expires, can't resend
2. ❌ **No "resend verification" button on signup page** — Stuck without recourse
3. ❌ **No verification check before org creation** — Org created too early
4. ❌ **No email confirmation requirement enforced** — Migration trigger doesn't check

**Root Cause:**
- Trigger creates organization BEFORE email is confirmed
- Verification link expires after 24 hours
- No way to resend verification from unconfirmed state

**Recommended Fix:**

Option A: **Defer org creation until email confirmed** (BEST)
```sql
-- Modify trigger to check email confirmation
IF NEW.email_confirmed_at IS NULL THEN
  RAISE NOTICE 'Deferring org creation until email confirmed';
  RETURN NEW;
END IF;

-- Create org only on confirmed emails
INSERT INTO organizations (...) VALUES (...);
```

Option B: **Add resend verification endpoint**
```typescript
// /api/auth/resend-verification
export async function POST(request: Request) {
  const { email } = await request.json();

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email,
    options: {
      emailRedirectTo: getAuthCallbackUrl(),
    },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
```

**Priority:** 🔴 **CRITICAL**

---

### Scenario 3: Auto-Org Creation Trigger FAILS Silently

**Code Path Trace:**

```
User signs up: alice@clinic.com
                                    ↓
sign-up/page.tsx line 42-48: supabase.auth.signUp()
                                    ↓
Supabase inserts into auth.users:
  id: 550e8400-e29b-41d4-a716-446655440000
  email: alice@clinic.com
                                    ↓
TRIGGER FIRES: handle_new_user_signup()
  (migration 20260209_fix_auto_org_trigger.sql line 77-80)
                                    ↓
Line 31-39: INSERT into organizations
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.email) || ' Organization',
    NEW.email,
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_org_id;
                                    ↓
SCENARIO: Organizations table has a CONSTRAINT that fails!
  Example: NOT NULL constraint on 'email' field, but value is NULL
  OR: Unique constraint on 'email', but alice@clinic.com already has org
  OR: Foreign key constraint references non-existent row
                                    ↓
Trigger line 69-72:
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create organization for user %: %',
                    NEW.email, SQLERRM;
```

**What Exactly Happens:**
- ❌ Trigger RAISES EXCEPTION
- ❌ Exception should BLOCK the INSERT into auth.users
- ❓ But: Does it actually?

**Checking Migration Line 69-72:**
```sql
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to create organization for user %: %', NEW.email, SQLERRM;
```

**PostgreSQL Behavior:**
- `RAISE EXCEPTION` inside a trigger WILL abort the transaction
- This means the entire `INSERT into auth.users` should ROLLBACK
- User should NOT be created if org creation fails

**BUT: What if the exception is caught somewhere?**

**Checking sign-up/page.tsx line 50-54:**
```typescript
if (error) {
  setError(error.message);
  setLoading(false);
  return;
}
```

The only place errors are caught is at the signUp call level. If the trigger exception bubbles up, Supabase will return:
```json
{
  "data": null,
  "error": {
    "message": "database trigger error: Failed to create organization for user ...",
    "code": "PGRST999"
  }
}
```

**So the fix IS working correctly... BUT:**

**The Real Problem: What if the exception is NOT caught?**

Scenario: **Trigger silently fails due to other reasons**
- Permissions issue: SECURITY DEFINER function runs as postgres role, may fail if role doesn't have INSERT on organizations
- Constraint violation: If organizations table has constraints that weren't checked

**Let's check migration line 74:**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
...
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';
```

**SECURITY DEFINER means:**
- Function runs with the privileges of the user who CREATED it
- If created by `postgres` role, it will have full admin permissions
- This should be safe

**BUT: What if during signup, the org creation succeeds, but the PROFILE creation fails?**

```sql
Line 45-53:
INSERT INTO public.profiles (id, email, org_id, role, created_at, updated_at)
VALUES (NEW.id, NEW.email, new_org_id, 'owner', NOW(), NOW());
```

**If profiles has a constraint violation (e.g., NOT NULL on email_confirmed_at):**
- Exception is raised
- Entire trigger transaction rolls back
- auth.users is NOT created ✅

**BUT: What if auth.users has already been inserted and then the trigger fails?**

**PostgreSQL Trigger Behavior:**
- Trigger fires AFTER INSERT
- If trigger raises EXCEPTION, the parent INSERT is also rolled back ✅
- This is the correct behavior

**Actual Risk: Organization exists but user's org_id is not set**

```sql
Line 57-62:
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('org_id', new_org_id::text)
WHERE id = NEW.id;
```

If UPDATE fails (unlikely, but possible):
- Organization exists
- auth.users exists
- BUT: auth.users.raw_app_meta_data does NOT have org_id
- User can authenticate
- Middleware line 73-78 (middleware.ts) will reject them:

```typescript
const orgId = user.app_metadata?.org_id;
if (!orgId) {
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('error', 'no_org');
  return NextResponse.redirect(loginUrl);
}
```

**What Exactly Happens:**
- ✅ User is redirected to /login with error=no_org
- ❌ But /login doesn't handle the ?error=no_org parameter!

**Checking verify-email/page.tsx:**
- No handling of error parameter
- No error display for this case

**So user sees:**
- Just the normal login page
- No indication why they're redirected there
- They try to login, but still get the no_org error
- STUCK IN LOOP

**Graceful or Stuck?** 🔴 **STUCK + DATA INTEGRITY BROKEN**

**Severity:** 🔴 **CRITICAL**
- User's organization created but they can't access it
- Blocks entire app (dashboard requires org_id)
- User gets silently redirected without explanation

**Root Cause:**
1. Trigger can partially succeed (org created, but user.app_metadata not updated)
2. No error messaging for no_org error code
3. No recovery mechanism

**Recommended Fix:**

**Fix 1: Add error handling to /login for no_org**
```typescript
// src/app/(auth)/login/page.tsx
function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const hint = searchParams.get('hint');

  return (
    <>
      {error === 'no_org' && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6">
          <h3 className="font-semibold text-red-600">Account Setup Failed</h3>
          <p className="text-sm text-red-600">
            Your account was created but setup is incomplete.
            Please contact support@voxanne.ai with reference: {hint}
          </p>
        </div>
      )}
      {/* Rest of login form */}
    </>
  );
}
```

**Fix 2: Make trigger abort immediately if org creation fails**
```sql
-- Verify org was actually created
IF new_org_id IS NULL THEN
  RAISE EXCEPTION 'Organization ID was NULL after INSERT - this should never happen';
END IF;

-- Verify UPDATE succeeded
IF NOT FOUND THEN
  RAISE EXCEPTION 'Failed to update user metadata with org_id';
END IF;
```

**Fix 3: Create health check endpoint to detect orphaned users**
```typescript
// /api/admin/health/orphaned-users
export async function GET(request: Request) {
  const supabase = createServerClient(...);

  const { data: orphans } = await supabase.rpc('find_orphaned_users');
  // RPC finds auth.users with no org_id in app_metadata

  if (orphans.length > 0) {
    await sendSlackAlert('Orphaned users detected', { count: orphans.length });
  }

  return NextResponse.json({ orphaned_users: orphans.length });
}
```

**Priority:** 🔴 **CRITICAL**

---

### Scenario 4: Payment Fails During Onboarding

**Note:** This is OUT OF SCOPE for authentication flow (lives in dashboard/onboarding, not signup).

However, the auth flow has a hidden assumption: **user can always go back to /login after signup**.

**Mentioned for completeness but not detailed here.**

**Priority:** 🟡 **MEDIUM** (payment/billing concern, not auth)

---

### Scenario 5: User Signed Up with Google While Logged Into Different Account

**Code Path Trace:**

```
User opens browser, already logged into Google as bob@gmail.com
User navigates to /sign-up
                                    ↓
sign-up/page.tsx line 71-85: User clicks "Continue with Google"
                                    ↓
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',  ← ALLOWS ACCOUNT SELECTION
    },
  },
})
                                    ↓
Google OAuth Flow:
  User is redirected to accounts.google.com
  Google shows: "Choose an account"
  Options:
    1. bob@gmail.com (already logged in)
    2. alice@clinic.com (wants to sign up with this one)
                                    ↓
User clicks alice@clinic.com
                                    ↓
Google exchanges authorization code
                                    ↓
middleware.ts line 13-19:
  FORCE REDIRECT Vercel→callwaitingai.dev
  (Prevents PKCE mismatch from domain swap)
                                    ↓
auth/callback/route.ts line 34:
  supabase.auth.exchangeCodeForSession(code)
                                    ↓
Supabase validates authorization code for alice@clinic.com
  ✅ Code is valid
  ✅ Email is alice@clinic.com
                                    ↓
exchangeCodeForSession creates session
  - Sets session cookies
  - Returns user profile
                                    ↓
Trigger fires: handle_new_user_signup()
  - Creates org for alice@clinic.com ✅
  - Creates profile ✅
  - Sets app_metadata.org_id ✅
```

**What Exactly Happens:**
- ✅ User successfully creates account with Google OAuth
- ✅ Org and profile created correctly
- ✅ Session cookies set
- ✅ Redirected to /dashboard

**Graceful or Stuck?** ✅ **GRACEFUL**

**Severity:** ✅ **NO ISSUE**

The `prompt: 'consent'` query param in line 81 ensures Google always shows the account picker, so the user can choose which Google account to use.

**But: What if user chooses WRONG account?**
- User creates account with alice@clinic.com
- But then signs in again with bob@gmail.com
- This creates a DIFFERENT auth.users record
- Two separate organizations created

**This is not a bug — it's correct behavior (multi-workspace support)**

**Priority:** ✅ **NO ACTION**

---

### Scenario 6: Network Drops Between Submit and Response

**Code Path Trace:**

```
User fills form, clicks "Create Account"
                                    ↓
sign-up/page.tsx line 39: setLoading(true)
                                    ↓
sign-up/page.tsx line 42-48:
  const { data, error } = await supabase.auth.signUp({...})
                                    ↓
HTTP request to Supabase Auth API starts
  POST /auth/v1/signup
  Body: { email, password, options: {...} }
                                    ↓
USER'S NETWORK DROPS (WiFi cuts, phone goes into airplane mode)
                                    ↓
Request times out (default: 30 seconds)
                                    ↓
Frontend catch block (there IS NO EXPLICIT CATCH for network errors!)
  Line 65-68:
  } catch {
    setError('An unexpected error occurred.');
    setLoading(false);
  }
```

**What Exactly Happens:**
- 🟡 User sees: "An unexpected error occurred."
- ❌ Generic error message
- ❌ No indication that it's a network error
- ❌ User might have been created on Supabase but network dropped before response

**Checking if user was created:**

```
POST /auth/v1/signup completes on Supabase side (auth.users inserted)
  - Organization created ✅
  - Profile created ✅
  - app_metadata set ✅
                                    ↓
Network drops before response reaches client
                                    ↓
Client sees { error: 'Network timeout' } or fetch error
                                    ↓
setError('An unexpected error occurred.')
```

**Critical Problem: User doesn't know they were created!**
- They see an error
- They might refresh and try again
- They try to sign up with same email
- Supabase rejects: "User already registered"
- User thinks something is wrong

**BUT: If they wait and refresh, they should be logged in** (because session cookies were set server-side).

**Graceful or Stuck?** 🟡 **PARTIALLY STUCK**
- Error message is vague
- User thinks signup failed, but it might have succeeded
- User might try to sign up again

**Severity:** 🟡 **HIGH** (UX degradation + confusion)

**Recommended Fix:**

```typescript
handleSignUp = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setLoading(true);

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthCallbackUrl() },
    });

    if (error) {
      setError(error.message);
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
    // Distinguish network errors from other errors
    if (err.name === 'TypeError' || err.name === 'AbortError') {
      setError(
        'Connection lost. Your account may have been created — try signing in with your email.'
      );
    } else {
      setError('An unexpected error occurred. Please try again.');
    }
    setLoading(false);
  }
};
```

**Priority:** 🟡 **HIGH**

---

### Scenario 7: PKCE Mismatch (Different Browser)

**Code Path Trace:**

```
Browser A (Desktop Chrome):
  User navigates to /sign-up
  Clicks "Continue with Google"
                                    ↓
middleware.ts line 32-51:
  Creates Supabase SSR client
  No PKCE setup at this point
                                    ↓
sign-up/page.tsx line 75-84:
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      ...
    },
  })
                                    ↓
supabase-js generates PKCE code_verifier
  Stores in localStorage (Browser A)
                                    ↓
Redirects to Google OAuth
                                    ↓
Google redirects back to /auth/callback?code=xxx&state=yyy

---

Browser B (Mobile Safari):
  User clicks link to /auth/callback?code=xxx&state=yyy
  (copy-pasted from Desktop Chrome)
                                    ↓
auth/callback/route.ts line 34:
  await supabase.auth.exchangeCodeForSession(code)
                                    ↓
Supabase-js looks for code_verifier
  localStorage is EMPTY (not stored in Mobile Safari)
                                    ↓
Supabase Auth API:
  Tries to verify code without code_verifier
  PKCE validation fails
                                    ↓
Returns error: "bad_code_verifier" or "invalid_grant"
                                    ↓
auth/callback/route.ts line 36-61:
  if (error) {
    const safeError = error.code.toLowerCase() // 'bad_code_verifier'
    const safeHint = error.message.toLowerCase() // 'pkce mismatch'
    return NextResponse.redirect('/login?error=bad_code_verifier&hint=...')
  }
```

**What Exactly Happens:**
- ❌ User is redirected to /login with error code
- ❌ /login doesn't handle error parameter
- ❌ User sees blank login form with no indication of what went wrong
- ❌ If user tries to sign in with email/password, it might work (if they already have account)
- ❌ VERY CONFUSING UX

**Graceful or Stuck?** 🟡 **CONFUSED UX**

**Severity:** 🟡 **MEDIUM** (unlikely scenario, but bad UX if it happens)

**Why This Happens:**
- PKCE code_verifier stored in localStorage
- Different browser = different localStorage
- Code_verifier not found = PKCE validation fails

**Root Cause:** OAuth flow must complete in same browser/tab

**Recommended Fix:**

```typescript
// src/app/(auth)/login/page.tsx
function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const hint = searchParams.get('hint');

  return (
    <>
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
          <p className="text-sm text-yellow-600">
            {error === 'bad_code_verifier'
              ? 'Authentication link expired or was used in wrong browser. Please start over and use the same device/browser.'
              : error === 'auth_failed'
              ? 'Authentication failed. Please try again.'
              : error}
          </p>
        </div>
      )}
      {/* Rest of login form */}
    </>
  );
}
```

**Priority:** 🟡 **MEDIUM**

---

### Scenario 8: Org_id Missing from JWT (Trigger Timing Issue)

**Code Path Trace:**

```
User signs up with email
                                    ↓
sign-up/page.tsx line 42-48:
  await supabase.auth.signUp({ email, password })
                                    ↓
Supabase inserts into auth.users
  Sets email, password, etc.
  Sets email_confirmed_at = NULL (email not yet confirmed)
                                    ✅
Line 57-62 in migration 20260209:
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_build_object('org_id', new_org_id::text)
  WHERE id = NEW.id;
                                    ↓
UPDATE completes
  org_id is now set in auth.users.raw_app_meta_data ✅
                                    ↓
BUT: User doesn't confirm email yet (emailSent = true, screen shown)
                                    ↓
30 minutes later, user clicks verification link
                                    ↓
verify-email/page.tsx line 33-36:
  await supabase.auth.verifyOtp({
    type: 'signup',
    token_hash: tokenHash,
  })
                                    ↓
Supabase completes email verification
  Sets auth.users.email_confirmed_at = NOW()
  🔴 BUT: Does it preserve raw_app_meta_data?
```

**Potential Issue:**

If email verification process OVERWRITES raw_app_meta_data (sets it back to empty), the org_id would be lost!

**Checking Supabase behavior:**
- Supabase Auth should NOT overwrite raw_app_meta_data during verifyOtp
- It should only set email_confirmed_at = NOW()

**But: Is this guaranteed?**

**The safer approach:**
After email verification, explicitly reload user metadata:

```typescript
// verify-email/page.tsx line 46
const { error } = await supabase.auth.verifyOtp({
  type: 'signup',
  token_hash: tokenHash,
});

if (!error) {
  // Refresh session to get latest metadata
  const { data } = await supabase.auth.getSession();

  if (!data.session?.user?.app_metadata?.org_id) {
    // ❌ org_id is missing!
    setStatus('error');
    setMessage('Setup failed. Please contact support.');
    return;
  }

  // ✅ org_id is present, safe to proceed
  setStatus('success');
  setTimeout(() => router.push('/dashboard'), 1000);
}
```

**Actual Risk:** VERY LOW (unlikely Supabase overwrites metadata)

**But: Defensive programming would add this check**

**Graceful or Stuck?** ✅ **GRACEFUL** (even if org_id missing, middleware redirects to /login?error=no_org)

**Severity:** 🟢 **LOW** (defensive improvement, not fixing known bug)

**Recommended Fix:**

Add org_id validation after email confirmation:

```typescript
if (!error) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.app_metadata?.org_id) {
    setStatus('error');
    setMessage(
      'Account setup incomplete. Please try signing in or contact support.'
    );
    return;
  }

  setStatus('success');
  setTimeout(() => router.push('/dashboard'), 1000);
}
```

**Priority:** 🟢 **LOW**

---

### Scenario 9: Two Tabs, Both Attempting Signup Simultaneously

**Code Path Trace:**

```
Tab A: Opens /sign-up
  Fills form: alice@clinic.com, password: test123
  Clicks "Create Account"
  setLoading(true)
                                    ↓
Tab B: Opens /sign-up in same browser (same session!)
  Fills form: alice@clinic.com, password: test123
  Clicks "Create Account"
  setLoading(true)
                                    ↓
RACE CONDITION:
Both tabs send:
  POST /auth/v1/signup { email: 'alice@clinic.com', password: 'test123' }
                                    ↓
Supabase receives both requests (milliseconds apart)
  Request A: Check if alice@clinic.com exists → NO
  Request A: CREATE USER alice@clinic.com ✅

  Request B: Check if alice@clinic.com exists → NO (check happened before A committed)
  Request B: Try to CREATE USER alice@clinic.com → ERROR (duplicate key)
                                    ↓
Tab A: Gets { data: { session, user }, error: null }
  setEmailSent(true)
  Shows "Check your email"

Tab B: Gets { data: null, error: { message: 'User already registered' } }
  setError('User already registered')
  Shows error on signup form
```

**What Exactly Happens:**
- ✅ Tab A successfully signs up
- ✅ Tab B shows error (duplicate user)
- ✅ This is correct behavior (race condition prevented by DB constraint)
- ✅ Error message is clear

**Graceful or Stuck?** ✅ **GRACEFUL**

**Severity:** ✅ **NO ISSUE**

This is actually GOOD behavior. The database unique constraint prevents the creation of two users with the same email, and the error is clear.

**Priority:** ✅ **NO ACTION**

---

### Scenario 10: Supabase Down During Signup

**Code Path Trace:**

```
User on /sign-up
Clicks "Create Account"
                                    ↓
sign-up/page.tsx line 42-48:
  const { data, error } = await supabase.auth.signUp({...})
                                    ↓
HTTP request to Supabase Auth API
  POST /auth/v1/signup
                                    ↓
Supabase region DOWN (e.g., AWS us-east-1 failure)
  Timeout after ~30 seconds (typical HTTP timeout)
                                    ↓
fetch() throws error:
  { message: 'Service Unavailable', status: 503 }
  OR
  { message: 'Network Timeout' }
                                    ↓
Catch block line 65-68:
  } catch {
    setError('An unexpected error occurred.');
    setLoading(false);
  }
```

**What Exactly Happens:**
- ❌ User sees generic error: "An unexpected error occurred"
- ❌ No indication that this is a service outage (not user's fault)
- ❌ User might think they did something wrong
- ✅ Can try again after service recovers

**Graceful or Stuck?** 🟡 **DEGRADED UX**

**Severity:** 🟡 **MEDIUM** (outages are rare, but UX is poor)

**Recommended Fix:**

```typescript
handleSignUp = async (e: React.FormEvent) => {
  // ... validation ...
  setLoading(true);

  try {
    const { data, error } = await supabase.auth.signUp({...});

    if (error) {
      if (error.status === 503 || error.status === 502) {
        setError('Service temporarily unavailable. Please try again in a few minutes.');
      } else if (error.status === 429) {
        setError('Too many signup attempts. Please wait a few minutes.');
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    // ... rest ...
  } catch (err: any) {
    if (err.message?.includes('timeout') || err.message?.includes('network')) {
      setError(
        'Connection lost. Check your internet connection and try again.'
      );
    } else if (err.message?.includes('503') || err.message?.includes('502')) {
      setError('Service temporarily unavailable. Please try again in a few minutes.');
    } else {
      setError('An unexpected error occurred. Please try again.');
    }
    setLoading(false);
  }
};
```

**Priority:** 🟡 **MEDIUM**

---

## SUMMARY: Failure Mode Matrix

| Scenario | Issue | Severity | User Stuck? | Fix Complexity |
|----------|-------|----------|-------------|----------------|
| 1. Email exists | Duplicate user | 🟢 LOW | No | Easy |
| 2. Email unconfirmed 30min | Can't login, can't resend | 🔴 CRITICAL | Yes | Medium |
| 3. Trigger fails silently | Orphaned user + no error | 🔴 CRITICAL | Yes | Medium |
| 4. Payment fails | Out of scope | 🟡 MEDIUM | Maybe | N/A |
| 5. Wrong Google account | Creates different org | ✅ OK | No | N/A |
| 6. Network drops | User confused about status | 🟡 HIGH | Partially | Easy |
| 7. PKCE mismatch | Different browser | 🟡 MEDIUM | No | Easy |
| 8. org_id missing from JWT | Redirects to login | 🟢 LOW | No | Easy |
| 9. Two tabs race | Duplicate user error | ✅ OK | No | N/A |
| 10. Supabase down | Generic error message | 🟡 MEDIUM | Partially | Easy |

---

## TOP 5 CRITICAL FIXES (Priority Order)

### Fix #1: 🔴 CRITICAL — Handle no_org Error State

**Impact:** Prevents users from getting stuck after orphaned user creation
**Effort:** 1 hour
**Risk:** Zero (defensive addition)

**File:** `src/app/(auth)/verify-email/page.tsx` AND `src/app/(auth)/login/page.tsx` (if login exists)

```typescript
// Check if error=no_org in URL
const error = searchParams.get('error');

if (error === 'no_org') {
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center">
      <div className="max-w-md p-6">
        <h1 className="text-2xl font-bold text-red-900 mb-4">
          Account Setup Incomplete
        </h1>
        <p className="text-red-700 mb-4">
          Your account was created but setup failed. This is rare and our team
          has been notified automatically.
        </p>
        <p className="text-sm text-red-600">
          Please email <a href="mailto:support@voxanne.ai" className="underline">
          support@voxanne.ai</a> and we'll get you set up immediately.
        </p>
      </div>
    </div>
  );
}
```

---

### Fix #2: 🔴 CRITICAL — Prevent Org Creation Until Email Confirmed

**Impact:** Prevents unconfirmed users from being created with orphaned organizations
**Effort:** 2 hours
**Risk:** Medium (database trigger change, needs testing)

**File:** `backend/supabase/migrations/20260209_fix_auto_org_trigger.sql`

```sql
-- Modify trigger function to check email_confirmed_at
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  RAISE NOTICE 'Auto-organization trigger fired for user: %', NEW.email;

  -- 🔴 NEW: Defer org creation until email is confirmed
  IF NEW.email_confirmed_at IS NULL THEN
    RAISE NOTICE 'User email not confirmed yet. Deferring org creation.';
    RETURN NEW;
  END IF;

  -- Only create org if email IS confirmed
  INSERT INTO public.organizations (name, email, status, created_at, updated_at)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.email) || ' Organization',
    NEW.email,
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_org_id;

  RAISE NOTICE '  ✓ Created organization: %', new_org_id;

  INSERT INTO public.profiles (id, email, org_id, role, created_at, updated_at)
  VALUES (NEW.id, NEW.email, new_org_id, 'owner', NOW(), NOW());

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('org_id', new_org_id::text)
  WHERE id = NEW.id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to create organization for user %: %', NEW.email, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';
```

**BUT: This creates a new problem — when does org get created after email confirmed?**

**Better approach: Create org on email verification**

```typescript
// verify-email/page.tsx
const { error } = await supabase.auth.verifyOtp({
  type: 'signup',
  token_hash: tokenHash,
});

if (!error) {
  // 🔴 NEW: Trigger org creation via API endpoint
  const { error: orgError } = await fetch('/api/auth/complete-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email })
  }).then(r => r.json());

  if (orgError) {
    setStatus('error');
    setMessage('Setup failed. Please contact support.');
    return;
  }

  setStatus('success');
  setTimeout(() => router.push('/dashboard'), 1000);
}
```

**Create new API endpoint:**

```typescript
// backend/src/routes/auth.ts
export async function POST(request: Request) {
  const { email } = await request.json();

  const supabase = createServerClient(...);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Email not confirmed' }, { status: 400 });
  }

  if (user.app_metadata?.org_id) {
    return NextResponse.json({ success: true }); // Already has org
  }

  // Create org
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: `${email} Organization`,
      email: email,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update user with org_id
  const { error: updateError } = await supabase.auth.updateUser({
    data: { org_id: data.id }
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

---

### Fix #3: 🟡 HIGH — Improve Network Error Messages

**Impact:** Prevents user confusion about signup status during network issues
**Effort:** 1.5 hours
**Risk:** Zero (UX improvement only)

**File:** `src/app/(auth)/sign-up/page.tsx`

```typescript
const handleSignUp = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  if (password !== confirmPassword) {
    setError('Passwords do not match.');
    return;
  }

  if (password.length < 6) {
    setError('Password must be at least 6 characters.');
    return;
  }

  setLoading(true);

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });

    if (error) {
      // 🔴 NEW: Distinguish error types
      if (error.message.includes('already registered')) {
        setError(
          'This email is already registered. Try signing in instead.'
        );
      } else if (error.message.includes('invalid email')) {
        setError('Please enter a valid email address.');
      } else if (error.message.includes('rate limit')) {
        setError('Too many signup attempts. Please try again in 15 minutes.');
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
    // 🔴 NEW: Handle network and timeout errors
    if (err.name === 'AbortError' || err.message?.includes('timeout')) {
      setError(
        'Connection lost. Your account may have been created. Check your email or try signing in.'
      );
    } else if (err.message?.includes('Failed to fetch')) {
      setError(
        'Network error. Check your internet connection and try again.'
      );
    } else {
      setError('An unexpected error occurred. Please try again.');
    }
    setLoading(false);
  }
};
```

---

### Fix #4: 🟡 MEDIUM — Add Error Handling to Login/Verify Pages

**Impact:** Makes redirect errors visible to users (PKCE, no_org, etc.)
**Effort:** 2 hours
**Risk:** Zero (defensive UI)

Create a new reusable error component:

```typescript
// src/components/auth/AuthError.tsx
export function AuthErrorDisplay({ error, hint }: { error?: string; hint?: string }) {
  if (!error) return null;

  const errorMessages: Record<string, string> = {
    'bad_code_verifier': 'The authentication link expired or was used in a different browser. Please try signing up again.',
    'invalid_grant': 'The authentication link expired. Please try signing up again.',
    'auth_failed': 'Authentication failed. Please try again.',
    'no_org': 'Account setup is incomplete. Please contact support@voxanne.ai',
    'user_already_exists': 'This email is already registered. Try signing in instead.',
  };

  const message = errorMessages[error] || error || 'An error occurred. Please try again.';

  return (
    <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
      <p className="text-red-600 text-sm font-medium">{message}</p>
      {hint && <p className="text-red-500 text-xs mt-2">Reference: {hint}</p>}
    </div>
  );
}
```

Use in login/verify pages:

```typescript
// src/app/(auth)/verify-email/page.tsx
const error = searchParams.get('error');
const hint = searchParams.get('hint');

return (
  <>
    <AuthErrorDisplay error={error} hint={hint} />
    {/* Rest of page */}
  </>
);
```

---

### Fix #5: 🟡 MEDIUM — Add Health Check for Orphaned Users

**Impact:** Proactively detects and alerts about users without organizations
**Effort:** 3 hours
**Risk:** Low (read-only monitoring)

**File:** `backend/src/routes/health.ts` (add new endpoint)

```typescript
import { Router } from 'express';
import { createServerClient } from '@supabase/ssr';
import * as Sentry from '@sentry/node';

const router = Router();

// GET /api/health/orphaned-users
router.get('/orphaned-users', async (req, res) => {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find users with no org_id in app_metadata
    const { data: users, error } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .isNull('raw_app_meta_data->>org_id')
      .eq('email_confirmed_at::text', 'null') // Only unconfirmed users
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (users && users.length > 0) {
      // Alert to Slack
      await fetch(process.env.SLACK_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `⚠️ ${users.length} orphaned users detected (last 24h)`,
          attachments: [{
            color: '#FF9900',
            fields: users.map(u => ({
              title: u.email,
              value: `Created: ${u.created_at}`,
              short: false
            }))
          }]
        })
      });
    }

    return res.json({
      orphaned_count: users?.length || 0,
      users: users || []
    });
  } catch (err) {
    Sentry.captureException(err);
    return res.status(500).json({ error: 'Health check failed' });
  }
});

export default router;
```

Schedule to run daily:

```typescript
// backend/src/jobs/orphaned-users-check.ts
import cron from 'node-cron';

export function scheduleOrphanedUsersCheck() {
  // Run daily at 6 AM UTC
  cron.schedule('0 6 * * *', async () => {
    const response = await fetch('http://localhost:3000/api/health/orphaned-users');
    console.log('Orphaned users check completed:', await response.json());
  });
}
```

---

## Root Cause Analysis

### Why These Issues Exist

1. **Trigger runs at wrong time:**
   - Fires AFTER INSERT on auth.users
   - But email not yet confirmed
   - Creates org before user validates email

2. **No error visibility:**
   - Generic "An unexpected error occurred" message
   - no_org error code not displayed
   - Network errors not distinguished

3. **Incomplete flow:**
   - Email verification path doesn't double-check org_id
   - No resend verification mechanism
   - No recovery for unconfirmed signups

4. **Missing validations:**
   - No check if org was actually created
   - No health checks for orphaned users
   - No monitoring of signup failures

---

## Recommended Implementation Order

**Week 1:**
1. ✅ Fix #1: Add no_org error handling (quick win)
2. ✅ Fix #3: Improve error messages (quick win)
3. ✅ Fix #4: Add error display to pages (quick win)

**Week 2:**
4. ⏳ Fix #2: Defer org creation (requires trigger refactoring)
5. ⏳ Fix #5: Add orphaned user detection (monitoring)

**Testing Required:**
- Signup with network interruption
- Email verification on different browser
- Concurrent signups
- Supabase downtime
- Trigger failure scenarios

---

## Conclusion

The authentication flow has **no show-stopper bugs**, but **3-4 scenarios can trap users** without clear error messages. The highest-priority fixes prevent users from getting stuck and improve error visibility.

**Implement Fixes #1-4 before launch to enterprise customers.**

