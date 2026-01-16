# OAuth Callback Failure Diagnostic

**Critical Finding:** Database check shows 0 rows in `org_credentials` table

This means the OAuth callback is NOT saving credentials to the database.

---

## Where the Failure Could Be

The OAuth flow has these steps:

1. **User clicks "Link My Google Calendar"** → Frontend redirects to Google
2. **Google shows consent screen** → User approves
3. **Google redirects to backend callback** → `http://localhost:3001/api/google-oauth/callback?code=...&state=...`
4. **Backend calls `exchangeCodeForTokens()`**
   - Decodes state to extract orgId
   - Exchanges code for Google tokens
   - **Calls `IntegrationDecryptor.storeCredentials()` to save to database** ← THIS IS FAILING
5. **Backend redirects user back to frontend** with success/error message

---

## Step-by-Step Debug Process

### Step 1: Check Backend Logs

The backend logs will tell us EXACTLY where the failure is.

**In the terminal where you run the backend** (usually `npm run dev`), look for logs like:

```
[GoogleOAuth] Callback received
[GoogleOAuth] Exchanging authorization code for tokens
[GoogleOAuth] Google token exchange error  ← IF THIS APPEARS, Google token exchange failed
[GoogleOAuth] Tokens stored successfully   ← IF THIS APPEARS, success!
[GoogleOAuth] Failed to store tokens       ← IF THIS APPEARS, database save failed
[IntegrationDecryptor] Supabase upsert error  ← IF THIS APPEARS, schema cache issue
```

**Action:** After you see the OAuth callback happen, copy the ENTIRE backend log output and share it with me. Look specifically for:
- Any lines with `[GoogleOAuth]`
- Any lines with `[IntegrationDecryptor]`
- Any error messages in red

---

### Step 2: Attempt OAuth Flow with Logs Visible

1. **Open backend terminal** where `npm run dev` is running
2. **Scroll to the end** so you can see new logs
3. **In a browser tab**, go to `http://localhost:3000/dashboard/api-keys`
4. **Click "Link My Google Calendar"**
5. **Complete Google consent screen** (approve access)
6. **Watch the backend terminal** - you should see logs appearing
7. **Copy ALL logs** from the moment you clicked the button until you see a result

---

### Step 3: Look for These Specific Issues

**Issue A: Google Token Exchange Failed**

If you see:
```
[GoogleOAuth] Google token exchange error
error: "Redirect URI mismatch"
```

This means your `GOOGLE_REDIRECT_URI` in `.env` doesn't match what's configured in Google Cloud Console.

**Fix:**
1. Go to Google Cloud Console → OAuth 2.0 Client IDs
2. Check "Authorized redirect URIs"
3. Make sure `http://localhost:3001/api/google-oauth/callback` is listed
4. Restart backend with `npm run dev`

---

**Issue B: Missing orgId in State**

If you see:
```
[GoogleOAuth] Failed to decode state parameter
error: "Invalid state: orgId missing or invalid"
```

This means the state parameter doesn't contain the org_id. This would indicate a frontend bug.

**Fix:** Need to check how the frontend is generating the OAuth URL

---

**Issue C: Supabase Schema Cache Error**

If you see:
```
[IntegrationDecryptor] Supabase upsert error
code: "PGRST205"
error: "Could not find the table"
```

This is a known issue where the REST API cache is out of sync.

**Fix:** The code already has retry logic with exponential backoff (2s, 4s, 8s).
- Check if it says "Schema cache retry succeeded" after a few seconds
- If not, the database schema might not exist

---

**Issue D: Encryption Key Mismatch**

If you see:
```
[EncryptionService] Failed to encrypt credentials
error: "Invalid encryption key length"
```

This means `ENCRYPTION_KEY` is misconfigured.

**Fix:** Verify in `.env`:
```
ENCRYPTION_KEY=9ced1e7153a62b03b99934b3a4c30033fc8cee278faeeae8b582f40171a81678
```
Should be exactly 64 hex characters (32 bytes).

---

## Action Items

1. **Make sure backend is running:** `npm run dev` in the `backend/` directory
2. **Open the backend terminal** where logs are being printed
3. **Attempt the OAuth flow** (user clicks "Link My Google Calendar")
4. **Copy the ENTIRE log output** from the backend
5. **Share the logs** with me in the following format:

```
[Paste backend logs here]
```

---

## Expected Success Log

If everything works, you should see:

```
[GoogleOAuth] Callback received {
  hasCode: true,
  hasState: true,
  codeLength: 102,
  stateLength: 120
}

[GoogleOAuth] Exchanging authorization code for tokens {
  codeLength: 102,
  hasCode: true
}

[GoogleOAuth] Extracted email from ID token {
  userEmail: "your-google-email@gmail.com"
}

[GoogleOAuth] Storing credentials with metadata {
  orgId: "46cf2995-2bee-44e3-838b-24151486fe4e",
  hasEmail: true,
  email: "your-google-email@gmail.com"
}

[IntegrationDecryptor] Preparing to upsert credentials {
  orgId: "46cf2995-2bee-44e3-838b-24151486fe4e",
  provider: "google_calendar",
  hasMetadata: true
}

[IntegrationDecryptor] Credentials stored successfully {
  orgId: "46cf2995-2bee-44e3-838b-24151486fe4e",
  provider: "google_calendar",
  rowsAffected: 1
}

[GoogleOAuth] OAuth callback successful {
  orgId: "46cf2995-2bee-44e3-838b-24151486fe4e",
  email: "your-google-email@gmail.com",
  success: true
}
```

If you see this, it means the database INSERT worked. Then we'd verify with:

```sql
SELECT * FROM org_credentials
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND provider = 'google_calendar';
```

---

## Summary

**The database shows 0 rows = The OAuth callback's `storeCredentials()` call never completed successfully.**

To fix this:
1. Check backend logs to find the exact error
2. Share the logs with me
3. I'll identify and fix the specific issue (redirect URI, schema cache, encryption, etc.)

Ready when you are!
