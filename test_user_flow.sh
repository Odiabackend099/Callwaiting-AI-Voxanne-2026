#!/bin/bash

# Complete User Flow Testing Script
# Tests all endpoints and user interactions step-by-step

set -e

echo "======================================"
echo "VOXANNE USER FLOW TEST SUITE"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to test endpoint
test_endpoint() {
    local method=$1
    local url=$2
    local description=$3
    local expected_status=$4
    
    echo -n "Testing: $description... "
    
    response=$(curl -s -w "\n%{http_code}" -X "$method" "http://localhost:$url")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        echo "Response: $body" | head -c 100
        echo ""
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $http_code)"
        echo "Response: $body"
        echo ""
        ((TESTS_FAILED++))
        return 1
    fi
}

# Helper function to test JSON response
test_json_response() {
    local url=$1
    local description=$2
    local jq_filter=$3
    
    echo -n "Testing: $description... "
    
    response=$(curl -s "http://localhost:$url")
    result=$(echo "$response" | jq -r "$jq_filter" 2>/dev/null || echo "PARSE_ERROR")
    
    if [ "$result" != "PARSE_ERROR" ] && [ ! -z "$result" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        echo "Result: $result"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "Response: $response"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "======================================"
echo "STEP 1: BACKEND HEALTH CHECK"
echo "======================================"
echo ""

test_endpoint "GET" "3001/health" "Backend health check" "200"
echo ""

echo "======================================"
echo "STEP 2: SETTINGS ENDPOINTS"
echo "======================================"
echo ""

test_endpoint "GET" "3001/api/founder-console/settings" "Get settings" "200"
test_json_response "3001/api/founder-console/settings" "Settings has vapiConfigured field" ".vapiConfigured"
test_json_response "3001/api/founder-console/settings" "Settings has twilioConfigured field" ".twilioConfigured"
echo ""

echo "======================================"
echo "STEP 3: VOICES ENDPOINT"
echo "======================================"
echo ""

test_endpoint "GET" "3001/api/assistants/voices/available" "Get available voices" "200"
test_json_response "3001/api/assistants/voices/available" "Voices is array" ".[0].id"
test_json_response "3001/api/assistants/voices/available" "First voice has name" ".[0].name"
echo ""

echo "======================================"
echo "STEP 4: AGENTS ENDPOINT"
echo "======================================"
echo ""

test_endpoint "GET" "3001/api/assistants/db-agents" "Get database agents" "200"
test_json_response "3001/api/assistants/db-agents" "Agents endpoint returns array" ".[0] | type"
echo ""

echo "======================================"
echo "STEP 5: FRONTEND ROUTES"
echo "======================================"
echo ""

test_endpoint "GET" "3000/" "Landing page" "200"
test_endpoint "GET" "3000/dashboard" "Dashboard page" "200"
test_endpoint "GET" "3000/dashboard/settings" "Settings page" "200"
test_endpoint "GET" "3000/dashboard/voice-test" "Voice test page" "200"
echo ""

echo "======================================"
echo "STEP 6: FRONTEND CONTENT VERIFICATION"
echo "======================================"
echo ""

echo -n "Testing: Dashboard contains 'Test Voice Agent' button... "
if curl -s http://localhost:3000/dashboard | grep -q "Test Voice Agent"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((TESTS_FAILED++))
fi

echo -n "Testing: Settings page contains 'API Keys' tab... "
if curl -s http://localhost:3000/dashboard/settings | grep -q "API Keys"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((TESTS_FAILED++))
fi

echo -n "Testing: Settings page contains 'Agent Configuration' tab... "
if curl -s http://localhost:3000/dashboard/settings | grep -q "Agent Configuration"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((TESTS_FAILED++))
fi

echo -n "Testing: Voice test page contains 'Start Conversation' button... "
if curl -s http://localhost:3000/dashboard/voice-test | grep -q "Start Conversation"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((TESTS_FAILED++))
fi

echo ""

echo "======================================"
echo "TEST SUMMARY"
echo "======================================"
echo ""
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "User Flow Status:"
    echo "  ✓ Backend endpoints working"
    echo "  ✓ Frontend routes accessible"
    echo "  ✓ Settings page configured"
    echo "  ✓ Voice test page ready"
    echo ""
    echo "Next Steps:"
    echo "  1. Open http://localhost:3000/dashboard in browser"
    echo "  2. Click 'Settings' button"
    echo "  3. Configure Vapi API key"
    echo "  4. Configure agent settings"
    echo "  5. Click 'Test Voice Agent' button"
    echo "  6. Click 'Start Conversation' and speak"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please check the errors above and fix them."
    exit 1
fi
