#!/bin/bash

# ============================================================================
# STRESS TEST: Multi-Tenant Atomic Booking Race Condition Test
# ============================================================================
# Purpose: Fire 5 concurrent booking requests for the EXACT SAME SLOT
# Expected Result:
#   - 1 Success: "Appointment confirmed"
#   - 4 Conflicts: "slot_unavailable" with alternatives offered
# ============================================================================

set -e

# Configuration
NGROK_URL="${NGROK_URL:-https://sobriquetical-zofia-abysmally.ngrok-free.dev}"
ORG_ID="${ORG_ID:-46cf2995-2bee-44e3-838b-24151486fe4e}"
TEST_SLOT="2026-02-20"
TEST_TIME="14:00"
TEST_PHONE_BASE="+1999888"

echo "=================================================="
echo "🚀 STRESS TEST: Race Condition Prevention"
echo "=================================================="
echo "URL: $NGROK_URL"
echo "ORG: $ORG_ID"
echo "SLOT: $TEST_SLOT at $TEST_TIME"
echo "CONCURRENT REQUESTS: 5"
echo ""

# Function to make a booking request
make_booking_request() {
    local request_num=$1
    local phone="${TEST_PHONE_BASE}${request_num}${request_num}${request_num}${request_num}"
    
    echo "  [Request $request_num] Starting with phone $phone..."
    
    curl -s -X POST "$NGROK_URL/api/vapi/tools/bookClinicAppointment" \
    -H "Content-Type: application/json" \
    -d "{
      \"toolCallId\": \"stress-test-$request_num\",
      \"tool\": {
        \"arguments\": {
          \"appointmentDate\": \"$TEST_SLOT\",
          \"appointmentTime\": \"$TEST_TIME\",
          \"patientName\": \"Stress Test User $request_num\",
          \"patientPhone\": \"$phone\",
          \"patientEmail\": \"stress-test-$request_num@clinic.local\",
          \"serviceType\": \"consultation\"
        }
      },
      \"customer\": { 
        \"metadata\": { \"org_id\": \"$ORG_ID\" } 
      }
    }" > "/tmp/stress-test-response-$request_num.json" 2>&1 &
    
    # Store the PID for later
    echo $! >> /tmp/stress-test-pids.txt
}

# Clear previous PIDs
rm -f /tmp/stress-test-pids.txt

echo "📡 Launching 5 concurrent requests..."
for i in {1..5}; do
    make_booking_request $i
    # Small stagger to ensure they hit DB at roughly the same time
    sleep 0.1
done

# Wait for all background jobs
wait

echo ""
echo "=================================================="
echo "📊 RESULTS"
echo "=================================================="

# Analyze results
success_count=0
conflict_count=0
error_count=0

for i in {1..5}; do
    response_file="/tmp/stress-test-response-$i.json"
    
    if [ ! -f "$response_file" ]; then
        echo "❌ Request $i: No response file"
        ((error_count++))
        continue
    fi
    
    # Check response
    if grep -q '"success":true' "$response_file" 2>/dev/null; then
        echo "✅ Request $i: SUCCESS - Appointment created"
        ((success_count++))
    elif grep -q '"error":"slot_unavailable"' "$response_file" 2>/dev/null; then
        echo "⚠️  Request $i: CONFLICT - Slot taken, alternatives offered"
        # Extract alternatives
        grep -o '"alternatives":\[[^]]*\]' "$response_file" | head -c 100
        echo ""
        ((conflict_count++))
    else
        echo "❌ Request $i: ERROR - Unexpected response"
        head -c 200 "$response_file"
        echo ""
        ((error_count++))
    fi
done

echo ""
echo "=================================================="
echo "📈 SUMMARY"
echo "=================================================="
echo "Successes: $success_count (Expected: 1)"
echo "Conflicts: $conflict_count (Expected: 4)"
echo "Errors: $error_count (Expected: 0)"

if [ $success_count -eq 1 ] && [ $conflict_count -eq 4 ] && [ $error_count -eq 0 ]; then
    echo ""
    echo "✅ RACE CONDITION TEST PASSED!"
    echo "The atomic locking is working correctly."
    exit 0
else
    echo ""
    echo "❌ TEST FAILED - Results don't match expectations"
    exit 1
fi
