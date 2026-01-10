# Phase 3: Quick OAuth Test Guide 🚀

**Status:** ✅ Backend Running - Ready to Test

---

## ✅ Current Status

- ✅ Backend server running on port 3001
- ✅ Health check responding (HTTP 200)
- ✅ Redirect URI added to Google Cloud Console
- ✅ Environment variables configured

---

## 🧪 Quick Test Steps

### 1. Test OAuth Authorization (Browser)

**Open this URL in your browser:**
```
http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001
```

**What Should Happen:**
1. ✅ Backend generates OAuth URL
2. ✅ Browser redirects to Google OAuth consent screen
3. ✅ Google shows "Google Calendar" permission request
4. ✅ You log in with your Google account
5. ✅ Click "Allow" to grant permission

**If you see an error:**
- `redirect_uri_mismatch` → Wait 5-10 minutes after adding URI to Google Console
- `invalid_client` → Check GOOGLE_CLIENT_ID in backend/.env
- `400 Bad Request` → Check backend logs for details

---

### 2. Complete OAuth Flow

**After clicking "Allow" on Google:**
1. ✅ Google redirects to: `http://localhost:3001/api/google-oauth/callback?code=...&state=...`
2. ✅ Backend exchanges code for tokens
3. ✅ Tokens encrypted and stored in database
4. ✅ Redirects to: `http://localhost:3000/dashboard/settings?success=calendar_connected`

**Check Backend Terminal:**
You should see logs like:
```
[GoogleOAuth] OAuth callback received
[GoogleOAuth] Tokens stored successfully
[GoogleOAuth] Redirecting to frontend
```

---

### 3. Verify Connection Status

**Run this command:**
```bash
curl "http://localhost:3001/api/google-oauth/status?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected Response:**
```json
{
  "connected": true,
  "active": true,
  "connectedAt": "2026-01-10T...",
  "hasTokens": true
}
```

✅ **If you see `"connected": true`** → OAuth flow completed successfully!

---

### 4. Test Calendar API (Optional)

**Create and run test script:**
```bash
cd backend
cat > scripts/test-calendar-quick.ts << 'EOF'
import 'dotenv/config';
import { getAvailableSlots } from '../src/services/calendar-integration';

const orgId = 'a0000000-0000-0000-0000-000000000001';
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const dateStr = tomorrow.toISOString().split('T')[0];

getAvailableSlots(orgId, dateStr, 'America/New_York')
  .then(slots => {
    console.log(`✅ Success! Found ${slots.length} available slots for ${dateStr}`);
    console.log(`   First 5: ${slots.slice(0, 5).join(', ')}`);
  })
  .catch(error => {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  });
EOF

npx ts-node scripts/test-calendar-quick.ts
```

**Expected:** Lists available time slots for tomorrow

---

## 🎯 Success Indicators

✅ **OAuth Working If:**
- Authorization URL redirects to Google
- No redirect_uri_mismatch error
- Callback redirects to frontend with `success=calendar_connected`
- Connection status shows `connected: true`
- Calendar API calls work

❌ **If Something Fails:**
- Check backend terminal for error logs
- Verify redirect URI in Google Console (wait 5-10 min if just added)
- Check environment variables are set correctly
- Try incognito mode to avoid cached sessions

---

## 📝 Test Results

**Fill this out as you test:**

- [ ] OAuth authorization URL works: ✅ / ❌
- [ ] Google consent screen appears: ✅ / ❌
- [ ] Permission granted successfully: ✅ / ❌
- [ ] Callback redirects to frontend: ✅ / ❌
- [ ] Connection status = `connected: true`: ✅ / ❌
- [ ] Calendar API calls work: ✅ / ❌

**Notes:**
_________________________________

---

**Ready!** Open the authorization URL in your browser to start testing. 🚀
