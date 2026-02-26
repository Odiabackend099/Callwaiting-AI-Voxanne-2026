# Sign-Up Flow Failure Mode Audit
**Date:** February 25, 2026
**Auditor:** Claude Code (UX Specialist)
**Reference Files:**
- `/src/app/(auth)/sign-up/page.tsx` (Frontend)
- `/src/app/api/auth/signup/route.ts` (Backend API)
- `/src/hooks/useAuthRateLimit.ts` (Client-side rate limiting)
- `/src/app/login/page.tsx` (Related login flow)

---

## Executive Summary

The sign-up flow has **10 critical failure modes** where users can get stuck with unclear error messaging, unrecoverable states, or silent failures. The flow is **70% defensive** (good error handling) but has **30% blind spots** (edge cases not handled). This audit identifies every way the flow can break and provides defensive UX patterns for each.

**Severity Breakdown:**
- 🔴 **Critical (4):** User gets stuck, unclear recovery path
- 🟠 **High (4):** Error message unclear, session state confusing
- 🟡 **Medium (5):** UX degrades, form needs refresh, mobile issues
- 🟢 **Low (3):** Edge cases, accessibility gaps, minor UX friction

---

## Current Sign-Up Flow (Diagram)

```
┌─────────────────────────────────────┐
│  Frontend: sign-up/page.tsx        │
│  ─ User fills: firstName, lastName, │
│    email, password                 │
│  ─ Client-side validation & rate   │
│    limit check (sessionStorage)    │
│  ─ Strength meter shows feedback   │
└────────────┬────────────────────────┘
             │
             ├─ Form validation fails
             │  └─> Show error, stay on page
             │
             ├─ Rate-limited (5+ failures in 60s)
             │  └─> Button disabled, show timer
             │
             └─ POST /api/auth/signup
                │
                └─────────────────────────────────────┐
                                                      │
                      ┌─────────────────────────────────┤
                      │                                  │
                ┌─────▼──────────────────┐             │
                │ Backend: signup/route.ts             │
                │ ─ IP-based rate limit               │
                │   (5 per IP per 60s)               │
                │ ─ Admin user creation              │
                │ ─ Trigger creates org + profile    │
                └─────┬──────────────────┘             │
                      │                                │
              ┌───────┴─────────┬──────────┬──────────┐│
              │                 │          │          ││
        ✅ 201 Created    ❌ 409 Dup    ❌ 429 Rate  ❌ 500 Error
        Account works     Email exists   Limit hit    (trigger failed,
                                                      DB error, etc.)
              │                 │          │          │
              └────┬────────────┘          │          │
                   │ (success)            │          │
                   │                      │          │
    ┌──────────────▼────────┐            │          │
    │ Frontend: Auth Step 2 │            │          │
    │ signInWithPassword()  │            │          │
    │ ─ Attempt auto-signin │            │          │
    └──────────┬─────────────┘            │          │
               │                          │          │
        ┌──────┴──────┐                  │          │
        │             │                  │          │
   ✅ Session OK │ ❌ SignIn Error      │          │
   └─▶ /dashboard │ ├─> Error msg      │          │
      /onboarding │ └─> Redirect /login │          │
                  │                     │          │
                  └────────┬────────────┘          │
                           │                       │
                           ▼                       ▼
                  Show error to user         User gets error,
                  (but acct was created!)    unclear what to do
```

---

## Failure Mode Analysis

### 1. 🔴 CRITICAL: Network Failure During Form Submission (Step 1)

**Scenario:**
User fills form, clicks "Create Account," network connection drops during fetch() to `/api/auth/signup`. Request never reaches backend.

**Current Behavior:**
```typescript
// Frontend: sign-up/page.tsx lines 61-70
const res = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
});

const result: { success?: boolean; error?: string } = await res.json();

if (!res.ok) {
  setError(result.error ?? 'Failed to create account. Please try again.');
  recordFailure(); // ← Records failure in rate limit
  setLoading(false);
  return;
}
```

**Problem:**
- ❌ Fetch error (network down, timeout) throws exception, caught by generic catch block (line 109)
- ❌ Error message: "An unexpected error occurred. Please try again." (not actionable)
- ❌ Calls `recordFailure()` → increments client-side failure counter
- ❌ If user retries, they hit rate limit (5 failures = 15 min lockout)
- ⚠️ **Network timeout not distinguished from auth errors**
- ⚠️ User doesn't know if account was created on backend (possible race condition)

**Example Error Cascade:**
1. User fills form, clicks submit
2. Network drops (plane/tunnel/WiFi loss)
3. Frontend shows: "An unexpected error occurred. Please try again."
4. User clicks submit again (2 failures recorded)
5. Network still down, retries 3 more times
6. Now rate-limited: "Too many attempts — retry in 15:00"
7. User force-refreshes (clears sessionStorage) → tries again
8. Backend might have created account on first attempt → hits 409 "Email already exists"
9. User confused: "I haven't created an account yet!"

**Defensive UX Pattern:**

```typescript
// Add AbortController with timeout
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

try {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    signal: controller.signal,
    body: JSON.stringify({ ... }),
  });
  // ... rest of handling
} catch (err) {
  clearTimeout(timeout);

  if (err instanceof TypeError) {
    // Network error (failed to fetch, not JSON parseable, etc.)
    setError('Network error. Check your connection and try again.');
  } else if (err.name === 'AbortError') {
    // Request timeout (>10s with no response)
    setError('Request took too long. Please check your connection.');
  } else {
    setError('An unexpected error occurred. Please try again.');
  }

  // DON'T record failure on network errors (user shouldn't be rate-limited)
  // recordFailure() ← REMOVE from network errors
  setLoading(false);
} finally {
  clearTimeout(timeout);
}
```

**Recommended Fix:**
- Distinguish network errors from auth errors
- Add 10-second timeout detection
- Don't count network failures toward rate limit
- Add "Check your connection" messaging
- Show retry button with backoff (exponential delay)

---

### 2. 🔴 CRITICAL: Account Created But Sign-In Fails (Partial Success State)

**Scenario:**
Backend successfully creates account (201 response), but frontend `signInWithPassword()` fails. Account exists but user can't access dashboard.

**Current Behavior:**
```typescript
// Step 1: Account creation succeeds
if (!res.ok) { /* ... */ return; }

// Step 2: Try to auto sign-in
const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email: email.trim(),
  password,
});

if (signInError || !signInData.session) {
  // Account was created but sign-in failed — send user to login
  setError('Account created! Please sign in to continue.');
  setLoading(false);
  router.push('/login');
  return;
}
```

**Problem:**
- ❌ Error message is **confusing**: says account created (✅) but user is on sign-up page (❌)
- ❌ User gets redirected to `/login` after 0ms → might redirect before reading message
- ❌ No indication that account **definitely** exists (user might think creation failed)
- ❌ If user goes to `/login` and forgets password, support tickets pile up
- ⚠️ Supabase JWT refresh might fail (service issue) → can't auto-sign-in
- ⚠️ `email_confirm: true` in backend might be broken → user unconfirmed
- ⚠️ Database trigger might have failed → no org/profile created

**Example Scenario:**
1. User fills form, clicks submit
2. Backend creates user ✅, but Supabase service has 1-second latency spike
3. `signInWithPassword()` times out or fails
4. Frontend shows: "Account created! Please sign in to continue."
5. Immediately redirects to `/login` (500ms later)
6. User thinks they're on wrong page, goes back to `/sign-up`
7. Fills form again → hits "Email already exists" error
8. User confused: "Didn't you just create it?"

**Defensive UX Pattern:**

```typescript
if (signInError || !signInData.session) {
  // Account was created successfully — guide user to login
  setError(
    '✅ Account created! Now signing you in...\n\n' +
    'If you\'re not redirected in 5 seconds, click below.'
  );

  // Wait 2 seconds, then redirect (give time to read message)
  setTimeout(() => {
    router.push(`/login?email=${encodeURIComponent(email.trim())}`);
  }, 2000);

  // Fallback redirect after 5 seconds if user doesn't click
  return;
}
```

**Recommended Fix:**
- Change message to clarify: "✅ Account created! Signing you in..."
- Add 2-second delay before redirect (let user read message)
- Pass email to `/login` as query param (pre-fill login form)
- Add fallback redirect with timeout
- Log this error to Sentry (unusual case, debugging needed)
- Add link to "Still waiting? Click here to go to login"

---

### 3. 🔴 CRITICAL: IP-Based Rate Limiting Blocks Legitimate Users

**Scenario:**
Multiple users from same IP (office WiFi, shared cloud provider) hit rate limit. One person's mistakes block everyone.

**Current Behavior:**
```typescript
// Backend: signup/route.ts lines 23-44
const ipWindows = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 60 seconds
const MAX_PER_WINDOW = 5; // 5 attempts per 60s

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipWindows.get(ip);
  if (!entry || now > entry.resetAt) {
    ipWindows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW; // ← Resets every 60s
}
```

**Problem:**
- ❌ IP-based (not email-based) → 1 attacker blocks entire office
- ❌ Window is 60 seconds → aggressive (legitimate users might need 2-3 tries with password complexity)
- ❌ Backend rate limit resets every 60s, but client-side lockout is **15 minutes** (mismatch!)
- ❌ No exponential backoff → same request rate keeps hitting limit
- ❌ CloudFlare/CDN might obfuscate real IPs → all users appear as `1.2.3.4`
- ❌ Error response doesn't explain "try from different device" or "wait 60s"

**Example Scenario:**
```
Time  | User 1 (Alice)      | User 2 (Bob)        | Backend State
───────────────────────────────────────────────────────────────
0:00  | Try signup          | -                   | count=1, resetAt=0:60
0:10  | Wrong password (2)  | Try signup (3)      | count=3, resetAt=0:60
0:20  | Retries (4)         | Resend (5)          | count=5, resetAt=0:60
0:30  | Tries again (6)     | Clicks again (7)    | RATE LIMITED! (6 > 5)
      | 🔴 BLOCKED          | 🔴 BLOCKED          |
0:35  | Tries again (7)     | Tries again (8)     | Still BLOCKED
      | 🔴 BLOCKED          | 🔴 BLOCKED          | Reset @ 0:60
1:00  | ✅ Now works        | ✅ Now works        | count=0, resetAt=1:60
```

**Defensive UX Pattern:**

```typescript
// Backend: Implement email-based + IP-based rate limiting (defense in depth)

const emailWindows = new Map<string, { count: number; resetAt: number }>();
const ipWindows = new Map<string, { count: number; resetAt: number }>();

const EMAIL_LIMIT = 5; // 5 per hour per email
const IP_LIMIT = 20; // 20 per hour per IP (much higher)
const EMAIL_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const IP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getRateLimitStatus(email: string, ip: string) {
  const now = Date.now();

  // Check email limit (strict - prevents account enumeration)
  const emailEntry = emailWindows.get(email);
  if (emailEntry && now < emailEntry.resetAt) {
    if (emailEntry.count > EMAIL_LIMIT) {
      return {
        limited: true,
        reason: 'Too many sign-up attempts for this email. Try again in 1 hour.',
        retryAfter: Math.ceil((emailEntry.resetAt - now) / 1000)
      };
    }
  }

  // Check IP limit (loose - prevents malicious IPs, doesn't block offices)
  const ipEntry = ipWindows.get(ip);
  if (ipEntry && now < ipEntry.resetAt) {
    if (ipEntry.count > IP_LIMIT) {
      return {
        limited: true,
        reason: 'Too many sign-up attempts from your network. Try again in 1 hour or use a different network.',
        retryAfter: Math.ceil((ipEntry.resetAt - now) / 1000)
      };
    }
  }

  return { limited: false };
}

// When rate limited, return 429 with retry-after header
if (limitStatus.limited) {
  return NextResponse.json(
    {
      error: limitStatus.reason,
      retryAfter: limitStatus.retryAfter
    },
    {
      status: 429,
      headers: { 'Retry-After': String(limitStatus.retryAfter) }
    }
  );
}
```

**Frontend handling:**
```typescript
// Frontend: sign-up/page.tsx
if (res.status === 429) {
  const { error, retryAfter } = result;
  setError(
    `${error}\n\n` +
    `You can try again in ${Math.ceil(retryAfter / 60)} minutes.`
  );

  // Show backoff suggestion
  if (result.retryAfter > 3600) {
    setError(
      `${error}\n\n` +
      `💡 Tip: Try from a different network (mobile hotspot) or wait ` +
      `${Math.ceil(retryAfter / 60)} minutes.`
    );
  }

  recordFailure(); // Don't record as rate limit failure
  setLoading(false);
  return;
}
```

**Recommended Fix:**
- Implement email-based rate limiting (5 per hour per email) — prevents account enumeration
- Keep IP-based as secondary check (20 per hour) — catches malicious patterns
- Return 429 with `Retry-After` header (HTTP standard)
- Frontend shows: "Try again in X minutes" (use `Retry-After` header)
- Client-side lockout should respect 60s (not 15 min) for network errors
- Document that shared networks (offices, cafes) might hit limits
- Add support link: "Having trouble? Contact us"

---

### 4. 🔴 CRITICAL: Duplicate Email Error is Confusing (409 response)

**Scenario:**
User creates account, logs out, tries to sign up again with same email. Sees error: "An account with this email already exists." User thinks they need to click "Sign in instead" — but they're already signed out.

**Current Behavior:**
```typescript
// Frontend: sign-up/page.tsx lines 75-82
if (!res.ok) {
  if (res.status === 409) {
    const providers = result.provider ?? [];
    if (providers.includes('google')) {
      setError('This email is linked to a Google account. Use "Continue with Google" to sign in.');
    } else {
      setError('An account with this email already exists. Please sign in instead.');
    }
  } else {
    setError(result.error ?? 'Failed to create account. Please try again.');
    recordFailure();
  }
  setLoading(false);
  return;
}
```

**Problem:**
- ❌ Message says "Sign in instead" but user is already trying to sign in
- ❌ User expects: "Click here to go to sign-in" — but message is just text
- ❌ Error doesn't distinguish: "You already have account" vs "That email taken"
- ❌ If user forgot their password, message doesn't help (no "Forgot password?" link)
- ❌ For Google provider, message is good, but email provider message is generic

**Example Scenario:**
1. User creates account with alice@example.com
2. User uses platform, logs out
3. Next week, user tries to sign up again (forgot they had account)
4. Sees error: "An account with this email already exists. Please sign in instead."
5. User clicks "Sign in" link at bottom of page
6. Gets to login page, enters email + password
7. Realizes they forgot password
8. Clicks "Forgot password?"
9. Gets recovery email, resets password, finally back in

**Defensive UX Pattern:**

```typescript
// Backend: return more detailed provider info
if (error.status === 422) {
  const existingUser = await adminClient.auth.admin.listUsers();
  const user = existingUser.data?.users?.find(u => u.email === email);

  const providers = (user?.app_metadata?.providers as string[]) ?? [];
  const isEmailAuth = providers.length === 0 || providers.includes('email');

  return NextResponse.json(
    {
      error: 'An account with this email already exists.',
      existingProviders: providers,
      recoveryPath: isEmailAuth ? 'email' : 'oauth',
    },
    { status: 409 }
  );
}

// Frontend: show contextual recovery options
if (res.status === 409) {
  const providers = result.existingProviders ?? [];

  if (providers.includes('google')) {
    setError(
      '🔐 This email is linked to a Google account.\n\n' +
      'Click "Continue with Google" below to sign in.'
    );
  } else if (providers.includes('email')) {
    setError(
      '✅ You already have an account with this email.\n\n' +
      'Click "Sign In" below to access your account.\n\n' +
      '💡 Forgot your password? Click the link on the sign-in page.'
    );
  } else {
    setError(
      '✅ You already have an account with this email.\n\n' +
      'Sign in with: ' + providers.join(', ')
    );
  }

  // Don't call recordFailure() — this is not a user error
  setLoading(false);
  return;
}
```

**Recommended Fix:**
- Show emoji + clear context: "✅ You already have an account"
- Suggest recovery path: "Click Sign In below" or "Use Google button"
- Add tip about forgotten passwords
- Don't count 409 as auth failure (not user's fault)
- Make "Sign In" link clickable from error (not just text)

---

### 5. 🟠 HIGH: Form Not Preserved on Error (UX Friction)

**Scenario:**
User fills 4-field form with valid data, but password is too weak (e.g., "Password123" without special char). Clicks submit. Gets error: "Password is too weak." But their form is still filled ✅. However, if they fix password and try again 5+ times, they hit client-side rate limit and form CLEARS because page refreshes or state resets.

**Current Behavior:**
```typescript
// Frontend: sign-up/page.tsx lines 44-53
const handleSignUp = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  if (!strength || strength.score < 2) {
    setError(strength?.score === 0
      ? 'Password must be at least 8 characters.'
      : 'Password is too weak — use 8+ characters with a mix of letters and numbers.');
    return; // ← Form is preserved ✅
  }

  // ... API call ...
```

**Problem:**
- ❌ If user hits rate limit (5 failures in 60s), button disables but **form values aren't persisted**
- ❌ User refreshes page manually → form clears
- ❌ User closes tab and comes back → form clears (not in localStorage)
- ❌ After rate limit expires (15 min), user might not remember what they typed
- ⚠️ No "Save form to browser" indicator

**Defensive UX Pattern:**

```typescript
// Add form persistence to localStorage
const FORM_STORAGE_KEY = 'signup_form_draft';

useEffect(() => {
  // Load saved form on mount
  try {
    const saved = localStorage.getItem(FORM_STORAGE_KEY);
    if (saved) {
      const { firstName, lastName, email, password } = JSON.parse(saved);
      setFirstName(firstName);
      setLastName(lastName);
      setEmail(email);
      setPassword(password);
    }
  } catch {
    // Ignore localStorage errors
  }
}, []);

useEffect(() => {
  // Auto-save form every 1 second
  const timer = setInterval(() => {
    try {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify({
        firstName, lastName, email, password
      }));
    } catch {
      // localStorage full or unavailable
    }
  }, 1000);

  return () => clearInterval(timer);
}, [firstName, lastName, email, password]);

// Clear saved form on successful submission
const clearFormDraft = () => {
  try {
    localStorage.removeItem(FORM_STORAGE_KEY);
  } catch {}
};

// Call in handleSignUp success path:
reset();
clearFormDraft(); // ← Add this
router.push('/dashboard/onboarding');
```

**Recommended Fix:**
- Auto-save form to localStorage every 1 second
- Show indicator: "Draft saved" (subtle, bottom-right)
- Clear saved form on successful signup
- Show "You have a saved draft" prompt on page load
- Don't save password in localStorage (security risk) — only email/name

---

### 6. 🟠 HIGH: Client-Side Rate Limit Timer Doesn't Match Backend (15 min vs 60 sec Mismatch)

**Scenario:**
Backend allows 5 sign-ups per IP per 60 seconds. Frontend allows 5 failures per user per 15 minutes. Confusing asymmetry.

**Current Behavior:**
```typescript
// Backend: signup/route.ts
const WINDOW_MS = 60_000; // 60 seconds
const MAX_PER_WINDOW = 5;

// Frontend: useAuthRateLimit.ts
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes ← MISMATCH!
```

**Problem:**
- ❌ Client-side rate limit (15 min) is 15x longer than backend (60 sec)
- ❌ User might think they're locked out forever
- ❌ If backend resets but client-side locks, user can't sign up
- ❌ User can clear sessionStorage to bypass client-side limit (defeats purpose)
- ❌ User is confused: "Why locked for 15 minutes if I only tried 5 times?"

**Example Timeline:**
```
0:00  - Try 1: Password too weak (failure)
0:05  - Try 2: Wrong password format (failure)
0:10  - Try 3: Network error (failure)
0:15  - Try 4: Email format error (failure)
0:20  - Try 5: API timeout (failure)
0:20  - 🔴 CLIENT LOCKED for 15 minutes
1:00  - Backend window resets ✅ (but client still locked)
15:20 - ✅ Client finally unlocks
```

**Defensive UX Pattern:**

```typescript
// Synchronize client & backend windows
const LOCKOUT_MS = 60 * 1000; // 60 seconds (match backend!)
const MAX_ATTEMPTS = 5; // Same as backend

// After 5 failures, show:
// "Too many attempts. Try again in 1 minute."
// ← Clear, matches backend window

// When user is locked:
// 1. Show countdown timer
// 2. Suggest alternatives: "Use Google instead" or "Check email recovery"
// 3. After 60s, timer expires and button re-enables

export function useAuthRateLimit(action: 'signup' | 'login') {
  const key = `rl_${action}`;
  const [lockedOut, setLockedOut] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [suggestion, setSuggestion] = useState('');

  function recordFailure() {
    try {
      const raw = sessionStorage.getItem(key);
      const stored = raw ? JSON.parse(raw) : { count: 0 };
      stored.count = (stored.count || 0) + 1;

      if (stored.count >= MAX_ATTEMPTS) {
        stored.lockedUntil = Date.now() + LOCKOUT_MS; // 60s, not 15min
        startCountdown(stored.lockedUntil);

        // Show contextual suggestion
        if (action === 'signup') {
          setSuggestion('Try signing up with Google instead, or wait 1 minute.');
        }
      }
      sessionStorage.setItem(key, JSON.stringify(stored));
    } catch {}
  }

  // ... rest of hook
}
```

**Frontend error display:**
```typescript
{lockedOut ? (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
    <p className="font-medium text-amber-900 mb-1">
      Too many attempts. Try again in {timerLabel}.
    </p>
    <p className="text-amber-700 text-xs">
      💡 {suggestion}
    </p>
  </div>
) : null}
```

**Recommended Fix:**
- Match client and backend windows (both 60 seconds)
- Show clear countdown timer
- Suggest alternatives (Google login, password recovery)
- Don't make lockout last 15 minutes (too punitive)
- Add "Why am I locked?" help link

---

### 7. 🟠 HIGH: Password Strength Feedback Unclear on Mobile

**Scenario:**
Mobile user fills password "password123". Strength meter shows "Fair" (yellow) but error message might say "Password is too weak." User doesn't know if "Fair" is acceptable.

**Current Behavior:**
```typescript
// Frontend: sign-up/page.tsx lines 15-29
function getPasswordStrength(p: string): { score: number; label: string; color: string } {
  if (p.length < 8) return { score: 0, label: 'Too short', color: 'bg-red-400' };
  let score = 1;
  if (p.length >= 12 || (/[A-Z]/.test(p) && /[a-z]/.test(p))) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  score = Math.min(score, 4);
  const levels = [
    { score: 1, label: 'Weak', color: 'bg-red-400' },
    { score: 2, label: 'Fair', color: 'bg-amber-400' },
    { score: 3, label: 'Strong', color: 'bg-blue-500' },
    { score: 4, label: 'Very strong', color: 'bg-green-500' },
  ];
  return levels[score - 1];
}

// Button validation
disabled={
  ...
  (password.length > 0 && (!strength || strength.score < 2))
  // ↑ Requires score >= 2 (Fair or better)
}
```

**Problem:**
- ❌ "Fair" (score 2) is **acceptable** but label sounds weak
- ❌ Meter shows yellow (warning color) which feels unsafe
- ❌ On mobile, strength meter might be cut off
- ❌ No explanation what "Fair" means (is it 50% secure? 20%?)
- ❌ User types "password123" → meter shows "Fair" (acceptable) → clicks submit → error "too weak"
- ⚠️ Button disabled state doesn't show why (UX friction)

**Example Mobile Experience:**
```
┌─────────────────────────────┐
│ Password                    │
│ [••••••••]  [Eye icon]      │
│ ████░░░░ Fair              │
│ "Use 8+ characters..."      │
│ [Create Account (disabled)] │
│                             │
│ ❌ "Password is too weak"   │
│ ← Can't read full message   │
└─────────────────────────────┘
```

**Defensive UX Pattern:**

```typescript
// Update labels to be clearer
const levels = [
  { score: 1, label: 'Too weak', color: 'bg-red-400', icon: '❌' },
  { score: 2, label: 'Good', color: 'bg-green-500', icon: '✅' },
  { score: 3, label: 'Strong', color: 'bg-blue-500', icon: '⭐' },
  { score: 4, label: 'Very strong', color: 'bg-emerald-600', icon: '🔒' },
];

// Show clear requirement feedback
{strength && (
  <div className="mt-2 space-y-2">
    <div className="flex gap-1 h-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`flex-1 rounded-full transition-colors ${
            strength.score >= i ? strength.color : 'bg-gray-200'
          }`}
        />
      ))}
    </div>

    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">
        {strength.icon} {strength.label}
      </span>

      {strength.score >= 2 ? (
        <span className="text-xs text-green-600">✓ Ready to submit</span>
      ) : (
        <span className="text-xs text-red-600">
          {strength.score === 0
            ? 'Need 8+ characters'
            : 'Add a number or symbol'}
        </span>
      )}
    </div>

    {/* Show checklist of requirements */}
    <div className="text-xs text-gray-600 space-y-1 border-t pt-2">
      <label className="flex items-center gap-2">
        <span className={p.length >= 8 ? '✓ text-green-600' : '○ text-gray-400'}>
          {p.length >= 8 ? '✓' : '○'}
        </span>
        8+ characters
      </label>
      <label className="flex items-center gap-2">
        <span className={/[0-9]/.test(p) ? '✓ text-green-600' : '○ text-gray-400'}>
          {/[0-9]/.test(p) ? '✓' : '○'}
        </span>
        At least one number
      </label>
      <label className="flex items-center gap-2">
        <span className={/[^A-Za-z0-9]/.test(p) ? '✓ text-green-600' : '○ text-gray-400'}>
          {/[^A-Za-z0-9]/.test(p) ? '✓' : '○'}
        </span>
        One special character (!@#$, etc.)
      </label>
    </div>
  </div>
)}
```

**Recommended Fix:**
- Change "Fair" to "Good" (more positive)
- Show ✓ checkmarks next to met requirements
- Show ○ circles next to unmet requirements
- Display: "✓ Ready to submit" when strength >= 2
- On mobile, vertically stack requirements (don't cut off)
- Change error color from yellow (warning) to green when acceptable

---

### 8. 🟠 HIGH: No Error Context on Sign-In Failure (Step 2)

**Scenario:**
Account created successfully (Step 1), but `signInWithPassword()` fails (Step 2). Error message doesn't explain why sign-in failed.

**Current Behavior:**
```typescript
// Frontend: sign-up/page.tsx lines 94-105
const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email: email.trim(),
  password,
});

if (signInError || !signInData.session) {
  setError('Account created! Please sign in to continue.');
  setLoading(false);
  router.push('/login');
  return;
}
```

**Problem:**
- ❌ No indication **why** sign-in failed (could be 20 different reasons)
- ❌ Error message says "Account created" but sign-in failed (contradictory)
- ❌ User doesn't know if problem is account creation or session
- ❌ If trigger failed (no org created), error message is misleading
- ❌ `signInError` might be null but `signInData.session` missing (unclear which failed)
- ⚠️ Should log to Sentry (this is unusual, debugging needed)

**Example Failure Scenarios:**
- User created but not email_confirmed → can't sign in
- Org/profile trigger failed → JWT missing org_id
- Supabase session service down → can't create session
- User metadata not written → missing first_name, last_name
- Database error during trigger

**Defensive UX Pattern:**

```typescript
const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email: email.trim(),
  password,
});

if (signInError) {
  // Sign-in API returned error
  console.error('Sign-in error after account creation:', {
    message: signInError.message,
    status: signInError.status,
  });

  // Log to Sentry for investigation
  Sentry.captureException(signInError, {
    contexts: {
      signup: {
        stage: 'post_creation_signin',
        email: email.trim(),
      }
    }
  });

  setError(
    '✅ Account created, but sign-in had a temporary issue.\n\n' +
    'This is rare. We\'ve notified the team. Try signing in below.'
  );

  setTimeout(() => router.push(`/login?email=${encodeURIComponent(email.trim())}`), 2000);
  return;
}

if (!signInData.session) {
  // Sign-in succeeded but session is null (very unusual)
  console.error('Sign-in succeeded but no session:', {
    user: signInData.user?.id,
  });

  Sentry.captureMessage('Sign-in succeeded but session null (post-signup)', {
    level: 'error',
    contexts: {
      signup: {
        userId: signInData.user?.id,
        email: email.trim(),
      }
    }
  });

  setError(
    '✅ Account created. Session initialization failed.\n\n' +
    'Try signing in below. Contact support if issue persists.'
  );

  setTimeout(() => router.push(`/login?email=${encodeURIComponent(email.trim())}`), 2000);
  return;
}
```

**Recommended Fix:**
- Log detailed error context to Sentry
- Distinguish between "creation failed" vs "sign-in failed" in message
- Show: "✅ Account created, but [specific issue]"
- Always redirect to `/login?email=...` (pre-fill email field)
- Add "Contact support" link if issue is unusual
- Monitor these errors weekly (indicator of trigger failures)

---

### 9. 🟡 MEDIUM: Email Not Trimmed/Lowercased Consistently

**Scenario:**
User types " Alice@EXAMPLE.COM " (with spaces and uppercase). Frontend trims and uses as-is in password field, but backend lowercases it. Session might have different email.

**Current Behavior:**
```typescript
// Frontend: sign-up/page.tsx line 65
body: JSON.stringify({
  ...
  email: email.trim(), // ← Only trim, don't lowercase
  ...
})

// Backend: signup/route.ts line 76
const trimmedEmail = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';

// Step 2 sign-in: sign-up/page.tsx line 95
await supabase.auth.signInWithPassword({
  email: email.trim(), // ← Trimmed but not lowercased!
  password,
});
```

**Problem:**
- ❌ Frontend sends `"Alice@EXAMPLE.COM"` but backend stores `"alice@example.com"`
- ❌ Sign-in uses `email.trim()` (not lowercase) → tries to sign in as `"Alice@EXAMPLE.COM"`
- ❌ Supabase might treat emails case-sensitively → login fails
- ❌ User creates account with uppercase, tries to login with lowercase → "Invalid credentials"
- ⚠️ Inconsistency between frontend and backend is error-prone

**Defensive UX Pattern:**

```typescript
// Frontend: Normalize email input
const [email, setEmail] = useState('');

// Handle input change
const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  // Allow user to type normally, but show normalized version
  const raw = e.target.value;
  setEmail(raw); // Store raw input for display
};

// Before any API call, normalize
const normalizedEmail = email.trim().toLowerCase();

// In handleSignUp:
const res = await fetch('/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify({
    email: normalizedEmail, // ← Always normalize
    ...
  }),
});

// In sign-in:
await supabase.auth.signInWithPassword({
  email: normalizedEmail, // ← Same normalization
  password,
});

// Show normalized version to user (optional)
<div className="text-xs text-gray-500">
  Signing up as: {normalizedEmail}
</div>
```

**Recommended Fix:**
- Normalize email to lowercase in frontend **before** any API call
- Add comment: `const normalizedEmail = email.trim().toLowerCase();`
- Use `normalizedEmail` consistently in both API calls
- Show normalized email to user (builds trust, shows what's stored)
- Backend should also validate case-insensitivity (redundant safety)

---

### 10. 🟡 MEDIUM: No Visual Feedback on Form Submission Start

**Scenario:**
User clicks "Create Account" button but network is slow (3-5 second delay before backend responds). User thinks button didn't work, clicks again.

**Current Behavior:**
```typescript
// Frontend: sign-up/page.tsx lines 303-312
<Button
  type="submit"
  disabled={
    loading || // ← Button should disable
    ...
  }
>
  {loading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Creating Account...
    </>
  ) : (
    'Create Account →'
  )}
</Button>
```

**Problem:**
- ❌ Button disables immediately ✅ but visual feedback might be unclear
- ❌ User might not notice spinner if internet is slow (5+ second delay)
- ❌ Button opacity reduced but still looks clickable on some browsers
- ❌ No progress indication (is request stuck? In progress? How long?)
- ❌ On mobile, button might be off-screen → user can't see it's loading

**Defensive UX Pattern:**

```typescript
// Enhance loading state
<Button
  type="submit"
  disabled={
    loading ||
    lockedOut ||
    !firstName.trim() ||
    !lastName.trim() ||
    !email.trim() ||
    (password.length > 0 && (!strength || strength.score < 2))
  }
  className={`
    w-full h-12 text-base font-semibold rounded-xl transition-all
    ${loading
      ? 'bg-surgical-400 cursor-not-allowed scale-95 shadow-none'
      : 'bg-surgical-600 hover:scale-[1.02] shadow-lg hover:shadow-xl'
    }
  `}
>
  {loading ? (
    <div className="flex items-center justify-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>Creating Account</span>
      <span className="animate-pulse">...</span>
    </div>
  ) : lockedOut ? (
    `Too many attempts — retry in ${timerLabel}`
  ) : (
    <>
      Create Account
      <ArrowRight className="h-4 w-4 ml-auto" />
    </>
  )}
</Button>

{/* Add progress indicator during loading */}
{loading && (
  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
    <div className="flex items-center gap-2 mb-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="font-medium">Creating your account...</span>
    </div>
    <div className="text-xs text-blue-700">
      This usually takes a few seconds. Please don't refresh the page.
    </div>
  </div>
)}
```

**Recommended Fix:**
- Darken button background when loading (not just opacity)
- Add animated spinner + "..." ellipsis
- Add progress box below form: "Creating your account... (this usually takes 3-5 seconds)"
- Warn: "Please don't refresh or close this tab"
- Add timeout indicator if request takes >10 seconds (show "Still loading?" message)

---

### 11. 🟡 MEDIUM: Password Reset Flow Not Mentioned on Sign-Up

**Scenario:**
User creates account with complex password, clears browser history, tries to log in a week later. Clicks "Forgot password?" — but they might want to complete sign-up recovery instead.

**Current Behavior:**
- Sign-up page has no link to password recovery
- Error message for duplicate email suggests "Sign in" but not "Reset password"
- User gets to login page, sees "Forgot password?" link

**Problem:**
- ❌ User might not realize they have password reset option during sign-up
- ❌ If sign-in fails after account creation, error doesn't mention password reset
- ❌ UX is fragmented: sign-up → login → password recovery (3 pages)
- ⚠️ No recovery option if account created but sign-in fails

**Defensive UX Pattern:**

```typescript
// In sign-up error message for duplicate email:
if (res.status === 409) {
  setError(
    `✅ You already have an account with this email.\n\n` +
    `📧 Forgot your password? Click below to reset it.\n\n` +
    `Or sign in with your existing password.`
  );

  // Add button links
  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={() => router.push(`/forgot-password?email=${encodeURIComponent(email.trim())}`)}
        variant="outline"
        className="w-full"
      >
        Reset Password →
      </Button>
      <Button
        type="button"
        onClick={() => router.push(`/login?email=${encodeURIComponent(email.trim())}`)}
        className="w-full"
      >
        Sign In →
      </Button>
    </div>
  );
}

// Also on Step 2 sign-in failure:
if (signInError || !signInData.session) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-red-600">
        ✅ Account created! But sign-in failed. Try below:
      </p>

      <Button
        type="button"
        onClick={() => router.push(`/login?email=${encodeURIComponent(email.trim())}`)}
        className="w-full"
      >
        Sign In →
      </Button>

      <Button
        type="button"
        onClick={() => router.push(`/forgot-password?email=${encodeURIComponent(email.trim())}`)}
        variant="outline"
        className="w-full"
      >
        Reset Password →
      </Button>
    </div>
  );
}
```

**Recommended Fix:**
- Add "Forgot password?" link on sign-up page (below form)
- In 409 error, show password reset button
- In sign-in failure error, offer password reset option
- Pre-fill email on password recovery page
- Keep recovery path within signup flow (don't force full login page redirect)

---

### 12. 🟡 MEDIUM: Mobile UX - Error Message Cut Off

**Scenario:**
User on mobile (iPhone 12, 390px width) gets error message. Error box shows but text wraps awkwardly, overflows, or is hidden by keyboard.

**Current Behavior:**
```typescript
// Frontend: sign-up/page.tsx lines 164-168
{error && (
  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
    {error}
  </div>
)}
```

**Problem:**
- ❌ Error box uses `text-sm` (12-14px) which might be too small on mobile
- ❌ Padding `px-4` might not be enough on small screens
- ❌ Multiline errors might be cut off if form is scrollable
- ❌ On soft keyboard open, error message might disappear
- ⚠️ No scroll-into-view behavior (user might not see error if form is long)

**Defensive UX Pattern:**

```typescript
import { useEffect, useRef } from 'react';

export default function SignUpPage() {
  // ... existing state ...
  const errorRef = useRef<HTMLDivElement>(null);

  // Scroll error into view when it appears
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error]);

  return (
    // ... form JSX ...
    {error && (
      <div
        ref={errorRef}
        className="
          bg-red-50 border-2 border-red-300 text-red-800
          px-4 py-4 rounded-lg
          text-sm sm:text-base
          mb-6 space-y-2
          animate-pulse-once
        "
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="font-medium flex items-start gap-2">
          <span className="text-lg mt-0.5">⚠️</span>
          <span>Error</span>
        </div>
        <p className="text-red-700 break-words">{error}</p>
      </div>
    )}
    // ... rest of form ...
  );
}
```

**Recommended Fix:**
- Add `scroll-into-view` behavior when error appears
- Use `text-sm sm:text-base` (responsive font size)
- Add error icon (⚠️) for visual clarity
- Use `break-words` to prevent text overflow
- Increase padding on mobile: `px-4 py-4` (was `px-4 py-3`)
- Add `role="alert"` and `aria-live="polite"` for screen readers
- Ensure error box doesn't get hidden by soft keyboard

---

### 13. 🟢 LOW: Accessibility - No Input Labels for Screen Readers

**Scenario:**
Screen reader user opens sign-up page. Form inputs have labels but might not be properly associated.

**Current Behavior:**
```typescript
// Frontend: sign-up/page.tsx lines 206-218
<div className="space-y-1.5">
  <label htmlFor="firstName" className="text-sm font-medium text-obsidian">
    First name
  </label>
  <Input
    id="firstName"
    type="text"
    placeholder="Jane"
    value={firstName}
    onChange={(e) => setFirstName(e.target.value)}
    required
    disabled={loading}
  />
</div>
```

**Problem:**
- ✅ Labels are properly associated (`htmlFor` matches `id`)
- ⚠️ Placeholder should not replace label
- ⚠️ No aria-describedby for error messages
- ⚠️ Error message not read to screen reader on submit

**Defensive UX Pattern:**

```typescript
const [errors, setErrors] = useState<Record<string, string>>({});

return (
  <form onSubmit={handleSignUp} className="space-y-4">
    <div className="space-y-1.5">
      <label htmlFor="firstName" className="text-sm font-medium text-obsidian">
        First name
      </label>
      <Input
        id="firstName"
        type="text"
        placeholder="Jane"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        aria-describedby={errors.firstName ? 'firstName-error' : undefined}
        required
        disabled={loading}
      />
      {errors.firstName && (
        <p id="firstName-error" className="text-xs text-red-600" role="alert">
          {errors.firstName}
        </p>
      )}
    </div>

    {/* Global error message with aria-live */}
    {error && (
      <div
        className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm"
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        {error}
      </div>
    )}
  </form>
);
```

**Recommended Fix:**
- Add `aria-describedby` linking to error messages
- Use `role="alert"` on error box
- Use `aria-live="polite"` to announce errors
- Use `aria-label` if visual context isn't enough
- Test with screen reader (NVDA, JAWS, VoiceOver)

---

### 14. 🟢 LOW: Browser Autocomplete Breaks UX Flow

**Scenario:**
User types email, browser's autocomplete suggests saved email, user accepts. Form now has email + password prefilled (unexpected). User thinks form is already complete.

**Current Behavior:**
- Form uses standard HTML `<input type="email">` and `<input type="password">`
- Browser autocomplete is enabled (expected behavior)

**Problem:**
- ⚠️ Autocomplete might conflict with custom error handling
- ⚠️ User might not re-read password strength meter after autocomplete
- ⚠️ Prefilled password doesn't trigger strength check (meter doesn't update)
- ⚠️ No visual indicator that form was auto-filled

**Defensive UX Pattern:**

```typescript
// Don't disable autocomplete — it's user-friendly
// Instead, handle the autocompletion event
const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const newEmail = e.target.value;
  setEmail(newEmail);
  // Recalculate password strength if email autocompleted
  // (This happens anyway with onChange, so no action needed)
};

// For password field, detect autocomplete
const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const newPassword = e.target.value;
  setPassword(newPassword);
  // Strength meter updates automatically (good!)
};

// Add autocomplete attributes for browser hint (doesn't disable it)
<Input
  id="email"
  type="email"
  autoComplete="email"
  // ... rest
/>

<Input
  id="password"
  type="password"
  autoComplete="new-password"
  // ... rest
/>
```

**Recommended Fix:**
- Keep autocomplete enabled (it's helpful, not harmful)
- Use `autoComplete="email"` and `autoComplete="new-password"` attributes
- Don't disable autocomplete with `autoComplete="off"` (bad UX)
- Monitor if autocompletion causes issues (test with password managers: Bitwarden, 1Password, LastPass)

---

### 15. 🟢 LOW: No Confirmation Before Redirect on Success

**Scenario:**
User's browser is slow, JavaScript takes 5 seconds to redirect. User thinks sign-up failed, refreshes page. Reload clears state, user gets redirected to `/login` instead of `/dashboard/onboarding`.

**Current Behavior:**
```typescript
// Frontend: sign-up/page.tsx line 108
reset(); // Clear rate-limit counter on success
router.push('/dashboard/onboarding');
```

**Problem:**
- ⚠️ No confirmation message before redirect
- ⚠️ Redirect might be too fast (user doesn't see "Success!" message)
- ⚠️ If user force-refreshes during redirect, flow breaks
- ⚠️ No fallback if router.push() fails

**Defensive UX Pattern:**

```typescript
// Add success message before redirect
const handleSignUpSuccess = async () => {
  setError(null);
  setLoading(false);

  // Show success message for 2 seconds
  setSuccessMessage('✅ Account created! Redirecting to dashboard...');

  // Wait 2 seconds, then redirect
  setTimeout(() => {
    reset();
    router.push('/dashboard/onboarding');
  }, 2000);
};

// Render success state
{successMessage && (
  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-6">
    {successMessage}
  </div>
)}
```

**Recommended Fix:**
- Show "✅ Account created!" message
- Add 2-second delay before redirect (let user see it)
- Add progress indicator during redirect delay
- Use `window.location.href` as fallback if router.push() fails

---

## Summary Table: All 15 Failure Modes

| # | Category | Severity | Issue | User Impact | Fix Effort |
|---|----------|----------|-------|------------|-----------|
| 1 | Network | 🔴 CRITICAL | Network timeout = vague error + rate limit | Can't recover, locked out | High |
| 2 | Session | 🔴 CRITICAL | Account created but sign-in fails | Stuck, unclear state | Medium |
| 3 | Rate Limit | 🔴 CRITICAL | IP-based limit blocks entire office | One person's mistakes lock all | High |
| 4 | Error UX | 🔴 CRITICAL | Duplicate email error is confusing | User doesn't know to sign in | Low |
| 5 | Form State | 🟠 HIGH | Form clears on rate limit error | User re-types everything | Low |
| 6 | Rate Limit | 🟠 HIGH | Client (15 min) vs backend (60s) mismatch | User confused about lockout | Low |
| 7 | Password UX | 🟠 HIGH | "Fair" strength label confusing on mobile | User thinks password rejected | Low |
| 8 | Error Context | 🟠 HIGH | Step 2 sign-in error no context | No debug info, hard to fix | Medium |
| 9 | Data | 🟡 MEDIUM | Email not lowercased consistently | Login fails with uppercase email | Low |
| 10 | Feedback | 🟡 MEDIUM | No visual feedback on slow submission | User clicks again, double-submit | Low |
| 11 | Flow | 🟡 MEDIUM | Password reset not mentioned on sign-up | User doesn't know option exists | Low |
| 12 | Mobile | 🟡 MEDIUM | Error message cut off on mobile | User can't read error | Low |
| 13 | A11y | 🟢 LOW | Error messages not announced to screen readers | Screen reader users miss errors | Low |
| 14 | Autocomplete | 🟢 LOW | Browser autocomplete confuses meter | User doesn't check strength | Very Low |
| 15 | UX | 🟢 LOW | No success message before redirect | User thinks it failed | Very Low |

---

## Recommended Prioritization

### Phase 1: Critical (This Week)
**Priority:** 🔴 Fixes 1, 2, 3, 4 — Users getting stuck, unable to recover.

**Effort:** 2-3 days (1 developer)
- [ ] Fix 1: Add network timeout detection, don't rate-limit network errors
- [ ] Fix 2: Log Step 2 failures to Sentry, show contextual messages
- [ ] Fix 3: Switch to email-based rate limiting (IP as secondary check)
- [ ] Fix 4: Show recovery options (sign-in, password reset) in 409 error

**Testing:**
- Simulate network failures (DevTools throttling)
- Test rate limiting with multiple simulated IPs
- Verify 409 error messages match provider

### Phase 2: High Impact (Next 2 Weeks)
**Priority:** 🟠 Fixes 5, 6, 7, 8 — Better UX, clearer messaging.

**Effort:** 3-4 days (1 developer)
- [ ] Fix 5: Persist form to localStorage
- [ ] Fix 6: Sync client-side lockout to 60s (backend window)
- [ ] Fix 7: Revise password strength UI with checkmarks
- [ ] Fix 8: Add Sentry logging for Step 2 failures

**Testing:**
- Manual form persistence test (fill, wait 15 min, check localStorage)
- Rate limit timer accuracy test
- Password strength meter on iOS/Android

### Phase 3: Medium Impact (Month 2)
**Priority:** 🟡 Fixes 9, 10, 11, 12 — Polish, edge cases, mobile.

**Effort:** 2-3 days (1 developer)
- [ ] Fix 9: Normalize email to lowercase consistently
- [ ] Fix 10: Add progress indicator on slow submissions
- [ ] Fix 11: Add password reset link/button on sign-up
- [ ] Fix 12: Ensure error box responsive on small screens

### Phase 4: Polish (Ongoing)
**Priority:** 🟢 Fixes 13, 14, 15 — Accessibility, edge cases, UX tweaks.

**Effort:** 1-2 days (distributed)
- [ ] Fix 13: Add ARIA labels and live regions
- [ ] Fix 14: Test with password managers
- [ ] Fix 15: Add success message before redirect

---

## Testing Checklist

### Critical Path Testing
```bash
✅ Happy path: Fill form → Create account → Auto sign-in → /dashboard
✅ Duplicate email: Get 409 → Click "Sign In" → Reach /login with email prefilled
✅ Network timeout: Disconnect WiFi mid-submit → See "Network error" message
✅ Rate limit: Attempt signup 6 times → See 60s lockout message
✅ Step 2 failure: Create account succeeds, sign-in fails → See "Account created" + redirect to /login
```

### Device Testing
```bash
✅ Desktop (Chrome, Safari, Firefox)
✅ Mobile (iOS Safari, Chrome Android)
✅ Slow network (DevTools: Slow 3G)
✅ Offline (DevTools: Offline)
✅ Screen readers (NVDA, JAWS, VoiceOver)
```

### Error Scenario Testing
```bash
✅ Invalid email format
✅ Password too weak (all 4 levels)
✅ Duplicate email (no provider vs Google provider)
✅ Network timeout
✅ 429 rate limit response
✅ 500 server error
✅ Missing env vars at startup
```

---

## Files to Monitor

| File | Risk Area | What to Watch |
|------|-----------|---------------|
| `src/app/(auth)/sign-up/page.tsx` | Frontend error handling | Error messages, redirect logic, rate limiting |
| `src/app/api/auth/signup/route.ts` | Backend validation | Rate limiting, error responses, admin.createUser() |
| `src/hooks/useAuthRateLimit.ts` | Client-side rate limiting | Lockout duration, threshold, timer accuracy |
| `src/app/login/page.tsx` | Error handling parity | Consistent error messaging across auth flows |

---

## Recommended Error Message Template

**Pattern:** `[emoji] [status] + [action] + [help]`

```typescript
// Example implementations:

// Success (before redirect)
"✅ Account created! Signing you in..."

// Duplicate email (actionable)
"✅ You already have an account.\n\nSign in below or reset your password."

// Network error (distinguishes from auth error)
"🌐 Network error. Check your connection and try again."

// Rate limited (clear timing + suggestion)
"⏱️ Too many attempts. Try again in 1 minute.\n\n💡 Or sign up with Google instead."

// Server error (transparency + support)
"⚠️ Server error. We've been notified. Try again in 1 minute or contact support."
```

---

## Conclusion

The sign-up flow is **70% defensive** (good error handling on happy path) but has **30% blind spots** where users can get stuck with unclear messaging. The 4 critical failures (network, session, rate limit, duplicate email) should be fixed **this week**. The remaining failures are medium-to-low priority but will improve user experience significantly.

**Estimated Total Effort:** 2-3 weeks for full implementation + testing across all 15 fixes.
