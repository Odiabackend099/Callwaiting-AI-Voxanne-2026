# SMS & CALENDAR FAILURE - ROOT CAUSE FOUND

**Date:** 2026-02-04
**Status:** 🔍 **ROOT CAUSE IDENTIFIED**

---

## 🔴 ROOT CAUSE #1: SMS FAILURE - PROVIDER NAME CASE MISMATCH

### The Smoking Gun

**Database Query:**
```sql
SELECT * FROM integrations
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND provider = 'twilio';
```
**Result:** 0 rows found

**But:**
```sql
SELECT * FROM integrations
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';
```
**Result:** 3 rows:
1. provider = 'google_calendar' ✅
2. provider = 'TWILIO' ❌ (uppercase!)
3. provider = 'twilio_inbound' ❌ (different name!)

### Why SMS Failed

**Code in `integration-decryptor.ts` line 130:**
```typescript
static async getTwilioCredentials(orgId: string): Promise<TwilioCredentials> {
  return this.getCredentials<TwilioCredentials>(
    orgId,
    'twilio',  // ❌ Searches for lowercase 'twilio'
    (decrypted) => { ... }
  );
}
```

**Code in `credential-service.ts` line 80:**
```typescript
const { data, error } = await supabase
  .from('integrations')
  .select('encrypted_config, ...')
  .eq('org_id', orgId)
  .eq('provider', provider)  // ❌ Case-sensitive match: 'twilio' != 'TWILIO'
  .maybeSingle();
```

**Result:** Credentials not found → SMS fails

---

## 🟡 ROOT CAUSE #2: CALENDAR HEALTH CHECK FAILURE - CONNECTED=FALSE

### The Smoking Gun

**Database Row:**
```json
{
  "provider": "google_calendar",
  "connected": false,  ❌ Health check failed
  "encrypted": false,
  "has_encrypted_config": true,  ✅ Credentials exist (920 chars)
  "last_checked_at": null  ⚠️ Never checked
}
```

### Why Calendar Health Check Failed

**Code in `integration-decryptor.ts` line 789-846:**
```typescript
static async validateGoogleCalendarHealth(orgId: string): Promise<{ healthy: boolean; error?: string }> {
  try {
    const creds = await this.getGoogleCalendarCredentials(orgId);

    // Test API call - minimal resource request
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    await calendar.calendarList.list({ maxResults: 1 });

    return { healthy: true };
  } catch (error: any) {
    if (error.code === 401) {
      return {
        healthy: false,
        error: 'OAuth token expired - please reconnect Google Calendar in settings',
      };
    }
    return {
      healthy: false,
      error: error?.message || 'Unknown error checking calendar health',
    };
  }
}
```

**Likely Issue:** OAuth token expired (access_token has TTL of 1 hour)

**Missing:** Token refresh logic to get new access_token using refresh_token

---

## 🛠️ FIX STRATEGY

### Fix #1: SMS Provider Name Case Mismatch (IMMEDIATE)

**Option A: Fix Database (Recommended)**
```sql
UPDATE integrations
SET provider = 'twilio'
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
  AND provider = 'TWILIO';
```

**Option B: Fix Code Query (Alternative)**
```typescript
// In credential-service.ts, make query case-insensitive:
.select('encrypted_config, ...')
.eq('org_id', orgId)
.ilike('provider', provider)  // Case-insensitive match
.maybeSingle();
```

**Recommended:** Option A (fix database) - Keeps code simple, avoids future issues

---

### Fix #2: Google Calendar Token Refresh (MEDIUM PRIORITY)

**Current Code (line 189-206):**
```typescript
const expiresAt = new Date(credentials.expiresAt);
if (expiresAt < new Date() && !allowExpired) {
  // ❌ Just throws error, doesn't refresh
  throw new Error('Google Calendar token expired. Please reconnect your Google account.');
}
```

**Should Be:**
```typescript
const expiresAt = new Date(credentials.expiresAt);
if (expiresAt < new Date() && !allowExpired) {
  log.info('IntegrationDecryptor', 'Token expired, attempting refresh', { orgId });

  // Refresh the token
  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: credentials.refreshToken
  });

  // Get new access token
  const { credentials: newCreds } = await oauth2Client.refreshAccessToken();

  // Update database with new access token
  const updatedCreds = {
    accessToken: newCreds.access_token,
    refreshToken: credentials.refreshToken, // Keep same refresh token
    expiresAt: new Date(Date.now() + (newCreds.expiry_date || 3600000)).toISOString()
  };

  await this.storeCredentials(orgId, 'google_calendar', updatedCreds);

  // Return refreshed credentials
  return updatedCreds;
}
```

---

## 📋 EXECUTION PLAN

### Phase 1: Fix SMS (5 minutes)
1. Run SQL to fix provider name: `UPDATE integrations SET provider = 'twilio' WHERE provider = 'TWILIO'`
2. Verify fix: `SELECT * FROM integrations WHERE provider = 'twilio'` (should return 1 row)
3. Test SMS: Create `test-sms-now.js` script to trigger SMS
4. Expected: SMS sends successfully with message_sid

### Phase 2: Fix Calendar Token Refresh (15 minutes)
1. Implement token refresh logic in `integration-decryptor.ts` lines 189-206
2. Add `updateIntegrationsTable()` helper method
3. Test refresh: Trigger `validateGoogleCalendarHealth()` with expired token
4. Expected: Token refreshes automatically, calendar health check passes

### Phase 3: Verify End-to-End (5 minutes)
1. Trigger booking via `test-booking-detailed.js`
2. Expected results:
   - ✅ Appointment created in database
   - ✅ SMS confirmation sent (message_sid returned)
   - ✅ Calendar event created (event_id returned)
   - ✅ Health check returns `{ healthy: true }`

---

## 🎯 SUCCESS CRITERIA

**Before Fix:**
- ❌ SMS: `"smsStatus": "failed_but_booked"`
- ❌ Calendar: `"Unable to check availability"`

**After Fix:**
- ✅ SMS: `"smsStatus": "sent", "messageSid": "SM..."`
- ✅ Calendar: `"availableSlots": ["14:00", "15:00", "16:00"]`

---

## 📁 FILES TO MODIFY

1. **Database:** `integrations` table - Fix provider name
2. **Code:** `backend/src/services/integration-decryptor.ts` lines 189-206 - Add token refresh
3. **Test:** `backend/test-sms-now.js` (NEW) - Manual SMS test
4. **Test:** `backend/test-calendar-health.js` (NEW) - Manual calendar test

---

**Next Action:** Execute Phase 1 (Fix SMS provider name)
