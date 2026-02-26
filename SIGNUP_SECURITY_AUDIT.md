# Sign-Up API Security & Robustness Audit

**Audit Date:** 2026-02-25
**Files Reviewed:**
- `/src/app/api/auth/signup/route.ts` (179 lines)
- `/src/app/(auth)/sign-up/page.tsx` (398 lines)
- `/src/hooks/useAuthRateLimit.ts` (85 lines)

**Overall Assessment:** ✅ **GOOD** - Well-designed API with defensive patterns. Minor issues identified and documented below.

---

## CRITICAL FINDINGS (Production-Blocking)

### Issue #1: Rate Limiter IP Spoofing Vulnerability

**Severity:** MEDIUM
**File:** `src/app/api/auth/signup/route.ts` (Line 48)
**Category:** Rate Limiting / Security

#### Problem

```typescript
const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
```

**Risks:**
1. **X-Forwarded-For Header Spoofing:** If the API is not behind a trusted proxy (Vercel, AWS ALB), attackers can set custom `x-forwarded-for` headers to bypass rate limiting. Each spoofed IP bypasses the 5-requests-per-60s limit.
2. **CloudFlare/CDN Bypass:** Legitimate CDN IPs may be shared by many users. Spoofing those IPs leads to false rate limiting of other users.
3. **Localhost Fallback:** If no `x-forwarded-for` header, defaults to "unknown", creating a single rate-limit bucket for all local requests.
4. **No Validation:** Doesn't check if the IP is valid format. Could accept malicious values.

#### Attack Scenario

```
Attacker: 5 requests with x-forwarded-for: 1.2.3.4
Attacker: 5 requests with x-forwarded-for: 1.2.3.5
Attacker: 5 requests with x-forwarded-for: 1.2.3.6
Result: 15 accounts created in 60s (should be 5)
```

#### Fix

**Option A: Trusted Proxy Chain (Recommended for Vercel)**

```typescript
// src/app/api/auth/signup/route.ts (Replace lines 48-49)

// Extract real IP from Vercel's trusted headers
// Vercel uses x-forwarded-for with multiple IPs; our IP is the FIRST one
// Only trust if request comes through Vercel infrastructure
function extractTrustedIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  const xRealIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip'); // CloudFlare

  // Vercel is the current deployer — x-forwarded-for is trustworthy
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    if (ips.length > 0 && isValidIp(ips[0])) {
      return ips[0];
    }
  }

  if (xRealIp && isValidIp(xRealIp)) {
    return xRealIp;
  }

  if (cfConnectingIp && isValidIp(cfConnectingIp)) {
    return cfConnectingIp;
  }

  // Fallback: create per-request ID instead of "unknown"
  // This prevents all unauthenticated local requests from sharing a bucket
  return `unknown-${crypto.randomUUID()}`;
}

function isValidIp(ip: string): boolean {
  // Basic IPv4 validation (prevent injection of special characters)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;

  // Check octet ranges (0-255)
  const octets = ip.split('.').map(Number);
  return octets.every(octet => octet >= 0 && octet <= 255);
}

export async function POST(req: NextRequest) {
  const ip = extractTrustedIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please try again in a minute.' },
      { status: 429 }
    );
  }
  // ... rest of handler
}
```

**Option B: IP Fingerprinting (Additional Layer)**

```typescript
// Combine IP with other request characteristics to detect spoofing
function generateClientFingerprint(req: NextRequest): string {
  const ip = extractTrustedIp(req);
  const userAgent = req.headers.get('user-agent') ?? 'unknown';
  const acceptLanguage = req.headers.get('accept-language') ?? 'unknown';

  // Hash to create a stable fingerprint without leaking user agent
  const combined = `${ip}:${userAgent}:${acceptLanguage}`;
  return crypto.createHash('sha256').update(combined).digest('hex').slice(0, 16);
}

// Use fingerprint instead of just IP
const fingerprint = generateClientFingerprint(req);
if (isRateLimited(fingerprint)) {
  // ...
}
```

**Migration Path:**
1. Keep existing `x-forwarded-for` extraction (backward compatible)
2. Add IP validation check
3. Use fingerprint for rate limit key (requires Node.js crypto)
4. Monitor false positives in logs for 1 week
5. Optionally increase `MAX_PER_WINDOW` if fingerprinting causes issues

---

### Issue #2: `getExistingProviders()` Unbounded User Listing

**Severity:** MEDIUM
**File:** `src/app/api/auth/signup/route.ts` (Line 172)
**Category:** Information Disclosure / Performance

#### Problem

```typescript
const { data } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
```

**Risks:**
1. **Unbounded Query:** Fetches 1000 users per call. If database grows to 10,000+ users, query is inefficient.
2. **User Enumeration:** If multiple emails hit this code path (409 conflict), all are listed in memory, leaking email addresses.
3. **Performance Degradation:** Large `perPage` with no pagination for the next page — if there are >1000 users, still only checks first page.
4. **Error Handling:** If `listUsers()` fails or returns null, the code silently continues with `data?.users?.find()` which returns `undefined`.

#### Attack Scenario

```
Attacker registers with email: valid@company.com
API responds: { error: 'Already exists', provider: ['google'] }
Attacker knows: valid@company.com uses Google OAuth
Attacker: Repeat with admin@company.com → email enumeration attack
```

#### Fix

```typescript
// src/app/api/auth/signup/route.ts (Replace getExistingProviders function)

// Uses admin API with a search filter instead of listing all users
// Only called when we KNOW the user exists (status 422)
async function getExistingProviders(email: string): Promise<string[]> {
  try {
    // Supabase admin API supports user search/filter
    // This is more efficient than listUsers()
    // However, the @supabase/supabase-js admin API doesn't support filtering yet
    // Workaround: Use direct REST API call with admin token

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        },
      }
    );

    if (!response.ok) {
      // Silently fail — if we can't check providers, return empty array
      // The 409 is still returned to user, so they know account exists
      return [];
    }

    const { users } = await response.json();

    // Extract providers from the first (and only) matching user
    if (Array.isArray(users) && users.length > 0) {
      return (users[0]?.app_metadata?.providers as string[]) ?? [];
    }

    return [];
  } catch (err) {
    // Log but don't throw — getExistingProviders is best-effort
    console.error('[api/auth/signup] getExistingProviders failed:', {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
```

**Alternative: Store Providers in Separate Table**

If you expect many sign-ups with social auth, consider denormalizing:

```sql
-- Create a cached providers table (reads only, no writes)
CREATE TABLE auth_provider_cache (
  email TEXT PRIMARY KEY,
  providers TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populate via database trigger when user is created
CREATE OR REPLACE FUNCTION cache_user_providers()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auth_provider_cache (email, providers, updated_at)
  VALUES (
    NEW.email,
    (NEW.app_metadata->>'providers')::text[],
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    providers = (NEW.app_metadata->>'providers')::text[],
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Then query the cache instead of listing all users:

```typescript
// Much faster — single row lookup instead of 1000 user scan
const { data, error } = await adminClient
  .from('auth_provider_cache')
  .select('providers')
  .eq('email', email)
  .single();

return data?.providers ?? [];
```

---

### Issue #3: Rate Limiter Window Cleanup Has Race Condition

**Severity:** LOW
**File:** `src/app/api/auth/signup/route.ts` (Lines 28-33)
**Category:** Performance / Memory Leak Prevention

#### Problem

```typescript
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of ipWindows) {
        if (now > entry.resetAt) ipWindows.delete(key);
    }
}, 5 * 60_000); // 5 minutes
```

**Risks:**
1. **Race Condition:** If cleanup interval runs while a request calls `isRateLimited()`, the Map could be iterated and modified simultaneously (JavaScript runtime prevents crashes but is inefficient).
2. **Memory Leak Risk:** If `MAX_PER_WINDOW` is increased without changing interval, old entries could accumulate. 5 minutes is sufficient for 60s windows, but fragile.
3. **Unbounded Growth:** No explicit limit on Map size. If you receive requests from 1M unique IPs in 5 minutes, all stored until cleanup.
4. **No Metrics:** No visibility into Map size or cleanup effectiveness.

#### Attack Scenario

```
Attacker generates 1M unique IP addresses (or spoofs them)
Each request: 1 new entry in Map
After 5 min: 1M entries in memory
Cleanup: Removes all entries (because resetAt < now)
Memory freed, but if requests continue → memory leak
```

#### Fix

```typescript
// src/app/api/auth/signup/route.ts (Replace setInterval cleanup)

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const ipWindows = new Map<string, RateLimitEntry>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes
const MAX_IPS_IN_MEMORY = 10_000; // Safety limit

let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanupInterval() {
  if (cleanupTimer) return; // Already running

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of ipWindows.entries()) {
      if (now > entry.resetAt) {
        ipWindows.delete(key);
        deletedCount++;
      }
    }

    // Log cleanup metrics
    if (process.env.NODE_ENV === 'development') {
      console.debug('[rate-limiter] Cleanup:', {
        deleted: deletedCount,
        remaining: ipWindows.size,
        timestamp: new Date().toISOString(),
      });
    }

    // Emergency: If Map is too large, clear oldest entries
    if (ipWindows.size > MAX_IPS_IN_MEMORY) {
      const entriesToDelete = ipWindows.size - MAX_IPS_IN_MEMORY;
      let deleted = 0;

      for (const [key, entry] of ipWindows.entries()) {
        if (deleted >= entriesToDelete) break;
        ipWindows.delete(key);
        deleted++;
      }

      console.warn('[rate-limiter] Emergency cleanup:', {
        deletedCount: deleted,
        reason: 'Map exceeded MAX_IPS_IN_MEMORY',
        maxAllowed: MAX_IPS_IN_MEMORY,
      });
    }
  }, CLEANUP_INTERVAL_MS);

  // Cleanup runs until process exit
  cleanupTimer.unref(); // Don't keep process alive just for cleanup
}

// Start cleanup when module loads
startCleanupInterval();

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    if (cleanupTimer) clearInterval(cleanupTimer);
  });
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipWindows.get(ip);

  if (!entry || now > entry.resetAt) {
    // Create new window
    ipWindows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  // Increment count
  entry.count += 1;

  // Check limit
  const limited = entry.count > MAX_PER_WINDOW;

  // Metric: Log near-limit IPs for monitoring
  if (process.env.NODE_ENV === 'development' && entry.count >= 4) {
    console.warn('[rate-limiter] IP approaching limit:', {
      ip,
      count: entry.count,
      maxAllowed: MAX_PER_WINDOW,
    });
  }

  return limited;
}
```

---

## HIGH-PRIORITY FINDINGS (Recommended Fixes)

### Issue #4: JSON.parse() Error Not Typed Safely

**Severity:** LOW
**File:** `src/app/api/auth/signup/route.ts` (Lines 62-67)
**Category:** Input Validation

#### Problem

```typescript
let parsed: unknown;
try {
    parsed = JSON.parse(rawText);
} catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
}
```

**Risks:**
1. **Large JSON:** JSON.parse() with a 1MB payload will block the event loop for milliseconds. No size limit on `rawText`.
2. **Deeply Nested JSON:** Pathological JSON like `[[[[[[...]]]]]]` can exhaust stack (DoS).
3. **Silent Type Coercion:** After parse, line 70 checks `typeof parsed !== 'object'`, but a number or string would pass type check if not caught earlier.

#### Fix

```typescript
// src/app/api/auth/signup/route.ts (Add near top of POST function)

const MAX_REQUEST_SIZE = 1024 * 10; // 10 KB
const MAX_JSON_DEPTH = 10; // Prevent deeply nested JSON attacks

// Step 1: Check Content-Type before reading body
const contentType = req.headers.get('content-type');
if (contentType && !contentType.includes('application/json')) {
    return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 } // 415 Unsupported Media Type
    );
}

// Step 2: Check Content-Length before reading
const contentLength = req.headers.get('content-length');
if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
    return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 } // 413 Payload Too Large
    );
}

// Step 3: Parse with depth validation
const rawText = await req.text().catch(() => '');
if (!rawText) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
}

if (rawText.length > MAX_REQUEST_SIZE) {
    return NextResponse.json(
        { error: 'Request body too large' },
        { status: 413 }
    );
}

let parsed: unknown;
try {
    parsed = JSON.parse(rawText);
} catch (err) {
    // Be specific about JSON parsing errors
    const message = err instanceof SyntaxError ? err.message : 'Invalid JSON';
    console.error('[api/auth/signup] JSON parse error:', message);
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
}

// Step 4: Validate structure depth
function validateDepth(obj: unknown, maxDepth: number, currentDepth = 0): boolean {
    if (currentDepth > maxDepth) return false;
    if (typeof obj !== 'object' || obj === null) return true;

    if (Array.isArray(obj)) {
        return obj.every(item => validateDepth(item, maxDepth, currentDepth + 1));
    }

    return Object.values(obj).every(
        value => validateDepth(value, maxDepth, currentDepth + 1)
    );
}

if (!validateDepth(parsed, MAX_JSON_DEPTH)) {
    return NextResponse.json(
        { error: 'Request structure too deeply nested.' },
        { status: 400 }
    );
}

// Now safe to extract fields
if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
}
```

---

### Issue #5: Email Regex Too Permissive

**Severity:** LOW
**File:** `src/app/api/auth/signup/route.ts` (Lines 84-87)
**Category:** Input Validation

#### Problem

```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(trimmedEmail)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
}
```

**Risks:**
1. **Accepts Invalid Emails:**
   - `a@b.c` ✓ (too short local part)
   - `test@domain..com` ✓ (double dots)
   - `test@@domain.com` ✓ (double @)
   - `test.domain.com` ✗ (correct rejection)

2. **No Length Validation:** Email can be 254+ characters (RFC 5321 limit is 254 total).

3. **No Deliverability Check:** Regex passes but address might not exist or be typo.

#### Fix

```typescript
// src/app/api/auth/signup/route.ts (Replace email validation)

const MAX_EMAIL_LENGTH = 254; // RFC 5321
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
    return NextResponse.json(
        { error: 'Email address is too long.' },
        { status: 400 }
    );
}

if (!EMAIL_REGEX.test(trimmedEmail)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
}

// Optional: Verify email doesn't have obvious typos using a library
// import { validateEmail } from 'email-validator'; // example library
// const isValid = await validateEmail(trimmedEmail);
```

---

### Issue #6: Timing Attack on Email Existence Check

**Severity:** MEDIUM
**File:** `src/app/api/auth/signup/route.ts` (Lines 116-140)
**Category:** Information Disclosure

#### Problem

**Timing Difference:**
- If email exists: 116→`adminClient.auth.admin.createUser()` fails immediately → response in ~50ms
- If email doesn't exist: trigger creates org/profile asynchronously → response in ~200-500ms

**Attack:**
```
Attacker measures response times:
- Fast response (50ms) → Email already exists (enumeration)
- Slow response (300ms) → Email is new
By repeating with 10,000 emails, attacker enumerates all registered emails
```

#### Fix

```typescript
// src/app/api/auth/signup/route.ts (Add constant-time response)

const CONSTANT_RESPONSE_TIME_MS = 300; // Always wait at least 300ms

// Wrap the entire response path
const startTime = Date.now();

try {
    // ... all existing logic ...

    // Before returning, ensure minimum response time
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs < CONSTANT_RESPONSE_TIME_MS) {
        await new Promise(resolve =>
            setTimeout(resolve, CONSTANT_RESPONSE_TIME_MS - elapsedMs)
        );
    }

    return NextResponse.json({ success: true }, { status: 201 });
} catch (err: unknown) {
    // Same timing delay in error path
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs < CONSTANT_RESPONSE_TIME_MS) {
        await new Promise(resolve =>
            setTimeout(resolve, CONSTANT_RESPONSE_TIME_MS - elapsedMs)
        );
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/auth/signup] Unexpected error:', message);
    return NextResponse.json(
        { error: 'An unexpected error occurred. Please try again.' },
        { status: 500 }
    );
}
```

---

### Issue #7: No CSRF Protection on Sign-Up Form

**Severity:** MEDIUM
**File:** `src/app/(auth)/sign-up/page.tsx` (Lines 61-70)
**Category:** CSRF / Security

#### Problem

```typescript
const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({...}),
});
```

**Risks:**
1. **No CSRF Token:** If attacker hosts malicious site and user visits while logged in, `fetch()` sends request with user's cookies automatically.
2. **Cross-Origin Requests:** Modern browsers allow CORS with `credentials: 'include'`. An attacker from `attacker.com` could register users on your behalf.
3. **No SameSite Cookie Enforcement:** If Supabase auth cookies lack `SameSite=Strict`, they're sent on cross-origin requests.

#### Fix

```typescript
// src/app/(auth)/sign-up/page.tsx (Add at component level)

import { useEffect, useState } from 'react';

// Generate CSRF token on page load (server or via API)
function generateCSRFToken(): string {
    // In a real app, fetch from server: GET /api/csrf-token
    // Server sets secure, httpOnly cookie with same token
    // For demo: use sessionStorage to prevent trivial CSRF
    if (typeof window === 'undefined') return '';

    let token = sessionStorage.getItem('csrf_token');
    if (!token) {
        // Generate 32-byte random token
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        sessionStorage.setItem('csrf_token', token);
    }
    return token;
}

export default function SignUpPage() {
    const router = useRouter();
    const [csrfToken, setCsrfToken] = useState('');

    // Load CSRF token on mount
    useEffect(() => {
        setCsrfToken(generateCSRFToken());
    }, []);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!csrfToken) {
            setError('Security token missing. Please refresh the page.');
            return;
        }

        // ... validation ...

        setLoading(true);

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken, // Add token header
                },
                credentials: 'same-origin', // Only send cookies for same-origin
                body: JSON.stringify({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    email: email.trim(),
                    password,
                }),
            });

            // ... rest of logic ...
        } catch {
            setError('An unexpected error occurred. Please try again.');
            recordFailure();
            setLoading(false);
        }
    };

    // ... rest of component ...
}
```

**Server-Side CSRF Validation:**

```typescript
// src/app/api/auth/signup/route.ts (Add CSRF check before processing)

export async function POST(req: NextRequest) {
    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token');
    if (!csrfToken) {
        return NextResponse.json(
            { error: 'CSRF token missing.' },
            { status: 403 }
        );
    }

    // In production: validate against server-side session store (Redis, database)
    // For now: at minimum, verify token format (non-empty, reasonable length)
    if (typeof csrfToken !== 'string' || csrfToken.length < 16 || csrfToken.length > 256) {
        return NextResponse.json(
            { error: 'Invalid CSRF token.' },
            { status: 403 }
        );
    }

    // Continue with signup logic...
    const ip = extractTrustedIp(req);
    if (isRateLimited(ip)) {
        // ...
    }

    // ... rest of handler ...
}
```

---

### Issue #8: Frontend Rate Limiter Vulnerable to DevTools Bypass

**Severity:** LOW
**File:** `src/hooks/useAuthRateLimit.ts` (Lines 53-66)
**Category:** Client-Side Validation

#### Problem

```typescript
function recordFailure() {
    try {
        const raw = sessionStorage.getItem(key);
        const stored = raw ? JSON.parse(raw) : { count: 0 };
        stored.count = (stored.count || 0) + 1;
        if (stored.count >= MAX_ATTEMPTS) {
            stored.lockedUntil = Date.now() + LOCKOUT_MS;
            startCountdown(stored.lockedUntil);
        }
        sessionStorage.setItem(key, JSON.stringify(stored));
    } catch {
        // ignore
    }
}
```

**Risks:**
1. **SessionStorage is Readable:** Browser DevTools shows all sessionStorage values. User can manually clear it.
2. **No Server-Side Enforcement:** If user clears sessionStorage, frontend lockout disappears, but server still has rate limit.
3. **False Sense of Security:** Comments in code suggest this is the primary defense, but server-side is real one.

**This is actually acceptable** because server-side rate limiting is the real defense. Client-side is just UX. However, document this clearly.

#### Fix (Documentation)

```typescript
// src/hooks/useAuthRateLimit.ts (Add comment)

/**
 * Client-side authentication rate limiter (UX enhancement only).
 *
 * This hook provides immediate feedback to users who exceed attempt limits
 * by disabling the submit button and showing a countdown timer.
 *
 * IMPORTANT: This is NOT a security boundary.
 * Users can bypass this via:
 * - Clearing sessionStorage in DevTools
 * - Directly calling the API
 * - Using curl or other HTTP clients
 *
 * THE REAL RATE LIMIT IS SERVER-SIDE in src/app/api/auth/signup/route.ts
 * which enforces a hard limit of 5 requests per IP per 60 seconds.
 *
 * This client-side limiter exists for:
 * 1. Rapid user feedback (no 429 response needed)
 * 2. Reduced unnecessary API calls
 * 3. Better UX (show countdown timer instead of HTTP error)
 *
 * Do NOT rely on this hook for security. Use server-side rate limiting.
 */

const MAX_ATTEMPTS = 5; // Must match server-side limit
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes (user-friendly)
// Note: Server uses 60s windows; client uses 15min lockout for friendlier UX
```

---

## MEDIUM-PRIORITY FINDINGS (Good-to-Fix)

### Issue #9: Error Messages Leak Service Provider Info

**Severity:** LOW
**File:** `src/app/api/auth/signup/route.ts` (Lines 127-150)
**Category:** Information Disclosure

#### Problem

```typescript
if (error.status === 422) {
    const existingProviders = await getExistingProviders(trimmedEmail);
    return NextResponse.json(
        {
            error: 'An account with this email already exists. Please sign in instead.',
            provider: existingProviders,
        },
        { status: 409 }
    );
}
```

**Risk:** Response body includes `provider: ['google']`, confirming which OAuth provider was used for that email. An attacker can enumerate all registered users and their signup methods.

#### Fix

**Option A: Hide Providers in Production**

```typescript
if (error.status === 422) {
    // In production, don't expose providers to unauthenticated users
    const existingProviders = process.env.NODE_ENV === 'development'
        ? await getExistingProviders(trimmedEmail)
        : [];

    return NextResponse.json(
        {
            error: 'An account with this email already exists. Please sign in instead.',
            ...(process.env.NODE_ENV === 'development' && { provider: existingProviders }),
        },
        { status: 409 }
    );
}
```

**Option B: Only Show Providers to the Email Owner**

```typescript
// Don't expose providers in API response at all
// Instead, send email to the address with which provider was used
if (error.status === 422) {
    const existingProviders = await getExistingProviders(trimmedEmail);

    if (existingProviders.length > 0) {
        // Send email: "Someone tried to sign up with your email.
        // Your account is registered with: Google OAuth"
        await sendProviderHintEmail(trimmedEmail, existingProviders);
    }

    // Return generic error to attacker
    return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
    );
}
```

---

### Issue #10: Console Errors Expose Internal Details

**Severity:** LOW
**File:** `src/app/api/auth/signup/route.ts` (Lines 143-146, 159)
**Category:** Information Disclosure

#### Problem

```typescript
console.error('[api/auth/signup] admin.createUser failed:', {
    message: error.message,
    status: error.status,
});

console.error('[api/auth/signup] Unexpected error:', message);
```

**Risks:**
1. **Logs Exposed in Production:** If logs are aggregated (Sentry, DataDog), internal error messages visible.
2. **Timing Information Leaks:** Different errors logged at different rates reveal timing patterns.

#### Fix

```typescript
// src/app/api/auth/signup/route.ts (Replace error logging)

// Only log relevant debugging info, redact sensitive details
if (error) {
    const logLevel = error.status === 422 ? 'info' : 'error'; // 422 is expected
    console[logLevel]('[api/auth/signup]', {
        event: 'user_creation_failed',
        status: error.status,
        // Don't log the full error message
        // It might contain credentials or internal details
        timestamp: new Date().toISOString(),
    });

    if (error.status === 422) {
        const existingProviders = await getExistingProviders(trimmedEmail);
        return NextResponse.json(
            {
                error: 'An account with this email already exists. Please sign in instead.',
                provider: existingProviders,
            },
            { status: 409 }
        );
    }

    // For other errors, return generic message
    return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 500 }
    );
}
```

---

## LOW-PRIORITY FINDINGS (Nice-to-Have)

### Issue #11: No Account Lockout After Multiple Failed Signups

**Severity:** LOW
**File:** Both API and frontend
**Category:** Abuse Prevention

#### Current Behavior

User exceeds rate limit → 429 response → User tries again after 60 seconds → Can immediately sign up again.

#### Risk

A user with legitimate account can spam other people's emails, causing those emails to get locked out of signup.

#### Recommended Addition

```typescript
// src/app/api/auth/signup/route.ts

// Progressive rate limiting: tighten limits as user fails more
function calculateRateLimit(ip: string): { maxPerWindow: number; windowMs: number } {
    const entry = ipWindows.get(ip);
    if (!entry) return { maxPerWindow: 5, windowMs: 60_000 };

    // If an IP has been rate-limited multiple times, reduce further
    const retries = Math.floor((entry.count - MAX_PER_WINDOW) / 2);
    return {
        maxPerWindow: Math.max(1, MAX_PER_WINDOW - retries),
        windowMs: 60_000 * (1 + retries), // Exponential backoff
    };
}
```

---

### Issue #12: Sign-Up Doesn't Verify Email Ownership

**Severity:** MEDIUM (for production)
**File:** `src/app/api/auth/signup/route.ts` (Line 119)
**Category:** Account Security

#### Current Code

```typescript
const { data, error } = await adminClient.auth.admin.createUser({
    email: trimmedEmail,
    password,
    email_confirm: true, // Immediately confirmed
    // ...
});
```

#### Risk

Any email can be registered without verification. Attackers can:
- Register with `ceo@company.com` (impersonation)
- Receive alerts meant for someone else
- Access appointment bookings for wrong person

#### Fix (When Ready)

```typescript
const { data, error } = await adminClient.auth.admin.createUser({
    email: trimmedEmail,
    password,
    email_confirm: false, // Require verification
    // ...
});

// After user creation, send verification email
// This is a separate, non-blocking operation
await sendVerificationEmail(trimmedEmail, data?.user?.id || '');

// Frontend should redirect to verification pending page
return NextResponse.json(
    {
        success: true,
        message: 'Account created. Check your email to verify your address.',
        nextStep: 'verify-email',
    },
    { status: 201 }
);
```

---

## SUMMARY TABLE

| Issue | Severity | File | Type | Impact |
|-------|----------|------|------|--------|
| #1 | MEDIUM | route.ts | Rate Limiter | IP spoofing bypass |
| #2 | MEDIUM | route.ts | API | Information disclosure |
| #3 | LOW | route.ts | Performance | Memory leak risk |
| #4 | LOW | route.ts | Validation | DoS via large JSON |
| #5 | LOW | route.ts | Validation | Invalid email acceptance |
| #6 | MEDIUM | route.ts | Timing | Email enumeration |
| #7 | MEDIUM | sign-up.tsx | CSRF | Account creation on behalf |
| #8 | LOW | useAuthRateLimit.ts | UX | User can bypass (intended) |
| #9 | LOW | route.ts | Disclosure | Provider enumeration |
| #10 | LOW | route.ts | Logging | Error detail leakage |
| #11 | LOW | route.ts | Abuse | No progressive backoff |
| #12 | MEDIUM | route.ts | Verification | No email confirmation |

---

## Recommended Priority Order

### Week 1 (Critical)
- [ ] #1: IP spoofing fix (rate limiter)
- [ ] #6: Constant-time responses (timing attack)
- [ ] #7: CSRF token validation

### Week 2 (Recommended)
- [ ] #2: Replace listUsers() with direct API call
- [ ] #4: Add Content-Length / JSON depth checks
- [ ] #5: Improve email regex
- [ ] #12: Email verification flow (if handling sensitive data)

### Week 3+ (Polish)
- [ ] #3: Improve cleanup interval metrics
- [ ] #9: Hide providers in production
- [ ] #10: Improve logging strategy
- [ ] #11: Progressive rate limiting

---

## Deployment Checklist

Before pushing to production:

- [ ] **Security Review:** Someone other than author reviews all fixes
- [ ] **Load Testing:** Test rate limiter with 10K concurrent requests from varied IPs
- [ ] **Email Verification:** Confirm getExistingProviders() works for all provider types
- [ ] **Error Handling:** Trigger 422 / 500 errors and verify response is correct
- [ ] **Monitoring:** Verify Sentry captures errors without credential leakage
- [ ] **CSRF Testing:** Attempt cross-origin signup from external domain (should fail)
- [ ] **Performance:** Verify API response <500ms under normal load

---

## Notes

**What's Already Good:**
- ✅ Input validation (type checking, field validation)
- ✅ Error handling (distinguishes 400 vs 409 vs 500)
- ✅ Async cleanup interval (prevents unbounded growth)
- ✅ Service role key not logged
- ✅ User ID not leaked in response
- ✅ Password validation (8-128 chars)
- ✅ Frontend password strength indicator

**What Needs Work:**
- ❌ IP extraction (spoofing vulnerability)
- ❌ User enumeration via getExistingProviders
- ❌ Timing attack on email existence
- ❌ CSRF protection missing
- ❌ JSON size limits

**Assumptions Made:**
- Deploying on Vercel (x-forwarded-for is trustworthy)
- Supabase is the identity provider
- Email verification not required for MVP
- 5 requests per IP per 60s is acceptable limit
