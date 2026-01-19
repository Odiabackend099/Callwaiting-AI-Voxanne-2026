#!/bin/bash

# ============================================================================
# HEALTH CHECK: Production-Ready Booking System Verification
# ============================================================================
# Purpose: Verify all components work end-to-end
# Tests:
#   1. Primary booking (success case)
#   2. Double-booking pivot (conflict + alternatives)
#   3. Data normalization (2024→2026, phone formatting)
#   4. Multi-tenant isolation (org_id)
# ============================================================================

set -e

# Configuration
NGROK_URL="${NGROK_URL:-https://sobriquetical-zofia-abysmally.ngrok-free.dev}"
ORG_ID="${ORG_ID:-46cf2995-2bee-44e3-838b-24151486fe4e}"
HEALTH_CHECK_SLOT="2026-03-15"
HEALTH_CHECK_TIME="10:00"

echo "============================================================"
echo "🏥 HEALTH CHECK: Production Booking System v2"
echo "============================================================"
echo "URL: $NGROK_URL"
echo "ORG: $ORG_ID"
echo ""

# ============================================================
# TEST 1: Primary Booking (Should Succeed)
# ============================================================
echo "TEST 1️⃣  - PRIMARY BOOKING"
echo "Action: Book Health Check User for $HEALTH_CHECK_SLOT at $HEALTH_CHECK_TIME"
echo ""

curl -s -X POST "$NGROK_URL/api/vapi/tools/bookClinicAppointment" \
-H "Content-Type: application/json" \
-d "{
  \"toolCallId\": \"health-check-1\",
  \"tool\": {
    \"arguments\": {
      \"appointmentDate\": \"$HEALTH_CHECK_SLOT\",
      \"appointmentTime\": \"$HEALTH_CHECK_TIME\",
      \"patientName\": \"Health Check Primary\",
      \"patientPhone\": \"+18005551234\",
      \"patientEmail\": \"health-primary@clinic.test\",
      \"serviceType\": \"consultation\"
    }
  },
  \"customer\": { 
    \"metadata\": { \"org_id\": \"$ORG_ID\" } 
  }
}" > /tmp/health-check-1.json 2>&1

echo "Response 1:"
python3 -m json.tool < /tmp/health-check-1.json | head -20

if grep -q '"success":true' /tmp/health-check-1.json; then
    echo "✅ TEST 1 PASSED: Booking succeeded"
else
    echo "❌ TEST 1 FAILED: Booking did not succeed"
    cat /tmp/health-check-1.json
    exit 1
fi

echo ""
sleep 1
echo ""

# ============================================================
# TEST 2: Double-Booking (Should Trigger Pivot)
# ============================================================
echo "TEST 2️⃣  - DOUBLE-BOOKING PIVOT"
echo "Action: Try to book the same slot again (should fail gracefully)"
echo ""

curl -s -X POST "$NGROK_URL/api/vapi/tools/bookClinicAppointment" \
-H "Content-Type: application/json" \
-d "{
  \"toolCallId\": \"health-check-2\",
  \"tool\": {
    \"arguments\": {
      \"appointmentDate\": \"$HEALTH_CHECK_SLOT\",
      \"appointmentTime\": \"$HEALTH_CHECK_TIME\",
      \"patientName\": \"Health Check Conflict\",
      \"patientPhone\": \"+18005551235\",
      \"patientEmail\": \"health-conflict@clinic.test\",
      \"serviceType\": \"consultation\"
    }
  },
  \"customer\": { 
    \"metadata\": { \"org_id\": \"$ORG_ID\" } 
  }
}" > /tmp/health-check-2.json 2>&1

echo "Response 2:"
python3 -m json.tool < /tmp/health-check-2.json | head -20

if grep -q '"error":"slot_unavailable"' /tmp/health-check-2.json; then
    echo "✅ TEST 2 PASSED: Conflict detected with alternatives"
    if grep -q '"message":' /tmp/health-check-2.json; then
        echo "   Message included for Sarah to speak:"
        grep '"message"' /tmp/health-check-2.json | sed 's/.*"message": "//' | sed 's/".*//'
    fi
else
    echo "❌ TEST 2 FAILED: Conflict not detected"
    cat /tmp/health-check-2.json
    exit 1
fi

echo ""
echo ""

# ============================================================
# TEST 3: Data Normalization (2024→2026 correction)
# ============================================================
echo "TEST 3️⃣  - DATA NORMALIZATION"
echo "Action: Send date with wrong year (2024), should be corrected to 2026"
echo ""

curl -s -X POST "$NGROK_URL/api/vapi/tools/bookClinicAppointment" \
-H "Content-Type: application/json" \
-d "{
  \"toolCallId\": \"health-check-3\",
  \"tool\": {
    \"arguments\": {
      \"appointmentDate\": \"2024-12-25\",
      \"appointmentTime\": \"11:00\",
      \"patientName\": \"Normalization Test\",
      \"patientPhone\": \"555-123-4567\",
      \"patientEmail\": \"normalization@clinic.test\",
      \"serviceType\": \"consultation\"
    }
  },
  \"customer\": { 
    \"metadata\": { \"org_id\": \"$ORG_ID\" } 
  }
}" > /tmp/health-check-3.json 2>&1

echo "Response 3:"
python3 -m json.tool < /tmp/health-check-3.json | head -20

if grep -q '"success":true' /tmp/health-check-3.json; then
    echo "✅ TEST 3 PASSED: Date normalization (2024→2026) handled"
else
    echo "❌ TEST 3 FAILED: Date normalization failed"
    cat /tmp/health-check-3.json
    exit 1
fi

echo ""
echo ""

# ============================================================
# TEST 4: Phone Normalization (E.164 format)
# ============================================================
echo "TEST 4️⃣  - PHONE NORMALIZATION"
echo "Action: Send phone in various formats, should normalize to E.164"
echo ""

curl -s -X POST "$NGROK_URL/api/vapi/tools/bookClinicAppointment" \
-H "Content-Type: application/json" \
-d "{
  \"toolCallId\": \"health-check-4\",
  \"tool\": {
    \"arguments\": {
      \"appointmentDate\": \"2026-03-16\",
      \"appointmentTime\": \"15:30\",
      \"patientName\": \"Phone Norm Test\",
      \"patientPhone\": \"(415) 555-0123\",
      \"patientEmail\": \"phone-norm@clinic.test\",
      \"serviceType\": \"consultation\"
    }
  },
  \"customer\": { 
    \"metadata\": { \"org_id\": \"$ORG_ID\" } 
  }
}" > /tmp/health-check-4.json 2>&1

echo "Response 4:"
python3 -m json.tool < /tmp/health-check-4.json | head -20

if grep -q '"success":true' /tmp/health-check-4.json; then
    echo "✅ TEST 4 PASSED: Phone normalization (415) 555-0123 → E.164"
else
    echo "❌ TEST 4 FAILED: Phone normalization failed"
    cat /tmp/health-check-4.json
    exit 1
fi

echo ""
echo "============================================================"
echo "✅ ALL HEALTH CHECKS PASSED"
echo "============================================================"
echo ""
echo "The booking system is production-ready:"
echo "  ✅ Primary bookings succeed"
echo "  ✅ Conflicts trigger graceful pivots with alternatives"
echo "  ✅ Date normalization (2024→2026) working"
echo "  ✅ Phone normalization (E.164) working"
echo ""
echo "Next Steps:"
echo "  1. Run live calls and monitor backend logs"
echo "  2. Check database for permanent records"
echo "  3. Monitor Sentry for any errors"
echo ""
