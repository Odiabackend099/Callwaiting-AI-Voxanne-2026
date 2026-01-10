# Google Cloud Console Setup - Required Actions

**Date:** 2026-01-10  
**Priority:** 🔴 **CRITICAL** - OAuth won't work without this

---

## Current Status

✅ **Google Calendar API:** Enabled  
✅ **OAuth 2.0 Client:** Created  
⚠️ **Redirect URI:** Needs Update

---

## Required Action: Add Redirect URI

The current OAuth client only has the Supabase Auth callback URL. We need to add our Google Calendar OAuth callback URL.

### Current Redirect URIs:
```
https://lbjymlodxprzqgtyqtcq.supabase.co/auth/v1/callback  ← Supabase Auth (keep this)
```

### Required Additional Redirect URIs:

**Development:**
```
http://localhost:3001/api/google-oauth/callback
```

**Production:**
```
https://callwaitingai.dev/api/google-oauth/callback
```

---

## Step-by-Step Instructions

### 1. Go to Google Cloud Console
1. Visit: https://console.cloud.google.com
2. Select project: `integral-accord-474321-p9`

### 2. Navigate to OAuth Credentials
1. Go to: **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID: `750045445755-najs38gvm8dudvtrq7mkm6legetn9bos`
3. Click on the client ID to edit

### 3. Add Authorized Redirect URIs
1. Scroll to **"Authorized redirect URIs"**
2. Click **"+ ADD URI"**
3. Add each URI:
   - `http://localhost:3001/api/google-oauth/callback` (Development)
   - `https://callwaitingai.dev/api/google-oauth/callback` (Production)
4. Click **"SAVE"**

### 4. Verify Authorized JavaScript Origins (Optional but Recommended)
Make sure these are in **"Authorized JavaScript origins"**:
- `http://localhost:3000` (Development)
- `http://localhost:3001` (Development - Backend)
- `https://callwaitingai.dev` (Production)

---

## Final Redirect URI List Should Be:

```
Authorized redirect URIs:
1. https://lbjymlodxprzqgtyqtcq.supabase.co/auth/v1/callback  (Existing - Supabase Auth)
2. http://localhost:3001/api/google-oauth/callback            (NEW - Dev)
3. https://callwaitingai.dev/api/google-oauth/callback        (NEW - Prod)
```

---

## Verification

After saving, wait 5-10 minutes for changes to propagate, then test:

```bash
# Test OAuth authorization endpoint
curl "http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected:** Redirects to Google OAuth consent screen

**If you get redirect_uri_mismatch error:**
- Wait 5-10 more minutes
- Double-check the redirect URI matches exactly (no trailing slashes)
- Clear browser cache

---

## Notes

- ⚠️ **Supabase Auth URI:** Keep the existing Supabase callback URI - it's for user authentication
- ✅ **New Calendar URI:** This is for Google Calendar API access (different OAuth flow)
- 🔄 **Changes take time:** Google may take 5-10 minutes to propagate redirect URI changes
- 🔒 **HTTPS required:** Production redirect URI must use HTTPS

---

**Status:** ⚠️ **ACTION REQUIRED** - Add redirect URIs to Google Cloud Console
