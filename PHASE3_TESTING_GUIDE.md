# Phase 3: Google Calendar OAuth - Testing Guide

**Date:** 2026-01-10  
**Status:** Ready for Testing

---

## Prerequisites Checklist

- [x] Environment variables configured in `backend/.env`
- [ ] Google Cloud Console redirect URIs added (see `GOOGLE_CLOUD_CONSOLE_SETUP.md`)
- [ ] Backend server running on port 3001
- [ ] Organization ID available for testing

---

## Step 1: Verify Environment Variables

```bash
cd backend
grep -E "GOOGLE_|FRONTEND_URL|BACKEND_URL" .env
```

**Expected Output:**
```
GOOGLE_CLIENT_ID=750045445755-najs38gvm8dudvtrq7mkm6legetn9bos.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_ENCRYPTION_KEY=539f2c702d3ec2342cbba7e2864e7019ae4eb0d79d80174ae134a4b4dbe38bd0
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google-oauth/callback
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
```

---

## Step 2: Start Backend Server

```bash
cd backend
npm run dev
```

**Expected Output:**
```
Server running on http://localhost:3001
✅ All routes registered
```

**Check for errors:**
- ❌ "GOOGLE_ENCRYPTION_KEY environment variable is required" → Encryption key missing/invalid
- ❌ "Missing GOOGLE_CLIENT_ID" → Client ID not configured
- ✅ No errors → Ready to test

---

## Step 3: Test OAuth Authorization Endpoint

**Get Organization ID:**
```bash
# If you don't know your org ID, use the default dev org ID
ORG_ID=a0000000-0000-0000-0000-000000000001
```

**Test Authorization URL Generation:**
```bash
curl -v "http://localhost:3001/api/google-oauth/authorize?orgId=${ORG_ID}" 2>&1 | grep -i "location:"
```

**Expected:** 
- HTTP 302 redirect
- Location header points to Google OAuth URL
- URL contains `client_id`, `scope`, `state` parameters

**Alternative Test (in Browser):**
1. Open: `http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001`
2. Should redirect to Google OAuth consent screen
3. If you see "redirect_uri_mismatch" → Need to add redirect URI in Google Console (see `GOOGLE_CLOUD_CONSOLE_SETUP.md`)

---

## Step 4: Complete OAuth Flow (Manual Test)

### 4.1: Initiate OAuth
1. Open browser: `http://localhost:3001/api/google-oauth/authorize?orgId=a0000000-0000-0000-0000-000000000001`
2. Should redirect to Google login

### 4.2: Grant Permission
1. Log in with Google account
2. Review permissions (Calendar access)
3. Click "Allow"

### 4.3: Verify Callback
1. Should redirect to: `http://localhost:3000/dashboard/settings?success=calendar_connected`
2. If error, check URL for error parameter:
   - `error=redirect_uri_mismatch` → Add redirect URI in Google Console
   - `error=oauth_token_exchange_failed` → Check backend logs
   - `error=oauth_state_invalid` → CSRF protection triggered

### 4.4: Check Backend Logs
```bash
# Watch backend console for:
[SMSStatusWebhook] Status update received  # (ignore if unrelated)
[GoogleOAuth] Generated OAuth URL          # Should see this
[GoogleOAuth] OAuth callback successful    # Should see this after granting permission
[GoogleOAuth] Tokens stored successfully   # Should see this
```

---

## Step 5: Verify Token Storage

**Check Database:**
```sql
-- In Supabase SQL Editor or via API
SELECT 
  org_id,
  provider,
  active,
  config->>'access_token' as has_access_token,
  config->>'refresh_token' as has_refresh_token,
  updated_at
FROM integrations
WHERE provider = 'google_calendar'
AND org_id = 'a0000000-0000-0000-0000-000000000001';
```

**Expected:**
- `active = true`
- `has_access_token = "iv:encrypted"` (encrypted string)
- `has_refresh_token = "iv:encrypted"` (encrypted string)
- `updated_at` = recent timestamp

---

## Step 6: Test Connection Status Endpoint

```bash
curl "http://localhost:3001/api/google-oauth/status?orgId=a0000000-0000-0000-0000-000000000001"
```

**Expected Response:**
```json
{
  "connected": true,
  "active": true,
  "connectedAt": "2026-01-10T12:00:00Z",
  "hasTokens": true
}
```

**If `connected: false`:**
- Tokens not stored in database
- Check backend logs for errors
- Retry OAuth flow

---

## Step 7: Test Calendar API Calls

### 7.1: Test Availability Check

```bash
# Test via curl (if you have a test endpoint)
# Or create a test script
```

**Create Test Script:**
```bash
cd backend
cat > scripts/test-calendar-api.ts << 'EOF'
import 'dotenv/config';
import { getAvailableSlots, checkAvailability } from '../src/services/calendar-integration';

const orgId = 'a0000000-0000-0000-0000-000000000001';

async function test() {
  try {
    console.log('📅 Testing Calendar API...\n');
    
    // Test 1: Get available slots
    console.log('Test 1: Get available slots for tomorrow');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    const slots = await getAvailableSlots(orgId, dateStr, 'America/New_York');
    console.log(`✅ Available slots: ${slots.length}`);
    console.log(`   Slots: ${slots.slice(0, 5).join(', ')}...\n`);
    
    // Test 2: Check specific time slot
    console.log('Test 2: Check if 2:00 PM slot is available');
    const startTime = `${dateStr}T14:00:00`;
    const endTime = `${dateStr}T15:00:00`;
    
    const available = await checkAvailability(orgId, startTime, endTime, 'America/New_York');
    console.log(`✅ Slot available: ${available}\n`);
    
    console.log('🎉 All tests passed!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

test();
EOF

npx ts-node scripts/test-calendar-api.ts
```

**Expected Output:**
```
📅 Testing Calendar API...

Test 1: Get available slots for tomorrow
✅ Available slots: 12
   Slots: 09:00, 09:45, 10:30, 11:15, 12:00...

Test 2: Check if 2:00 PM slot is available
✅ Slot available: true

🎉 All tests passed!
```

---

## Step 8: Test Token Refresh

Tokens should auto-refresh when expired. To test:

1. Wait for token to expire (usually 1 hour)
2. Or manually set `expires_at` in database to past time
3. Make a calendar API call
4. Check backend logs for: `[GoogleOAuth] Access token expired, refreshing`
5. Verify new access token stored in database

---

## Troubleshooting

### Issue: "redirect_uri_mismatch"
**Solution:** 
- Add `http://localhost:3001/api/google-oauth/callback` to Google Console
- Wait 5-10 minutes
- Clear browser cache

### Issue: "Token decryption failed"
**Solution:**
- Verify `GOOGLE_ENCRYPTION_KEY` is correct (64 hex characters)
- Ensure encryption key hasn't changed since tokens were stored
- Reconnect Google Calendar (tokens will be re-encrypted)

### Issue: "Token refresh failed"
**Solution:**
- User may have revoked access in Google Account settings
- Reconnect Google Calendar
- Check backend logs for specific error

### Issue: "Calendar not connected"
**Solution:**
- Complete OAuth flow first
- Verify tokens stored in database
- Check `active = true` in integrations table

---

## Success Criteria

✅ **OAuth Flow:**
- [ ] Authorization URL generated successfully
- [ ] User redirected to Google consent screen
- [ ] Permission granted
- [ ] Callback received successfully
- [ ] Tokens stored encrypted in database
- [ ] Redirect to frontend with success message

✅ **API Calls:**
- [ ] Connection status endpoint works
- [ ] Get available slots works
- [ ] Check availability works
- [ ] Token auto-refresh works

✅ **Security:**
- [ ] Tokens encrypted in database
- [ ] State parameter validated (CSRF protection)
- [ ] Error messages don't expose sensitive info

---

**Ready to Test!** Start with Step 1 and work through each step systematically.
