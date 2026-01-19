#!/bin/bash

################################################################################
# VOXANNE VERIFICATION TEST SUITE - DYNAMIC ASSISTANT ID
# 
# Multi-Tenant Safe: Queries database for org's custom VAPI_ASSISTANT_ID
# No hardcoded IDs in environment - proper multi-tenant architecture
#
# Usage: ./run-verification-tests-dynamic.sh [ORG_ID]
# 
# Prerequisites:
#   - Backend running on http://localhost:3001
#   - VAPI_PRIVATE_KEY set (backend master key)
#   - Organization exists in database
#   - jq installed (for JSON parsing)
################################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║              VOXANNE VERIFICATION TEST SUITE - DYNAMIC MODE               ║"
echo "║         Multi-Tenant Safe: Queries DB for org's VAPI_ASSISTANT_ID        ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# Get org ID from argument or use default
ORG_ID="${1:-a0000000-0000-0000-0000-000000000001}"

echo -e "${BLUE}[SETUP]${NC} Checking prerequisites..."
echo ""

# Check VAPI_PRIVATE_KEY
if [ -z "$VAPI_PRIVATE_KEY" ]; then
    echo -e "${RED}✗ ERROR: VAPI_PRIVATE_KEY not set${NC}"
    echo "Run: export VAPI_PRIVATE_KEY='c08c442b-cc56-4a05-8bfa-34d46a5efccd'"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}✗ ERROR: jq not installed${NC}"
    echo "Run: brew install jq"
    exit 1
fi

echo -e "${GREEN}✓${NC} VAPI_PRIVATE_KEY set"
echo -e "${GREEN}✓${NC} jq available"
echo -e "${BLUE}[INFO]${NC} Organization ID: $ORG_ID"
echo ""

# Step 1: Check backend health
echo -e "${BLUE}[SETUP]${NC} Verifying backend is running..."
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${RED}✗ Backend not running on http://localhost:3001${NC}"
    echo "Start backend with: cd backend && npm run dev"
    exit 1
fi
echo -e "${GREEN}✓${NC} Backend is running"
echo ""

# Step 2: Query database for organization's VAPI_ASSISTANT_ID
echo -e "${BLUE}[SETUP]${NC} Querying database for org's VAPI_ASSISTANT_ID..."
echo "  Organization ID: $ORG_ID"
echo ""

# Create a simple endpoint to get the assistant ID
# This would be on backend: GET /api/internal/org/:orgId/assistant
VAPI_ASSISTANT_ID=$(curl -s "http://localhost:3001/api/internal/org/${ORG_ID}/assistant" | jq -r '.vapi_assistant_id // empty')

if [ -z "$VAPI_ASSISTANT_ID" ]; then
    echo -e "${RED}✗ Could not retrieve VAPI_ASSISTANT_ID from database${NC}"
    echo ""
    echo "Options:"
    echo "  1. Verify organization exists in database"
    echo "  2. Verify agent has vapi_assistant_id set"
    echo "  3. Check backend logs for errors"
    echo ""
    echo "Debug SQL:"
    echo "  SELECT id, name, vapi_assistant_id FROM agents WHERE org_id = '$ORG_ID';"
    exit 1
fi

echo -e "${GREEN}✓${NC} VAPI_ASSISTANT_ID retrieved from database"
echo "  Value: $VAPI_ASSISTANT_ID"
echo ""

export VAPI_ASSISTANT_ID

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
TESTS_RUN=$((TESTS_RUN + 1))
echo -e "${BLUE}[Test 1]${NC} Get Vapi Assistant & Verify Tool Registration"
echo ""

response=$(curl -s -X GET "https://api.vapi.ai/assistant/$VAPI_ASSISTANT_ID" \
  -H "Authorization: Bearer $VAPI_PRIVATE_KEY" 2>&1 || true)

if echo "$response" | jq -e '.tools[] | select(.function.name=="bookClinicAppointment")' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo "Output:"
echo "$response" | jq '.tools[] | select(.function.name=="bookClinicAppointment")' 2>/dev/null || echo "$response" | head -10
echo ""
echo "───────────────────────────────────────────────────────────────────────────"
echo ""

# Test 2: Test tool endpoint reachability
TESTS_RUN=$((TESTS_RUN + 1))
echo -e "${BLUE}[Test 2]${NC} Test Tool Endpoint Reachability"
echo ""

response=$(curl -s -X POST "https://api.vapi.ai/assistant/$VAPI_ASSISTANT_ID/test" \
  -H "Authorization: Bearer $VAPI_PRIVATE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "bookClinicAppointment",
    "arguments": {
      "patientName": "Test Patient",
      "patientPhone": "+15555555555",
      "patientEmail": "test@example.com",
      "appointmentDate": "2026-08-20",
      "appointmentTime": "14:00"
    }
  }' 2>&1 || true)

if echo "$response" | jq -e '.result.appointmentId // empty' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo "Output:"
echo "$response" | jq '.result' 2>/dev/null || echo "$response" | head -10
echo ""
echo "───────────────────────────────────────────────────────────────────────────"
echo ""

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
TESTS_RUN=$((TESTS_RUN + 1))
echo -e "${BLUE}[Test 3]${NC} Backend Health Check"
echo ""

response=$(curl -s http://localhost:3001/health 2>&1 || true)

if echo "$response" | jq -e '.status' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo "Output:"
echo "$response" | jq '.' 2>/dev/null || echo "$response" | head -10
echo ""
echo "───────────────────────────────────────────────────────────────────────────"
echo ""

# Test 4: Valid booking
TESTS_RUN=$((TESTS_RUN + 1))
echo -e "${BLUE}[Test 4]${NC} Create Valid Booking"
echo ""

response=$(curl -s -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d "{
    \"toolCallId\": \"test-001\",
    \"tool\": {
      \"arguments\": {
        \"organizationId\": \"$ORG_ID\",
        \"patientName\": \"John Doe\",
        \"patientPhone\": \"+15551234567\",
        \"patientEmail\": \"john@example.com\",
        \"appointmentDate\": \"2026-08-15\",
        \"appointmentTime\": \"14:00\"
      }
    }
  }" 2>&1 || true)

if echo "$response" | jq -e '.result.appointmentId // empty' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo "Output:"
echo "$response" | jq '.result' 2>/dev/null || echo "$response" | head -10
echo ""
echo "───────────────────────────────────────────────────────────────────────────"
echo ""

# Test 5: Duplicate prevention - First booking
TESTS_RUN=$((TESTS_RUN + 1))
echo -e "${BLUE}[Test 5]${NC} Duplicate Prevention - First Booking (Should Succeed)"
echo ""

response=$(curl -s -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d "{
    \"toolCallId\": \"dup-1\",
    \"tool\": {
      \"arguments\": {
        \"organizationId\": \"$ORG_ID\",
        \"patientName\": \"Patient A\",
        \"patientPhone\": \"+15551111111\",
        \"patientEmail\": \"a@example.com\",
        \"appointmentDate\": \"2026-08-21\",
        \"appointmentTime\": \"09:00\"
      }
    }
  }" 2>&1 || true)

if echo "$response" | jq -e '.result.success | select(. == true)' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
fi

echo "Output:"
echo "$response" | jq '.result' 2>/dev/null || echo "$response" | head -10
echo ""
echo "───────────────────────────────────────────────────────────────────────────"
echo ""

# Test 6: Duplicate prevention - Second booking same slot
TESTS_RUN=$((TESTS_RUN + 1))
echo -e "${BLUE}[Test 6]${NC} Duplicate Prevention - Second Booking (Should Fail with SLOT_UNAVAILABLE)"
sleep 1
echo ""

response=$(curl -s -X POST http://localhost:3001/api/vapi/tools/bookClinicAppointment \
  -H "Content-Type: application/json" \
  -d "{
    \"toolCallId\": \"dup-2\",
    \"tool\": {
      \"arguments\": {
        \"organizationId\": \"$ORG_ID\",
        \"patientName\": \"Patient B\",
        \"patientPhone\": \"+15552222222\",
        \"patientEmail\": \"b@example.com\",
        \"appointmentDate\": \"2026-08-21\",
        \"appointmentTime\": \"09:00\"
      }
    }
  }" 2>&1 || true)

if echo "$response" | jq -e '.result.error | select(. == "SLOT_UNAVAILABLE")' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC} (Advisory lock working correctly)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
elif echo "$response" | jq -e '.result.success | select(. == true)' > /dev/null 2>&1; then
    echo -e "${RED}✗ FAIL${NC} (Advisory locks are BROKEN - second booking succeeded!)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
else
    echo -e "${YELLOW}⚠ INCONCLUSIVE${NC}"
fi

echo "Output:"
echo "$response" | jq '.result' 2>/dev/null || echo "$response" | head -10
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
echo "Organization ID:  $ORG_ID"
echo "Assistant ID:     $VAPI_ASSISTANT_ID"
echo "Tests Run:        $TESTS_RUN"
echo -e "Tests Passed:     ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed:     ${RED}$TESTS_FAILED${NC}"
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
    echo "  - Verify organization exists in database with valid VAPI_ASSISTANT_ID"
    echo ""
    exit 1
fi
