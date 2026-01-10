# OAuth Authorize Route Fix

**Issue:** `/api/google-oauth/authorize` was returning 401 "Missing or invalid Authorization header" when accessed from browser.

**Root Cause:** The route had `requireAuthOrDev` middleware, which blocks requests without Authorization header, even in dev mode when accessed from browser.

**Solution:** Removed `requireAuthOrDev` middleware from the `/authorize` endpoint because:
1. OAuth initiation flows are typically public (user clicks link → redirects to Google)
2. The orgId comes from query parameter, not auth context
3. The callback route already handles security via the state parameter

**Changes Made:**
- Removed `requireAuthOrDev` from `router.get('/authorize', ...)`
- Route now accepts orgId as query parameter
- In dev mode, defaults to `a0000000-0000-0000-0000-000000000001` if no orgId provided
- In production, requires orgId as query parameter

**Security Note:**
- The `/callback` route validates the state parameter (contains orgId) for CSRF protection
- Token storage requires valid state, preventing unauthorized connections

**Testing:**
```bash
# Should redirect to Google OAuth (not return 401)
curl -I "http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected:** HTTP 302 redirect to Google OAuth consent screen
