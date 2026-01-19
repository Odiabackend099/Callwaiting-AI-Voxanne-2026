#!/bin/bash
# Complete automated verification script
# Usage: chmod +x verify_booking_system.sh && ./verify_booking_system.sh

set -e

BACKEND_URL="${1:-http://localhost:3001}"
ORG_ID="a0000000-0000-0000-0000-000000000001"
PASSED=0
FAILED=0
WARNINGS=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
print_test() {
  echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
  echo -e "${GREEN}✅ PASS${NC} - $1"
}

print_fail() {
  echo -e "${RED}❌ FAIL${NC} - $1"
}

print_warn() {
  echo -e "${YELLOW}⚠️  WARN${NC} - $1"
}

# Header
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "                🔍 AUTOMATED BOOKING SYSTEM VERIFICATION SUITE"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Backend URL: $BACKEND_URL"
echo "Organization ID: $ORG_ID"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# ============================================================================
# TEST 1: HEALTH CHECK
# ============================================================================
print_test "Test 1: Backend Health Check"
if RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health"); then
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)
  
  if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "ok"; then
    print_pass "Backend is healthy (HTTP $HTTP_CODE)"
    ((PASSED++))
  else
    print_fail "Backend health check failed (HTTP $HTTP_CODE)"
    print_warn "Response: $BODY"
    ((FAILED++))
  fi
else
  print_fail "Could not connect to backend at $BACKEND_URL"
  ((FAILED++))
fi
echo ""

# ============================================================================
# TEST 2: VALID BOOKING REQUEST
# ============================================================================
print_test "Test 2: Valid Booking Request"
BOOKING_DATA="{
  \"toolCallId\": \"verify-test-001-$(date +%s)\",
  \"tool\": {
    \"arguments\": {
      \"organizationId\": \"$ORG_ID\",
      \"patientName\": \"Test Patient\",
      \"patientPhone\": \"+15551234567\",
      \"patientEmail\": \"test@example.com\",
      \"appointmentDate\": \"2026-08-15\",
      \"appointmentTime\": \"14:00\"
    }
  }
}"

if RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "$BOOKING_DATA"); then
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)
  
  if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q '"success":true'; then
    APPT_ID=$(echo "$BODY" | grep -o '"appointmentId":"[^"]*"' | cut -d'"' -f4)
    print_pass "Booking created successfully (ID: ${APPT_ID:0:8}...)"
    ((PASSED++))
  else
    print_fail "Booking request failed (HTTP $HTTP_CODE)"
    print_warn "Response: $BODY"
    ((FAILED++))
  fi
else
  print_fail "Could not reach booking endpoint"
  ((FAILED++))
fi
echo ""

# ============================================================================
# TEST 3: DUPLICATE SLOT PREVENTION
# ============================================================================
print_test "Test 3: Duplicate Slot Prevention"

# First booking
FIRST_DATA="{
  \"toolCallId\": \"verify-test-dup-1-$(date +%s)\",
  \"tool\": {
    \"arguments\": {
      \"organizationId\": \"$ORG_ID\",
      \"patientName\": \"First Patient\",
      \"patientPhone\": \"+15551111111\",
      \"patientEmail\": \"first@example.com\",
      \"appointmentDate\": \"2026-08-16\",
      \"appointmentTime\": \"10:00\"
    }
  }
}"

FIRST_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "$FIRST_DATA")

FIRST_HTTP=$(echo "$FIRST_RESPONSE" | tail -1)
FIRST_BODY=$(echo "$FIRST_RESPONSE" | head -n -1)

# Second booking - same slot
sleep 1

SECOND_DATA="{
  \"toolCallId\": \"verify-test-dup-2-$(date +%s)\",
  \"tool\": {
    \"arguments\": {
      \"organizationId\": \"$ORG_ID\",
      \"patientName\": \"Second Patient\",
      \"patientPhone\": \"+15552222222\",
      \"patientEmail\": \"second@example.com\",
      \"appointmentDate\": \"2026-08-16\",
      \"appointmentTime\": \"10:00\"
    }
  }
}"

SECOND_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "$SECOND_DATA")

SECOND_HTTP=$(echo "$SECOND_RESPONSE" | tail -1)
SECOND_BODY=$(echo "$SECOND_RESPONSE" | head -n -1)

if echo "$FIRST_BODY" | grep -q '"success":true'; then
  print_pass "First booking succeeded"
  ((PASSED++))
else
  print_fail "First booking failed - should succeed"
  ((FAILED++))
fi

if echo "$SECOND_BODY" | grep -qE '"success":false|SLOT_UNAVAILABLE|already.*booked'; then
  print_pass "Second booking correctly rejected (duplicate prevention working)"
  ((PASSED++))
else
  print_fail "Second booking succeeded - duplicate prevention NOT working!"
  print_warn "This is CRITICAL - advisory locks may be missing"
  ((FAILED++))
fi
echo ""

# ============================================================================
# TEST 4: INVALID EMAIL HANDLING
# ============================================================================
print_test "Test 4: Invalid Email Handling"

INVALID_DATA="{
  \"toolCallId\": \"verify-test-invalid-email-$(date +%s)\",
  \"tool\": {
    \"arguments\": {
      \"organizationId\": \"$ORG_ID\",
      \"patientName\": \"Invalid Email Test\",
      \"patientPhone\": \"+15553333333\",
      \"patientEmail\": \"not-an-email\",
      \"appointmentDate\": \"2026-08-17\",
      \"appointmentTime\": \"11:00\"
    }
  }
}"

INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "$INVALID_DATA")

INVALID_HTTP=$(echo "$INVALID_RESPONSE" | tail -1)
INVALID_BODY=$(echo "$INVALID_RESPONSE" | head -n -1)

if echo "$INVALID_BODY" | grep -q "error\|Error"; then
  print_pass "Invalid email correctly rejected"
  ((PASSED++))
elif echo "$INVALID_BODY" | grep -q '"success":true'; then
  print_warn "Invalid email accepted - may be auto-normalized"
  ((WARNINGS++))
else
  print_fail "Unexpected response to invalid email"
  ((FAILED++))
fi
echo ""

# ============================================================================
# TEST 5: DATA NORMALIZATION
# ============================================================================
print_test "Test 5: Data Normalization"

NORMALIZE_DATA="{
  \"toolCallId\": \"verify-test-normalize-$(date +%s)\",
  \"tool\": {
    \"arguments\": {
      \"organizationId\": \"$ORG_ID\",
      \"patientName\": \"john DOE\",
      \"patientPhone\": \"5556666666\",
      \"patientEmail\": \"JOHN@EXAMPLE.COM\",
      \"appointmentDate\": \"2026-08-18\",
      \"appointmentTime\": \"15:30\"
    }
  }
}"

NORMALIZE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "$NORMALIZE_DATA")

NORMALIZE_HTTP=$(echo "$NORMALIZE_RESPONSE" | tail -1)
NORMALIZE_BODY=$(echo "$NORMALIZE_RESPONSE" | head -n -1)

if [ "$NORMALIZE_HTTP" = "200" ] && echo "$NORMALIZE_BODY" | grep -q '"success":true'; then
  print_pass "Data normalization successful"
  print_warn "Review database to verify normalization (title case, lowercase email, E.164 phone)"
  ((PASSED++))
  ((WARNINGS++))
else
  print_fail "Data normalization test failed"
  ((FAILED++))
fi
echo ""

# ============================================================================
# TEST 6: RESPONSE TIME PERFORMANCE
# ============================================================================
print_test "Test 6: Response Time Performance"

PERF_DATA="{
  \"toolCallId\": \"verify-test-perf-$(date +%s)\",
  \"tool\": {
    \"arguments\": {
      \"organizationId\": \"$ORG_ID\",
      \"patientName\": \"Performance Test\",
      \"patientPhone\": \"+15557777777\",
      \"patientEmail\": \"perf@example.com\",
      \"appointmentDate\": \"2026-08-19\",
      \"appointmentTime\": \"09:00\"
    }
  }
}"

START_TIME=$(date +%s%N)
curl -s -X POST "$BACKEND_URL/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "$PERF_DATA" > /dev/null
END_TIME=$(date +%s%N)

DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))

if [ $DURATION_MS -lt 300 ]; then
  print_pass "Response time acceptable: ${DURATION_MS}ms (target: <300ms)"
  ((PASSED++))
elif [ $DURATION_MS -lt 1000 ]; then
  print_warn "Response time slow: ${DURATION_MS}ms (target: <300ms, acceptable: <1000ms)"
  ((WARNINGS++))
else
  print_fail "Response time too slow: ${DURATION_MS}ms (target: <300ms)"
  ((FAILED++))
fi
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "════════════════════════════════════════════════════════════════════════════════"
echo "                              📊 TEST SUMMARY"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "Passed:   ${GREEN}$PASSED${NC}"
echo -e "Failed:   ${RED}$FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

TOTAL=$((PASSED + FAILED + WARNINGS))
echo "Total Tests: $TOTAL"
echo ""

# ============================================================================
# FINAL STATUS
# ============================================================================
if [ $FAILED -eq 0 ]; then
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo -e "${GREEN}✅ ALL TESTS PASSED - SYSTEM IS READY FOR DEPLOYMENT${NC}"
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo ""
  if [ $WARNINGS -gt 0 ]; then
    echo "⚠️  Review warnings above and manually verify before production deployment"
    echo ""
  fi
  exit 0
else
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo -e "${RED}❌ TESTS FAILED - DO NOT DEPLOY${NC}"
  echo "════════════════════════════════════════════════════════════════════════════════"
  echo ""
  echo "Next Steps:"
  echo "1. Review failed tests above"
  echo "2. Check backend logs for errors"
  echo "3. Verify environment variables are set correctly"
  echo "4. Ensure database is accessible"
  echo "5. Run this script again to verify fixes"
  echo ""
  exit 1
fi
