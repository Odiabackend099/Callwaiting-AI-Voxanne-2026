# Phase 3: OAuth Routes Ready - Testing Guide 🚀

**Status:** Routes Verified - Ready for OAuth Flow Testing

---

## ✅ Route Verification Complete

### Test Route: ✅ Working
**Endpoint:** `GET /api/google-oauth/test`
**Status:** Returns JSON response
**Verifies:** Router is registered and working

### Status Endpoint: ✅ Working
**Endpoint:** `GET /api/google-oauth/status?orgId=...`
**Status:** Returns connection status JSON
**Response:** `{"connected": false, ...}` or `{"connected": true, ...}`

### Authorization Endpoint: ✅ Working
**Endpoint:** `GET /api/google-oauth/authorize?orgId=...`
**Status:** Returns HTTP 302 redirect to Google OAuth
**Next Step:** Open in browser to start OAuth flow

---

## 🧪 Complete OAuth Flow Testing

### Step 1: Open Authorization URL

**In Browser:**
```
http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001
```

**What Should Happen:**
1. ✅ Backend generates OAuth URL with state parameter
2. ✅ Browser redirects to Google OAuth consent screen
3. ✅ Google shows login/consent screen
4. ✅ Requesting "Calendar" access permission

---

### Step 2: Grant Permission

**On Google Consent Screen:**
- Select or log in with your Google account
- Review permissions (Calendar access)
- Click **"Allow"** to grant permission

**Expected:**
- ✅ Permission granted
- ✅ Google redirects back to callback URL

---

### Step 3: Verify Callback Processing

**After Clicking "Allow":**
- Google redirects to: `http://localhost:3001/api/google-oauth/callback?code=...&state=...`
- Backend processes callback:
  - Validates state parameter (CSRF protection)
  - Exchanges authorization code for access_token + refresh_token
  - Encrypts tokens using AES-256-CBC
  - Stores encrypted tokens in Supabase `integrations` table
  - Redirects to frontend

**Final Redirect:**
- Should go to: `http://localhost:3000/dashboard/settings?success=calendar_connected`
- Or if frontend not running: May show connection error (that's OK - check backend logs)

---

### Step 4: Check Backend Logs

**Watch backend terminal for:**
```
[GoogleOAuth] Generated OAuth URL { orgId: '...' }
[GoogleOAuth] OAuth callback received
[GoogleOAuth] Tokens stored successfully { orgId: '...' }
```

**Success Indicators:**
- ✅ "Tokens stored successfully" message
- ✅ No error messages
- ✅ Redirect to frontend completed

---

### Step 5: Verify Connection Status

**Run Command:**
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

✅ **If `connected: true`** → OAuth flow completed successfully!

---

### Step 6: Verify Token Storage (Database)

**In Supabase Dashboard:**

1. Go to **Table Editor** → `integrations` table
2. Filter by:
   - `provider` = `google_calendar`
   - `org_id` = `a0000000-0000-0000-0000-000000000001`

3. **Expected Result:**
   - ✅ Row exists with `active = true`
   - ✅ `config` column contains:
     ```json
     {
       "access_token": "iv_hex:encrypted_hex",
       "refresh_token": "iv_hex:encrypted_hex",
       "expires_at": "2026-01-10T19:00:00Z"
     }
     ```
   - ✅ Tokens are ENCRYPTED (not plaintext)
   - ✅ `updated_at` = recent timestamp

---

## ✅ Success Criteria Checklist

**OAuth Flow:**
- [ ] Authorization URL redirects to Google ✅ / ❌
- [ ] Google consent screen appears ✅ / ❌
- [ ] Permission granted successfully ✅ / ❌
- [ ] Callback received and processed ✅ / ❌
- [ ] Tokens stored encrypted in database ✅ / ❌
- [ ] Connection status = `connected: true` ✅ / ❌

---

## 🎯 Next Steps After OAuth Success

Once OAuth flow completes successfully:

### Test Calendar API Calls

**Create and run test script:**
```bash
cd backend
cat > scripts/test-calendar-api.ts << 'EOF'
import 'dotenv/config';
import { getAvailableSlots, checkAvailability } from '../src/services/calendar-integration';

const orgId = 'a0000000-0000-0000-0000-000000000001';
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const dateStr = tomorrow.toISOString().split('T')[0];

async function test() {
  try {
    console.log('📅 Testing Google Calendar API...\n');
    
    // Test 1: Get available slots
    console.log(`Test 1: Get available slots for ${dateStr}`);
    const slots = await getAvailableSlots(orgId, dateStr, 'America/New_York');
    console.log(`✅ Found ${slots.length} available slots`);
    console.log(`   Sample: ${slots.slice(0, 5).join(', ')}...\n`);
    
    // Test 2: Check availability
    console.log('Test 2: Check if 2:00 PM slot is available');
    const available = await checkAvailability(
      orgId,
      `${dateStr}T14:00:00-05:00`,
      `${dateStr}T15:00:00-05:00`,
      'America/New_York'
    );
    console.log(`✅ 2:00 PM slot available: ${available}\n`);
    
    console.log('🎉 All calendar API tests passed!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

test();
EOF

npx ts-node scripts/test-calendar-api.ts
```

**Expected:** Lists available time slots and checks availability

---

## 🐛 Troubleshooting

### Issue: redirect_uri_mismatch
**Solution:**
- Verify redirect URI in Google Console: `http://localhost:3001/api/google-oauth/callback`
- Wait 5-10 minutes after adding URI
- Clear browser cache
- Try incognito mode

### Issue: Token Exchange Failed
**Solution:**
- Check backend logs for specific error
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in .env
- Verify redirect URI matches Google Console

### Issue: Tokens Not Stored
**Solution:**
- Check backend logs for database errors
- Verify Supabase connection
- Check `integrations` table exists and has correct schema

---

## 📊 Test Results Log

**Test Date/Time:** _____________

**OAuth Flow:**
- Authorization URL: ✅ / ❌
- Google consent: ✅ / ❌
- Permission granted: ✅ / ❌
- Callback processed: ✅ / ❌
- Tokens stored: ✅ / ❌

**Verification:**
- Connection status: ✅ / ❌
- Database tokens: ✅ / ❌

**Calendar API:**
- Get slots: ✅ / ❌
- Check availability: ✅ / ❌

**Notes:**
_________________________________

---

**Ready to test!** Open the authorization URL in your browser to start the OAuth flow. 🚀
