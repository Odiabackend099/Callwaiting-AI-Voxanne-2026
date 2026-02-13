# Google Calendar OAuth - Quick Deploy Guide

⏱️ **Total Time**: 15 minutes | 🎯 **Status**: Ready to deploy

---

## Step 1️⃣: Google Cloud Console (5 minutes)

**Go to**: https://console.cloud.google.com/apis/credentials

**Find Your OAuth Client**:
- OAuth 2.0 Client ID: `750045445755-najs38gvm8dudvtrq7mkm6legetn9bos.apps.googleusercontent.com`

**Add Render URL**:
1. Click **Edit** (pencil icon)
2. Scroll to "Authorized redirect URIs"
3. Click **+ ADD URI**
4. Paste: `https://voxanneai.onrender.com/api/google-oauth/callback`
5. Click **SAVE** (blue button at bottom)

**Verify**: Refresh page and confirm URL appears in list

✅ **Expected Result**: 6 total URIs in the list

---

## Step 2️⃣: Render Dashboard (5 minutes)

**Go to**: https://dashboard.render.com

**Select Backend Service** (voxanne-ai or similar)

**Add Environment Variables**:
1. Click **Environment** tab
2. **Add new variable**:
   - Name: `BACKEND_URL`
   - Value: `https://voxanneai.onrender.com`
   - Click Save

3. **Update existing variable** (if exists) or add:
   - Name: `GOOGLE_REDIRECT_URI`
   - Value: `https://voxanneai.onrender.com/api/google-oauth/callback`
   - Click Save

4. **Update existing** (if needed):
   - Name: `FRONTEND_URL`
   - Value: `https://voxanne.ai`
   - Click Save

**Watch for Restart**: Render automatically restarts service (2 min)

✅ **Expected Result**: All variables saved, backend restarted with green health check

---

## Step 3️⃣: Verify Deployment (3 minutes)

**Run this command**:
```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run verify:oauth-production
```

**Expected Output**:
```
✅ Production verification PASSED
```

**If it fails**:
1. Wait 30 seconds (backend might still be starting)
2. Run again: `npm run verify:oauth-production`
3. If still failing, check Render logs

---

## Step 4️⃣: Manual Test (2 minutes)

**On Production** (https://voxanne.ai):

1. Login to dashboard
2. Go to Settings → API Keys (or `/dashboard/api-keys`)
3. Find "Google Calendar" section
4. Click **"Connect with Google"**
5. You should see Google sign-in screen
6. Sign in with your Google account
7. Click **Allow** on permissions screen
8. **You should be redirected back to dashboard**
9. See message: **"Connected to: your-email@gmail.com"**

✅ **Success**: No more `redirect_uri_mismatch` error!

---

## Common Issues

### "Still getting redirect_uri_mismatch?"
1. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
2. Verify Google Cloud Console has the URL
3. Verify Render shows green health check
4. Wait 30 seconds and try again

### "Backend offline?"
1. Check Render dashboard status
2. Look at Render logs for errors
3. Wait for restart to complete

### "See blank page after Google approval?"
1. Check browser console (F12) for errors
2. Verify `FRONTEND_URL` is correct in Render
3. Verify frontend is actually deployed

---

## Verification Commands

```bash
# Check development config is valid
cd backend && npm run test:oauth-config

# Check production is ready (after Render restart)
cd backend && npm run verify:oauth-production
```

Both should show ✅ **PASSED**

---

## Rollback (if needed)

If anything breaks:

**Revert Render environment**:
1. Go to Render dashboard
2. Click Environment tab
3. Revert values to previous versions
4. Click Save

**Revert code**:
```bash
git checkout backend/.env backend/.env.render
```

**Revert Google Console**:
1. Remove `https://voxanneai.onrender.com/api/google-oauth/callback` from approved URIs
2. Keep other URIs as they were

---

## Success Criteria

✅ **Deployment is successful when**:
- [ ] Google Cloud Console shows Render URL in approved redirects
- [ ] Render environment variables are saved and service restarted
- [ ] `npm run verify:oauth-production` returns PASSED
- [ ] Manual test: Click "Connect Google" → Approve → Returns to dashboard with "Connected"
- [ ] No errors in Sentry

---

## Final Checklist

- [ ] Step 1: Google Cloud Console updated
- [ ] Step 2: Render environment variables set
- [ ] Step 3: Verification test passed
- [ ] Step 4: Manual test successful
- [ ] ✨ Done!

**You've fixed the calendar integration!** 🎉

---

**Questions?** See `GOOGLE_OAUTH_FIX_DEPLOYMENT_CHECKLIST.md` for detailed troubleshooting.
