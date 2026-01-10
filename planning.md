# Implementation Plan: SMS Verification & Google Calendar Integration

**Date:** 2026-01-10  
**Status:** Planning Phase Complete - Ready for Execution  
**Based on:** Perplexity AI Research (Latest Twilio & Google Documentation)

---

## Problem Statement

### Current Issues

1. **Twilio SMS Delivery:**
   - Messages show "delivered" in API but not received
   - Phone number +18777804236 not verified in trial account
   - No real delivery tracking (status callbacks)
   - Error 30044 on long messages

2. **Google Calendar Integration:**
   - OAuth flow incomplete
   - No real-time availability checking during calls
   - Missing appointment booking functionality
   - No SMS confirmation after booking

3. **End-to-End Flow:**
   - No integration between Vapi webhooks → Calendar → SMS
   - Missing race condition handling
   - No transaction management across APIs

---

## Implementation Phases

### Phase 1: Twilio Phone Verification (P0 - Critical)

**Goal:** Verify phone number programmatically using Outgoing Caller IDs API

**Key Findings from Research:**
- Use `client.outgoingCallerIds.create()` - Twilio calls the number with verification code
- No fully automated verification (user must enter code during call)
- Can check verification status via `client.outgoingCallerIds.list()`

**Steps:**
1. **1.1:** Create verification initiation script
   - File: `backend/scripts/verify-phone-twilio.ts`
   - Function: `initiateVerification(phoneNumber, friendlyName)`
   - Uses: `client.outgoingCallerIds.create()`
   - Output: Verification SID and code to display

2. **1.2:** Create verification status checker
   - Function: `checkVerificationStatus(phoneNumber)`
   - Uses: `client.outgoingCallerIds.list()` and filter
   - Returns: boolean (verified or not)

3. **1.3:** Update test script to check verification before sending
   - File: `backend/scripts/test-twilio-sms.ts`
   - Add: Pre-flight check for verified numbers
   - Warn if number not verified

**Acceptance Criteria:**
- ✅ Can initiate verification programmatically
- ✅ Can check if number is verified
- ✅ Test script warns about unverified numbers
- ✅ Verification works for +18777804236

**Dependencies:**
- Twilio SDK: `twilio@^5.10.7` (already installed)

---

### Phase 2: SMS Delivery Tracking (P0 - Critical)

**Goal:** Add status callbacks for real delivery tracking

**Key Findings:**
- Status "delivered" means Twilio → carrier, not device receipt
- Use `statusCallback` webhook for real delivery status
- Handle statuses: queued, sent, delivered, failed, undelivered

**Steps:**
2. **2.1:** Create SMS status webhook endpoint
   - File: `backend/src/routes/sms-status-webhook.ts`
   - Endpoint: `POST /api/webhooks/sms-status`
   - Log delivery status to database
   - Update message tracking

2. **2.2:** Update SMS sending functions to include statusCallback
   - Files: `backend/src/services/sms-notifications.ts`, `backend/src/services/twilio-service.ts`
   - Add: `statusCallback` parameter
   - Use: `process.env.BACKEND_URL + '/api/webhooks/sms-status'`

2. **2.3:** Create message tracking table (optional)
   - Table: `sms_message_tracking`
   - Fields: message_sid, org_id, status, error_code, updated_at
   - For audit and debugging

**Acceptance Criteria:**
- ✅ SMS functions include statusCallback
- ✅ Webhook receives delivery status updates
- ✅ Real delivery status logged (not just "delivered")
- ✅ Error codes tracked (30004, 30007, etc.)

**Dependencies:**
- Backend URL environment variable
- Webhook endpoint accessible from Twilio

---

### Phase 3: Google Calendar OAuth Flow (P1 - High Priority)

**Goal:** Complete OAuth 2.0 authorization code flow for multi-tenant calendar access

**Key Findings:**
- Use `googleapis@latest` (v137+)
- Store refresh tokens encrypted in Supabase
- Scopes: `https://www.googleapis.com/auth/calendar.events`
- Auto-refresh tokens on API calls

**Steps:**
3. **3.1:** Create OAuth 2.0 client service
   - File: `backend/src/services/google-oauth-service.ts`
   - Functions: `generateAuthUrl()`, `getTokens(code)`, `refreshToken(refreshToken)`
   - Uses: `google.auth.OAuth2`

3. **3.2:** Create OAuth routes
   - File: `backend/src/routes/google-oauth.ts`
   - Routes:
     - `GET /api/google-oauth/authorize` - Generate auth URL
     - `GET /api/google-oauth/callback` - Handle callback, store tokens
     - `POST /api/google-oauth/revoke` - Revoke access

3. **3.3:** Update token storage
   - File: `backend/src/services/calendar-integration.ts`
   - Function: `storeRefreshToken(orgId, refreshToken)` - Encrypt and store
   - Function: `getRefreshToken(orgId)` - Decrypt and return
   - Table: `integrations` (provider: 'google_calendar')

3. **3.4:** Frontend OAuth initiation
   - File: `src/app/google-oauth/page.tsx` (or component)
   - Button: "Connect Google Calendar"
   - Redirects to OAuth URL
   - Handles callback

**Acceptance Criteria:**
- ✅ OAuth flow works end-to-end
- ✅ Refresh tokens stored encrypted in Supabase
- ✅ Token auto-refresh on API calls
- ✅ Multiple organizations can connect independently

**Dependencies:**
- Google Cloud Console: OAuth client configured
- Redirect URI: `http://localhost:3000/auth/google/callback`
- `googleapis` package: `^137.0.0`

---

### Phase 4: Calendar Availability Checking (P1 - High Priority)

**Goal:** Real-time availability checking during calls with timezone support

**Key Findings:**
- Use `calendar.events.list()` for specific time range
- Use `calendar.freebusy.query()` for multi-calendar
- Handle timezones correctly (user timezone vs calendar timezone)
- Cache results for performance

**Steps:**
4. **4.1:** Implement availability checking function
   - File: `backend/src/services/calendar-integration.ts`
   - Function: `checkAvailability(orgId, startTime, endTime, timeZone)`
   - Uses: `calendar.events.list()` with timeMin/timeMax
   - Returns: boolean (available or not)

4. **4.2:** Implement get available slots function
   - Function: `getAvailableSlots(orgId, date, timeZone, businessHours)`
   - Checks full day, returns array of available time slots
   - Filters by business hours
   - Returns: `['09:00', '10:00', '14:00', ...]`

4. **4.3:** Add timezone handling
   - Function: `convertToCalendarTimezone(date, userTimezone, calendarTimezone)`
   - Use: `luxon` or native `Intl.DateTimeFormat`
   - Ensure correct timezone conversion

4. **4.4:** Add caching layer (optional)
   - Cache: Redis or in-memory with TTL
   - Key: `calendar:slots:${orgId}:${date}`
   - TTL: 5 minutes
   - Invalidate on booking

**Acceptance Criteria:**
- ✅ Can check if specific time slot is available
- ✅ Can get all available slots for a date
- ✅ Timezone conversions work correctly
- ✅ Performance: < 500ms per check

**Dependencies:**
- Google Calendar API access
- OAuth tokens valid
- Timezone data

---

### Phase 5: Appointment Booking (P1 - High Priority)

**Goal:** Book appointments with attendee emails and SMS confirmation

**Key Findings:**
- Use `calendar.events.insert()` with attendees
- Set `sendUpdates: 'all'` for email confirmations
- Handle booking conflicts gracefully
- Send SMS after successful booking

**Steps:**
5. **5.1:** Implement booking function
   - File: `backend/src/services/calendar-integration.ts`
   - Function: `bookAppointment(orgId, eventDetails)`
   - Parameters: `{ summary, start, end, customerEmail, timeZone, description }`
   - Uses: `calendar.events.insert()`
   - Returns: Event object with HTML link

5. **5.2:** Add conflict checking
   - Before booking, check: `checkAvailability(orgId, start, end)`
   - If conflict: throw error or suggest alternatives
   - Return: Alternative time slots

5. **5.3:** Integrate SMS confirmation
   - After successful booking: Call `sendAppointmentConfirmationSMS()`
   - SMS includes: Event title, date/time, calendar link
   - Handle SMS failures gracefully (log but don't fail booking)

5. **5.4:** Add booking transaction wrapper
   - Function: `bookWithSMSConfirmation(orgId, eventDetails, customerPhone)`
   - Try: Book calendar event
   - Then: Send SMS confirmation
   - On failure: Log error, don't rollback calendar (already booked)

**Acceptance Criteria:**
- ✅ Can book appointments successfully
- ✅ Customer receives calendar invite via email
- ✅ Customer receives SMS confirmation
- ✅ Booking conflicts handled gracefully

**Dependencies:**
- Calendar availability checking (Phase 4)
- SMS service (existing)
- OAuth tokens valid

---

### Phase 6: Vapi Webhook Integration (P1 - High Priority)

**Goal:** Connect Vapi voice agent to calendar booking flow

**Key Findings:**
- Vapi sends webhooks with call events
- Parse date/time from voice transcript
- Check availability in real-time
- Book if confirmed by customer

**Steps:**
6. **6.1:** Create Vapi booking webhook handler
   - File: `backend/src/routes/vapi-booking-webhook.ts`
   - Endpoint: `POST /api/webhooks/vapi/booking`
   - Parse: `{ orgId, intent, date, time, phone, customerName }`
   - Function: `handleBookingRequest(req)`

6. **6.2:** Implement booking flow logic
   - Step 1: Extract date/time from Vapi transcript
   - Step 2: Check availability: `checkAvailability(orgId, date, time)`
   - Step 3: If available: Return available slots to Vapi
   - Step 4: Wait for customer confirmation
   - Step 5: On confirm: `bookAppointment()` → `sendSMS()`
   - Step 6: Return booking result to Vapi

6. **6.3:** Add slot locking (race condition prevention)
   - Before booking: Lock slot in database
   - Table: `booking_locks` (org_id, date, time, locked_until, locked_by)
   - Lock duration: 5 minutes
   - Release: On booking or timeout
   - Function: `lockSlot(orgId, date, time)` / `unlockSlot(orgId, date, time)`

6. **6.4:** Handle alternative time suggestions
   - If requested time unavailable: `getAvailableSlots(orgId, date)`
   - Return: Top 3 alternatives to Vapi
   - Vapi: Presents alternatives to customer

**Acceptance Criteria:**
- ✅ Vapi webhook triggers booking flow
- ✅ Real-time availability checking works
- ✅ Booking happens automatically on confirmation
- ✅ Race conditions prevented with locking
- ✅ SMS confirmation sent after booking

**Dependencies:**
- Calendar availability (Phase 4)
- Appointment booking (Phase 5)
- SMS service (existing)
- Vapi webhook access

---

### Phase 7: Error Handling & Resilience (P2 - Medium Priority)

**Goal:** Robust error handling and retry logic

**Steps:**
7. **7.1:** Add retry logic for calendar API
   - Function: `retryCalendarCall(fn, maxRetries)`
   - Handle: Rate limits (429), network errors (503)
   - Exponential backoff: 1s, 2s, 4s

7. **7.2:** Add SMS retry queue
   - If SMS fails after booking: Add to retry queue
   - Table: `sms_retry_queue` (message_sid, org_id, retry_count, next_retry_at)
   - Background job: Retry failed SMS (3 attempts max)

7. **7.3:** Add graceful degradation
   - If calendar API down: Return "Service temporarily unavailable"
   - If SMS fails: Still complete booking, log error
   - Never fail entire flow if one service fails

**Acceptance Criteria:**
- ✅ Calendar API retries on rate limits
- ✅ SMS failures don't block booking
- ✅ Errors logged for debugging
- ✅ User-friendly error messages

---

### Phase 8: Testing & Validation (P0 - Critical)

**Goal:** Comprehensive testing of all flows

**Steps:**
8. **8.1:** Test phone verification
   - Run: `npx ts-node scripts/verify-phone-twilio.ts +18777804236`
   - Verify: Code received and number verified

8. **8.2:** Test SMS with status callback
   - Send: Test SMS to verified number
   - Verify: Status webhook receives updates
   - Verify: SMS received on phone

8. **8.3:** Test OAuth flow
   - Connect: Google Calendar via OAuth
   - Verify: Tokens stored encrypted
   - Verify: Token refresh works

8. **8.4:** Test calendar availability
   - Check: Specific time slot
   - Check: All slots for a date
   - Verify: Timezone handling correct

8. **8.5:** Test booking flow
   - Book: Appointment via API
   - Verify: Calendar event created
   - Verify: Email sent to customer
   - Verify: SMS confirmation sent

8. **8.6:** Test end-to-end Vapi flow (manual)
   - Simulate: Vapi webhook request
   - Verify: Availability checked
   - Verify: Booking created
   - Verify: SMS sent

**Acceptance Criteria:**
- ✅ All individual functions tested
- ✅ End-to-end flow tested
- ✅ Error scenarios tested
- ✅ Production-ready

---

## Technical Requirements

### APIs & Libraries

1. **Twilio SDK:**
   - Version: `twilio@^5.10.7` (already installed)
   - Features: Outgoing Caller IDs, Messages API, Status Callbacks

2. **Google APIs:**
   - Package: `googleapis@^137.0.0` (upgrade if needed)
   - Package: `google-auth-library@latest`
   - APIs: Calendar API v3

3. **Database:**
   - Supabase (PostgreSQL)
   - Tables: `integrations`, `sms_message_tracking`, `booking_locks`, `sms_retry_queue`

4. **Frontend:**
   - Next.js 14
   - OAuth redirect handling

### Environment Variables

```bash
# Twilio
TWILIO_ACCOUNT_SID=AC0a90c92cbd17b575fde9ec6e817b71af
TWILIO_AUTH_TOKEN=11c1e5e1069e38f99a2f8c35b8baaef8
TWILIO_PHONE_NUMBER=+19523338443

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# Backend
BACKEND_URL=http://localhost:3001
```

### Database Schema Additions

```sql
-- SMS tracking (optional)
CREATE TABLE sms_message_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  message_sid TEXT UNIQUE NOT NULL,
  to_phone TEXT NOT NULL,
  from_phone TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking locks (race condition prevention)
CREATE TABLE booking_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  date DATE NOT NULL,
  time TIME NOT NULL,
  locked_until TIMESTAMPTZ NOT NULL,
  locked_by TEXT, -- request_id or session_id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, date, time)
);

-- SMS retry queue
CREATE TABLE sms_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  message_sid TEXT,
  to_phone TEXT NOT NULL,
  message_body TEXT NOT NULL,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Success Criteria

### Phase 1 Complete:
- ✅ Phone verification script works
- ✅ Can verify +18777804236
- ✅ SMS sent to verified number is received

### Phase 2 Complete:
- ✅ Status callback webhook receives updates
- ✅ Real delivery status tracked
- ✅ Error codes logged

### Phase 3 Complete:
- ✅ OAuth flow works end-to-end
- ✅ Tokens stored encrypted
- ✅ Token refresh automatic

### Phase 4 Complete:
- ✅ Availability checking works
- ✅ Timezone handling correct
- ✅ Performance < 500ms

### Phase 5 Complete:
- ✅ Appointments booked successfully
- ✅ Email confirmations sent
- ✅ SMS confirmations sent

### Phase 6 Complete:
- ✅ Vapi webhook triggers booking
- ✅ End-to-end flow works
- ✅ Race conditions prevented

### Phase 7 Complete:
- ✅ Error handling robust
- ✅ Retry logic works
- ✅ Graceful degradation

### Phase 8 Complete:
- ✅ All tests passing
- ✅ Production-ready
- ✅ Documentation complete

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Twilio verification requires manual code entry | High | Provide clear instructions, use Console as backup |
| Google OAuth callback URL mismatch | High | Document correct URLs, test thoroughly |
| Calendar API rate limits | Medium | Implement caching, retry logic |
| SMS delivery failures | Medium | Retry queue, don't block booking |
| Race conditions in booking | High | Slot locking mechanism |
| Token refresh failures | Medium | Automatic retry, clear error messages |

---

## Timeline Estimate

- **Phase 1:** 2 hours (verification scripts)
- **Phase 2:** 2 hours (status callbacks)
- **Phase 3:** 4 hours (OAuth flow)
- **Phase 4:** 3 hours (availability checking)
- **Phase 5:** 3 hours (booking)
- **Phase 6:** 4 hours (Vapi integration)
- **Phase 7:** 2 hours (error handling)
- **Phase 8:** 3 hours (testing)

**Total:** ~23 hours (3 working days)

---

## Next Steps

1. Execute Phase 1: Phone verification
2. Execute Phase 2: SMS status callbacks
3. Execute Phase 3: Google OAuth
4. Continue with remaining phases sequentially

**Status:** ✅ Planning Complete - Ready for Execution
