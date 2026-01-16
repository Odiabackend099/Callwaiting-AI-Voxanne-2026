# Root Cause Analysis - OAuth Credentials Not Saving

## Problem Statement
Database query shows 0 rows in `org_credentials` table for your organization. This means the OAuth callback is not saving credentials to the database.

## Investigation Path

### ✅ Verified Working
1. **JWT has org_id** - User successfully added org_id to Supabase JWT
2. **Backend code is correct** - All OAuth code looks proper with retry logic
3. **Database schema exists** - `org_credentials` table is properly created
4. **Encryption service** - Correctly handles hex-based encryption keys
5. **Routes registered** - Google OAuth routes are registered at `/api/google-oauth`

### ❌ Root Cause Unknown
Credentials are NOT being saved to the database. This could be:

**Option A: storeCredentials() is failing silently**
- Encryption error
- Supabase upsert error not being caught
- Retry logic exhausting

**Option B: OAuth callback not being triggered**
- Google redirect URI mismatch
- Code-exchange failing before reaching storeCredentials()

**Option C: State parameter decode failing**
- Can't extract orgId from state
- OrganizationID becomes null/invalid

---

## Solution: Diagnostic Tests (Complete All Steps)

### Step 1: Test Credential Storage Function (5 minutes)

**What this does:** Tests if the backend can save credentials directly, bypassing OAuth flow

**Browser Console** (F12 → Console):
```javascript
const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
const backendUrl = 'http://localhost:3001';

fetch(`${backendUrl}/api/google-oauth/test-store-credentials`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orgId, email: 'test@gmail.com' })
})
  .then(r => r.json())
  .then(data => console.log('TEST RESULT:', JSON.stringify(data, null, 2)))
  .catch(e => console.error('Error:', e.message));
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Test credentials stored successfully",
  "orgId": "46cf2995-2bee-44e3-838b-24151486fe4e",
  "email": "test@gmail.com"
}
```

**Result Interpretation:**
- ✅ **If you see `success: true`** → Proceed to SQL check
- ❌ **If you see an error** → Share the error message, indicates storage function is broken

---

### Step 2: Verify SQL Query After Test (2 minutes)

After running the test, execute in Supabase SQL Editor:

```sql
SELECT * FROM org_credentials
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND provider = 'google_calendar';
```

**Result Interpretation:**
- ✅ **If you get 1 row** → Storage works! Problem is in OAuth callback or frontend
- ❌ **If you get 0 rows** → Storage function failed, need to check encryption/database

---

### Step 3: Restart Backend with Fresh Logs (1 minute)

```bash
# In the backend terminal
npm run dev
```

Keep this terminal **visible and don't scroll away**.

---

### Step 4: Attempt Real OAuth Flow with Logs Visible (3 minutes)

1. **In browser**: Go to `http://localhost:3000/dashboard/api-keys`
2. **Click**: "Link My Google Calendar"
3. **Complete**: Google consent screen
4. **Watch backend terminal** for logs

**Look for these patterns:**
```
[GoogleOAuth] Callback received
[GoogleOAuth] Exchanging authorization code for tokens
[GoogleOAuth] About to store credentials
[GoogleOAuth] storeCredentials() completed successfully
[GoogleOAuth] Tokens stored successfully
```

OR (if failure):
```
[GoogleOAuth] Google token exchange error
[GoogleOAuth] storeCredentials() failed with error
[IntegrationDecryptor] Supabase upsert error
```

---

### Step 5: Share Results

Copy and paste:
1. **Test endpoint response** (from Step 1)
2. **SQL query results** (from Step 2)
3. **Backend logs** (from Step 4)

---

## Quick Diagnosis Matrix

| Test Result | Probable Cause | Next Action |
|-------------|----------------|------------|
| Test=Success, SQL=0 rows | Database write issue | Check Supabase connection |
| Test=Success, SQL=1 row | OAuth callback problem | Check Google redirect URI |
| Test=Failed with error | Storage function broken | Fix encryption/supabase issue |
| OAuth logs show "exchange error" | Google rejects code | Check redirect URI in Google Cloud |
| OAuth logs show "decode state error" | State parameter corrupted | Check frontend state generation |

---

## Files Modified

Added test endpoint to enable diagnosis:
- `backend/src/routes/google-oauth.ts` - Added `/test-store-credentials` endpoint
- `backend/src/services/google-oauth-service.ts` - Enhanced logging

---

## What Happens When You Run Tests

1. **Test endpoint** directly calls `IntegrationDecryptor.storeCredentials()`
2. This encrypts test credentials and upserts to database
3. If successful, SQL query will show the row
4. If SQL shows 0 rows after success response, it indicates:
   - Encryption working but database not receiving data
   - OR data is being deleted immediately
   - OR encryption is silently failing

5. **Real OAuth flow** shows exactly where it breaks in the chain

---

## Next Steps

1. **Run the test endpoint** (copy/paste JavaScript into console)
2. **Check SQL query** for results
3. **Restart backend** and run real OAuth flow
4. **Copy all logs** and share results
5. **I'll identify the exact issue** from the diagnostic data

This will give us the exact point of failure instead of guessing.

---

