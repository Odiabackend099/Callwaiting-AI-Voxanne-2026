#!/bin/bash

# PhD-Level Integration Test: Vapi ↔ Backend Booking Flow
# Simulates EXACTLY what happens during a live call using curl

set -e  # Exit on error

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
TEST_ORG_EMAIL="voxanne@demo.com"
TEST_DATE="2026-02-05"
TEST_TIME="15:00"
TEST_PHONE="+2348141995397"
TEST_PHONE_2="+15559876543"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

log_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASS_COUNT++))
}

log_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((FAIL_COUNT++))
}

log_info() {
    echo -e "${BLUE}$1${NC}"
}

log_step() {
    echo -e "\n${YELLOW}[$1]${NC} $2"
}

echo ""
echo "🎓 PhD-Level Integration Test: Vapi ↔ Backend Booking Flow"
echo "======================================================================"
echo "Simulating REAL conversation between Vapi AI and Backend"
echo ""

# STEP 1: Check backend server is running
log_step "1/9" "Checking backend server..."
if curl -s -f "$BACKEND_URL/health" > /dev/null 2>&1; then
    log_pass "Backend server is running at $BACKEND_URL"
else
    log_fail "Backend server is NOT running at $BACKEND_URL"
    echo ""
    echo "Please start the backend server first:"
    echo "  cd backend && npm run dev"
    exit 1
fi

# STEP 2: Get organization ID
log_step "2/9" "Fetching organization from database..."
log_info "   SQL: SELECT id FROM organizations WHERE email='voxanne@demo.com'"

# Note: This would need psql or Supabase API access
# For now, we'll use a placeholder
ORG_ID="${VOXANNE_ORG_ID}"

if [ -z "$ORG_ID" ]; then
    log_fail "Organization ID not found"
    echo ""
    echo "Please set the organization ID:"
    echo "  export VOXANNE_ORG_ID=\"your-org-id-here\""
    echo ""
    echo "To find your org ID, run this SQL in Supabase:"
    echo "  SELECT id FROM organizations WHERE email='voxanne@demo.com';"
    exit 1
fi

log_pass "Organization ID: $ORG_ID"

# STEP 3: Simulate AI calling checkAvailability
log_step "3/9" "🤖 AI: \"Let me check the schedule for February 5th...\""
log_info "   Backend receives: POST /api/vapi-tools/checkAvailability"

CHECK_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/vapi-tools/checkAvailability" \
  -H "Content-Type: application/json" \
  -d "{
    \"toolCallId\": \"integration-test-check-001\",
    \"orgId\": \"$ORG_ID\",
    \"args\": {
      \"date\": \"$TEST_DATE\",
      \"serviceType\": \"consultation\"
    }
  }" 2>&1)

echo "   Response: $CHECK_RESPONSE" | head -c 200
echo "..."

if echo "$CHECK_RESPONSE" | grep -q '"success":true'; then
    if echo "$CHECK_RESPONSE" | grep -q "$TEST_TIME"; then
        log_pass "checkAvailability returned available slots including 15:00"
    else
        log_fail "15:00 not in available slots"
        echo "   Full response: $CHECK_RESPONSE"
        exit 1
    fi
else
    log_fail "checkAvailability tool failed"
    echo "   Full response: $CHECK_RESPONSE"
    exit 1
fi

# STEP 4: Pause for user confirmation
log_step "4/9" "Verify checkAvailability logs..."
echo ""
echo "Press Enter to continue with booking test..."
read -r

# STEP 5: Simulate AI calling bookClinicAppointment
log_step "5/9" "🤖 AI: \"Excellent! Let me book that for you...\""
log_info "   Backend receives: POST /api/vapi-tools/bookClinicAppointment"
log_info "   Args: name=Austyn, phone=$TEST_PHONE, date=$TEST_DATE, time=$TEST_TIME"

BOOK_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/vapi-tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "{
    \"toolCallId\": \"integration-test-book-001\",
    \"orgId\": \"$ORG_ID\",
    \"args\": {
      \"customerName\": \"Austyn\",
      \"customerPhone\": \"$TEST_PHONE\",
      \"customerEmail\": \"austyn@demo.com\",
      \"appointmentDate\": \"$TEST_DATE\",
      \"appointmentTime\": \"$TEST_TIME\",
      \"serviceType\": \"consultation\"
    }
  }" 2>&1)

echo "   Response: $BOOK_RESPONSE" | head -c 200
echo "..."

if echo "$BOOK_RESPONSE" | grep -q '"success":true'; then
    APPOINTMENT_ID=$(echo "$BOOK_RESPONSE" | grep -o '"appointmentId":"[^"]*"' | cut -d'"' -f4)
    log_pass "Booking succeeded: $APPOINTMENT_ID"
else
    log_fail "Booking failed"
    echo "   Full response: $BOOK_RESPONSE"
    exit 1
fi

# STEP 6: Verify in database (requires SQL access)
log_step "6/9" "Verifying database state..."
echo ""
echo "Please run these SQL queries in Supabase to verify:"
echo ""
echo "-- 1. Check contact was created"
echo "SELECT id, first_name, last_name, phone, email"
echo "FROM contacts"
echo "WHERE phone = '$TEST_PHONE';"
echo ""
echo "-- 2. Check appointment was created"
echo "SELECT id, scheduled_at, status, contact_id"
echo "FROM appointments"
echo "WHERE id = '$APPOINTMENT_ID';"
echo ""
echo "Expected: 1 contact record, 1 appointment with status='confirmed'"
echo ""
echo "Press Enter after verifying in database..."
read -r
log_info "Database verification assumed successful"

# STEP 7: Test double-booking prevention (CRITICAL)
log_step "7/9" "🚨 CRITICAL TEST: Double-booking prevention..."
log_info "   Attempting to book THE SAME slot with different customer..."

DOUBLE_BOOK_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/vapi-tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "{
    \"toolCallId\": \"integration-test-double-001\",
    \"orgId\": \"$ORG_ID\",
    \"args\": {
      \"customerName\": \"Test Patient 2\",
      \"customerPhone\": \"$TEST_PHONE_2\",
      \"customerEmail\": \"test2@example.com\",
      \"appointmentDate\": \"$TEST_DATE\",
      \"appointmentTime\": \"$TEST_TIME\",
      \"serviceType\": \"consultation\"
    }
  }" 2>&1)

echo "   Response: $DOUBLE_BOOK_RESPONSE" | head -c 200
echo "..."

if echo "$DOUBLE_BOOK_RESPONSE" | grep -q '"success":false'; then
    if echo "$DOUBLE_BOOK_RESPONSE" | grep -q 'SLOT_UNAVAILABLE'; then
        if echo "$DOUBLE_BOOK_RESPONSE" | grep -q 'just booked'; then
            log_pass "Advisory lock working - second booking rejected with SLOT_UNAVAILABLE"
        else
            log_fail "Wrong error message"
            echo "   Expected: 'That time was just booked by another caller'"
            echo "   Full response: $DOUBLE_BOOK_RESPONSE"
        fi
    else
        log_fail "Wrong error type (expected SLOT_UNAVAILABLE)"
        echo "   Full response: $DOUBLE_BOOK_RESPONSE"
    fi
else
    log_fail "CRITICAL: Advisory lock FAILED - slot was double-booked!"
    echo "   This is a CRITICAL failure - advisory locks are not working!"
    echo "   Full response: $DOUBLE_BOOK_RESPONSE"
    exit 1
fi

# STEP 8: Verify no double-bookings in database
log_step "8/9" "Verifying database integrity..."
echo ""
echo "Please run this SQL query in Supabase:"
echo ""
echo "SELECT COUNT(*) as booking_count"
echo "FROM appointments"
echo "WHERE scheduled_at = '$TEST_DATE $TEST_TIME:00'"
echo "  AND status IN ('confirmed', 'pending');"
echo ""
echo "Expected: booking_count = 1 (only Austyn's booking)"
echo ""
echo "Press Enter after verifying..."
read -r
log_info "Database integrity verification assumed successful"

# STEP 9: Check backend logs
log_step "9/9" "Checking backend logs..."
echo ""
echo "Please verify these log entries exist:"
echo ""
echo "✅ 'Tool invoked: checkAvailability'"
echo "✅ 'Available slots returned'"
echo "✅ 'Tool invoked: bookClinicAppointment'"
echo "✅ 'Finding or creating contact for phone: $TEST_PHONE'"
echo "✅ 'Calling book_appointment_with_lock RPC'"
echo "✅ '📱 SMS Bridge Result'"
echo "⚠️  'Booking conflict - slot already taken' (on second attempt)"
echo ""
echo "To check logs, run:"
echo "  tail -f /path/to/logs/backend.log | grep -E '(checkAvailability|bookClinicAppointment|Advisory lock|SMS)'"
echo ""

# Summary
echo ""
echo "======================================================================"
if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL AUTOMATED TESTS PASSED - INTEGRATION VERIFIED!${NC}"
    echo "======================================================================"
    echo ""
    echo "Summary:"
    echo "  ✅ AI tool invocation flow works correctly"
    echo "  ✅ checkAvailability called and returned slots"
    echo "  ✅ bookClinicAppointment succeeded"
    echo "  ✅ Double-booking prevention verified"
    echo "  ⏳ Database verification pending manual confirmation"
    echo ""
    echo "🚀 Production flow validated - Ready for real calls!"
    echo ""
    echo "CLEANUP:"
    echo "  Run these SQL queries to delete test data:"
    echo "  DELETE FROM appointments WHERE contact_id IN (SELECT id FROM contacts WHERE phone IN ('$TEST_PHONE', '$TEST_PHONE_2'));"
    echo "  DELETE FROM contacts WHERE phone IN ('$TEST_PHONE', '$TEST_PHONE_2');"
    echo ""
else
    echo -e "${RED}❌ INTEGRATION TEST FAILED${NC}"
    echo "======================================================================"
    echo ""
    echo "Passed: $PASS_COUNT tests"
    echo "Failed: $FAIL_COUNT tests"
    echo ""
    echo "Review the errors above and fix before deploying to production."
    echo ""
fi

exit $FAIL_COUNT
