# OAuth Token Exchange Fix Instructions

**Error:** `oauth_token_exchange_failed`

## Most Likely Cause: Redirect URI Mismatch

The redirect URI must match **exactly** between:
1. The OAuth authorization request (what you generate)
2. Google Cloud Console configuration

---

## Step 1: Verify Redirect URI in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID (the one with Client ID starting with `750045445755-...`)
3. Click to edit it
4. In "Authorized redirect URIs", verify it includes:
   ```
   http://localhost:3001/api/google-oauth/callback
   ```

**Important:**
- Must be **exactly** `http://localhost:3001/api/google-oauth/callback`
- No trailing slash
- Use `http://` not `https://` for localhost
- Port must be `3001`

5. Click **Save**

---

## Step 2: Verify Environment Variables

**In `backend/.env`:**
```
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google-oauth/callback
```

This should match exactly what's in Google Cloud Console.

---

## Step 3: Restart Backend Server

**Kill and restart:**
```bash
# Kill backend
lsof -ti:3001 | xargs kill -9

# Restart
cd backend
npm run dev
```

---

## Step 4: Try OAuth Flow Again

1. **Clear browser cookies/cache** (optional but recommended)
2. **Open authorization URL:**
   ```
   http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001
   ```
3. **Complete authorization quickly** (codes expire in ~10 minutes)
4. **Check for error details** in the redirect URL:
   - Look for `?error=...&details=...` in the callback URL
   - The `details` parameter will show the specific error

---

## Step 5: Check Backend Logs

**If error persists, check backend terminal/logs for:**
```
[OAuth Token Exchange Error]
Google token exchange error
```

**Common error messages:**
- `redirect_uri_mismatch` → URI doesn't match Google Console
- `invalid_grant` → Code expired or already used (restart flow)
- `unauthorized_client` → Wrong client ID/secret

---

## Quick Verification

**Test the status endpoint (requires restart after fix):**
```bash
curl "http://localhost:3001/api/google-oauth/status?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected after successful connection:**
```json
{
  "connected": true,
  "active": true,
  ...
}
```

---

## Troubleshooting

### If redirect URI is correct but still failing:

1. **Check if authorization code expired:**
   - Codes expire in ~10 minutes
   - Each code can only be used once
   - Solution: Restart OAuth flow immediately

2. **Verify OAuth client initialization:**
   - Check backend logs on startup
   - Should not show errors about missing env vars

3. **Check Google Cloud Console OAuth consent screen:**
   - Go to: APIs & Services → OAuth consent screen
   - Ensure app is in "Testing" or "Published" mode
   - Add your email to test users if in Testing mode

---

**Next:** After fixing, restart backend and try OAuth flow again. Check the callback URL for error details.
