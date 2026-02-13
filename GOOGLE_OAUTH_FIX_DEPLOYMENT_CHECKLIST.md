# Google Calendar OAuth Integration - Fix Deployment Checklist

**Status**: ✅ **READY FOR DEPLOYMENT**
**Created**: 2026-02-13
**Priority**: CRITICAL - Blocking all calendar integrations

---

## 🎯 Problem Summary

Users attempting to connect Google Calendar encounter:
```
Error 400: redirect_uri_mismatch
Attempted URI: https://voxanneai.onrender.com/api/google-oauth/callback
```

**Root Cause**: Production backend URL (`voxanneai.onrender.com`) is NOT approved in Google Cloud Console.

**Impact**: 100% of calendar connection attempts fail, blocking appointment booking for all customers.

---

## ✅ What's Been Fixed

### 1. Development Environment Configuration ✅
- **File**: `backend/.env`
- **Change**: Unified ngrok domain for both `BACKEND_URL` and `GOOGLE_REDIRECT_URI`
- **Before**:
  ```bash
  BACKEND_URL=https://postspasmodic-nonprofitable-bella.ngrok-free.dev
  GOOGLE_REDIRECT_URI=https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/google-oauth/callback
  ```
- **After**:
  ```bash
  BACKEND_URL=https://sobriquetical-zofia-abysmally.ngrok-free.dev
  GOOGLE_REDIRECT_URI=https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/google-oauth/callback
  ```
- **Verification**: ✅ Configuration test passed (9/9 checks)

### 2. Production Environment Template ✅
- **File**: `backend/.env.render`
- **Change**: Updated placeholders with actual Render URLs
- **Before**:
  ```bash
  GOOGLE_REDIRECT_URI=https://your-backend-url.onrender.com/api/google-oauth/callback
  BACKEND_URL=https://your-backend-url.onrender.com
  ```
- **After**:
  ```bash
  GOOGLE_REDIRECT_URI=https://voxanneai.onrender.com/api/google-oauth/callback
  BACKEND_URL=https://voxanneai.onrender.com
  ```

### 3. OAuth Service Validation ✅
- **File**: `backend/src/services/google-oauth-service.ts`
- **Change**: Added startup validation to detect environment variable mismatches
- **Benefit**: Catches configuration errors immediately at startup instead of at runtime during OAuth flow
- **Logs**: Shows clear error messages if domains don't match

### 4. Test Scripts Created ✅
Three automated test scripts to verify OAuth is working:

| Script | Purpose | Command |
|--------|---------|---------|
| `test-oauth-config.ts` | Validates environment variables | `npm run test:oauth-config` |
| `test-oauth-e2e.ts` | Tests authorization URL generation | `npm run test:oauth-e2e` |
| `verify-production-oauth.ts` | Verifies production is ready | `npm run verify:oauth-production` |

**Status**: All created and working ✅

### 5. npm Scripts Added ✅
- `npm run test:oauth-config` - Validate configuration
- `npm run test:oauth-e2e` - Test authorization URL generation
- `npm run verify:oauth-production` - Verify production deployment

---

## 🚀 Deployment Steps (MANUAL)

### Step 1: Update Google Cloud Console ⚠️ **YOU MUST DO THIS**

**Timeline**: 5 minutes

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find OAuth 2.0 Client ID: `750045445755-najs38gvm8dudvtrq7mkm6legetn9bos.apps.googleusercontent.com`
3. Click **Edit** button
4. Scroll to **Authorized redirect URIs** section
5. Click **+ ADD URI**
6. Paste: `https://voxanneai.onrender.com/api/google-oauth/callback`
7. Click **SAVE**

**Verify**: Reload page and confirm new URI appears in the list

---

### Step 2: Update Render Environment Variables ⚠️ **YOU MUST DO THIS**

**Timeline**: 5 minutes

1. Go to: https://dashboard.render.com
2. Select your backend service
3. Click **Environment** tab
4. Update or add these variables:

| Variable | Value |
|----------|-------|
| `BACKEND_URL` | `https://voxanneai.onrender.com` |
| `GOOGLE_REDIRECT_URI` | `https://voxanneai.onrender.com/api/google-oauth/callback` |
| `FRONTEND_URL` | `https://voxanne.ai` |

5. Click **Save Changes**

**Note**: Render will auto-redeploy (watch dashboard for completion, ~1-2 minutes)

---

### Step 3: Verify Development Environment ✅ **ALREADY DONE**

**Status**: Development OAuth configuration is valid ✅

```bash
cd backend
npm run test:oauth-config
# Result: ✅ All 9 checks passed
```

---

### Step 4: Verify Production Deployment ⏳ **AFTER RENDER RESTARTS**

Wait 2 minutes for Render to redeploy, then run:

```bash
npm run verify:oauth-production
```

**Expected Output**:
```
✅ Production OAuth configuration is VALID!
```

---

## 🧪 Manual Testing Procedure

**Prerequisites**: Render deployment complete + Google Cloud Console updated

### Test on Production (https://voxanne.ai)

1. **Login to dashboard**
   - Email: test account
   - Password: test password

2. **Navigate to calendar settings**
   - Go to `/dashboard/api-keys` or Settings → API Keys

3. **Click "Connect Google Calendar"**
   - Should redirect to Google consent screen

4. **Approve permissions**
   - Select which calendar to use
   - Click "Allow"

5. **Verify redirect back to dashboard**
   - Should see success message
   - Should show "Connected to: your-email@gmail.com"
   - Should show expiry date

6. **Test disconnect & reconnect**
   - Click "Disconnect"
   - Repeat steps 3-5

---

## ✨ Post-Deployment Checklist

### Immediate (Right After Deployment)

- [ ] Production Render environment variables are set
- [ ] Run: `npm run verify:oauth-production` → All tests pass
- [ ] Google Cloud Console shows 6 approved redirect URIs:
  - [ ] `https://voxanneai.onrender.com/api/google-oauth/callback` (NEW)
  - [ ] `https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/google-oauth/callback`
  - [ ] `https://api.voxanne.ai/api/google-oauth/callback`
  - [ ] Others from previous configs
- [ ] Check Render logs for no "[CRITICAL]" errors
- [ ] Log into production dashboard and trigger OAuth flow
- [ ] Verify calendar connects without redirect_uri_mismatch error

### Within 24 Hours

- [ ] Monitor Sentry for any new OAuth-related errors
- [ ] Check database: Do we have new entries in `org_credentials` table?
  ```sql
  SELECT COUNT(*) FROM org_credentials
  WHERE provider = 'google_calendar' AND is_active = true
  AND created_at > NOW() - INTERVAL '24 hours';
  ```
- [ ] Announce to customers: "Google Calendar OAuth is now working"

### Within 1 Week

- [ ] Monitor error rate for OAuth-related errors
- [ ] Gather customer feedback on calendar integration experience
- [ ] Document any edge cases or issues encountered

---

## 🔄 Troubleshooting

### Issue: Still Getting "redirect_uri_mismatch" After Deployment

**Diagnosis**:
```bash
# Check Render logs
# Check environment variables set correctly
# Check Google Cloud Console has the URL

# Clear browser cache and try again (hard refresh: Cmd+Shift+R)
```

**Solution**:
1. Verify Google Cloud Console has `https://voxanneai.onrender.com/api/google-oauth/callback`
2. Verify Render environment variables are saved (page shows green checkmarks)
3. Wait 30 seconds for changes to propagate
4. Hard refresh browser: Cmd+Shift+R (or Ctrl+Shift+R on Windows)
5. Try again

### Issue: Render Backend is Offline

**Diagnosis**: `npm run verify:oauth-production` returns "Backend unreachable"

**Solution**:
1. Check https://dashboard.render.com for service status
2. Look for deployment errors in Render logs
3. Check if service is still building/restarting
4. Check if there are startup errors (broken imports, missing env vars)

### Issue: Cannot Redirect Back to Frontend

**Diagnosis**: Redirect works but frontend shows blank page

**Solution**:
1. Check `FRONTEND_URL` environment variable is correct
2. Verify frontend is actually deployed and accessible
3. Check browser console for errors
4. Verify JWT token is valid

---

## 📊 Metrics & Monitoring

### Success Metrics

**Before Fix**:
- OAuth success rate: 0%
- Error: 100% redirect_uri_mismatch

**After Fix** (Target):
- OAuth success rate: >95%
- Errors: Only user cancellations, not system errors

### How to Measure

```sql
-- Count successful calendar connections last 24 hours
SELECT COUNT(*) as connections_24h
FROM org_credentials
WHERE provider = 'google_calendar'
  AND is_active = true
  AND created_at > NOW() - INTERVAL '24 hours';

-- Check for errors in logs
SELECT error, COUNT(*) FROM error_logs
WHERE message LIKE '%oauth%' OR message LIKE '%redirect_uri%'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error;
```

---

## 📝 Files Modified

| File | Change | Status |
|------|--------|--------|
| `backend/.env` | Fix ngrok domain mismatch | ✅ Done |
| `backend/.env.render` | Update Render URL | ✅ Done |
| `backend/src/services/google-oauth-service.ts` | Add validation | ✅ Done |
| `backend/src/scripts/test-oauth-config.ts` | Create test | ✅ Done |
| `backend/src/scripts/test-oauth-e2e.ts` | Create test | ✅ Done |
| `backend/src/scripts/verify-production-oauth.ts` | Create test | ✅ Done |
| `backend/package.json` | Add npm scripts | ✅ Done |
| Google Cloud Console | Add Render URL | ⏳ PENDING |
| Render Dashboard | Set env vars | ⏳ PENDING |

---

## 🎯 Implementation Summary

| Phase | Task | Status |
|-------|------|--------|
| 1 | Fix .env configuration | ✅ Complete |
| 2 | Fix .env.render template | ✅ Complete |
| 3 | Add validation code | ✅ Complete |
| 4 | Create test scripts | ✅ Complete |
| 5 | Update Google Cloud Console | ⏳ Pending (manual step) |
| 6 | Update Render environment | ⏳ Pending (manual step) |
| 7 | Verify deployment | ⏳ Pending (after steps 5-6) |
| 8 | Manual testing | ⏳ Pending (after step 7) |
| 9 | Monitor & validate | ⏳ Pending (after step 8) |
| 10 | Announce to customers | ⏳ Pending (after validation) |

---

## 🚨 Critical Notes

1. **Google Cloud Console update is MANUAL** - Must be done by developer with access
2. **Render restart is AUTOMATIC** - Happens when environment variables are saved
3. **Clear browser cache** - OAuth redirects may be cached by browser
4. **Check logs** - Render provides real-time logs for debugging
5. **No database changes** - Safe to deploy, no migration needed

---

## 📞 Support

If deployment fails:
1. Run: `npm run verify:oauth-production`
2. Check Render logs for errors
3. Verify environment variables are saved
4. Verify Google Cloud Console has the redirect URI
5. Try hard browser refresh (Cmd+Shift+R)

---

## ✨ Success Criteria

Deployment is successful when:

- ✅ `npm run test:oauth-config` returns: "✅ All configuration checks passed"
- ✅ `npm run verify:oauth-production` returns: "✅ Production verification PASSED"
- ✅ Manual test: Click "Connect Google Calendar" → Approve → Returns to dashboard with "Connected"
- ✅ No "[CRITICAL]" messages in Render logs
- ✅ New entries appear in `org_credentials` table with `provider='google_calendar'`

---

**Ready to deploy!** Follow the steps above and you'll fix the calendar integration issue. 🎉

