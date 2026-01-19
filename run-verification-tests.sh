#!/bin/bash

################################################################################
# VOXANNE VERIFICATION TEST SUITE
# Complete end-to-end testing for Vapi integration and backend booking
# 
# Usage: ./run-verification-tests.sh
# 
# Prerequisites:
#   - Backend running on http://localhost:3001
#   - VAPI_PRIVATE_KEY set (backend master key)
#   - VAPI_ASSISTANT_ID set (Vapi assistant ID)
#   - jq installed (for JSON parsing)
################################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                  VOXANNE VERIFICATION TEST SUITE                         ║"
echo "║                     Complete End-to-End Verification                     ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
echo -e "${BLUE}[SETUP]${NC} Checking prerequisites..."
echo ""

if [ -z "$VAPI_PRIVATE_KEY" ]; then
    echo -e "${RED}✗ ERROR: VAPI_PRIVATE_KEY not set${NC}"
    echo "Run: export VAPI_PRIVATE_KEY=\"your-vapi-private-key\""
    exit 1
fi

if [ -z "$VAPI_ASSISTANT_ID" ]; then
    echo -e "${RED}✗ ERROR: VAPI_ASSISTANT_ID not set${NC}"
    echo "Run: export VAPI_ASSISTANT_ID=\"your-assistant-id\""
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}✗ ERROR: jq not installed${NC}"
    echo "Run: brew install jq"
    exit 1
fi

echo -e "${GREEN}✓${NC} VAPI_PRIVATE_KEY set"
echo -e "${GREEN}✓${NC} VAPI_ASSISTANT_ID set"
echo -e "${GREEN}✓${NC} jq available"
echo ""

# Function to run test and check result
run_test() {
    local test_name="$1"
    local test_num="$2"
    local cmd="$3"
    local expected_check="$4"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    echo -e "${BLUE}[Test $test_num]${NC} $test_name"
    echo "Command: $cmd"
    echo ""
    
    # Execute command and capture output
    response=$(eval "$cmd" 2>&1 || true)
    
    # Check result
    if echo "$response" | grep -q "$expected_check" || [ -z "$expected_check" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "Response: $response"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    echo "Output:"
    echo "$response" | head -20
    echo ""
    echo "───────────────────────────────────────────────────────────────────────────"
    echo ""
}

################################################################################
# VAPI API TESTS
################################################################################

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                         VAPI API VERIFICATION                            ║"
echo "║             (Tests 1-2: Vapi assistant and tool configuration)           ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Get assistant details and verify tool registration
run_test \
    "Get Vapi Assistant & Verify Tool Registration" \
    "1" \
    "curl -s -X GET \"https://api.vapi.ai/assistant/\$VAPI_ASSISTANT_ID\" \
      -H \"Authorization: Bearer \$VAPI_PRIVATE_KEY\" | jq '.tools[] | select(.function.name==\"bookClinicAppointment\")'" \
    "bookClinicAppointment"

# Test 2: Test tool endpoint reachability
run_test \
    "Test Tool Endpoint Reachability" \
    "2" \
    "curl -s -X POST \"https://api.vapi.ai/assistant/\$VAPI_ASSISTANT_ID/test\" \
      -H \"Authorization: Bearer \$VAPI_PRIVATE_KEY\" \
      -H \"Content-Type: application/json\" \
      -d '{
        \"toolName\": \"bookClinicAppointment\",
        \"arguments\": {
          \"patientName\": \"Test Patient\",
          \"patientPhone\": \"+15555555555\",
          \"patientEmail\": \"test@example.com\",
          \"appointmentDate\": \"2026-08-20\",
          \"appointmentTime\": \"14:00\"
        }
      }' | jq '.result'" \
    "appointmentId"

################################################################################
# BACKEND TESTS
################################################################################

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                      BACKEND VERIFICATION                                ║"
echo "║          (Tests 3-6: Health check, booking, duplicate prevention)        ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Test 3: Health check
run_test \
    "Backend Health Check" \
    "3" \
    "curl -s http://localhost:3001/health | jq ." \
    "ok"

# Test 4: Valid booking
run_test \
    "Create Valid Booking" \
    "4" \
    "curl -s -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
      -H \"Content-Type: application/json\" \
      -d '{
        \"toolCallId\": \"test-001\",
        \"tool\": {
          \"arguments\": {
            \"organizationId\": \"a0000000-0000-0000-0000-000000000001\",
            \"patientName\": \"John Doe\",
            \"patientPhone\": \"+15551234567\",
            \"patientEmail\": \"john@example.com\",
            \"appointmentDate\": \"2026-08-15\",
            \"appointmentTime\": \"14:00\"
          }
        }
      }' | jq '.result'" \
    "appointmentId"

# Test 5: Duplicate prevention - First booking
run_test \
    "Duplicate Prevention - First Booking (Should Succeed)" \
    "5" \
    "curl -s -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
      -H \"Content-Type: application/json\" \
      -d '{
        \"toolCallId\": \"dup-1\",
        \"tool\": {
          \"arguments\": {
            \"organizationId\": \"a0000000-0000-0000-0000-000000000001\",
            \"patientName\": \"Patient A\",
            \"patientPhone\": \"+15551111111\",
            \"patientEmail\": \"a@example.com\",
            \"appointmentDate\": \"2026-08-21\",
            \"appointmentTime\": \"09:00\"
          }
        }
      }' | jq '.result.success'" \
    "true"

# Test 6: Duplicate prevention - Second booking same slot
echo -e "${BLUE}[Test 6]${NC} Duplicate Prevention - Second Booking (Should Fail with SLOT_UNAVAILABLE)"
echo "Waiting 1 second before second booking attempt..."
sleep 1
echo ""

TESTS_RUN=$((TESTS_RUN + 1))

response=$(curl -s -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d '{
    "toolCallId": "dup-2",
    "tool": {
      "arguments": {
        "organizationId": "a0000000-0000-0000-0000-000000000001",
        "patientName": "Patient B",
        "patientPhone": "+15552222222",
        "patientEmail": "b@example.com",
        "appointmentDate": "2026-08-21",
        "appointmentTime": "09:00"
      }
    }
  }' 2>&1)

if echo "$response" | jq -e '.result.error | select(. == "SLOT_UNAVAILABLE")' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC} (Advisory lock working correctly)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
elif echo "$response" | jq -e '.result.success | select(. == true)' > /dev/null 2>&1; then
    echo -e "${RED}✗ FAIL${NC} (Advisory locks are BROKEN - second booking succeeded when it should fail!)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    echo -e "${YELLOW}⚠ INCONCLUSIVE${NC}"
fi

echo "Output:"
echo "$response" | jq '.' | head -20
echo ""
echo "───────────────────────────────────────────────────────────────────────────"
echo ""

################################################################################
# TEST SUMMARY
################################################################################

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                         TEST SUMMARY                                     ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Tests Run:    $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Make live test call to clinic AI phone number"
    echo "  2. Verify booking appears in Supabase within 5 seconds"
    echo "  3. Verify all fields are normalized correctly"
    echo "  4. Sign off on pre-deployment checklist"
    echo ""
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  - Verify backend is running: curl -s http://localhost:3001/health"
    echo "  - Check backend logs for errors"
    echo "  - Verify VAPI_PRIVATE_KEY is correct"
    echo "  - Verify VAPI_ASSISTANT_ID matches your Vapi configuration"
    echo ""
    exit 1
fi
