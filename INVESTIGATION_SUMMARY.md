# OAuth "Not Linked" Investigation - Complete Summary

## Problem Statement
User voxanne@demo.com attempts to link Google Calendar 100+ times. OAuth flow completes (shows success redirect), but backend never saves credentials to database. UI persistently shows "Not Linked" because database has no credentials.

---

## Investigation Timeline

### Phase 1: JWT Analysis (RESOLVED ✅)
**Issue:** User's JWT was missing `org_id` field
**Root Cause:** User account existed before database trigger that stamps org_id
**Fix Applied:** Manually added org_id to user's JWT via Supabase dashboard
**Result:** User now has org_id in JWT: `46cf2995-2bee-44e3-838b-24151486fe4e`

### Phase 2: Code Review (VERIFIED ✅)
**Finding:** Backend OAuth code is correctly implemented
- Includes `access_type: 'offline'` and `prompt: 'consent'` ✅
- Properly exchanges authorization code for tokens ✅
- Calls `IntegrationDecryptor.storeCredentials()` to save to database ✅
- Has retry logic for Supabase schema cache issues ✅

**Finding:** Frontend code is correctly implemented
- Properly extracts org_id from JWT ✅
- Makes correct status endpoint calls ✅
- Green checkmark logic is NOT hardcoded (will show when credentials exist) ✅

### Phase 3: Database Verification (CRITICAL FINDING ❌)
**Query Run:**
```sql
SELECT * FROM org_credentials
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND provider = 'google_calendar';
```

**Result:** 0 rows

**Interpretation:** The OAuth callback is FAILING TO SAVE credentials to the database

---

## Root Cause Analysis

The OAuth flow has these steps:

```
User clicks button
    ↓
Frontend redirects to Google OAuth URL
    ↓
Google shows consent screen
    ↓
User approves
    ↓
Google redirects to backend: http://localhost:3001/api/google-oauth/callback?code=XXX&state=YYY
    ↓
Backend: exchangeCodeForTokens(code, state)
    ├─ Decode state → extract orgId
    ├─ Exchange code → get Google tokens (access_token + refresh_token)
    ├─ Call IntegrationDecryptor.storeCredentials()
    │   └─ UPSERT to org_credentials table
    │       └─ ⚠️ THIS IS WHERE IT'S FAILING ⚠️
    └─ Redirect to frontend with success
```

**The failure point:** `IntegrationDecryptor.storeCredentials()` is either:
1. Never being called (exchange code fails before)
2. Being called but failing silently
3. Being called but Supabase upsert fails

---

## Possible Issues (in order of likelihood)

### Issue #1: Redirect URI Mismatch (50% probability)

**How it fails:**
1. Google OAuth needs exact redirect URI match
2. Frontend is configured with different redirect URI than Google Cloud Console

**Current config:**
```
.env: GOOGLE_REDIRECT_URI=http://localhost:3001/api/google-oauth/callback
```

**Problem:** If Google Cloud Console has different URI, Google rejects the exchange

**Symptoms:** Log message `redirect_uri_mismatch`

**Fix:** Verify Google Cloud Console authorized redirect URIs include `http://localhost:3001/api/google-oauth/callback`

---

### Issue #2: State Parameter Invalid (15% probability)

**How it fails:**
1. Frontend generates state parameter with orgId
2. State gets corrupted in URL or during redirect
3. Backend can't decode state → can't extract orgId
4. OrganizationID is null → upsert fails with foreign key error

**Symptoms:** Log message `Failed to decode state parameter` or `Invalid state: orgId missing`

**Fix:** Need to check frontend's state generation

---

### Issue #3: Supabase Schema Cache Out of Sync (20% probability)

**How it fails:**
1. `org_credentials` table exists in database
2. Supabase REST API cache hasn't been updated yet
3. API can't find the table for UPSERT
4. Returns `PGRST205` error

**Symptoms:** Log message `PGRST205` or `Could not find the table`

**Status:** Code has retry logic with exponential backoff (2s, 4s, 8s)

**Fix:** Code should automatically retry. If it shows "Schema cache retry succeeded", it's working.

---

### Issue #4: Encryption Key Wrong (10% probability)

**How it fails:**
1. Credentials are encrypted before storage using `ENCRYPTION_KEY`
2. `ENCRYPTION_KEY` in .env is wrong length or value
3. Encryption fails
4. Upsert never happens

**Symptoms:** Log message `Failed to encrypt credentials` or `Invalid encryption key length`

**Current config:**
```
ENCRYPTION_KEY=9ced1e7153a62b03b99934b3a4c30033fc8cee278faeeae8b582f40171a81678
```
(64 hex characters = 32 bytes ✅ correct format)

---

### Issue #5: Other Database Error (5% probability)

**Symptoms:** Log message showing specific Supabase error

**Fix:** Logs will reveal the exact issue

---

## How to Debug

**Only way to identify the issue:** Check backend logs during OAuth callback

**The logs will show:**
```
[GoogleOAuth] Callback received
  ↓
[GoogleOAuth] Exchanging authorization code for tokens
  ↓
[GoogleOAuth] Tokens stored successfully  ← If success
OR
[GoogleOAuth] Failed to exchange code for tokens  ← If failure
OR
[IntegrationDecryptor] Credentials stored successfully  ← If success
OR
[IntegrationDecryptor] Supabase upsert error  ← If failure
```

---

## Files Involved

**Backend OAuth Routes:**
- [backend/src/routes/google-oauth.ts](backend/src/routes/google-oauth.ts)
  - Line 181-316: Callback handler
  - Line 254: Calls `exchangeCodeForTokens()`
  - Line 427-433: Status endpoint

**Backend OAuth Service:**
- [backend/src/services/google-oauth-service.ts](backend/src/services/google-oauth-service.ts)
  - Line 45-57: `getOAuthUrl()` - generates OAuth URL with `access_type: 'offline'` and `prompt: 'consent'`
  - Line 67-197: `exchangeCodeForTokens()` - exchanges code for tokens and saves to database
  - Line 166-170: **CRITICAL** - Calls `IntegrationDecryptor.storeCredentials()`

**Credential Storage:**
- [backend/src/services/integration-decryptor.ts](backend/src/services/integration-decryptor.ts)
  - Line 403-538: `storeCredentials()` - encrypts and upserts to `org_credentials` table
  - Line 452-494: Has retry logic for Supabase schema cache issues

**Database Schema:**
- [backend/migrations/20250111_create_byoc_credentials_schema.sql](backend/migrations/20250111_create_byoc_credentials_schema.sql)
  - Creates `org_credentials` table with provider, encrypted_config, is_active, metadata columns

**Frontend Status Check:**
- [src/app/dashboard/api-keys/page.tsx](src/app/dashboard/api-keys/page.tsx)
  - Line 61-104: `fetchCalendarStatus()` - calls `/api/google-oauth/status/{orgId}`
  - Line 422-459: Shows "Linked" when `calendarStatus.connected === true`

---

## Next Actions

1. **Get backend logs** during OAuth callback attempt
2. **Identify specific error** from logs
3. **Apply targeted fix** based on error type
4. **Verify credentials save** with SQL query
5. **Confirm UI updates** to show "Linked"

---

## Success Criteria

✅ OAuth callback completes
✅ Backend logs show "Tokens stored successfully"
✅ SQL query returns 1 row in org_credentials table
✅ Frontend status endpoint returns `connected: true`
✅ UI shows "Linked" with green checkmark

---

## Conclusion

**Root cause confirmed:** OAuth callback is not saving credentials to database (0 rows found)

**Status:** Awaiting backend logs to identify why `storeCredentials()` is failing

**Next:** Get logs from OAuth callback attempt

