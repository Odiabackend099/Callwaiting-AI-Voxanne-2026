# Senior Code Review: Authentication System

## Executive Summary
The authentication system has **critical production issues** that cause redirects to fail in deployed environments. This review identifies 12 major issues across 3 files with specific fixes and reasoning.

---

## File 1: `src/contexts/AuthContext.tsx`

### Issue 1: CRITICAL - Hardcoded Client-Side Domain Detection
**Severity:** CRITICAL | **Lines:** 125, 170, 195

**Problem:**
```typescript
// ❌ BROKEN
emailRedirectTo: `${window.location.origin}/auth/callback`
redirectTo: `${window.location.origin}/auth/callback`
```

**Why it fails:**
- `window.location.origin` is evaluated at runtime in the browser
- In production behind a CDN/proxy, this resolves to the proxy domain, not your actual domain
- Supabase OAuth requires exact domain match configured in dashboard
- Email verification links redirect to wrong domain

**Fix:**
```typescript
// ✅ FIXED
emailRedirectTo: getAuthCallbackUrl()
redirectTo: getAuthCallbackUrl()
```

**Reasoning:** Environment variables are evaluated at build time and are reliable across all deployment environments.

---

### Issue 2: LOGICAL ERROR - Missing Error Handling in OAuth Flow
**Severity:** HIGH | **Lines:** 164-189

**Problem:**
```typescript
const signInWithGoogle = async () => {
    try {
        const { error } = await supabase.auth.signInWithOAuth({...});
        if (error) {
            setError(error.message);
            return { error };
        }
        return { error: null };
    } catch (err) {
        // ...
    }
};
```

**Why it's wrong:**
- OAuth doesn't immediately return an error; it redirects to Google
- If redirect fails silently, user sees no feedback
- No timeout handling if redirect doesn't happen
- No logging for debugging production issues

**Fix:**
```typescript
const signInWithGoogle = async () => {
    try {
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: getAuthCallbackUrl(),
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });

        if (error) {
            console.error('[Auth] Google OAuth error:', error);
            setError(error.message);
            return { error };
        }

        // OAuth flow initiated - redirect will happen
        // Set a timeout to detect if redirect fails
        const redirectTimeout = setTimeout(() => {
            console.warn('[Auth] OAuth redirect did not occur within 5s');
            setError('Authentication redirect failed. Please try again.');
        }, 5000);

        return { error: null, timeout: redirectTimeout };
    } catch (err) {
        const error = err instanceof Error ? err : new Error('Google sign in failed');
        console.error('[Auth] Google sign in exception:', error);
        setError(error.message);
        return { error };
    }
};
```

**Reasoning:** 
- Explicit logging helps diagnose production issues
- Timeout detection catches redirect failures
- Better error messaging for users

---

### Issue 3: EDGE CASE - No Validation of Email Format
**Severity:** MEDIUM | **Lines:** 118-141

**Problem:**
```typescript
const signUp = async (email: string, password: string, userData?: object) => {
    try {
        setError(null);
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            // ...
        });
        // No email validation before sending to Supabase
    }
};
```

**Why it's wrong:**
- Invalid emails waste API calls
- Supabase returns generic error message
- No client-side validation saves bandwidth and improves UX
- Should validate before making API call

**Fix:**
```typescript
const validateEmail = (email: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return 'Please enter a valid email address';
    }
    return null;
};

const signUp = async (email: string, password: string, userData?: object) => {
    try {
        setError(null);
        
        // Validate email before API call
        const emailError = validateEmail(email);
        if (emailError) {
            setError(emailError);
            return { user: null, error: new Error(emailError) };
        }
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: getAuthCallbackUrl(),
                data: userData
            }
        });
        // ...
    }
};
```

**Reasoning:** Client-side validation reduces API calls, improves UX, and catches obvious errors early.

---

### Issue 4: PERFORMANCE - Unnecessary State Updates in onAuthStateChange
**Severity:** MEDIUM | **Lines:** 71-86

**Problem:**
```typescript
const { data } = supabase.auth.onAuthStateChange(
    async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
            await fetchUserSettings(session.user.id);
        } else {
            setUserSettings(null);
        }

        if (event === 'SIGNED_OUT') {
            router.push('/login');
        }
    }
);
```

**Why it's inefficient:**
- Multiple state updates in sequence cause multiple re-renders
- `fetchUserSettings` is async but not awaited properly
- No error handling if settings fetch fails
- `router.push` happens after state updates, causing layout shift

**Fix:**
```typescript
const { data } = supabase.auth.onAuthStateChange(
    async (event, session) => {
        // Batch state updates
        const newUser = session?.user ?? null;
        
        if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setUserSettings(null);
            router.push('/login');
            return;
        }

        setSession(session);
        setUser(newUser);

        if (newUser) {
            try {
                await fetchUserSettings(newUser.id);
            } catch (err) {
                console.error('[Auth] Failed to fetch user settings:', err);
                // Don't block auth flow on settings fetch failure
            }
        } else {
            setUserSettings(null);
        }
    }
);
```

**Reasoning:** Batched updates reduce re-renders, explicit error handling prevents silent failures.

---

### Issue 5: SECURITY - No Rate Limiting on Auth Attempts
**Severity:** MEDIUM | **Lines:** 118-141, 143-162

**Problem:**
```typescript
const signUp = async (email: string, password: string, userData?: object) => {
    try {
        setError(null);
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            // ...
        });
        // No rate limiting - user can spam signup attempts
    }
};
```

**Why it's vulnerable:**
- No rate limiting allows brute force attacks
- No cooldown between failed attempts
- No tracking of failed attempts per IP/email

**Fix:**
```typescript
// Add rate limiting state
const [signUpAttempts, setSignUpAttempts] = useState<{ [key: string]: number[] }>({});
const [signInAttempts, setSignInAttempts] = useState<{ [key: string]: number[] }>({});

const isRateLimited = (email: string, attempts: { [key: string]: number[] }, maxAttempts = 5, windowMs = 15 * 60 * 1000): boolean => {
    const now = Date.now();
    const userAttempts = attempts[email] || [];
    const recentAttempts = userAttempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
        return true;
    }
    
    attempts[email] = [...recentAttempts, now];
    return false;
};

const signUp = async (email: string, password: string, userData?: object) => {
    try {
        setError(null);
        
        if (isRateLimited(email, signUpAttempts)) {
            setError('Too many signup attempts. Please try again in 15 minutes.');
            return { user: null, error: new Error('Rate limited') };
        }
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: getAuthCallbackUrl(),
                data: userData
            }
        });
        // ...
    }
};
```

**Reasoning:** Rate limiting prevents brute force attacks and abuse.

---

### Issue 6: MAINTAINABILITY - Magic Strings in Error Messages
**Severity:** LOW | **Lines:** Throughout

**Problem:**
```typescript
const error = err instanceof Error ? err : new Error('Sign up failed');
const error = err instanceof Error ? err : new Error('Sign in failed');
const error = err instanceof Error ? err : new Error('Google sign in failed');
```

**Why it's bad:**
- Error messages duplicated across multiple functions
- Hard to update messaging consistently
- No error codes for analytics/debugging

**Fix:**
```typescript
// Create error constants
const AUTH_ERRORS = {
    SIGNUP_FAILED: 'Failed to create account. Please try again.',
    SIGNIN_FAILED: 'Failed to sign in. Please check your credentials.',
    GOOGLE_SIGNIN_FAILED: 'Google sign in failed. Please try again.',
    RESET_PASSWORD_FAILED: 'Failed to send password reset email.',
    UPDATE_PASSWORD_FAILED: 'Failed to update password.',
    SIGNOUT_FAILED: 'Failed to sign out.',
    SETTINGS_UPDATE_FAILED: 'Failed to update settings.',
} as const;

const signUp = async (email: string, password: string, userData?: object) => {
    try {
        // ...
    } catch (err) {
        const error = err instanceof Error ? err : new Error(AUTH_ERRORS.SIGNUP_FAILED);
        setError(error.message);
        return { user: null, error };
    }
};
```

**Reasoning:** Centralized error messages are easier to maintain and update.

---

## File 2: `src/app/auth/callback/route.ts`

### Issue 7: CRITICAL - Domain Mismatch in Callback Redirect
**Severity:** CRITICAL | **Line:** 35

**Problem:**
```typescript
// ❌ BROKEN
return NextResponse.redirect(requestUrl.origin + next);
```

**Why it fails:**
- `requestUrl.origin` is the request origin, not your app domain
- Behind Vercel/CDN, this is the proxy domain
- Supabase redirects to `https://your-domain/auth/callback?code=...`
- But the callback redirects to the proxy domain
- Creates infinite redirect loop or 404

**Fix:**
```typescript
// ✅ FIXED
const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;
const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
return NextResponse.redirect(baseUrl + next);
```

**Reasoning:** Environment variables are reliable across all deployment environments.

---

### Issue 8: EDGE CASE - No Error Handling for Code Exchange Failure
**Severity:** HIGH | **Lines:** 9-30

**Problem:**
```typescript
if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(...);
    await supabase.auth.exchangeCodeForSession(code);
}

// Always redirects, even if code exchange failed
const next = requestUrl.searchParams.get('next') || '/dashboard';
return NextResponse.redirect(requestUrl.origin + next);
```

**Why it's wrong:**
- If code exchange fails, user is still redirected
- No error message shown to user
- Silent failure is hard to debug
- User ends up on dashboard without being authenticated

**Fix:**
```typescript
export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const error = requestUrl.searchParams.get('error');
    const errorDescription = requestUrl.searchParams.get('error_description');

    // Handle OAuth errors from Supabase
    if (error) {
        const errorMessage = errorDescription || error;
        console.error('[Auth Callback] OAuth error:', errorMessage);
        
        // Redirect to login with error message
        const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin);
        loginUrl.searchParams.set('error', errorMessage);
        return NextResponse.redirect(loginUrl.toString());
    }

    if (code) {
        try {
            const cookieStore = await cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        get(name: string) {
                            return cookieStore.get(name)?.value;
                        },
                        set(name: string, value: string, options: any) {
                            cookieStore.set({ name, value, ...options });
                        },
                        remove(name: string, options: any) {
                            cookieStore.set({ name, value: '', ...options });
                        },
                    },
                }
            );

            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
            if (exchangeError) {
                console.error('[Auth Callback] Code exchange failed:', exchangeError);
                const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin);
                loginUrl.searchParams.set('error', 'Authentication failed. Please try again.');
                return NextResponse.redirect(loginUrl.toString());
            }
        } catch (err) {
            console.error('[Auth Callback] Exception during code exchange:', err);
            const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin);
            loginUrl.searchParams.set('error', 'An unexpected error occurred. Please try again.');
            return NextResponse.redirect(loginUrl.toString());
        }
    }

    // Successful authentication
    const next = requestUrl.searchParams.get('next') || '/dashboard';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;
    const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
    
    return NextResponse.redirect(baseUrl + next);
}
```

**Reasoning:** Explicit error handling and logging helps diagnose authentication failures.

---

### Issue 9: SECURITY - No CSRF Protection
**Severity:** MEDIUM | **Lines:** Throughout

**Problem:**
```typescript
// No state parameter validation
const code = requestUrl.searchParams.get('code');
```

**Why it's vulnerable:**
- OAuth requires CSRF protection via `state` parameter
- Without it, attacker can redirect user to their OAuth app
- Supabase should handle this, but explicit validation is safer

**Fix:**
```typescript
// Store state in session/cookie during OAuth initiation
// Verify state in callback
const state = requestUrl.searchParams.get('state');
const storedState = cookieStore.get('oauth_state')?.value;

if (!state || state !== storedState) {
    console.error('[Auth Callback] CSRF validation failed');
    const loginUrl = new URL('/login', process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin);
    loginUrl.searchParams.set('error', 'Invalid authentication request.');
    return NextResponse.redirect(loginUrl.toString());
}
```

**Reasoning:** CSRF protection prevents OAuth hijacking attacks.

---

## File 3: `src/lib/auth-redirect.ts` (NEW FILE)

### Issue 10: DESIGN - Centralized Redirect URL Logic
**Severity:** N/A (NEW FILE) | **Purpose:** Single source of truth

**Implementation:**
```typescript
export function getRedirectUrl(path: string = '/auth/callback'): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  if (!appUrl) {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${path}`;
    }
    return `http://localhost:3000${path}`;
  }
  
  const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
}
```

**Benefits:**
- ✅ Single source of truth for redirect URLs
- ✅ Consistent URL normalization
- ✅ Easy to test
- ✅ Easy to extend with new redirect paths

---

## File 4: `.env.local` (UPDATED)

### Issue 11: MISSING - Production Domain Configuration
**Severity:** CRITICAL | **Solution:** Add environment variable

```bash
# ✅ ADDED
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For production (Vercel):**
```bash
NEXT_PUBLIC_APP_URL=https://callwaitingai.dev
```

---

## Summary Table

| Issue | File | Severity | Type | Impact |
|-------|------|----------|------|--------|
| 1 | AuthContext.tsx | CRITICAL | Logical | Auth redirects to localhost in prod |
| 2 | AuthContext.tsx | HIGH | Error Handling | No feedback on OAuth failures |
| 3 | AuthContext.tsx | MEDIUM | Edge Case | Invalid emails waste API calls |
| 4 | AuthContext.tsx | MEDIUM | Performance | Unnecessary re-renders |
| 5 | AuthContext.tsx | MEDIUM | Security | No rate limiting on auth attempts |
| 6 | AuthContext.tsx | LOW | Maintainability | Duplicated error messages |
| 7 | callback/route.ts | CRITICAL | Logical | Callback redirects to wrong domain |
| 8 | callback/route.ts | HIGH | Error Handling | Silent failures on code exchange |
| 9 | callback/route.ts | MEDIUM | Security | No CSRF protection |
| 10 | auth-redirect.ts | N/A | Design | Centralized redirect logic |
| 11 | .env.local | CRITICAL | Config | Missing production domain |
| 12 | Overall | HIGH | Architecture | No comprehensive error logging |

---

## Recommendations

### Immediate (Before Production)
1. ✅ Add `NEXT_PUBLIC_APP_URL` environment variable
2. ✅ Replace `window.location.origin` with helper function
3. ✅ Fix callback route to use environment variable
4. ✅ Add error handling in callback route
5. ✅ Verify Supabase redirect URLs in dashboard

### Short Term (Next Sprint)
1. Add email validation before API calls
2. Add rate limiting on auth attempts
3. Add CSRF protection with state parameter
4. Centralize error messages
5. Add comprehensive error logging

### Long Term (Future)
1. Add analytics for auth success rates
2. Add multi-factor authentication
3. Add session management improvements
4. Add audit logging for security events
5. Add automated tests for auth flows

---

## Testing Checklist

- [ ] Local dev: Email signup → verify link → redirect to dashboard
- [ ] Local dev: Google OAuth → authorize → redirect to dashboard
- [ ] Local dev: Password reset → verify link → redirect to update-password
- [ ] Production: Email signup → verify link → redirect to dashboard
- [ ] Production: Google OAuth → authorize → redirect to dashboard
- [ ] Production: Password reset → verify link → redirect to update-password
- [ ] Production: Invalid email → error message
- [ ] Production: Multiple signup attempts → rate limited
- [ ] Production: OAuth error → error message on login page
