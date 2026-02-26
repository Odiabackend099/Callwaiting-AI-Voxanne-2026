# Sign-Up Flow Failure Mode Fixes — Implementation Guide

**Quick Reference:** This guide provides copy-paste ready code for each of the 15 failure modes identified in `SIGNUP_FAILURE_MODES_AUDIT.md`.

---

## Fix 1: Network Timeout & Network Error Distinction

**File:** `/src/app/(auth)/sign-up/page.tsx`

**Before:**
```typescript
const res = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    password,
  }),
});

const result = await res.json();

if (!res.ok) {
  setError(result.error ?? 'Failed to create account. Please try again.');
  recordFailure();
  setLoading(false);
  return;
}
```

**After:**
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

try {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
    }),
  });

  let result;
  try {
    result = await res.json();
  } catch {
    setError('Invalid response from server. Please try again.');
    recordFailure();
    setLoading(false);
    return;
  }

  if (!res.ok) {
    // Don't record network errors as failures (user shouldn't be rate-limited)
    const isNetworkError = !res.ok && (res.status === 0 || res.status >= 500);

    if (isNetworkError) {
      setError('Server error. Check your connection and try again.');
      // Don't call recordFailure() for server errors
    } else {
      setError(result.error ?? 'Failed to create account. Please try again.');
      recordFailure();
    }

    setLoading(false);
    return;
  }

  // Success path
  // ... rest of code

} catch (err) {
  clearTimeout(timeout);

  let errorMsg = 'An unexpected error occurred. Please try again.';

  if (err instanceof TypeError) {
    // Network error (failed to fetch, not JSON parseable, etc.)
    errorMsg = 'Network error. Check your connection and try again.';
  } else if (err instanceof Error && err.name === 'AbortError') {
    // Request timeout (>10s with no response)
    errorMsg = 'Request took too long. Please check your connection.';
  }

  setError(errorMsg);
  // Don't record network/timeout errors as auth failures
  setLoading(false);

} finally {
  clearTimeout(timeout);
}
```

---

## Fix 2: Account Created But Sign-In Failed — Better Error Context

**File:** `/src/app/(auth)/sign-up/page.tsx`

**Before:**
```typescript
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

**After:**
```typescript
const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email: email.trim(),
  password,
});

if (signInError) {
  // Log detailed error for debugging
  console.error('Sign-in error after account creation:', {
    message: signInError.message,
    status: signInError.status,
  });

  // TODO: Import Sentry if available
  // Sentry.captureException(signInError, {
  //   contexts: {
  //     signup: {
  //       stage: 'post_creation_signin',
  //       email: email.trim(),
  //     }
  //   }
  // });

  setError(
    '✅ Account created, but sign-in had a temporary issue.\n\n' +
    'This is rare. Please try signing in below with your email and password.'
  );

  setTimeout(() => {
    router.push(`/login?email=${encodeURIComponent(email.trim())}`);
  }, 2000);

  setLoading(false);
  return;
}

if (!signInData.session) {
  // Very unusual case — sign-in succeeded but session is null
  console.error('Sign-in succeeded but no session:', {
    userId: signInData.user?.id,
  });

  setError(
    '✅ Account created. Sign-in initialization failed.\n\n' +
    'Try signing in below. Contact support@voxanne.ai if this persists.'
  );

  setTimeout(() => {
    router.push(`/login?email=${encodeURIComponent(email.trim())}`);
  }, 2000);

  setLoading(false);
  return;
}

// Success
reset();
router.push('/dashboard/onboarding');
```

---

## Fix 3: Email-Based Rate Limiting (Backend)

**File:** `/src/app/api/auth/signup/route.ts`

**Replace the entire rate limiting section (lines 20-54) with:**

```typescript
// --- Rate limiting: email-based (strict) + IP-based (loose) ---
// Email limit: prevents account enumeration, protects against brute-force signup attempts
// IP limit: prevents malicious networks, doesn't block entire offices
const emailWindows = new Map<string, { count: number; resetAt: number }>();
const ipWindows = new Map<string, { count: number; resetAt: number }>();

const EMAIL_LIMIT = 5; // Max 5 signup attempts per email per hour
const IP_LIMIT = 20; // Max 20 signup attempts per IP per hour
const EMAIL_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const IP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of emailWindows) {
    if (now > entry.resetAt) emailWindows.delete(key);
  }
  for (const [key, entry] of ipWindows) {
    if (now > entry.resetAt) ipWindows.delete(key);
  }
}, 5 * 60_000);

function checkRateLimit(email: string, ip: string): { limited: boolean; reason?: string; retryAfter?: number } {
  const now = Date.now();

  // Check email limit (strict)
  const emailEntry = emailWindows.get(email);
  if (emailEntry && now < emailEntry.resetAt) {
    emailEntry.count += 1;
    if (emailEntry.count > EMAIL_LIMIT) {
      return {
        limited: true,
        reason: 'Too many sign-up attempts for this email. Try again in 1 hour.',
        retryAfter: Math.ceil((emailEntry.resetAt - now) / 1000),
      };
    }
  } else {
    emailWindows.set(email, { count: 1, resetAt: now + EMAIL_WINDOW_MS });
  }

  // Check IP limit (loose)
  const ipEntry = ipWindows.get(ip);
  if (ipEntry && now < ipEntry.resetAt) {
    ipEntry.count += 1;
    if (ipEntry.count > IP_LIMIT) {
      return {
        limited: true,
        reason: 'Too many sign-up attempts from your network. Try again in 1 hour or use a different network.',
        retryAfter: Math.ceil((ipEntry.resetAt - now) / 1000),
      };
    }
  } else {
    ipWindows.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
  }

  return { limited: false };
}

export async function POST(req: NextRequest) {
  // Extract email early for rate limiting
  const rawText = await req.text().catch(() => '');
  if (!rawText) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const p = parsed as Record<string, unknown>;
  const trimmedEmail = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  // Rate limit check
  const limitCheck = checkRateLimit(trimmedEmail, ip);
  if (limitCheck.limited) {
    return NextResponse.json(
      {
        error: limitCheck.reason,
        retryAfter: limitCheck.retryAfter,
      },
      {
        status: 429,
        headers: limitCheck.retryAfter ? { 'Retry-After': String(limitCheck.retryAfter) } : {},
      }
    );
  }

  // Rest of the signup logic continues...
```

---

## Fix 3B: Frontend Rate Limit Handling (Revised)

**File:** `/src/app/(auth)/sign-up/page.tsx`

```typescript
// Add this handler in the handleSignUp function:

if (res.status === 429) {
  const { error, retryAfter } = result;

  const minLabel = retryAfter ? Math.ceil(retryAfter / 60) : 1;

  setError(
    `${error}\n\n` +
    `⏱️ You can try again in ${minLabel} minute${minLabel === 1 ? '' : 's'}.`
  );

  // Show recovery suggestion if long wait
  if (retryAfter && retryAfter > 3600) {
    const suggestAlt = `💡 Tip: Try signing up with Google instead, or wait ${minLabel} minutes.`;
    setError(prev => `${prev}\n\n${suggestAlt}`);
  }

  // Don't record 429 as user failure (it's a rate limit, not an error)
  setLoading(false);
  return;
}
```

---

## Fix 4: Better Duplicate Email Error (409)

**File:** `/src/app/(auth)/sign-up/page.tsx`

**Before:**
```typescript
if (res.status === 409) {
  const providers = result.provider ?? [];
  if (providers.includes('google')) {
    setError('This email is linked to a Google account. Use "Continue with Google" to sign in.');
  } else {
    setError('An account with this email already exists. Please sign in instead.');
  }
}
```

**After:**
```typescript
if (res.status === 409) {
  const providers = result.provider ?? [];

  if (providers.includes('google')) {
    setError(
      '✅ This email is linked to a Google account.\n\n' +
      '🔐 Use the "Continue with Google" button above to sign in.'
    );
  } else if (providers.length > 0) {
    // Multiple providers
    setError(
      `✅ You already have an account with this email.\n\n` +
      `Sign in with: ${providers.join(', ')}`
    );
  } else {
    // Email auth only
    setError(
      '✅ You already have an account with this email.\n\n' +
      '📧 Sign in below with your email and password.\n\n' +
      '💡 Forgot your password? Click "Forgot password?" on the sign-in page.'
    );
  }

  // Don't count 409 as auth failure
  setLoading(false);
  return;
}
```

---

## Fix 5: Form Persistence to localStorage

**File:** `/src/app/(auth)/sign-up/page.tsx`

**Add at top of component:**
```typescript
const FORM_STORAGE_KEY = 'signup_form_draft';

// Load saved form on mount
useEffect(() => {
  try {
    const saved = localStorage.getItem(FORM_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.firstName) setFirstName(parsed.firstName);
      if (parsed.lastName) setLastName(parsed.lastName);
      if (parsed.email) setEmail(parsed.email);
      if (parsed.password) setPassword(parsed.password);
    }
  } catch {
    // Ignore localStorage errors (private mode, quota exceeded, etc.)
  }
}, []);

// Auto-save form to localStorage (don't save password for security)
useEffect(() => {
  const timer = setInterval(() => {
    try {
      localStorage.setItem(
        FORM_STORAGE_KEY,
        JSON.stringify({
          firstName,
          lastName,
          email,
          // Don't save password (security risk)
        })
      );
    } catch {
      // Ignore — localStorage might be full or unavailable
    }
  }, 1000);

  return () => clearInterval(timer);
}, [firstName, lastName, email]);

// Clear on successful signup
const clearFormDraft = () => {
  try {
    localStorage.removeItem(FORM_STORAGE_KEY);
  } catch {}
};
```

**In handleSignUp success path:**
```typescript
reset();
clearFormDraft(); // ← Add this
router.push('/dashboard/onboarding');
```

---

## Fix 6: Synchronize Client & Backend Rate Limit Windows

**File:** `/src/hooks/useAuthRateLimit.ts`

**Replace the entire file:**
```typescript
'use client';

import { useState, useEffect, useRef } from 'react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000; // 60 seconds (match backend window!)

export function useAuthRateLimit(action: 'signup' | 'login') {
  const key = `rl_${action}`;
  const [lockedOut, setLockedOut] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkLockout();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function checkLockout() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) || '{}');
      if (stored.lockedUntil && Date.now() < stored.lockedUntil) {
        startCountdown(stored.lockedUntil);
      }
    } catch {
      // sessionStorage unavailable (SSR) — ignore
    }
  }

  function startCountdown(until: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLockedOut(true);

    const updateTimer = () => {
      const secs = Math.ceil((until - Date.now()) / 1000);
      if (secs <= 0) {
        setLockedOut(false);
        setSecondsLeft(0);
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        setSecondsLeft(secs);
      }
    };

    // Update immediately
    updateTimer();

    // Then update every second
    intervalRef.current = setInterval(updateTimer, 1000);
  }

  function recordFailure() {
    try {
      const raw = sessionStorage.getItem(key);
      const stored = raw ? JSON.parse(raw) : { count: 0 };
      stored.count = (stored.count || 0) + 1;

      if (stored.count >= MAX_ATTEMPTS) {
        stored.lockedUntil = Date.now() + LOCKOUT_MS; // 60s, not 15min
        startCountdown(stored.lockedUntil);
      }

      sessionStorage.setItem(key, JSON.stringify(stored));
    } catch {
      // Ignore sessionStorage errors
    }
  }

  function reset() {
    try {
      sessionStorage.removeItem(key);
    } catch {}
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLockedOut(false);
    setSecondsLeft(0);
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timerLabel = `${mins}:${String(secs).padStart(2, '0')}`;

  return { lockedOut, secondsLeft, timerLabel, recordFailure, reset };
}
```

---

## Fix 7: Improved Password Strength UI

**File:** `/src/app/(auth)/sign-up/page.tsx`

**Replace the strength display section (lines 274-288):**

```typescript
{strength && (
  <div className="mt-2 space-y-2">
    {/* Visual strength bar */}
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

    {/* Strength label + status */}
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-gray-700">
        {strength.score === 1
          ? '❌ Too weak'
          : strength.score === 2
          ? '✅ Good'
          : strength.score === 3
          ? '⭐ Strong'
          : '🔒 Very strong'}
      </span>

      {strength.score >= 2 ? (
        <span className="text-xs text-green-600 font-medium">✓ Ready to submit</span>
      ) : (
        <span className="text-xs text-red-600">
          {strength.score === 0
            ? 'Need 8+ characters'
            : 'Add a number or symbol'}
        </span>
      )}
    </div>

    {/* Requirement checklist */}
    <div className="text-xs text-gray-600 space-y-1 border-t pt-2 mt-2">
      <label className="flex items-center gap-2 cursor-default">
        <span className={password.length >= 8 ? 'text-green-600' : 'text-gray-400'}>
          {password.length >= 8 ? '✓' : '○'}
        </span>
        <span className="leading-tight">8+ characters</span>
      </label>

      <label className="flex items-center gap-2 cursor-default">
        <span className={/[0-9]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
          {/[0-9]/.test(password) ? '✓' : '○'}
        </span>
        <span className="leading-tight">At least one number (0-9)</span>
      </label>

      <label className="flex items-center gap-2 cursor-default">
        <span className={/[^A-Za-z0-9]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
          {/[^A-Za-z0-9]/.test(password) ? '✓' : '○'}
        </span>
        <span className="leading-tight">One special character (!@#$%, etc.)</span>
      </label>
    </div>
  </div>
)}
```

**Update the strength calculation to use "Good" instead of "Fair":**
```typescript
const levels = [
  { score: 1, label: 'Too weak', color: 'bg-red-400' },
  { score: 2, label: 'Good', color: 'bg-green-500' },   // Changed from "Fair" to "Good"
  { score: 3, label: 'Strong', color: 'bg-blue-500' },
  { score: 4, label: 'Very strong', color: 'bg-emerald-600' },
];
```

---

## Fix 8: Email Normalization

**File:** `/src/app/(auth)/sign-up/page.tsx`

**In the handleSignUp function, normalize email before any API call:**

```typescript
const handleSignUp = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);

  // Normalize email (lowercase + trim)
  const normalizedEmail = email.trim().toLowerCase();

  // ... password validation ...

  setLoading(true);

  try {
    // Step 1: API call with normalized email
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail, // ← Use normalized
        password,
      }),
    });

    // ... error handling ...

    // Step 2: Sign-in with normalized email
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail, // ← Same normalized email
      password,
    });

    // ... rest of code ...
  } catch (err) {
    // ...
  }
};
```

**Display normalized email to user (optional but builds trust):**
```typescript
{email && (
  <div className="text-xs text-gray-500 text-right">
    Signing up as: <strong>{email.trim().toLowerCase()}</strong>
  </div>
)}
```

---

## Fix 9: Loading State Feedback

**File:** `/src/app/(auth)/sign-up/page.tsx`

**Before the form, add progress indicator:**

```typescript
{loading && (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
    <div className="flex items-center gap-3 mb-2">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      <span className="font-medium text-blue-900">Creating your account...</span>
      <span className="animate-pulse text-blue-600">...</span>
    </div>
    <p className="text-sm text-blue-800">
      This usually takes a few seconds. Please don't refresh or close this tab.
    </p>
  </div>
)}
```

**Update button styling to show loading state more clearly:**

```typescript
<Button
  type="submit"
  className={`
    w-full h-12 text-base font-semibold rounded-xl transition-all
    ${loading
      ? 'bg-surgical-400 cursor-not-allowed shadow-none scale-95'
      : 'bg-surgical-600 hover:shadow-xl hover:scale-[1.02]'
    }
    ${lockedOut ? 'opacity-50 cursor-not-allowed' : ''}
  `}
  disabled={
    loading ||
    lockedOut ||
    !firstName.trim() ||
    !lastName.trim() ||
    !email.trim() ||
    (password.length > 0 && (!strength || strength.score < 2))
  }
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
```

---

## Fix 10: Error Message Accessibility & Mobile

**File:** `/src/app/(auth)/sign-up/page.tsx`

**Update error display with accessibility:**

```typescript
import { useRef, useEffect } from 'react';

// At top of component:
const errorRef = useRef<HTMLDivElement>(null);

// After error state declaration:
useEffect(() => {
  if (error && errorRef.current) {
    // Scroll error into view on mobile
    errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}, [error]);

// In JSX, replace error div:
{error && (
  <div
    ref={errorRef}
    className="
      bg-red-50 border-2 border-red-300 text-red-800
      px-4 py-4 rounded-lg
      text-sm sm:text-base
      mb-6 space-y-2
      animate-shake-once
    "
    role="alert"
    aria-live="polite"
    aria-atomic="true"
  >
    <div className="font-medium flex items-start gap-2">
      <span className="text-lg mt-0.5" aria-hidden="true">⚠️</span>
      <span>Sign-up Error</span>
    </div>
    <p className="text-red-700 break-words whitespace-pre-wrap">{error}</p>
  </div>
)}
```

---

## Fix 11: Password Reset Link on Sign-Up

**File:** `/src/app/(auth)/sign-up/page.tsx`

**After the form submission button, add:**

```typescript
{error && error.includes('already has an account') && (
  <>
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={() => router.push(`/forgot-password?email=${encodeURIComponent(email.trim().toLowerCase())}`)}
    >
      Reset Password →
    </Button>
    <Button
      type="button"
      className="w-full"
      onClick={() => router.push(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}`)}
    >
      Sign In →
    </Button>
  </>
)}
```

**Add link below form:**

```typescript
<p className="mt-6 text-center text-xs text-obsidian/60">
  <Link
    href="/forgot-password"
    className="text-surgical-600 hover:text-surgical-700 font-medium"
  >
    Forgot password?
  </Link>
  {' '}
  •
  {' '}
  <Link href="/login" className="text-surgical-600 hover:text-surgical-700 font-medium">
    Sign in
  </Link>
</p>
```

---

## Fix 12: Success Message Before Redirect

**File:** `/src/app/(auth)/sign-up/page.tsx`

**Add state for success message:**

```typescript
const [successMessage, setSuccessMessage] = useState<string | null>(null);
```

**Update success path:**

```typescript
if (signInError || !signInData.session) {
  // Account created but sign-in failed
  setError('Account created! Please sign in to continue.');
  setLoading(false);
  router.push('/login');
  return;
}

// Success!
reset();
clearFormDraft();

// Show success message for 2 seconds
setSuccessMessage('✅ Account created! Redirecting to dashboard...');

setTimeout(() => {
  router.push('/dashboard/onboarding');
}, 2000);
```

**Display success message:**

```typescript
{successMessage && (
  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-6 flex items-center gap-2">
    <CheckCircle className="h-5 w-5" />
    {successMessage}
  </div>
)}
```

---

## Testing Checklist

After implementing all fixes, test these scenarios:

### Critical Path
- [ ] Happy path: Fill form → Create account → Auto sign-in → /dashboard
- [ ] Duplicate email: See 409 → Click "Sign in" → Pre-filled /login
- [ ] Network timeout: Disconnect WiFi → See "Network error" (not "Unexpected error")
- [ ] Rate limit: Try 6 times → See "60s" countdown (not "15 min")
- [ ] Step 2 failure: Account created, sign-in fails → See message + redirect to /login

### Mobile Testing
- [ ] Error message not cut off (check on 390px width)
- [ ] Strength meter visible and readable
- [ ] Password requirements list responsive
- [ ] Loading indicator visible
- [ ] Buttons have adequate padding

### Accessibility Testing
- [ ] Screen reader announces error messages (`aria-live="polite"`)
- [ ] Form labels properly associated with inputs
- [ ] Tab order is logical
- [ ] Focus visible on all interactive elements

### Edge Cases
- [ ] Form persists on page refresh
- [ ] Uppercase email normalized (alice@EXAMPLE.COM works)
- [ ] Long error messages wrap properly
- [ ] Multiple errors show contextual options
- [ ] Browser autocomplete works smoothly

---

## Files Modified Summary

| File | Changes | Priority |
|------|---------|----------|
| `src/app/(auth)/sign-up/page.tsx` | All 9 frontend fixes | High |
| `src/app/api/auth/signup/route.ts` | Rate limiting + 429 handling | High |
| `src/hooks/useAuthRateLimit.ts` | Sync timeout to 60s | Medium |

---

## Deployment Notes

- **Backward Compatibility:** All changes are backward compatible
- **No Database Changes:** No schema changes required
- **No Dependencies:** No new npm packages needed
- **Rollback:** Can revert to previous version without data loss
- **Testing Environment:** Test all fixes in staging before production

---

## Success Metrics

After implementation, measure:
- 📉 Sign-up error rate (target: <2% after fixes)
- ⏱️ Median time to account creation (target: <5 seconds)
- 🔄 Form retry rate (target: <1 retry per 10 successful signups)
- 📱 Mobile sign-up completion rate (target: >85%)
- 🛡️ Rate-limiting false positives (target: <5 legitimate users blocked per week)
