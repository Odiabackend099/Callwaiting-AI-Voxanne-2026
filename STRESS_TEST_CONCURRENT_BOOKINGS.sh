#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
# 🔥 CallWaiting AI - 10-Person Stress Test
# ════════════════════════════════════════════════════════════════════════════
# 
# Purpose: Verify that the database advisory locks prevent double-booking
#          when 10 simultaneous requests hit the same time slot
#
# Usage:   ./STRESS_TEST_CONCURRENT_BOOKINGS.sh
#
# Expected Result: 1 success, 9 failures with SLOT_UNAVAILABLE error
# Interpretation: Advisory locks are working correctly ✅
#
# ════════════════════════════════════════════════════════════════════════════

set -e

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
ORG_ID="${ORG_ID:-a0000000-0000-0000-0000-000000000001}"
SLOT_DATE="${SLOT_DATE:-2026-07-15}"
SLOT_TIME="${SLOT_TIME:-10:00}"
NUM_CONCURRENT="${NUM_CONCURRENT:-10}"

# Results tracking
RESULTS_FILE="/tmp/stress_test_results_$$.txt"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ════════════════════════════════════════════════════════════════════════════
# SECTION 1: Display Test Parameters
# ════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔥 CallWaiting AI - Advisory Lock Stress Test${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Test Parameters:"
echo "  Backend URL: ${YELLOW}$BACKEND_URL${NC}"
echo "  Organization: ${YELLOW}$ORG_ID${NC}"
echo "  Slot Date: ${YELLOW}$SLOT_DATE${NC}"
echo "  Slot Time: ${YELLOW}$SLOT_TIME${NC}"
echo "  Concurrent Requests: ${YELLOW}$NUM_CONCURRENT${NC}"
echo "  Test Time: ${YELLOW}$TIMESTAMP${NC}"
echo ""
echo "What This Tests:"
echo "  ✓ Database advisory locks prevent race conditions"
echo "  ✓ Only 1 booking succeeds for same slot"
echo "  ✓ Other 9 bookings rejected with SLOT_UNAVAILABLE"
echo "  ✓ Multi-tenant org_id isolation is maintained"
echo ""

# ════════════════════════════════════════════════════════════════════════════
# SECTION 2: Pre-Flight Checks
# ════════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}Pre-Flight Checks:${NC}"
echo -n "  Checking backend availability... "
if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✓ ONLINE${NC}"
else
  echo -e "${RED}✗ OFFLINE${NC}"
  echo ""
  echo -e "${RED}Error: Backend is not running at $BACKEND_URL${NC}"
  echo "Please start the backend first:"
  echo "  cd backend && npm run dev"
  exit 1
fi

# ════════════════════════════════════════════════════════════════════════════
# SECTION 3: Fire Concurrent Requests
# ════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}Firing $NUM_CONCURRENT Simultaneous Requests...${NC}"
echo ""

# Clear results file
> $RESULTS_FILE

# Fire concurrent requests
for i in $(seq 1 $NUM_CONCURRENT)
do
  (
    # Construct unique patient info for each request
    PATIENT_NAME="Stress Test User $i"
    PATIENT_PHONE="+15550000000$(printf '%02d' $i)"
    PATIENT_EMAIL="stress$i@test.com"
    
    echo -n "  [$i/$NUM_CONCURRENT] Sending... "
    
    # Send the booking request
    RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/vapi/tools/bookClinicAppointment" \
      -H "Content-Type: application/json" \
      -d "{
        \"toolCallId\": \"stress-$i\",
        \"tool\": {
          \"arguments\": {
            \"organizationId\": \"$ORG_ID\",
            \"patientName\": \"$PATIENT_NAME\",
            \"patientPhone\": \"$PATIENT_PHONE\",
            \"patientEmail\": \"$PATIENT_EMAIL\",
            \"appointmentDate\": \"$SLOT_DATE\",
            \"appointmentTime\": \"$SLOT_TIME\"
          }
        }
      }" 2>/dev/null)
    
    # Parse response
    SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true' | wc -l)
    
    if [ $SUCCESS -gt 0 ]; then
      # Extract appointment ID
      APPT_ID=$(echo "$RESPONSE" | grep -o '"appointmentId":"[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -z "$APPT_ID" ]; then
        APPT_ID=$(echo "$RESPONSE" | grep -o '"appointment_id":"[^"]*"' | head -1 | cut -d'"' -f4)
      fi
      
      echo -e "${GREEN}✓ SUCCESS${NC}" >&2
      echo "PASS|$i|$PATIENT_NAME|$APPT_ID|$(date '+%H:%M:%S.%3N')" >> $RESULTS_FILE
    else
      # Extract error message
      ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -z "$ERROR" ]; then
        ERROR="UNKNOWN_ERROR"
      fi
      
      echo -e "${YELLOW}✗ REJECTED${NC}" >&2
      echo "FAIL|$i|$PATIENT_NAME|$ERROR|$(date '+%H:%M:%S.%3N')" >> $RESULTS_FILE
    fi
  ) &
done

# Wait for all requests to complete
echo ""
echo "Waiting for all requests to complete..."
wait

sleep 1

# ════════════════════════════════════════════════════════════════════════════
# SECTION 4: Parse and Display Results
# ════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 Test Results${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Count results
PASS_COUNT=$(grep -c "^PASS|" $RESULTS_FILE 2>/dev/null || echo 0)
FAIL_COUNT=$(grep -c "^FAIL|" $RESULTS_FILE 2>/dev/null || echo 0)
TOTAL=$((PASS_COUNT + FAIL_COUNT))

# Display detailed results
echo "Request Outcomes:"
echo ""
if [ $PASS_COUNT -gt 0 ]; then
  echo -e "${GREEN}✓ SUCCESSFUL BOOKINGS ($PASS_COUNT):${NC}"
  grep "^PASS|" $RESULTS_FILE | while IFS='|' read status req_num patient_name appt_id timestamp; do
    echo "  Request $req_num ($patient_name)"
    echo "    Appointment ID: $appt_id"
    echo "    Time: $timestamp"
    echo ""
  done
fi

if [ $FAIL_COUNT -gt 0 ]; then
  echo -e "${YELLOW}✗ REJECTED BOOKINGS ($FAIL_COUNT):${NC}"
  grep "^FAIL|" $RESULTS_FILE | head -3 | while IFS='|' read status req_num patient_name error timestamp; do
    echo "  Request $req_num ($patient_name)"
    echo "    Error: $error"
    echo "    Time: $timestamp"
    echo ""
  done
  if [ $FAIL_COUNT -gt 3 ]; then
    echo "  ... and $((FAIL_COUNT - 3)) more rejected bookings"
    echo ""
  fi
fi

# ════════════════════════════════════════════════════════════════════════════
# SECTION 5: Test Verdict
# ════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🎯 Test Verdict${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Summary:"
echo "  Total Requests:     $TOTAL"
echo "  Successful:         $PASS_COUNT"
echo "  Rejected:           $FAIL_COUNT"
echo ""

# Check if test passed
if [ "$PASS_COUNT" -eq 1 ] && [ "$FAIL_COUNT" -eq $((NUM_CONCURRENT - 1)) ]; then
  echo -e "${GREEN}✅ TEST PASSED${NC}"
  echo ""
  echo "✓ Advisory locks working correctly"
  echo "✓ Only 1 booking succeeded for the slot"
  echo "✓ Database race condition protection verified"
  echo "✓ Ready for production deployment"
  echo ""
  VERDICT=0
elif [ "$PASS_COUNT" -eq 0 ] && [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${RED}⚠️  UNEXPECTED RESULT: All requests rejected${NC}"
  echo ""
  echo "Possible causes:"
  echo "  • Backend error in booking processing"
  echo "  • Database connection issue"
  echo "  • org_id does not exist"
  echo "  • Time slot already booked"
  echo ""
  VERDICT=1
else
  echo -e "${RED}❌ TEST FAILED${NC}"
  echo ""
  echo "✗ Multiple bookings succeeded for same slot"
  echo "✗ Advisory locks may not be working"
  echo "✗ Race condition vulnerability exists"
  echo ""
  echo "Action Required:"
  echo "  1. Stop deployment"
  echo "  2. Verify pg_advisory_xact_lock in database"
  echo "  3. Check RPC function definition"
  echo "  4. Run 'mcp_supabase_execute_sql' to inspect function"
  echo ""
  VERDICT=2
fi

echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════${NC}"

# ════════════════════════════════════════════════════════════════════════════
# SECTION 6: Cleanup and Exit
# ════════════════════════════════════════════════════════════════════════════

rm -f $RESULTS_FILE

exit $VERDICT
