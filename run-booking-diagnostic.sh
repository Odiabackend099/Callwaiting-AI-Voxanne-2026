#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   VOXANNE BOOKING FLOW DIAGNOSTIC                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Configuration
ORG_ID="46cf2995-2bee-44e3-838b-24151486fe4e"
NGROK_URL="https://sobriquetical-zofia-abysmally.ngrok-free.dev"
BOOKING_ENDPOINT="${NGROK_URL}/api/vapi/tools/bookClinicAppointment"
HEALTH_ENDPOINT="${NGROK_URL}/health"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# ============================================================================
# TEST 1: Backend Health
# ============================================================================
echo -e "${YELLOW}[TEST 1/4] Checking if backend is accessible...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_ENDPOINT" 2>&1)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n 1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Backend is UP${NC}"
  echo "   Response: $BODY"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ Backend is DOWN (HTTP $HTTP_CODE)${NC}"
  echo "   This means your backend is not running or ngrok tunnel is inactive"
  echo "   Response: $BODY"
  ((TESTS_FAILED++))
  echo ""
  echo -e "${YELLOW}To start the backend:${NC}"
  echo "  cd backend"
  echo "  npm run dev"
  exit 1
fi
echo ""

# ============================================================================
# TEST 2: Booking Endpoint Exists
# ============================================================================
echo -e "${YELLOW}[TEST 2/4] Checking if booking endpoint is registered...${NC}"
ENDPOINT_TEST=$(curl -s -I -X POST "$BOOKING_ENDPOINT" 2>&1 | head -n 1)

if echo "$ENDPOINT_TEST" | grep -q "405\|200\|400"; then
  echo -e "${GREEN}✅ Booking endpoint exists${NC}"
  echo "   Endpoint: $BOOKING_ENDPOINT"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ Booking endpoint NOT found${NC}"
  echo "   This means /api/vapi/tools/bookClinicAppointment is not registered"
  echo "   Response: $ENDPOINT_TEST"
  ((TESTS_FAILED++))
fi
echo ""

# ============================================================================
# TEST 3: Test Booking with Valid Payload
# ============================================================================
echo -e "${YELLOW}[TEST 3/4] Testing booking endpoint with valid payload...${NC}"

BOOKING_PAYLOAD=$(cat <<EOF
{
  "customer": {
    "metadata": {
      "org_id": "$ORG_ID"
    }
  },
  "message": {
    "toolCall": {
      "function": {
        "name": "bookClinicAppointment",
        "arguments": {
          "appointmentDate": "2026-01-20",
          "appointmentTime": "18:00",
          "patientEmail": "diagnostic-test@example.com",
          "patientName": "Diagnostic Test",
          "serviceType": "consultation"
        }
      }
    }
  }
}
EOF
)

BOOKING_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BOOKING_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$BOOKING_PAYLOAD" 2>&1)

HTTP_CODE=$(echo "$BOOKING_RESPONSE" | tail -n 1)
BODY=$(echo "$BOOKING_RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Booking endpoint returned HTTP 200${NC}"
  ((TESTS_PASSED++))

  # Check response format
  if echo "$BODY" | grep -q "toolResult"; then
    echo -e "${GREEN}✅ Response has toolResult field${NC}"

    if echo "$BODY" | grep -q "\"content\""; then
      echo -e "${GREEN}✅ Response has content field (single-line JSON)${NC}"

      if echo "$BODY" | grep -q "\"speech\""; then
        echo -e "${GREEN}✅ Response has speech field${NC}"
        echo ""
        echo -e "${GREEN}✨ BOOKING ENDPOINT IS WORKING CORRECTLY${NC}"
      else
        echo -e "${RED}❌ Response missing speech field${NC}"
        ((TESTS_FAILED++))
      fi
    else
      echo -e "${RED}❌ Response missing content field${NC}"
      ((TESTS_FAILED++))
    fi
  else
    echo -e "${RED}❌ Response missing toolResult field${NC}"
    ((TESTS_FAILED++))
  fi

  echo ""
  echo "Full response:"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
else
  echo -e "${RED}❌ Booking endpoint returned HTTP $HTTP_CODE${NC}"
  ((TESTS_FAILED++))
  echo ""
  echo "Response body:"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
fi
echo ""

# ============================================================================
# TEST 4: Check Vapi Configuration
# ============================================================================
echo -e "${YELLOW}[TEST 4/4] Checking Vapi configuration...${NC}"
echo -e "${YELLOW}⚠️  Manual check required:${NC}"
echo "  1. Go to: https://dashboard.vapi.ai"
echo "  2. Open your inbound assistant (Sarah)"
echo "  3. Click 'Edit'  or go to Tools section"
echo "  4. Find 'bookClinicAppointment' tool"
echo "  5. Check the webhook URL is:"
echo -e "     ${GREEN}$BOOKING_ENDPOINT${NC}"
echo "  6. NOT http://localhost:3001 (must be HTTPS ngrok URL)"
echo ""
read -p "Is the webhook URL correct in Vapi dashboard? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${GREEN}✅ Vapi configuration appears correct${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${YELLOW}⚠️  Update the webhook URL in Vapi dashboard${NC}"
  ((TESTS_FAILED++))
fi
echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                      DIAGNOSTIC SUMMARY                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo -e "${GREEN}Passed: $TESTS_PASSED/4${NC}"
echo -e "${RED}Failed: $TESTS_FAILED/4${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed! Your booking endpoint is working correctly.${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Call Sarah again at the clinic phone number"
  echo "  2. Provide your booking information"
  echo "  3. The appointment should now be confirmed"
  echo ""
  echo "If booking still fails, check:"
  echo "  - backend/vapi-debug.log for detailed logs"
  echo "  - backend logs for error messages"
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Debugging required.${NC}"
  echo ""
  echo "Common issues:"
  echo "  1. Backend not running → npm run dev in backend/"
  echo "  2. Wrong ngrok URL in Vapi dashboard"
  echo "  3. Missing org_id in customer.metadata"
  echo "  4. Database errors (check backend logs)"
  echo ""
  echo "Check detailed logs:"
  echo "  tail -f backend/vapi-debug.log"
  exit 1
fi
