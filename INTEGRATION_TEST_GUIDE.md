# 🎓 PhD-Level Integration Test - Execution Guide

**Test Type:** End-to-End Vapi ↔ Backend Simulation
**Duration:** 10-15 minutes
**Confidence Level:** 100% (validates REAL production flow)

---

## What This Test Does

This integration test simulates **EXACTLY** what happens during a live call:

1. **Vapi receives call** → Customer says: "I'd like to book for February 5th at 3 PM"
2. **AI processes** → Calls `checkAvailability` tool
3. **Backend handles** → Queries database for available slots
4. **AI confirms** → Says: "I have 3 PM available"
5. **AI collects info** → Gets name, phone, email
6. **AI books** → Calls `bookClinicAppointment` tool
7. **Backend creates** → Uses advisory locks to prevent double-booking
8. **Database updates** → Contact + appointment created
9. **SMS queued** → Confirmation text sent (async)
10. **AI confirms** → Says: "All set! You'll receive a text"

---

## Prerequisites

### 1. Backend Server Running
```bash
cd backend
npm run dev
# Expected output: Server listening on port 3000
```

### 2. Get Organization ID
```sql
-- Run in Supabase SQL Editor
SELECT id, email, name
FROM organizations
WHERE email = 'voxanne@demo.com';
```

**If no results:**
```sql
INSERT INTO organizations (email, name, timezone, business_hours)
VALUES (
  'voxanne@demo.com',
  'Voxanne Demo Clinic',
  'America/Los_Angeles',
  '9 AM - 6 PM'
)
RETURNING id;
```

### 3. Set Environment Variable
```bash
export VOXANNE_ORG_ID="your-org-id-from-step-2"
```

---

## Running the Test

### Method 1: Automated Bash Script (Recommended)

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
./integration-test.sh
```

**Expected Output:**
```
🎓 PhD-Level Integration Test: Vapi ↔ Backend Booking Flow
======================================================================
Simulating REAL conversation between Vapi AI and Backend

[1/9] Checking backend server...
✅ Backend server is running at http://localhost:3000

[2/9] Fetching organization from database...
✅ Organization ID: abc-123-def-456

[3/9] 🤖 AI: "Let me check the schedule for February 5th..."
   Backend receives: POST /api/vapi-tools/checkAvailability
   Response: {"toolCallId":"integration-test-check-001","result":{"success":true,...
✅ checkAvailability returned available slots including 15:00

[4/9] Verify checkAvailability logs...
Press Enter to continue with booking test...

[5/9] 🤖 AI: "Excellent! Let me book that for you..."
   Backend receives: POST /api/vapi-tools/bookClinicAppointment
   Args: name=Austyn, phone=+2348141995397, date=2026-02-05, time=15:00
   Response: {"toolCallId":"integration-test-book-001","result":{"success":true,...
✅ Booking succeeded: appointment-id-123

[7/9] 🚨 CRITICAL TEST: Double-booking prevention...
   Attempting to book THE SAME slot with different customer...
   Response: {"toolCallId":"integration-test-double-001","result":{"success":false,"error":"SLOT_UNAVAILABLE"...
✅ Advisory lock working - second booking rejected with SLOT_UNAVAILABLE

======================================================================
🎉 ALL AUTOMATED TESTS PASSED - INTEGRATION VERIFIED!
======================================================================
```

### Method 2: Manual API Calls (Advanced)

If the bash script doesn't work, run these curl commands manually:

#### Step 1: Check Availability
```bash
curl -X POST http://localhost:3000/api/vapi-tools/checkAvailability \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "manual-test-check-001",
    "orgId": "YOUR_ORG_ID_HERE",
    "args": {
      "date": "2026-02-05",
      "serviceType": "consultation"
    }
  }' | jq
```

**Expected Response:**
```json
{
  "toolCallId": "manual-test-check-001",
  "result": {
    "success": true,
    "availableSlots": ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
  }
}
```

#### Step 2: Book Appointment
```bash
curl -X POST http://localhost:3000/api/vapi-tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "manual-test-book-001",
    "orgId": "YOUR_ORG_ID_HERE",
    "args": {
      "customerName": "Austyn",
      "customerPhone": "+2348141995397",
      "customerEmail": "austyn@demo.com",
      "appointmentDate": "2026-02-05",
      "appointmentTime": "15:00",
      "serviceType": "consultation"
    }
  }' | jq
```

**Expected Response:**
```json
{
  "toolCallId": "manual-test-book-001",
  "result": {
    "success": true,
    "appointmentId": "abc-123-def-456",
    "message": "Appointment booked successfully",
    "scheduledAt": "2026-02-05T15:00:00Z"
  }
}
```

#### Step 3: Test Double-Booking (CRITICAL)
```bash
curl -X POST http://localhost:3000/api/vapi-tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "manual-test-double-001",
    "orgId": "YOUR_ORG_ID_HERE",
    "args": {
      "customerName": "Test Patient 2",
      "customerPhone": "+15559876543",
      "customerEmail": "test2@example.com",
      "appointmentDate": "2026-02-05",
      "appointmentTime": "15:00",
      "serviceType": "consultation"
    }
  }' | jq
```

**Expected Response (CRITICAL):**
```json
{
  "toolCallId": "manual-test-double-001",
  "result": {
    "success": false,
    "error": "SLOT_UNAVAILABLE",
    "message": "That time was just booked by another caller",
    "conflicting_appointment": {
      "id": "abc-123-def-456",
      "patient_name": "Austyn"
    }
  }
}
```

---

## Database Verification

### Check Contact Creation
```sql
SELECT id, first_name, last_name, phone, email, created_at
FROM contacts
WHERE phone = '+2348141995397';
```

**Expected: 1 row**
```
id          | first_name | last_name | phone          | email
abc-123-... | Austyn     |           | +2348141995397 | austyn@demo.com
```

### Check Appointment Creation
```sql
SELECT
  a.id,
  a.scheduled_at,
  a.duration_minutes,
  a.status,
  c.first_name || ' ' || c.last_name as patient_name,
  c.phone
FROM appointments a
JOIN contacts c ON a.contact_id = c.id
WHERE a.scheduled_at = '2026-02-05 15:00:00'
  AND a.status IN ('confirmed', 'pending');
```

**Expected: 1 row**
```
id          | scheduled_at        | status    | patient_name | phone
abc-123-... | 2026-02-05 15:00:00 | confirmed | Austyn       | +2348141995397
```

### Verify NO Double-Bookings (CRITICAL)
```sql
SELECT scheduled_at, COUNT(*) as booking_count
FROM appointments
WHERE scheduled_at = '2026-02-05 15:00:00'
  AND status IN ('confirmed', 'pending')
GROUP BY scheduled_at
HAVING COUNT(*) > 1;
```

**Expected: 0 rows** (no double-bookings)

---

## Backend Log Verification

### Success Logs (Expected)
```bash
# Monitor logs in real-time
tail -f /path/to/logs/backend.log | grep -E "(checkAvailability|bookClinicAppointment|Advisory lock|SMS)"
```

**Expected Log Sequence:**
```
[INFO] VapiTools: Tool invoked: checkAvailability (orgId=..., date=2026-02-05)
[INFO] VapiTools: Available slots returned: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
[INFO] VapiTools: Tool invoked: bookClinicAppointment (orgId=..., name=Austyn, date=2026-02-05, time=15:00)
[INFO] VapiTools: Finding or creating contact for phone: +2348141995397
[INFO] VapiTools: Contact created: id=... (new contact)
[INFO] VapiTools: Calling book_appointment_with_lock RPC
[INFO] Database: Advisory lock acquired for org_id=... slot=2026-02-05 15:00:00
[INFO] Database: No conflicts found, proceeding with booking
[INFO] VapiTools: ✅ Booking succeeded (appointmentId=...)
[INFO] VapiTools: 📱 SMS Bridge Result (smsStatus=sent, phone=+2348141995397)
```

**Double-Booking Attempt Logs:**
```
[INFO] VapiTools: Tool invoked: bookClinicAppointment (name=Test Patient 2, time=15:00)
[INFO] VapiTools: Calling book_appointment_with_lock RPC
[INFO] Database: Advisory lock acquired
[WARN] Database: Conflict detected - Slot already booked by appointment_id=... (patient: Austyn)
[WARN] VapiTools: ⚠️ Booking conflict - slot already taken
[INFO] VapiTools: Tool response: { success: false, error: "SLOT_UNAVAILABLE" }
```

---

## Success Criteria

**✅ Test PASSES if all 8 criteria met:**

1. **checkAvailability called successfully**
   - Returns list of available slots
   - Includes 15:00 in the list

2. **bookClinicAppointment succeeds**
   - Returns success: true
   - Returns appointment ID

3. **Contact created in database**
   - 1 contact row with name="Austyn"
   - Phone matches: +2348141995397

4. **Appointment created in database**
   - 1 appointment row
   - Status = "confirmed"
   - Scheduled at 2026-02-05 15:00:00

5. **SMS queued (check logs)**
   - Log entry: "SMS Bridge Result"
   - Appears AFTER "Booking succeeded"

6. **Double-booking prevented**
   - Second booking returns success: false
   - Error = "SLOT_UNAVAILABLE"
   - Message mentions "just booked by another caller"

7. **Database integrity maintained**
   - Only 1 appointment for 2026-02-05 15:00:00
   - No duplicate bookings exist

8. **Correct log sequence**
   - checkAvailability logged first
   - bookClinicAppointment logged second
   - Advisory lock acquisition logged
   - SMS bridge logged

---

## Troubleshooting

### Test Fails: checkAvailability returns error

**Symptom:**
```json
{
  "result": {
    "success": false,
    "error": "Some error message"
  }
}
```

**Fix:**
1. Verify backend server is running: `curl http://localhost:3000/health`
2. Check organization exists in database
3. Verify database connection is working
4. Review backend logs for errors

### Test Fails: Booking succeeds but appointment not in database

**Symptom:** API returns success but no database record

**Fix:**
1. Check if `book_appointment_with_lock` RPC exists:
   ```sql
   SELECT routine_name FROM information_schema.routines
   WHERE routine_name = 'book_appointment_with_lock';
   ```
2. If missing, apply migration: `backend/supabase/migrations/20260127_appointment_booking_with_lock.sql`

### Test Fails: Double-booking NOT prevented

**Symptom:** Second booking succeeds instead of returning SLOT_UNAVAILABLE

**Fix:**
1. ⚠️ **CRITICAL BUG** - Advisory locks not working
2. Verify RPC implementation uses `pg_advisory_xact_lock`
3. Check backend code uses `book_appointment_with_lock` (not `book_appointment_atomic`)
4. Review backend logs for "Advisory lock acquired" message

### Test Fails: SMS not logged

**Symptom:** No "SMS Bridge Result" log entry

**Fix:**
1. Check if Twilio credentials are configured
2. Verify SMS service is not throwing errors
3. This is WARNING level (non-critical) - booking should still work

---

## Cleanup After Testing

### Delete Test Data
```sql
-- Delete appointments
DELETE FROM appointments
WHERE contact_id IN (
  SELECT id FROM contacts
  WHERE phone IN ('+2348141995397', '+15559876543')
);

-- Delete contacts
DELETE FROM contacts
WHERE phone IN ('+2348141995397', '+15559876543');

-- Verify cleanup
SELECT COUNT(*) FROM appointments WHERE scheduled_at = '2026-02-05 15:00:00';
-- Expected: 0
```

---

## Next Steps After Successful Test

1. ✅ **All tests passed** → System ready for production
2. 📞 **Make a real test call** to Vapi number
3. 📊 **Monitor dashboard** for real call data
4. 🔍 **Review logs** for 24 hours post-deployment
5. 📝 **Document any edge cases** discovered

---

## Alternative: Test with Real Vapi Call

Instead of simulating with curl, make an actual phone call:

### Setup
1. Get Vapi inbound phone number from dashboard
2. Ensure assistant has tools registered
3. Start backend server with logging enabled

### Call Flow
```
📞 YOU: Call the Vapi number

🤖 AI: "Hello! Thank you for calling. How can I help you today?"

📞 YOU: "Hi, my name is Austyn. I'd like to book an appointment for February 5th at 3 PM."

🤖 AI: "Great! Let me check the schedule for you..."
        [Backend log: checkAvailability called]

🤖 AI: "I have 3 PM available on February 5th. Can I get your phone number and email?"

📞 YOU: "My number is +2348141995397 and email is austyn@demo.com"

🤖 AI: "Perfect! So that's 3 PM on Tuesday, February 5th, 2026. Is that correct?"

📞 YOU: "Yes, that's correct."

🤖 AI: "Excellent! Let me book that for you..."
        [Backend log: bookClinicAppointment called]
        [Backend log: Advisory lock acquired]
        [Backend log: Booking succeeded]
        [Backend log: SMS Bridge Result]

🤖 AI: "All set! I've booked your appointment for 3 PM on Tuesday, February 5th. You'll receive a confirmation text shortly. Is there anything else?"

📞 YOU: "No, that's all. Thank you!"

🤖 AI: "You're welcome! Have a great day!"
        [Call ends]
```

### Verify After Call
1. Check database for new contact and appointment
2. Verify SMS was sent (check logs)
3. Try booking same slot again (should fail)

---

**Test Created:** 2026-02-04
**Version:** 1.0
**Confidence:** 100% - Validates REAL production flow
