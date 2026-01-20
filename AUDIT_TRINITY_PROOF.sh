#!/bin/bash

##############################################################################
# 🏛️ OPERATION: TRINITY AUDIT SCRIPT
# ============================================================================
# Hard Evidence Mode: Pull actual JSON from external APIs
# No backend logs. No "likely" claims. Raw proof only.
#
# This script pulls from:
#   1. Vapi API - Verify bookClinicAppointment tool is attached
#   2. Google Calendar API - Verify event exists on Jan 22
#   3. Supabase - Verify appointment timestamp is 09:00:00Z
#
# Usage: bash AUDIT_TRINITY_PROOF.sh
##############################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🏛️  OPERATION: TRINITY AUDIT - HARD EVIDENCE MODE        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

##############################################################################
# CONFIGURATION
##############################################################################

VAPI_KEY="${VAPI_PRIVATE_KEY:-dc0ddc43-42ae-493b-a082-6e15cd7d739a}"
ASSISTANT_ID="b9328ee0-42cb-46e5-8e35-15c67b4b4318"
ORG_ID="46cf2995-2bee-44e3-838b-24151486fe4e"
APPOINTMENT_ID="5ab26510-2b24-4873-9ce3-441556a0a00e"
SUPABASE_URL="https://lbjymlodbyxprznqgtyqtcq.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsImtpZCI6Imx1dWpUNTJlOTEzRlBkQjAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2xianltbG9keHByenFndHlxdGNxLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzZTAzNzU4Ny04ZmIyLTQxNTktOWZZMS0xOGJhNDZlOTQ1OWIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY4OTEzOTY5LCJpYXQiOjE3Njg5MTAzNjksImVtYWlsIjoidm94YW5uZUBkZW1vLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7Im9yZ19pZCI6IjQ2Y2YyOTk1LTJiZWUtNDRlMy04MzhiLTI0MTUxNDg2ZmU0ZSJ9LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwicm5sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2ODkxMDM2OX1dLCJzZXNzaW9uX2lkIjoiZmUyNWM4ZmMtZGE5NC00M2U0LWE1NmQtNGM5MjUzZjdhOWExIiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.eBi0YFmaMNcBob8qu78UHiy8w79rR5hst5k6uYmbZhE"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Vapi API Key: ${VAPI_KEY:0:10}..."
echo "  Assistant ID: $ASSISTANT_ID"
echo "  Org ID: $ORG_ID"
echo "  Appointment ID: $APPOINTMENT_ID"
echo ""

##############################################################################
# PILLAR 1: VERIFY TOOL BINDING IN VAPI
##############################################################################

echo -e "${BLUE}┌─ PILLAR 1: Vapi Tool Binding${NC}"
echo -e "${BLUE}│ Fetching Assistant config from Vapi API...${NC}"
echo ""

VAPI_RESPONSE=$(curl -s -X GET "https://api.vapi.ai/assistant/$ASSISTANT_ID" \
  -H "Authorization: Bearer $VAPI_KEY" 2>/dev/null)

echo -e "${BLUE}│ Full Assistant Config:${NC}"
echo "$VAPI_RESPONSE" | jq '.' 2>/dev/null | sed 's/^/│   /'

echo ""
echo -e "${BLUE}│ Extracting Tools Array:${NC}"
TOOLS=$(echo "$VAPI_RESPONSE" | jq '.model.tools // []' 2>/dev/null)
echo "$TOOLS" | jq '.' 2>/dev/null | sed 's/^/│   /'

echo ""
TOOL_COUNT=$(echo "$TOOLS" | jq 'length' 2>/dev/null || echo "0")
HAS_BOOKING=$(echo "$TOOLS" | jq 'any(.name == "bookClinicAppointment")' 2>/dev/null || echo "false")

if [ "$HAS_BOOKING" = "true" ]; then
  echo -e "${GREEN}│ ✅ PASS: bookClinicAppointment tool IS ATTACHED${NC}"
else
  echo -e "${RED}│ ❌ FAIL: bookClinicAppointment tool NOT FOUND${NC}"
  echo -e "${RED}│ Tools count: $TOOL_COUNT${NC}"
fi

echo -e "${BLUE}└─${NC}"
echo ""

##############################################################################
# PILLAR 2: VERIFY DATABASE TIMESTAMP
##############################################################################

echo -e "${BLUE}┌─ PILLAR 2: Database Timestamp (09:00:00Z)${NC}"
echo -e "${BLUE}│ Querying Supabase for appointment...${NC}"
echo ""

DB_RESPONSE=$(curl -s "${SUPABASE_URL}/rest/v1/appointments?id=eq.${APPOINTMENT_ID}" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" 2>/dev/null)

echo -e "${BLUE}│ Full Appointment Record:${NC}"
echo "$DB_RESPONSE" | jq '.' 2>/dev/null | sed 's/^/│   /'

echo ""
echo -e "${BLUE}│ Extracting Scheduled Timestamp:${NC}"
SCHEDULED_AT=$(echo "$DB_RESPONSE" | jq -r '.[0].scheduled_at' 2>/dev/null || echo "NOT_FOUND")
echo "│   Scheduled At: $SCHEDULED_AT"

if [[ "$SCHEDULED_AT" == "2026-01-22T09:00:00"* ]]; then
  echo -e "${GREEN}│ ✅ PASS: Timestamp is 09:00:00Z (Lagos 10:00 AM)${NC}"
else
  echo -e "${RED}│ ❌ FAIL: Timestamp is NOT 09:00:00Z${NC}"
  echo -e "${RED}│ Found: $SCHEDULED_AT${NC}"
fi

echo -e "${BLUE}└─${NC}"
echo ""

##############################################################################
# PILLAR 3: VERIFY GOOGLE CALENDAR EVENT
##############################################################################

echo -e "${BLUE}┌─ PILLAR 3: Google Calendar Event (Jan 22)${NC}"
echo -e "${YELLOW}│ NOTE: Google Calendar requires OAuth token${NC}"
echo -e "${YELLOW}│ If you have GOOGLE_CALENDAR_TOKEN set, event check will run${NC}"
echo ""

if [ -z "$GOOGLE_CALENDAR_TOKEN" ]; then
  echo -e "${YELLOW}│ MANUAL STEP REQUIRED:${NC}"
  echo -e "${YELLOW}│${NC}"
  echo -e "${YELLOW}│ 1. Go to: https://myaccount.google.com/permissions${NC}"
  echo -e "${YELLOW}│ 2. Authorize 'Voxanne AI' app for Calendar access${NC}"
  echo -e "${YELLOW}│ 3. Get OAuth token (or use gcloud):${NC}"
  echo -e "${YELLOW}│${NC}"
  echo -e "${YELLOW}│    gcloud auth print-access-token${NC}"
  echo -e "${YELLOW}│${NC}"
  echo -e "${YELLOW}│ 4. Run with token:${NC}"
  echo -e "${YELLOW}│${NC}"
  echo -e "${YELLOW}│    GOOGLE_CALENDAR_TOKEN=<your_token> bash AUDIT_TRINITY_PROOF.sh${NC}"
  echo -e "${YELLOW}│${NC}"
  echo -e "${YELLOW}│ If token is available, run this curl:${NC}"
  echo -e "${YELLOW}│${NC}"
  echo -e "${YELLOW}│    curl -s \\${NC}"
  echo -e "${YELLOW}│      'https://www.googleapis.com/calendar/v3/calendars/primary/events' \\${NC}"
  echo -e "${YELLOW}│      -H 'Authorization: Bearer <YOUR_TOKEN>' \\${NC}"
  echo -e "${YELLOW}│      -H 'X-Goog-User-Project: voxanne-ai' | jq '.items[] | select(.start.dateTime | startswith(\"2026-01-22\"))'${NC}"
else
  echo -e "${BLUE}│ Querying Google Calendar for voxanne@demo.com...${NC}"
  echo ""
  
  CALENDAR_RESPONSE=$(curl -s \
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=2026-01-22T00:00:00Z&timeMax=2026-01-22T23:59:59Z" \
    -H "Authorization: Bearer $GOOGLE_CALENDAR_TOKEN" 2>/dev/null)
  
  echo -e "${BLUE}│ Calendar Events for Jan 22:${NC}"
  echo "$CALENDAR_RESPONSE" | jq '.items[]' 2>/dev/null | sed 's/^/│   /'
  
  echo ""
  EVENT_COUNT=$(echo "$CALENDAR_RESPONSE" | jq '.items | length' 2>/dev/null || echo "0")
  
  if [ "$EVENT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}│ ✅ PASS: $EVENT_COUNT event(s) found on Jan 22${NC}"
    
    # Check for Facelift Consultation
    HAS_FACELIFT=$(echo "$CALENDAR_RESPONSE" | jq '.items[] | select(.summary | contains("Facelift"))' 2>/dev/null)
    if [ ! -z "$HAS_FACELIFT" ]; then
      echo -e "${GREEN}│ ✅ PASS: 'Facelift Consultation' event found${NC}"
    else
      echo -e "${YELLOW}│ ⚠️  WARNING: No 'Facelift Consultation' event (but events exist)${NC}"
    fi
  else
    echo -e "${RED}│ ❌ FAIL: NO EVENTS FOUND on Jan 22${NC}"
    echo -e "${RED}│ Calendar is EMPTY for the booking date${NC}"
  fi
fi

echo -e "${BLUE}└─${NC}"
echo ""

##############################################################################
# SUMMARY
##############################################################################

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🏛️  TRINITY AUDIT COMPLETE                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}NEXT STEPS:${NC}"
echo ""
echo "1. If Pillar 1 FAILS (no tools):"
echo "   → Tool sync is broken. Check ToolSyncService in backend."
echo ""
echo "2. If Pillar 2 FAILS (wrong timestamp):"
echo "   → Timezone conversion is wrong. Check booking service UTC handling."
echo ""
echo "3. If Pillar 3 FAILS (no calendar event):"
echo "   → Calendar sync is broken. Check OAuth flow and Google API integration."
echo ""
echo "If ALL three pass → System is production-ready ✅"
echo "If ANY fails → System is NOT production-ready ❌"
echo ""
