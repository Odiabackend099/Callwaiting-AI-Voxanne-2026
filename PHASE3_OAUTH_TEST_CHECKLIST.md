# Phase 3: OAuth Testing Checklist ✅

**Date:** 2026-01-10  
**Status:** Redirect URI Added - Ready to Test

---

## ✅ Prerequisites Check

- [x] Environment variables configured
- [x] Google Cloud Console redirect URI added (`http://localhost:3001/api/google-oauth/callback`)
- [ ] Backend server running on port 3001
- [ ] OAuth flow tested
- [ ] Token storage verified

---

## 🧪 Step-by-Step Testing

### Step 1: Start Backend Server

```bash
cd backend
npm run dev
```

**Expected Output:**
```
Server running on http://localhost:3001
✅ Routes registered: /api/google-oauth/*
```

**Check for errors:**
- ❌ "GOOGLE_ENCRYPTION_KEY environment variable is required" → Check .env file
- ❌ "Missing GOOGLE_CLIENT_ID" → Check .env file
- ✅ No errors → Ready to proceed

---

### Step 2: Test OAuth Authorization Endpoint

**Option A: Browser Test (Recommended)**
```
Open in browser:
http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001
```

**Expected:**
- ✅ Redirects to Google OAuth consent screen
- ✅ Shows "Google Calendar" permission request
- ✅ URL contains `client_id`, `scope`, `state` parameters

**If you see "redirect_uri_mismatch":**
- Wait 5-10 minutes (Google needs time to propagate)
- Clear browser cache
- Try incognito mode

**Option B: curl Test (Quick Check)**
```bash
curl -v "http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001" 2>&1 | grep -i "location:"
```

**Expected:**
- HTTP 302 redirect
- Location header points to `accounts.google.com/o/oauth2/auth`

---

### Step 3: Complete OAuth Flow

1. **On Google Consent Screen:**
   - Select Google account
   - Review permissions (Calendar access)
   - Click "Allow"

2. **Expected Redirect:**
   - Google redirects to: `http://localhost:3001/api/google-oauth/callback?code=...&state=...`
   - Backend processes callback
   - Redirects to: `http://localhost:3000/dashboard/settings?success=calendar_connected`

3. **Check Backend Logs:**
   ```
   [GoogleOAuth] OAuth callback received
   [GoogleOAuth] Tokens stored successfully
   ```

**If you see error in URL:**
- `error=redirect_uri_mismatch` → Wait 5-10 min, clear cache
- `error=oauth_token_exchange_failed` → Check backend logs
- `error=oauth_state_invalid` → CSRF protection triggered (retry)

---

### Step 4: Verify Connection Status

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

**If `connected: false`:**
- OAuth flow didn't complete
- Check backend logs for errors
- Retry OAuth flow

---

### Step 5: Verify Token Storage (Database)

**In Supabase Dashboard or SQL Editor:**
```sql
SELECT 
  org_id,
  provider,
  active,
  CASE 
    WHEN config->>'access_token' IS NOT NULL THEN 'Encrypted'
    ELSE 'Missing'
  END as access_token_status,
  CASE 
    WHEN config->>'refresh_token' IS NOT NULL THEN 'Encrypted'
    ELSE 'Missing'
  END as refresh_token_status,
  updated_at
FROM integrations
WHERE provider = 'google_calendar'
AND org_id = 'a0000000-0000-0000-0000-000000000001';
```

**Expected:**
- `active = true`
- `access_token_status = 'Encrypted'`
- `refresh_token_status = 'Encrypted'`
- `updated_at` = recent timestamp

---

### Step 6: Test Calendar API Calls

**Create Test Script:**
```bash
cd backend
cat > scripts/test-calendar.ts << 'EOF'
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
    
    console.log(`Test 1: Get available slots for ${dateStr}`);
    const slots = await getAvailableSlots(orgId, dateStr, 'America/New_York');
    console.log(`✅ Found ${slots.length} available slots`);
    console.log(`   First 5: ${slots.slice(0, 5).join(', ')}...\n`);
    
    // Test 2: Check specific time slot
    console.log('Test 2: Check if 2:00 PM slot is available');
    const available = await checkAvailability(
      orgId,
      `${dateStr}T14:00:00`,
      `${dateStr}T15:00:00`,
      'America/New_York'
    );
    console.log(`✅ 2:00 PM slot available: ${available}\n`);
    
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

npx ts-node scripts/test-calendar.ts
```

**Expected Output:**
```
📅 Testing Google Calendar API...

Test 1: Get available slots for 2026-01-11
✅ Found 12 available slots
   First 5: 09:00, 09:45, 10:30, 11:15, 12:00...

Test 2: Check if 2:00 PM slot is available
✅ 2:00 PM slot available: true

🎉 All calendar API tests passed!
```

---

## ✅ Success Criteria

- [ ] OAuth authorization URL generated successfully
- [ ] User redirected to Google consent screen
- [ ] Permission granted
- [ ] Callback received and processed
- [ ] Tokens stored encrypted in database
- [ ] Connection status shows `connected: true`
- [ ] Calendar API calls work (getAvailableSlots, checkAvailability)

---

## 🐛 Troubleshooting

### Issue: "redirect_uri_mismatch"
**Solution:**
- Verify redirect URI in Google Console matches exactly: `http://localhost:3001/api/google-oauth/callback`
- Wait 5-10 minutes after adding
- Clear browser cache
- Try incognito mode

### Issue: "Token decryption failed"
**Solution:**
- Verify `GOOGLE_ENCRYPTION_KEY` in `.env` is correct
- Ensure encryption key hasn't changed
- Reconnect Google Calendar

### Issue: "Calendar not connected"
**Solution:**
- Complete OAuth flow first
- Verify tokens in database
- Check `active = true` in integrations table

### Issue: Backend not starting
**Solution:**
- Check for port conflicts: `lsof -ti:3001`
- Verify all environment variables set
- Check TypeScript compilation errors

---

## 📊 Test Results Log

**Date/Time:** _____________

**OAuth Flow:**
- [ ] Authorization URL generated: ✅ / ❌
- [ ] Google consent screen shown: ✅ / ❌
- [ ] Permission granted: ✅ / ❌
- [ ] Callback received: ✅ / ❌
- [ ] Tokens stored: ✅ / ❌

**API Testing:**
- [ ] Connection status check: ✅ / ❌
- [ ] Get available slots: ✅ / ❌
- [ ] Check availability: ✅ / ❌

**Notes:**
_________________________________

---

**Ready to test!** Start with Step 1 and work through systematically.
