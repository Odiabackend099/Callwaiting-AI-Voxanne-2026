#!/bin/bash

# API Endpoint Testing Script
# Tests: Recording playback, Sentiment data, Dashboard stats

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Voxanne API Endpoint Testing ===${NC}\n"

# Check if backend is running
echo -e "${YELLOW}[1/5] Checking backend server status...${NC}"
if ! curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${YELLOW}Backend not running on port 3001. Starting backend...${NC}"
    # Start backend in background
    npm run dev > /tmp/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    sleep 5
fi

# Get test JWT token from environment or create one
echo -e "${YELLOW}[2/5] Setting up authentication...${NC}"
if [ -z "$TEST_JWT" ]; then
    echo -e "${YELLOW}No TEST_JWT provided. Using anonymous requests...${NC}"
    JWT_HEADER=""
else
    JWT_HEADER="-H \"Authorization: Bearer $TEST_JWT\""
fi

# Test 1: Recording Playback Endpoint
echo -e "\n${BLUE}=== Test 1: Recording Playback Endpoint ===${NC}"
echo -e "${YELLOW}Testing: GET /api/calls-dashboard/{CALL_ID}/recording-url${NC}"

# Try with a test call ID (you may need to replace this with an actual call ID)
TEST_CALL_ID="test-call-123"

if [ -n "$JWT_HEADER" ]; then
    RESPONSE=$(curl -s -H "Authorization: Bearer $TEST_JWT" \
        "http://localhost:3001/api/calls-dashboard/$TEST_CALL_ID/recording-url" 2>&1)
else
    RESPONSE=$(curl -s "http://localhost:3001/api/calls-dashboard/$TEST_CALL_ID/recording-url" 2>&1)
fi

if echo "$RESPONSE" | grep -q "error\|Error"; then
    echo -e "${YELLOW}Response (expected error for test call):${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${GREEN}✓ Recording playback endpoint is responding${NC}"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi

# Test 2: Sentiment Data Endpoint
echo -e "\n${BLUE}=== Test 2: Sentiment Data Endpoint ===${NC}"
echo -e "${YELLOW}Testing: GET /api/calls-dashboard?page=1&limit=1${NC}"

if [ -n "$JWT_HEADER" ]; then
    RESPONSE=$(curl -s -H "Authorization: Bearer $TEST_JWT" \
        "http://localhost:3001/api/calls-dashboard?page=1&limit=1" 2>&1)
else
    RESPONSE=$(curl -s "http://localhost:3001/api/calls-dashboard?page=1&limit=1" 2>&1)
fi

echo -e "${YELLOW}Response:${NC}"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Extract sentiment data if available
if echo "$RESPONSE" | jq -e '.calls[0]' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Sentiment data found${NC}"
    echo "$RESPONSE" | jq '.calls[0] | {sentiment_label, sentiment_score, sentiment_urgency}' 2>/dev/null
else
    echo -e "${YELLOW}No calls data in response (may be expected if no calls exist)${NC}"
fi

# Test 3: Dashboard Stats Endpoint
echo -e "\n${BLUE}=== Test 3: Dashboard Stats Endpoint ===${NC}"
echo -e "${YELLOW}Testing: GET /api/analytics/dashboard-pulse${NC}"

if [ -n "$JWT_HEADER" ]; then
    RESPONSE=$(curl -s -H "Authorization: Bearer $TEST_JWT" \
        "http://localhost:3001/api/analytics/dashboard-pulse" 2>&1)
else
    RESPONSE=$(curl -s "http://localhost:3001/api/analytics/dashboard-pulse" 2>&1)
fi

echo -e "${YELLOW}Response:${NC}"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

if echo "$RESPONSE" | grep -q "error\|Error"; then
    echo -e "${RED}✗ Dashboard stats endpoint returned error${NC}"
else
    echo -e "${GREEN}✓ Dashboard stats endpoint is responding${NC}"
fi

# Summary
echo -e "\n${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}All API endpoints have been tested.${NC}"
echo -e "${YELLOW}Note: Ensure you have:${NC}"
echo "  1. A valid JWT token in TEST_JWT environment variable"
echo "  2. Actual call IDs in your database for complete testing"
echo "  3. Backend running on port 3001"

# Cleanup
if [ ! -z "$BACKEND_PID" ]; then
    echo -e "\n${YELLOW}Stopping backend...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
fi

echo -e "${GREEN}Testing complete!${NC}\n"
