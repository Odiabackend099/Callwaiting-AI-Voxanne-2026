#!/bin/bash

################################################################################
# VAPI WEBHOOK CONFIGURATION SCRIPT
#
# Purpose: Programmatically configure Vapi assistant webhook with ngrok tunnel
# - Verifies all services are running
# - Gets ngrok tunnel URL
# - Calls backend webhook configurator endpoint
# - Verifies webhook is properly configured
#
# Usage: ./CONFIGURE_VAPI_WEBHOOK.sh <VAPI_API_KEY> <VAPI_ASSISTANT_ID>
################################################################################

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:3001"
NGROK_API="http://localhost:4040/api"
MAX_RETRIES=5
RETRY_DELAY=2

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🔧 VAPI WEBHOOK CONFIGURATION${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# STEP 1: Validate inputs
# ============================================================================
if [ -z "$1" ] || [ -z "$2" ]; then
  echo -e "${RED}❌ Usage: $0 <VAPI_API_KEY> <VAPI_ASSISTANT_ID>${NC}"
  echo ""
  echo "Example:"
  echo "  $0 dc0ddc43-42ae-493b-a082-6e15cd7d739a 1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada"
  exit 1
fi

VAPI_API_KEY="$1"
VAPI_ASSISTANT_ID="$2"

echo "Configuration:"
echo "  VAPI API Key: ${VAPI_API_KEY:0:16}...${VAPI_API_KEY: -8}"
echo "  Assistant ID: $VAPI_ASSISTANT_ID"
echo ""

# ============================================================================
# STEP 2: Verify services are running
# ============================================================================
echo -e "${YELLOW}📋 Verifying services...${NC}"

# Check backend
echo -n "  Backend (3001): "
if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC}"
  BACKEND_OK=1
else
  echo -e "${RED}❌ Not responding${NC}"
  BACKEND_OK=0
fi

# Check ngrok
echo -n "  ngrok API (4040): "
if curl -s "$NGROK_API/tunnels" > /dev/null 2>&1; then
  echo -e "${GREEN}✅${NC}"
  NGROK_OK=1
else
  echo -e "${RED}❌ Not responding${NC}"
  NGROK_OK=0
fi

if [ $BACKEND_OK -eq 0 ] || [ $NGROK_OK -eq 0 ]; then
  echo ""
  echo -e "${RED}❌ Required services not running. Start them first:${NC}"
  echo "  Terminal 1: cd backend && npm run dev"
  echo "  Terminal 2: npm run dev"
  echo "  Terminal 3: ngrok http 3001"
  exit 1
fi

echo ""

# ============================================================================
# STEP 3: Get ngrok tunnel URL
# ============================================================================
echo -e "${YELLOW}🌐 Retrieving ngrok tunnel URL...${NC}"

NGROK_URL=$(curl -s "$NGROK_API/tunnels" | jq -r '.tunnels[0].public_url // empty')

if [ -z "$NGROK_URL" ]; then
  echo -e "${RED}❌ Failed to retrieve ngrok tunnel URL${NC}"
  echo "Attempted to query: $NGROK_API/tunnels"
  exit 1
fi

echo -e "  ${GREEN}✅${NC} Tunnel: $NGROK_URL"
echo ""

# ============================================================================
# STEP 4: Call backend webhook configurator endpoint
# ============================================================================
echo -e "${YELLOW}🔌 Configuring Vapi webhook...${NC}"

CONFIG_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/internal/configure-vapi-webhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"vapiApiKey\": \"$VAPI_API_KEY\",
    \"vapiAssistantId\": \"$VAPI_ASSISTANT_ID\",
    \"webhookUrl\": \"$NGROK_URL/api/webhooks/vapi\"
  }")

echo "Response:"
echo "$CONFIG_RESPONSE" | jq '.' 2>/dev/null || echo "$CONFIG_RESPONSE"
echo ""

CONFIG_SUCCESS=$(echo "$CONFIG_RESPONSE" | jq -r '.success // false' 2>/dev/null)

if [ "$CONFIG_SUCCESS" != "true" ]; then
  echo -e "${RED}❌ Webhook configuration failed${NC}"
  echo ""
  echo "Debug info:"
  echo "  - Check backend logs: tail -f /tmp/backend.log | grep -i webhook"
  echo "  - Verify VAPI_API_KEY is correct"
  echo "  - Verify VAPI_ASSISTANT_ID exists"
  exit 1
fi

echo -e "${GREEN}✅ Webhook configured successfully${NC}"
echo ""

# ============================================================================
# STEP 5: Verify webhook configuration
# ============================================================================
echo -e "${YELLOW}✔️  Verifying webhook configuration...${NC}"

VERIFY_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/internal/verify-vapi-webhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"vapiApiKey\": \"$VAPI_API_KEY\",
    \"vapiAssistantId\": \"$VAPI_ASSISTANT_ID\"
  }")

echo "Verification result:"
echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
echo ""

VERIFY_SUCCESS=$(echo "$VERIFY_RESPONSE" | jq -r '.configured // false' 2>/dev/null)

if [ "$VERIFY_SUCCESS" = "true" ]; then
  echo -e "${GREEN}✅ Webhook is properly configured${NC}"
else
  echo -e "${YELLOW}⚠️  Webhook verification inconclusive (may still be working)${NC}"
fi

echo ""

# ============================================================================
# FINAL SUMMARY
# ============================================================================
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 CONFIGURATION COMPLETE${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Your Vapi assistant is now configured to:"
echo "  1. Receive webhooks from: $NGROK_URL/api/webhooks/vapi"
echo "  2. Call backend tools at: $NGROK_URL/api/vapi/tools/*"
echo "  3. Send SMS confirmations via your Twilio account"
echo ""
echo "Next steps:"
echo "  1. Test a booking: ./VERIFY_SMS_BRIDGE.sh"
echo "  2. Check backend logs: tail -f /tmp/backend.log | grep -i vapi"
echo "  3. Monitor ngrok: open http://localhost:4040"
echo ""
echo -e "${YELLOW}Note: This ngrok URL will change if you restart the tunnel.${NC}"
echo -e "${YELLOW}      Re-run this script to update the webhook URL.${NC}"
echo ""
