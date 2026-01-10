# OAuth Token Exchange Debugging Guide

**Error:** `oauth_token_exchange_failed`

## Common Causes & Solutions

### 1. Redirect URI Mismatch (Most Common)

**Problem:** The redirect URI used in the authorization request doesn't exactly match what's configured in Google Cloud Console.

**Check:**
1. Google Cloud Console → APIs & Services → Credentials
2. Open your OAuth 2.0 Client ID
3. Verify authorized redirect URIs include **exactly**:
   ```
   http://localhost:3001/api/google-oauth/callback
   ```

**Important:** The URI must match **exactly** including:
- Protocol (`http://` not `https://` for localhost)
- Port number (`3001`)
- Path (`/api/google-oauth/callback`)
- No trailing slashes

**Fix:**
- Add `http://localhost:3001/api/google-oauth/callback` to authorized redirect URIs
- Make sure there are no extra spaces or characters
- Save and wait a few seconds for changes to propagate

---

### 2. Authorization Code Expired or Already Used

**Problem:** OAuth authorization codes are single-use and expire quickly (usually 10 minutes).

**Symptoms:**
- Error message includes "invalid_grant"
- Code was already exchanged successfully

**Fix:**
- Restart the OAuth flow from the beginning
- Don't refresh the callback page after completion
- Complete the flow within 10 minutes

---

### 3. Client ID/Secret Mismatch

**Problem:** Wrong credentials or environment variables not loaded.

**Check:**
```bash
cd backend
grep GOOGLE_CLIENT_ID .env
grep GOOGLE_CLIENT_SECRET .env
```

**Verify:**
- Client ID matches Google Cloud Console
- Client Secret matches Google Cloud Console
- Environment variables are loaded (restart server after changes)

---

### 4. Encryption Key Issues

**Problem:** `GOOGLE_ENCRYPTION_KEY` missing or invalid format.

**Check:**
```bash
cd backend
grep GOOGLE_ENCRYPTION_KEY .env
```

**Should be:** 64-character hex string (32 bytes)

**Fix:**
```bash
openssl rand -hex 32
# Add output to .env as GOOGLE_ENCRYPTION_KEY
```

---

## Debugging Steps

### Step 1: Check Backend Logs

Look for detailed error messages:
```bash
# Check terminal where backend is running
# Or check logs/backend.log if logging to file
```

Look for:
- `[OAuth Token Exchange Error]` - Full error details
- `Google token exchange error` - Google API error details
- `redirect_uri_mismatch` - URI mismatch error
- `invalid_grant` - Code expired/used error

### Step 2: Verify Redirect URI Configuration

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Check "Authorized redirect URIs" section
4. Ensure it includes: `http://localhost:3001/api/google-oauth/callback`

### Step 3: Test OAuth Flow Again

1. Clear browser cache/cookies (optional)
2. Start fresh OAuth flow:
   ```
   http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001
   ```
3. Complete authorization quickly (within 10 minutes)
4. Check error details in browser URL: `?error=...&details=...`

### Step 4: Verify Environment Variables

```bash
cd backend
cat .env | grep GOOGLE
```

Should show:
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GOOGLE_ENCRYPTION_KEY=...` (64 hex chars)
- `GOOGLE_REDIRECT_URI=http://localhost:3001/api/google-oauth/callback`

**Restart backend after checking!**

---

## Quick Fix Checklist

- [ ] Redirect URI added to Google Cloud Console (exact match)
- [ ] Backend server restarted after env changes
- [ ] Authorization code not expired (complete flow quickly)
- [ ] Encryption key is 64 hex characters
- [ ] Client ID/Secret match Google Cloud Console
- [ ] Check backend logs for specific error message

---

## Next Steps

After fixing the issue:
1. Restart backend server
2. Try OAuth flow again
3. Check for `?success=calendar_connected` in callback URL
4. Verify status: `curl "http://localhost:3001/api/google-oauth/status?orgId=..."`

---

**Status:** Debugging token exchange failure...
