# 🛡️ Voxanne Robust Integration Framework - Complete Testing Guide

## Overview

This document provides step-by-step instructions to test the complete Robust Integration Framework implemented for 2026. All 5 components are now deployed and ready for validation.

**Framework Components:**
1. ✅ **tenantResolver Middleware** - Auto-resolve missing org_id from JWT
2. ✅ **SafeCall Wrapper** - Resilient API calls with circuit breaker & token refresh
3. ✅ **health-integrations Endpoint** - Comprehensive system diagnostics
4. ✅ **Twilio Guard** - Guaranteed SMS delivery with retry & confirmation
5. ✅ **Auto-Org Creation Trigger** - New users auto-assigned organization on signup

---

## Prerequisites

- Backend running on port 3001: `npm run dev` in `backend/` directory
- Frontend running on port 3000: `npm run dev` in root directory
- Supabase credentials configured in `.env`
- Twilio credentials configured in `.env`
- Google OAuth credentials configured in `.env`

---

## Test 1: Health Integrations Diagnostic Endpoint

**Purpose:** Verify the system can self-diagnose health status across all dependencies

### Test 1.1: Database Connectivity Check

```bash
curl -X GET http://localhost:3001/api/health/integrations \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-16T20:15:30.123Z",
  "elapsedMs": 145,
  "integrations": [
    {
      "name": "Database",
      "status": "healthy",
      "lastChecked": "2026-01-16T20:15:30.123Z",
      "message": "PostgreSQL connection active",
      "details": {
        "queriedRows": 1
      }
    },
    ...
  ],
  "summary": {
    "healthy": 4,
    "degraded": 0,
    "critical": 0
  },
  "recommendations": [
    "✅ All systems operational"
  ]
}
```

**Validation Checklist:**
- [ ] Database status shows "healthy"
- [ ] Response includes all 4 integration checks (Database, Google Calendar, Twilio, Circuit Breakers)
- [ ] Overall status is "healthy" or "degraded" (not "critical")
- [ ] Elapsed time is < 500ms
- [ ] Recommendations are present

---

## Test 2: Zero-Trust Onboarding Flow

**Purpose:** Verify new users can sign up and be automatically assigned an organization

### Test 2.1: User Signup (Trigger auto-org creation)

1. **Sign up a new test user:**
   - Navigate to `http://localhost:3000/auth` (or your sign-up page)
   - Email: `test-user-$(date +%s)@example.com` (use timestamp to create unique email)
   - Password: `TestPassword123!`
   - Click "Sign Up"

2. **Verify database auto-creation:**
   ```sql
   -- Check if organization was auto-created
   SELECT id, email, is_organization, created_at
   FROM profiles
   WHERE email = 'test-user-TIMESTAMP@example.com'
   AND is_organization = true
   ORDER BY created_at DESC
   LIMIT 1;
   ```

   **Expected Result:** 1 row with `is_organization = true`

3. **Verify JWT includes org_id:**
   ```sql
   -- Check user's app_metadata contains org_id
   SELECT id, email, app_metadata->>'org_id' as org_id
   FROM auth.users
   WHERE email = 'test-user-TIMESTAMP@example.com';
   ```

   **Expected Result:** org_id is populated (looks like: `46cf2995-2bee-44e3-838b-24151486fe4e`)

### Test 2.2: Frontend receives org_id in JWT

1. **Log in with the new user:**
   - Navigate to dashboard
   - Verify login succeeds without needing manual org_id assignment

2. **Check localStorage JWT:**
   ```javascript
   // In browser console:
   const token = localStorage.getItem('auth.token');
   const decoded = JSON.parse(atob(token.split('.')[1]));
   console.log('org_id:', decoded.app_metadata?.org_id);
   ```

   **Expected:** org_id is present

### Test 2.3: tenantResolver Middleware Fallback

1. **Create a test case with "stale" JWT:**
   - Manually remove org_id from JWT in browser localStorage
   - Refresh page
   - Navigate to any protected endpoint

2. **Verify middleware recovers org_id:**
   - Request should succeed (not fail with 403)
   - Check backend logs:
     ```
     [TenantResolver] Resolved missing org_id via database
     ```

---

## Test 3: Google Calendar OAuth Integration

**Purpose:** Verify SafeCall token refresh works during calendar operations

### Test 3.1: Link Google Calendar (with SafeCall enabled)

1. Navigate to `http://localhost:3000/dashboard/api-keys`
2. Click "Link Google Calendar"
3. Complete OAuth flow
4. Verify status shows "Google Calendar - Linked"

### Test 3.2: Verify Token Refresh on Expiry

1. **Simulate expired token:**
   ```sql
   -- Set token expiry to past time
   UPDATE org_credentials
   SET encrypted_config = NULL
   WHERE provider = 'google_calendar'
   AND org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';
   ```
   (Then reset it via OAuth)

2. **Trigger calendar operation:**
   - Make a calendar query (check availability, book appointment)
   - Token should auto-refresh without user intervention

3. **Check logs:**
   ```
   [SafeCall] Token refreshed for google_calendar
   ```

---

## Test 4: Twilio Guard SMS Delivery

**Purpose:** Verify SMS sends with retry logic and delivery confirmation

### Test 4.1: Basic SMS Send

```bash
# Add this test endpoint temporarily to your routes
curl -X POST http://localhost:3001/api/test/send-sms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "organizationId": "46cf2995-2bee-44e3-838b-24151486fe4e",
    "phoneNumber": "+1XXXYYYZZZZ",
    "message": "Test SMS from Voxanne - ignore if you received this"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "SM1234567890abcdef",
  "attempts": 1,
  "userMessage": "",
  "details": {
    "deliveryTime": 1250
  }
}
```

**Validation Checklist:**
- [ ] SMS received on test phone number
- [ ] Response includes messageId
- [ ] Delivery time is < 5000ms
- [ ] No errors in backend logs

### Test 4.2: Retry Logic (Simulate Failure)

1. **Temporarily break Twilio credentials:**
   ```javascript
   // In safe-call or twilio-guard, modify auth token check
   process.env.TWILIO_AUTH_TOKEN = 'INVALID';
   ```

2. **Attempt to send SMS:**
   - Should retry 3 times (exponential backoff: 1s, 2s, 4s)
   - Check backend logs for retry attempts:
     ```
     [TwilioGuard] SMS attempt 1/3 failed
     [TwilioGuard] SMS attempt 2/3 failed
     [TwilioGuard] SMS attempt 3/3 failed
     [TwilioGuard] Circuit breaker opened for org_id
     ```

3. **Restore credentials and wait 30 seconds:**
   - Circuit should auto-recover after cooldown
   - Next SMS attempt should succeed

---

## Test 5: Circuit Breaker Pattern

**Purpose:** Verify system gracefully degrades when services fail

### Test 5.1: Verify Circuit Breaker Status

```bash
curl -X GET http://localhost:3001/api/health/integrations
```

Look for "Circuit Breakers" section:
```json
{
  "name": "Circuit Breakers",
  "status": "healthy",
  "details": {
    "totalBreakers": 3,
    "openServices": []
  }
}
```

### Test 5.2: Trigger Circuit Opening (Simulate Service Failure)

1. **Simulate 3 consecutive Google Calendar failures:**
   ```bash
   # Call a calendar endpoint 3 times with broken credentials
   for i in {1..3}; do
     curl -X GET "http://localhost:3001/api/calendar/freebusy" \
       -H "Authorization: Bearer INVALID_TOKEN" \
       -H "Content-Type: application/json"
   done
   ```

2. **Check circuit is open:**
   ```bash
   curl -X GET http://localhost:3001/api/health/integrations
   ```

   Should show:
   ```json
   {
     "name": "Circuit Breakers",
     "status": "degraded",
     "details": {
       "openServices": ["google_calendar"]
     }
   }
   ```

3. **Verify graceful degradation:**
   - AI doesn't crash
   - Returns user message: "Google Calendar system is temporarily unavailable. Please try again in a moment."

4. **Wait 30 seconds and verify auto-recovery:**
   ```bash
   # After 30 second cooldown
   curl -X GET http://localhost:3001/api/health/integrations
   ```

   Should show:
   ```json
   {
     "openServices": []  // Circuit is closed again
   }
   ```

---

## Test 6: End-to-End Appointment Booking Flow

**Purpose:** Validate the complete integration works from user voice input to calendar confirmation

### Test 6.1: Book Appointment via AI

**Scenario:** User calls and says "I'd like to book an appointment for Tuesday at 2 PM"

**Manual Test Steps:**
1. Ensure Google Calendar is linked (Test 3.1)
2. Trigger booking via API:
   ```bash
   curl -X POST http://localhost:3001/api/appointments \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{
       "organizationId": "46cf2995-2bee-44e3-838b-24151486fe4e",
       "patientEmail": "patient@example.com",
       "startTime": "2026-01-21T14:00:00Z",
       "endTime": "2026-01-21T14:30:00Z",
       "summary": "New Patient Appointment"
     }'
   ```

### Test 6.2: Verify Calendar Event Created

1. **Check Google Calendar:**
   - Event should appear on calendar
   - Title: "New Patient Appointment"
   - Time: Tuesday 2:00 PM - 2:30 PM

2. **Check Database:**
   ```sql
   SELECT id, summary, status, calendar_event_id, created_at
   FROM bookings
   WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

   **Expected:** 1 row with status='confirmed' and calendar_event_id populated

### Test 6.3: Verify SMS Confirmation Sent

1. **Check SMS delivery:**
   - Patient should receive SMS: "Your appointment is confirmed for Tuesday, January 21 at 2:00 PM"
   - Timestamp should match booking time

2. **Check logs:**
   ```
   [TwilioGuard] SMS sent successfully to +1XXXYYYZZZZ
   [Booking] Appointment confirmed and SMS sent
   ```

---

## Test 7: Multi-Tenant Isolation

**Purpose:** Verify organizations don't see each other's data

### Test 7.1: Create Second Test Organization

1. **Sign up as different user:**
   ```bash
   Email: second-org-test@example.com
   ```

2. **Note their org_id:**
   ```sql
   SELECT app_metadata->>'org_id' as org_id
   FROM auth.users
   WHERE email = 'second-org-test@example.com';
   ```

### Test 7.2: Verify Data Isolation

```sql
-- First org's calendar should not be accessible to second org
SELECT * FROM org_credentials
WHERE provider = 'google_calendar'
AND org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';

-- Second org's view (should be empty or different)
SELECT * FROM org_credentials
WHERE provider = 'google_calendar'
AND org_id = 'SECOND_ORG_ID';
```

---

## Test 8: Diagnostic Recommendations

**Purpose:** Verify the system provides actionable guidance

### Test 8.1: Trigger Degraded State

```bash
# Disable Google Calendar token (set expiresAt to past)
# Then check health endpoint
curl -X GET http://localhost:3001/api/health/integrations
```

**Expected recommendations:**
```json
{
  "recommendations": [
    "🟡 Google Calendar token expiring soon - refresh will happen automatically on next use"
  ]
}
```

### Test 8.2: Trigger Critical State

```bash
# Stop Supabase temporarily, then check health
curl -X GET http://localhost:3001/api/health/integrations
```

**Expected:**
```json
{
  "status": "critical",
  "recommendations": [
    "🔴 DATABASE CRITICAL: Check Supabase connection and service key"
  ]
}
```

---

## Success Criteria

✅ **Framework is production-ready when:**

| Component | Status | Evidence |
|-----------|--------|----------|
| New user auto-org assignment | ✅ | User signup triggers org creation, JWT has org_id |
| tenantResolver fallback | ✅ | Stale JWT requests still work via database lookup |
| SafeCall token refresh | ✅ | Expired Google tokens auto-refresh without user action |
| Circuit breaker | ✅ | System degrades gracefully, auto-recovers after 30s |
| Twilio Guard retries | ✅ | SMS retries 3x with exponential backoff |
| Health diagnostics | ✅ | `/api/health/integrations` shows accurate status |
| End-to-end booking | ✅ | User voice → booking created → SMS sent |
| Multi-tenant isolation | ✅ | Orgs see only their own credentials and bookings |

---

## Troubleshooting

### "JWT missing org_id" Error
- **Solution:** tenantResolver middleware should catch this
- **Check logs:** `[TenantResolver] Resolved missing org_id`
- **If still failing:** Run migration to create missing org

### SMS Not Delivering
- **Check:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in `.env`
- **Verify:** Phone number is in correct E.164 format (+1XXXYYYZZZZ)
- **Check logs:** `[TwilioGuard] SMS attempt` messages
- **Circuit open?** Wait 30 seconds or manually reset

### Google Calendar Token Expired
- **Auto-refresh:** Should happen automatically via SafeCall
- **Manual check:**
  ```sql
  SELECT * FROM org_credentials WHERE provider = 'google_calendar';
  ```
- **If stuck:** Re-link calendar via OAuth flow

### health/integrations endpoint returns "critical"
- **Database down:** Check Supabase status
- **Google token expired:** Run OAuth flow to refresh
- **Twilio misconfigured:** Verify environment variables
- **Circuit breaker open:** Check error logs, wait 30s for auto-recovery

---

## Deployment Checklist

Before deploying to production:

- [ ] Run all 8 tests above in staging environment
- [ ] Verify database migration ran successfully
- [ ] Backend started without errors
- [ ] All environment variables configured
- [ ] Test user signup with new email
- [ ] Verify org auto-created in database
- [ ] Link Google Calendar
- [ ] Create test appointment
- [ ] Verify SMS sent
- [ ] Check /api/health/integrations shows "healthy"

---

## Performance Benchmarks

Expected response times:

| Operation | Target | Tolerance |
|-----------|--------|-----------|
| /api/health/integrations | 200ms | < 500ms |
| SafeCall (success) | 500ms | < 2000ms |
| TwilioGuard (success) | 1500ms | < 5000ms |
| tenantResolver (fallback) | 100ms | < 300ms |
| Google Calendar token refresh | 800ms | < 2000ms |

---

## Support

If tests fail, check:

1. **Backend logs:** `npm run dev` in `backend/` directory
2. **Database logs:** Supabase dashboard → Logs
3. **Environment variables:** All 3 services configured
4. **Network:** APIs accessible from your network
5. **Previous commits:** Compare against working baseline

---

## Next Steps

1. **Run all tests** above and collect evidence
2. **Fix any failures** using troubleshooting section
3. **Deploy to staging** once all tests pass
4. **Monitor production** for errors in first 24 hours
5. **Update documentation** as issues are discovered

---

**Status:** ✅ Complete
**Deployed:** 2026-01-16
**Last Updated:** 2026-01-16
**Framework Version:** 1.0.0
