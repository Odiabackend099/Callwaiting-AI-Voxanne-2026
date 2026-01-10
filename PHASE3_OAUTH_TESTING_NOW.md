# Phase 3: OAuth Testing - Live Testing Guide 🚀

**Date:** 2026-01-10  
**Status:** Server Restarted - Ready for Live Testing

---

## ✅ Pre-Test Verification

**Server Status:** ✅ Running on port 3001  
**Routes Status:** ✅ OAuth routes loaded  
**Redirect URI:** ✅ Added to Google Cloud Console

---

## 🧪 Live Testing Steps

### Test 1: Authorization Endpoint ✅

**Open in Browser:**
```
http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001
```

**What Should Happen:**
1. ✅ Browser makes request to backend
2. ✅ Backend generates OAuth URL with state parameter
3. ✅ Browser redirects to Google OAuth consent screen
4. ✅ URL should be: `accounts.google.com/o/oauth2/auth?client_id=...&scope=...&state=...`

**Expected Behavior:**
- ✅ No 404 error
- ✅ Redirects to Google (not localhost)
- ✅ Shows Google login/consent screen
- ✅ Requesting "Calendar" access

**If You See Errors:**
- ❌ `404 Not Found` → Routes not loaded, restart server
- ❌ `redirect_uri_mismatch` → Wait 5-10 min after adding URI to Google Console
- ❌ `401 Unauthorized` → Auth middleware blocking (check if user/auth required)

---

### Test 2: Complete OAuth Flow ✅

**After Opening Authorization URL:**

1. **Google Login Screen:**
   - Select your Google account
   - Or enter credentials if not logged in

2. **Google Consent Screen:**
   - Shows: "Voxanne AI wants to access your Google Account"
   - Permission: "See, edit, share, and permanently delete all the calendars you can access using Google Calendar"
   - Click **"Allow"** ✅

3. **Callback Processing:**
   - Google redirects to: `http://localhost:3001/api/google-oauth/callback?code=...&state=...`
   - Backend processes callback:
     - Validates state parameter (CSRF protection)
     - Exchanges code for access_token + refresh_token
     - Encrypts tokens
     - Stores in database

4. **Final Redirect:**
   - Should redirect to: `http://localhost:3000/dashboard/settings?success=calendar_connected`
   - Or if frontend not running: May show error page (that's OK - check backend logs)

---

### Test 3: Check Backend Logs 📝

**Watch backend terminal for:**
```
[GoogleOAuth] Generated OAuth URL { orgId: '...', hasState: true }
[GoogleOAuth] OAuth callback received
[GoogleOAuth] Tokens stored successfully { orgId: '...' }
[GoogleOAuth] Redirecting to frontend
```

**Success Indicators:**
- ✅ "Tokens stored successfully" message
- ✅ No error messages
- ✅ Redirect URL generated

---

### Test 4: Verify Connection Status ✅

**Run Command:**
```bash
curl "http://localhost:3001/api/google-oauth/status?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected Response:**
```json
{
  "connected": true,
  "active": true,
  "connectedAt": "2026-01-10T18:...",
  "hasTokens": true
}
```

**If `connected: false`:**
- OAuth flow didn't complete
- Check backend logs for errors
- Retry OAuth flow

---

### Test 5: Verify Token Storage (Database) ✅

**In Supabase Dashboard:**

1. Go to **Table Editor** → `integrations` table
2. Filter by:
   - `provider` = `google_calendar`
   - `org_id` = `a0000000-0000-0000-0000-000000000001`

3. **Expected Result:**
   - ✅ Row exists with `active = true`
   - ✅ `config` column contains JSON:
     ```json
     {
       "access_token": "iv_hex:encrypted_hex",
       "refresh_token": "iv_hex:encrypted_hex",
       "expires_at": "2026-01-10T19:00:00Z"
     }
     ```
   - ✅ `updated_at` = recent timestamp

**Tokens should be ENCRYPTED** (not plaintext!)

---

### Test 6: Test Calendar API Calls ✅

**Create Quick Test Script:**
```bash
cd backend
cat > scripts/test-calendar-live.ts << 'EOF'
import 'dotenv/config';
import { getAvailableSlots, checkAvailability } from '../src/services/calendar-integration';

const orgId = 'a0000000-0000-0000-0000-000000000001';

async function test() {
  try {
    console.log('📅 Testing Google Calendar API...\n');
    
    // Test 1: Get available slots
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    console.log(`✅ Test 1: Get available slots for ${dateStr}`);
    const slots = await getAvailableSlots(orgId, dateStr, 'America/New_York');
    console.log(`   Found ${slots.length} available slots`);
    console.log(`   Sample: ${slots.slice(0, 5).join(', ')}...\n`);
    
    // Test 2: Check specific time slot
    console.log('✅ Test 2: Check availability for 2:00 PM');
    const available = await checkAvailability(
      orgId,
      `${dateStr}T14:00:00-05:00`,
      `${dateStr}T15:00:00-05:00`,
      'America/New_York'
    );
    console.log(`   Slot available: ${available}\n`);
    
    console.log('🎉 All calendar API tests passed!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.message.includes('not connected')) {
      console.error('   → Complete OAuth flow first');
    }
    process.exit(1);
  }
}

test();
EOF

npx ts-node scripts/test-calendar-live.ts
```

**Expected Output:**
```
📅 Testing Google Calendar API...

✅ Test 1: Get available slots for 2026-01-11
   Found 12 available slots
   Sample: 09:00, 09:45, 10:30, 11:15, 12:00...

✅ Test 2: Check availability for 2:00 PM
   Slot available: true

🎉 All calendar API tests passed!
```

---

## ✅ Success Criteria Checklist

### OAuth Flow:
- [ ] Authorization URL redirects to Google ✅ / ❌
- [ ] Google consent screen appears ✅ / ❌
- [ ] Permission granted successfully ✅ / ❌
- [ ] Callback received and processed ✅ / ❌
- [ ] Tokens stored encrypted in database ✅ / ❌
- [ ] Backend logs show success ✅ / ❌

### API Testing:
- [ ] Connection status = `connected: true` ✅ / ❌
- [ ] Get available slots works ✅ / ❌
- [ ] Check availability works ✅ / ❌
- [ ] No errors in backend logs ✅ / ❌

---

## 🐛 Troubleshooting

### Issue: Still Getting 404
**Solution:**
- Verify server restarted after adding routes
- Check `grep "google-oauth" backend/src/server.ts` shows route
- Restart server again

### Issue: redirect_uri_mismatch
**Solution:**
- Wait 5-10 minutes after adding URI to Google Console
- Clear browser cache
- Try incognito mode
- Verify URI exactly matches: `http://localhost:3001/api/google-oauth/callback`

### Issue: Token Exchange Failed
**Solution:**
- Check backend logs for specific error
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in .env
- Verify redirect URI in Google Console matches

### Issue: Calendar API Calls Fail
**Solution:**
- Verify OAuth flow completed
- Check connection status endpoint
- Check backend logs for token refresh errors
- Verify tokens in database (encrypted)

---

## 📊 Test Results Log

**Test Date/Time:** _____________

**OAuth Flow:**
- Authorization URL: ✅ / ❌
- Google consent: ✅ / ❌
- Permission granted: ✅ / ❌
- Callback processed: ✅ / ❌
- Tokens stored: ✅ / ❌

**API Testing:**
- Connection status: ✅ / ❌
- Get slots: ✅ / ❌
- Check availability: ✅ / ❌

**Issues Encountered:**
_________________________________

---

**Ready to test!** Open the authorization URL and follow the flow step by step. 🚀
