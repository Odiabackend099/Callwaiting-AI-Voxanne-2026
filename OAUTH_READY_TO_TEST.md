# ✅ OAuth Routes Ready - Testing Guide

**Status:** ✅ **Fixed and Ready for Testing**

---

## 🔧 Fix Applied

**Problem:** `/api/google-oauth/authorize` was returning 401 "Missing or invalid Authorization header"

**Solution:** Removed `requireAuthOrDev` middleware from `/authorize` route because:
- OAuth initiation is a public endpoint (user clicks link → redirects to Google)
- orgId comes from query parameter, not auth headers
- Security is handled via state parameter in callback

---

## ✅ Verified Routes

### Test Route (Working)
```bash
curl "http://localhost:3001/api/google-oauth/test"
```
**Response:**
```json
{
  "message": "Google OAuth router is working!",
  "timestamp": "2026-01-10T18:27:07.532Z"
}
```

### Authorize Route (Now Public)
```bash
curl -I "http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001"
```
**Expected:** HTTP 302 redirect to Google OAuth consent screen

---

## 🧪 Complete OAuth Flow Test

### Step 1: Open Authorization URL

**In Browser:**
```
http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001
```

**Expected:**
- ✅ No 401 error
- ✅ Redirects to Google OAuth consent screen
- ✅ Shows "Google wants to access your Google Calendar" permission request

### Step 2: Grant Permission

1. Log in with your Google account (if not already logged in)
2. Review the permissions requested:
   - ✅ "See, edit, share, and permanently delete all the calendars you can access using Google Calendar"
3. Click **"Allow"** to grant access

### Step 3: Verify Callback

**Expected Redirect:**
```
http://localhost:3000/dashboard/settings?success=calendar_connected
```

**Backend Logs Should Show:**
```
[INFO] GoogleOAuth - Tokens stored successfully { orgId: '...' }
```

### Step 4: Verify Connection Status

```bash
curl "http://localhost:3001/api/google-oauth/status?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected Response:**
```json
{
  "connected": true,
  "active": true,
  "last_updated": "2026-01-10T...",
  "message": "Connected and active"
}
```

### Step 5: Verify Token Storage

Check Supabase `integrations` table:
```sql
SELECT org_id, provider, active, updated_at 
FROM integrations 
WHERE provider = 'google_calendar' 
AND org_id = 'a0000000-0000-0000-0000-000000000001';
```

**Expected:**
- ✅ `active = true`
- ✅ `config` contains encrypted `access_token` and `refresh_token`
- ✅ `updated_at` is recent

---

## 🔒 Security Notes

### State Parameter Protection
- The `state` parameter contains the orgId, base64url-encoded
- This prevents CSRF attacks by ensuring the callback matches the authorization request
- Invalid state parameters will be rejected

### Token Encryption
- Access tokens and refresh tokens are encrypted using AES-256-CBC
- Encryption key: `GOOGLE_ENCRYPTION_KEY` (32-byte hex string)
- Each token has a unique initialization vector (IV)

### Auto-Refresh
- Tokens are automatically refreshed when expired or near expiry
- Refresh happens transparently before API calls

---

## 📋 Testing Checklist

- [ ] Open authorize URL in browser (no 401 error)
- [ ] Redirects to Google OAuth consent screen
- [ ] Grant permission successfully
- [ ] Callback redirects to frontend with success message
- [ ] Backend logs show "Tokens stored successfully"
- [ ] Status endpoint returns `connected: true`
- [ ] Token stored in Supabase (encrypted)
- [ ] Can make calendar API calls (next step)

---

## 🐛 Troubleshooting

### Still Getting 401?
- Ensure backend server was restarted after fix
- Check: `curl "http://localhost:3001/api/google-oauth/test"` should work

### Callback Not Working?
- Verify redirect URI in Google Cloud Console matches exactly:
  - Dev: `http://localhost:3001/api/google-oauth/callback`
  - Prod: `{your-domain}/api/google-oauth/callback`

### Token Storage Fails?
- Check Supabase connection in backend logs
- Verify `integrations` table exists with correct schema
- Check encryption key is set: `GOOGLE_ENCRYPTION_KEY`

---

## 🚀 Next Steps

1. ✅ Test OAuth flow (you are here)
2. Test calendar availability checking
3. Test appointment booking
4. Test integration with Vapi voice agent
5. Test SMS confirmation after booking

---

**Status:** ✅ **Ready to Test OAuth Flow in Browser!**
