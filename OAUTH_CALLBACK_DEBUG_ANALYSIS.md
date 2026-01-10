# OAuth Callback Debug Analysis

## === STEP-BACK INSIGHTS ===

### Assumptions That Must Be True:
* Google redirects back to `http://localhost:3001/api/google-oauth/callback` with `code` and `state` query parameters
* Express.js `req.query` correctly parses URL query parameters
* The redirect URI in Google Cloud Console exactly matches what we're using
* User completes OAuth flow without manual URL manipulation
* No proxy/middleware strips query parameters

### Required Conditions for Failure:
* Google redirects without `code` parameter
* Google redirects without `state` parameter
* Query parameters are lost in transit (proxy/stripping)
* Redirect URI mismatch causes Google to redirect differently
* User navigates directly to callback URL

### Lifecycle/Context Risks:
* **Timing**: Authorization codes expire in ~10 minutes
* **State**: State parameter must match what was sent initially
* **Network**: Any proxy between Google and localhost could modify URLs
* **Browser**: Browser might strip parameters on redirect
* **Express**: Query parsing might fail with malformed URLs

---

## === INVARIANTS & CONTRACTS ===

### Inputs:
* **Google Callback URL Format**: `?code=AUTH_CODE&state=STATE_VALUE` OR `?error=ERROR_TYPE`
* **Required Query Params**: `code` (string), `state` (string)
* **Optional Query Params**: `error` (string), `error_description` (string)

### API/DB:
* **Google OAuth 2.0**: Must return `code` and `state` if authorization successful
* **Express req.query**: Should parse query parameters automatically
* **Supabase**: Not involved in parameter validation

### UI/State:
* **Frontend Redirect**: Should preserve error parameters in URL
* **Browser Navigation**: Must not strip query parameters on redirect

---

## === ROOT-CAUSE HYPOTHESES ===

### A) Redirect URI Mismatch (Google Redirects to Wrong URL)
**Evidence:**
- Error says `missing_oauth_parameters` (code/state not present)
- User just added redirect URI to Google Console
- Previous error was `oauth_token_exchange_failed` (code was present but exchange failed)

**Falsification Test:**
- Check Google Cloud Console: Verify redirect URI is exactly `http://localhost:3001/api/google-oauth/callback`
- Check backend logs: Look for the callback URL that was received
- Verify the OAuth URL generated includes the correct redirect_uri

**Quick Check:**
```bash
# Check what redirect URI is being sent to Google
curl -s "http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001" -I | grep -i location
```

---

### B) Query Parameters Being Stripped (Proxy/Browser/Express)
**Evidence:**
- Error shows `missing_oauth_parameters` - parameters not present
- Could be middleware or proxy stripping query params
- Express query parsing might fail

**Falsification Test:**
- Add detailed logging to see full request URL and parsed query
- Check if `req.query` is empty vs. just missing `code`/`state`
- Verify no middleware strips query parameters before this route

**Code to Add:**
```typescript
console.log('Full URL:', req.url);
console.log('Query object:', req.query);
console.log('Raw query string:', req.url.split('?')[1]);
```

---

### C) User Navigated Directly to Callback (Not from Google Redirect)
**Evidence:**
- Missing parameters suggests manual navigation
- No referer header from Google

**Falsification Test:**
- Check `req.headers.referer` - should be from `accounts.google.com`
- Log full request headers to verify source

---

## === MINIMAL EXPERIMENT PLAN ===

### 1. Add Comprehensive Logging
**Temporary logs to add:**
```typescript
log.info('GoogleOAuth', 'Callback received', {
  hasCode: !!code,
  hasState: !!state,
  fullUrl: req.url,
  queryParams: req.query,
  referer: req.headers.referer
});
```

**Expected Outcomes:**
- **If redirect URI mismatch**: Logs show callback URL different from expected
- **If parameters stripped**: Logs show URL has params but `req.query` is empty
- **If direct navigation**: Logs show no referer from Google

### 2. Verify OAuth Authorization URL
**Check what redirect URI is being sent:**
- Inspect the authorization URL Google generates
- Verify `redirect_uri` parameter in URL matches Google Console

### 3. Test Callback Route Directly
**Manual test:**
```bash
curl "http://localhost:3001/api/google-oauth/callback?code=test123&state=test456"
```

**Expected:** Should process (even if state is invalid, code should be present)

---

## === SMALLEST CORRECT FIX ===

### Immediate Fix: Enhanced Logging (Applied)
**File:** `backend/src/routes/google-oauth.ts`
**Lines:** 97-124

**Changes:**
1. Added detailed logging before parameter validation
2. Log full URL, query params, headers, referer
3. Console.error for immediate visibility
4. Add debug parameter to error redirect

**Why This Works:**
- Provides diagnostic information to identify root cause
- Non-breaking change (adds logs only)
- Helps distinguish between different failure modes

### Next Steps Based on Logs:

**If logs show redirect URI mismatch:**
- Fix: Verify/update redirect URI in Google Cloud Console
- Verify: OAuth URL generation uses correct redirect URI

**If logs show parameters present but not parsed:**
- Fix: Check Express query parsing configuration
- Verify: No middleware strips query parameters

**If logs show no referer/direct navigation:**
- Fix: User must complete OAuth flow properly
- Verify: Start from `/authorize` endpoint, not callback

---

## Testing Plan

1. **Restart backend** with enhanced logging
2. **Try OAuth flow again** from beginning
3. **Check backend logs** for callback details
4. **Share logs** to determine exact root cause
5. **Apply targeted fix** based on log findings

---

## Rollback Plan

If enhanced logging causes issues:
- Remove logging statements
- Revert to original error handling
- Debug manually by checking network requests

---

**Status:** Enhanced logging applied. Ready for diagnosis.
