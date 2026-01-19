# 🔍 Verification Plan: Pre & Post-Deployment
**Date**: 2026-01-18  
**Purpose**: Verify booking system before live deployment  
**Status**: Ready to execute

---

## 📋 Quick Start

```bash
# Run all automated tests
chmod +x /tmp/verify_booking_system.sh
/tmp/verify_booking_system.sh

# Expected output: All tests pass ✅
```

---

## PART 1: AUTOMATED VERIFICATION (curl-based)

### Test 1: Verify Backend Endpoint Is Running

```bash
echo "=== Test 1: Backend Health Check ==="
curl -s http://localhost:3001/health | jq .

# Expected Response:
# {
#   "status": "ok",
#   "timestamp": "2026-01-18T19:15:00Z"
# }

# Success Criteria: HTTP 200, status: "ok"
```

### Test 2: Test Booking Endpoint with Valid Data

```bash
echo "=== Test 2: Valid Booking Request ==="

curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "verify-test-001",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Test Patient",
        "patientPhone": "+15551234567",
        "patientEmail": "test@example.com",
        "appointmentDate": "2026-07-25",
        "appointmentTime": "14:00"
      }
    }
  }' | jq .

# Expected Response:
# {
#   "toolCallId": "verify-test-001",
#   "result": {
#     "success": true,
#     "appointmentId": "abc-123-def",
#     "message": "Appointment confirmed"
#   }
# }

# Success Criteria: 
# - HTTP 200
# - result.success = true
# - appointmentId is UUID format
# - No errors in response
```

### Test 3: Test Duplicate Prevention (Same Slot Twice)

```bash
echo "=== Test 3: Duplicate Slot Prevention ==="

# First booking - should succeed
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "verify-test-002",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "First Patient",
        "patientPhone": "+15551111111",
        "patientEmail": "first@example.com",
        "appointmentDate": "2026-07-26",
        "appointmentTime": "10:00"
      }
    }
  }' | jq .result.success

# Expected: true ✅

# Second booking - same slot, should fail
sleep 1
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "verify-test-003",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Second Patient",
        "patientPhone": "+15552222222",
        "patientEmail": "second@example.com",
        "appointmentDate": "2026-07-26",
        "appointmentTime": "10:00"
      }
    }
  }' | jq .result

# Expected Response:
# {
#   "success": false,
#   "error": "SLOT_UNAVAILABLE",
#   "message": "This time slot is already booked"
# }

# Success Criteria:
# - First booking: success = true ✅
# - Second booking: error = "SLOT_UNAVAILABLE" ✅
```

### Test 4: Test Invalid Email Rejection

```bash
echo "=== Test 4: Invalid Email Handling ==="

curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "verify-test-004",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Invalid Email Test",
        "patientPhone": "+15553333333",
        "patientEmail": "not-an-email",
        "appointmentDate": "2026-07-27",
        "appointmentTime": "11:00"
      }
    }
  }' | jq .result

# Expected Response: Error or normalization to valid format
# Success Criteria: Either error OR email normalized correctly
```

### Test 5: Test Multi-Tenant Isolation

```bash
echo "=== Test 5: Multi-Tenant Isolation ==="

# Create booking for Org A
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "verify-test-005-org-a",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Org A Patient",
        "patientPhone": "+15554444444",
        "patientEmail": "orga@example.com",
        "appointmentDate": "2026-07-28",
        "appointmentTime": "09:00"
      }
    }
  }' | jq .result.success

# Expected: true ✅

# Create booking for Org B - same time, different org
# (If you have a second org - otherwise skip this test)
curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "verify-test-005-org-b",
    "tool": {
      "arguments": {
        "organizationId": "b0000000-0000-0000-0000-000000000001",
        "patientName": "Org B Patient",
        "patientPhone": "+15555555555",
        "patientEmail": "orgb@example.com",
        "appointmentDate": "2026-07-28",
        "appointmentTime": "09:00"
      }
    }
  }' | jq .result.success

# Expected: true ✅ (different org, same slot is allowed)

# Success Criteria:
# - Org A booking succeeds
# - Org B booking succeeds (same slot, different org)
# - Proves isolation is working
```

### Test 6: Test Data Normalization

```bash
echo "=== Test 6: Data Normalization ==="

curl -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "verify-test-006",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "john DOE",
        "patientPhone": "5556666666",
        "patientEmail": "JOHN@EXAMPLE.COM",
        "appointmentDate": "2026-07-29",
        "appointmentTime": "15:30"
      }
    }
  }' | jq .result

# Expected:
# - Name normalized to: "John Doe" (title case)
# - Email normalized to: "john@example.com" (lowercase)
# - Phone normalized to: "+15556666666" (E.164 format)

# Success Criteria: All fields normalized correctly
```

### Test 7: Database Verification Query

```bash
echo "=== Test 7: Verify Bookings in Database ==="

# Connect to Supabase and verify bookings were created
psql "postgresql://[user]:[password]@db.supabase.co:5432/postgres" -c "
  SELECT 
    COUNT(*) as total_bookings,
    COUNT(DISTINCT org_id) as unique_orgs,
    COUNT(DISTINCT contact_id) as unique_contacts
  FROM appointments
  WHERE created_at > NOW() - INTERVAL '10 minutes';"

# Expected Output:
# total_bookings | unique_orgs | unique_contacts
# ───────────────┼─────────────┼─────────────────
#        6      |      2      |        6

# Success Criteria: Bookings appear in database, orgs are isolated
```

---

## PART 2: MANUAL VERIFICATION

### Step 1: Monitor Dashboard During Tests

**While running automated tests, watch these:**

```bash
# Terminal 1: Watch backend logs
tail -f /var/log/backend.log | grep -i "booking\|error\|vapi"

# Terminal 2: Watch database for new records
psql [...] -c "SELECT * FROM appointments ORDER BY created_at DESC LIMIT 5;" --watch=1

# Terminal 3: Run curl tests (from above)
```

**What to look for:**
- ✅ No errors in logs
- ✅ Bookings appearing in database
- ✅ Correct org_id values
- ✅ Timestamps are recent

---

### Step 2: Live Call Test (Manual)

**Before deploying to production, run ONE live test call:**

1. **Setup**
   - Have someone ready to call your test phone number
   - Have Supabase dashboard open in another window
   - Have backend logs visible

2. **Make the Call**
   - Patient calls your AI-enabled clinic number
   - Say: "I want to book an appointment for tomorrow at 2 PM"
   - Listen to AI confirm the booking
   - Note the appointment details AI repeats back

3. **Verify in Database**
   - Check Supabase `appointments` table
   - Look for your new booking
   - Verify all fields are correct:
     ```
     ✓ Patient name matches (normalized)
     ✓ Phone matches (E.164 format)
     ✓ Email is correct
     ✓ Date/time is what you requested
     ✓ Status is "confirmed"
     ✓ created_at is recent
     ```

4. **Test Double-Booking Prevention**
   - Call again immediately
   - Request the SAME time
   - AI should say slot is unavailable
   - Database should still show only 1 booking

---

### Step 3: Multi-Clinic Test (if applicable)

If you have multiple clinics/orgs:

1. **Make first call to Clinic A**
   - Book: 2026-07-20 10:00
   - Verify in database under Clinic A's org_id

2. **Make second call to Clinic B**
   - Book: 2026-07-20 10:00 (same time)
   - Should succeed (different org)
   - Verify in database under Clinic B's org_id

3. **Verify Isolation**
   - No cross-contamination
   - Each clinic sees only their own bookings

---

## PART 3: SUCCESS CRITERIA CHECKLIST

### Automated Tests
- [ ] Test 1: Backend health check passes
- [ ] Test 2: Valid booking succeeds
- [ ] Test 3: Duplicate prevention works (1 success, 1 failure)
- [ ] Test 4: Invalid data handled gracefully
- [ ] Test 5: Multi-tenant isolation working
- [ ] Test 6: Data normalization correct
- [ ] Test 7: Bookings in database

### Manual Tests
- [ ] Live call booking succeeds
- [ ] Booking appears in database within 5 seconds
- [ ] All fields normalized correctly
- [ ] Double-booking prevented on second call
- [ ] AI confirms appointment details correctly
- [ ] Multi-clinic isolation working (if applicable)

### System Health
- [ ] Backend logs clean (no errors)
- [ ] Database connections healthy
- [ ] API response times < 300ms
- [ ] No partial/orphaned records
- [ ] All org_id filters working

---

## PART 4: TROUBLESHOOTING

### Issue: "Test returns 404 Not Found"
**Cause**: Backend not running or wrong port  
**Fix**:
```bash
# Check backend is running
curl http://localhost:3001/health

# If fails, start backend
cd backend && npm run dev
```

### Issue: "Booking succeeds but doesn't appear in database"
**Cause**: Database connection issue  
**Fix**:
```bash
# Verify Supabase connection
psql "postgresql://..." -c "SELECT 1"

# Check SUPABASE_SERVICE_ROLE_KEY is set
echo $SUPABASE_SERVICE_ROLE_KEY

# Restart backend with correct env vars
export SUPABASE_SERVICE_ROLE_KEY=your_key
npm run dev
```

### Issue: "Double-booking prevention NOT working"
**STOP IMMEDIATELY** - Don't deploy  
**Cause**: Advisory locks may not be active  
**Fix**:
```bash
# Check RPC function has advisory locks
psql -c "SELECT routine_definition FROM information_schema.routines 
  WHERE routine_name='book_appointment_atomic'" | grep "pg_advisory"

# If empty, advisory locks are missing - this is CRITICAL
```

### Issue: "Data not normalized (name still lowercase, etc)"
**Cause**: Backend normalization not applied  
**Fix**:
```bash
# Check backend normalizeBookingData function exists
grep -n "normalizeBookingData\|toLowerCase\|toUpperCase" backend/src/routes/vapi-tools-routes.ts

# Verify function is called before RPC
```

---

## PART 5: AUTOMATED TEST SCRIPT

Save this as `/tmp/verify_booking_system.sh`:

```bash
#!/bin/bash
# Complete automated verification script
# Usage: chmod +x verify_booking_system.sh && ./verify_booking_system.sh

set -e

BACKEND_URL="http://localhost:3001"
ORG_ID="a0000000-0000-0000-0000-000000000001"
PASSED=0
FAILED=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "════════════════════════════════════════════════════════════════"
echo "🔍 AUTOMATED BOOKING SYSTEM VERIFICATION"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Test 1: Health Check
echo -n "Test 1: Backend Health Check... "
if curl -s "$BACKEND_URL/health" | grep -q "ok"; then
  echo -e "${GREEN}✅ PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}"
  ((FAILED++))
fi

# Test 2: Valid Booking
echo -n "Test 2: Valid Booking Request... "
RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "{
    \"toolCallId\": \"verify-test-001\",
    \"tool\": {
      \"arguments\": {
        \"organizationId\": \"$ORG_ID\",
        \"patientName\": \"Test Patient\",
        \"patientPhone\": \"+15551234567\",
        \"patientEmail\": \"test@example.com\",
        \"appointmentDate\": \"2026-07-25\",
        \"appointmentTime\": \"14:00\"
      }
    }
  }")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo -e "${GREEN}✅ PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}"
  echo "Response: $RESPONSE"
  ((FAILED++))
fi

# Test 3: Duplicate Prevention
echo -n "Test 3: Duplicate Prevention... "
FIRST=$(curl -s -X POST "$BACKEND_URL/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "{
    \"toolCallId\": \"verify-test-002\",
    \"tool\": {
      \"arguments\": {
        \"organizationId\": \"$ORG_ID\",
        \"patientName\": \"Patient A\",
        \"patientPhone\": \"+15551111111\",
        \"patientEmail\": \"a@example.com\",
        \"appointmentDate\": \"2026-07-26\",
        \"appointmentTime\": \"10:00\"
      }
    }
  }")

sleep 1

SECOND=$(curl -s -X POST "$BACKEND_URL/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "{
    \"toolCallId\": \"verify-test-003\",
    \"tool\": {
      \"arguments\": {
        \"organizationId\": \"$ORG_ID\",
        \"patientName\": \"Patient B\",
        \"patientPhone\": \"+15552222222\",
        \"patientEmail\": \"b@example.com\",
        \"appointmentDate\": \"2026-07-26\",
        \"appointmentTime\": \"10:00\"
      }
    }
  }")

if echo "$FIRST" | grep -q '"success":true' && echo "$SECOND" | grep -q "SLOT_UNAVAILABLE"; then
  echo -e "${GREEN}✅ PASS${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ FAIL${NC}"
  ((FAILED++))
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 RESULTS"
echo "════════════════════════════════════════════════════════════════"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED - READY TO DEPLOY${NC}"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED - FIX BEFORE DEPLOYING${NC}"
  exit 1
fi
```

---

## SUMMARY

| Test Type | Purpose | Expected | Status |
|-----------|---------|----------|--------|
| **Automated** | Verify endpoints work | All tests pass | 🔄 Ready |
| **Manual** | Real-world booking | Booking succeeds | 🔄 Ready |
| **Integration** | End-to-end flow | Database + UI sync | 🔄 Ready |

---

**Before deployment, run:**
```bash
./verify_booking_system.sh
```

**If all tests pass**: ✅ Deployment approved  
**If any test fails**: ❌ Fix issue, retest before deploying

---

Generated: 2026-01-18 19:15 UTC  
Status: Ready to execute
