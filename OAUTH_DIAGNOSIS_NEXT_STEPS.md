# OAuth Callback Diagnosis - Next Steps

**Error:** `missing_oauth_parameters`

**Status:** ✅ Enhanced logging applied

---

## 🔍 Diagnosis Analysis

Following debug agent protocol, I've identified **3 possible root causes**:

### Hypothesis A: Redirect URI Mismatch
- Google redirects to wrong URL (not our callback)
- **Check:** Verify redirect URI in Google Cloud Console matches exactly

### Hypothesis B: Query Parameters Stripped
- Proxy/middleware/browser strips query parameters
- **Check:** Backend logs will show if URL has params but `req.query` is empty

### Hypothesis C: Direct Navigation
- User navigated directly to callback (not from Google)
- **Check:** Logs will show no referer header from Google

---

## 🧪 Diagnostic Test - Run Now

### Step 1: Try OAuth Flow Again

**Open in browser:**
```
http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001
```

**Complete the flow:**
1. Grant permission on Google consent screen
2. Wait for redirect back to callback
3. Check what error appears

### Step 2: Check Backend Logs

**Look in terminal where `npm run dev` is running for:**

```
[INFO] GoogleOAuth - Callback received
```

**This will show:**
- `hasCode`: true/false
- `hasState`: true/false
- `fullUrl`: The exact URL received
- `queryParams`: All parsed query parameters
- `referer`: Where the request came from

**Also look for:**
```
[OAuth Callback Debug]
```

This shows console.error output with full request details.

---

## 📊 What the Logs Will Tell Us

### If Logs Show:
**`hasCode: false, hasState: false` + `fullUrl` has no query params**
→ **Problem:** Google didn't include parameters (redirect URI mismatch)

**`hasCode: false, hasState: false` + `fullUrl` has `?code=...&state=...`**
→ **Problem:** Express query parsing issue (parameters present but not parsed)

**`hasCode: true, hasState: true`**
→ **Problem:** Different issue (shouldn't hit `missing_oauth_parameters` error)

**No referer from `accounts.google.com`**
→ **Problem:** User navigated directly, not from Google redirect

---

## 🔧 Quick Checks

### 1. Verify Redirect URI in OAuth URL
**Check what redirect URI is sent to Google:**
- The authorization URL should include `redirect_uri=http://localhost:3001/api/google-oauth/callback`
- If it's different, that's the mismatch

### 2. Verify Google Cloud Console
**Ensure exactly this URI is configured:**
```
http://localhost:3001/api/google-oauth/callback
```
- No trailing slash
- Must be `http://` not `https://` for localhost
- Port must be `3001`

---

## 📋 Action Items

1. ✅ **Enhanced logging applied** - Backend restarted
2. ⏳ **Try OAuth flow again** - Get fresh logs
3. ⏳ **Share backend logs** - From terminal after callback
4. ⏳ **Share callback URL** - The final URL in browser address bar

---

## 🎯 Expected Outcome

After trying the OAuth flow, the enhanced logs will reveal:
- **Exactly** what URL the callback receives
- **Whether** code/state parameters are present
- **Where** the request came from (referer)
- **Why** parameters might be missing

This will pinpoint the exact root cause so we can apply a targeted fix.

---

**Next:** Try the OAuth flow and share the backend logs from the terminal.
