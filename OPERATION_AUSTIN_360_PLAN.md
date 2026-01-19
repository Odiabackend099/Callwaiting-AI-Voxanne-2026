# Operation Austin 360: Full-Spectrum Integration Test

**Status:** Final Integration Milestone  
**Date:** 2026-01-19  
**Objective:** Verify Holy Trinity (Identity → Communication → Scheduling)

---

## Pre-Flight Checklist

### Issue 1: Unsaved Changes in Dashboard
**Status:** ⚠️ CRITICAL  
**Action Required:**
1. Check what unsaved changes exist in the AgentConfiguration
2. Either save or discard to prevent cached state from interfering
3. Verify API Keys page shows Google Calendar as "Connected"

**Why This Matters:**
- If unsaved changes aren't cleared, old inbound agent config may be cached
- Could cause SMS to use stale phone numbers
- Calendar integration might not be active

### Issue 2: Calendar Integration Verification
**Status:** ✅ APPEARS CONNECTED (per screenshot)  
**Verification:** Google Calendar shows "Connected" status  
**Action:** Verify connection is actually persistent (not just UI state)

### Issue 3: Twilio Configuration
**Status:** ⏳ NEEDS VERIFICATION  
**Required:** Sara org must have Twilio credentials in `integrations` table  
**Action:** Check if Sara has configured Twilio or if SMS will fail gracefully

---

## Test Sequence: Operation Austin 360

### Phase A: Pre-Test Verification (Before curl)

1. **Dashboard Unsaved Changes**
   - [ ] Navigate to Agent Configuration
   - [ ] Review what changes are unsaved
   - [ ] Save or Discard to clear state

2. **Verify Integrations Status**
   - [ ] API Keys page shows Google Calendar: Connected ✅
   - [ ] Verify no stale cached config
   - [ ] Check Twilio credentials status (expected: unconfigured for Sara)

3. **Database Pre-State**
   - [ ] Confirm appointments table has 0 rows
   - [ ] Confirm leads table has 0 rows
   - [ ] Confirm contacts table has 0 rows

### Phase B: Execute Booking (The curl)

```bash
curl -X POST "http://localhost:3001/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "call": {
        "metadata": { "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e" }
      }
    },
    "tool": {
      "arguments": {
        "patientName": "Austin",
        "patientPhone": "+13024648548",
        "patientEmail": "austin99@gmail.com",
        "appointmentDate": "2026-01-21",
        "appointmentTime": "12:00",
        "serviceType": "Botox Consultation"
      }
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "appointmentId": "uuid-here",
  "smsStatus": "failed_but_booked",
  "message": "✅ Appointment confirmed for Wed, Jan 21, 2026 at 12:00 PM"
}
```

### Phase C: Verify Holy Trinity

#### 1. Identity Layer (Database)
```sql
-- Must return exactly 1 lead
SELECT id, phone, name FROM leads 
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e'
AND phone = '+13024648548';

-- Must return exactly 1 appointment
SELECT id, contact_id, service_type, scheduled_at FROM appointments
WHERE org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';

-- Must verify linkage
SELECT a.id as appointment_id, l.phone, l.name, a.service_type
FROM appointments a
JOIN leads l ON a.contact_id = l.id
WHERE a.org_id = '46cf2995-2bee-44e3-838b-24151486fe4e';
```

**Expected:** 1 record with Austin's data

#### 2. Communication Layer (SMS)
**Check Backend Logs for:**
- `[IntegrationDecryptor] Failed to retrieve credentials` (expected if Twilio unconfigured)
- `[SmsService] Sending SMS to +13024648548` (if Twilio configured)
- `[BookingConfirmationService] SMS Result: ...` showing status

**If Twilio Configured:**
- ✅ SMS message arrives at +13024648548

**If Twilio Unconfigured (Current State):**
- ✅ SMS bridge fails gracefully with 404
- ✅ Appointment still created
- ✅ Status shows "failed_but_booked"

#### 3. Scheduling Layer (Google Calendar)
**Check Google Calendar for:**
- Event Title: "Botox Consultation: Austin"
- Date: Wednesday, January 21, 2026
- Time: 12:00 PM
- Attendee: austin99@gmail.com
- Organizer: voxanne@demo.com

**Expected:** Event appears within 30 seconds of booking

---

## Success Criteria (All Must Pass)

### Database Tier ✅
- [ ] Exactly 1 lead created (no duplicates)
- [ ] Exactly 1 appointment created
- [ ] Appointment correctly linked to lead
- [ ] Phone = +13024648548 (verified)
- [ ] Name = "Austin"
- [ ] Service Type = "Botox Consultation"
- [ ] Scheduled = 2026-01-21 12:00:00 UTC

### SMS Tier ✅/⚠️
- [ ] Backend logs show SMS bridge attempt
- [ ] If Twilio unconfigured: logs show 404 (expected)
- [ ] If Twilio configured: SMS arrives
- [ ] No hardcoded phone numbers in logs
- [ ] Appointment NOT blocked by SMS failure

### Calendar Tier ✅
- [ ] Event appears in Google Calendar within 30s
- [ ] Event has correct title (includes patient name)
- [ ] Event has correct date/time (Jan 21, 12:00 PM)
- [ ] Event has attendee email (austin99@gmail.com)
- [ ] Event is in Sara's calendar (voxanne@demo.com)

### Multi-Tenant Isolation ✅
- [ ] Only Sara org data visible (RLS enforced)
- [ ] No cross-org data leakage
- [ ] Org ID correctly extracted from message metadata
- [ ] JWT validation successful

---

## Failure Scenarios & Debugging

### If Appointment Not Created
- Check: Booking RPC returned error?
- Check: Database RLS policies blocking INSERT?
- Check: Schema mismatch (leads vs contacts table)?
- Check: Foreign key constraint violated?

### If SMS Bridge Fails Unexpectedly
- Check: IntegrationDecryptor error message
- Check: Twilio credentials not in integrations table (expected for Sara)
- Check: Encryption error decrypting credentials?

### If Google Calendar Event Missing
- Check: Calendar integration token still valid?
- Check: Backend logs for "GoogleCalendarService" errors
- Check: Calendar service response code
- Check: Event creation payload formation

### If Duplicates Created
- Check: RPC phone-first logic working?
- Check: Concurrent booking attempts?
- Check: Database transaction isolation?

---

## Post-Test Actions

### If All Pass
- [ ] Document in OPERATION_AUSTIN_360_RESULTS.md
- [ ] Mark system ready for staging deployment
- [ ] Update CEO with "GO" decision

### If Any Fail
- [ ] Log full error details
- [ ] Identify root cause
- [ ] Create targeted fix
- [ ] Retest specific layer

---

## Architecture Validation

### Holy Trinity Connections
```
┌─────────────────────────────────────────────────┐
│         VAPI Tool Call (Austin Request)         │
└──────────────┬──────────────────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │  bookClinicAppointment│
    │  RPC (book_atomic)   │
    └──────────┬───────────┘
               │
    ┌──────────┴──────────────────┐
    │                             │
    ▼                             ▼
┌──────────────────┐    ┌─────────────────────┐
│  IDENTITY LAYER  │    │  COMMUNICATION LAYER │
│  ─────────────── │    │  ─────────────────── │
│  leads.phone =   │    │  IntegrationDecryptor│
│  +13024648548    │    │  → Twilio SID/Token │
│  (Supabase)      │    │  → SMS to +13024... │
│                  │    │  (May 404 if unconfig)
└──────────┬───────┘    └──────────┬──────────┘
           │                       │
           └───────┬───────────────┘
                   │
                   ▼
         ┌──────────────────────┐
         │  SCHEDULING LAYER    │
         │  ──────────────────  │
         │  GoogleCalendarService
         │  → Create event      │
         │  → Jan 21, 12:00 PM  │
         │  (GCP/Google API)    │
         └──────────────────────┘
```

All three layers must work in concert, but failure in one (like SMS) should NOT block booking.

---

## Environment Variables Required

For full test:
- ✅ `VAPI_PRIVATE_KEY` - (already set)
- ✅ `BACKEND_URL` - (already set)
- ✅ `SUPABASE_URL` - (already set)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - (already set)
- ⏳ `GOOGLE_OAUTH_ACCESS_TOKEN` - (in integrations table encrypted)
- ⏳ `TWILIO_ACCOUNT_SID` - (in integrations table encrypted, may be missing for Sara)

---

## Estimated Time to Completion

- Pre-flight checks: 5 minutes
- Curl execution: 30 seconds
- Database verification: 2 minutes
- Google Calendar check: 1 minute (may take 10-30s to propagate)
- SMS verification: 1 minute (if configured) or immediate (if not)
- **Total: 10 minutes**

---

**Status: Ready to Execute**

Developer should proceed to Phase 3 execution once pre-flight checks complete.
