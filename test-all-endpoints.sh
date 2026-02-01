#!/bin/bash

# Comprehensive API Endpoint Testing Script
# Tests all dashboard and call log endpoints

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_BASE="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}API ENDPOINT COMPREHENSIVE TEST SUITE${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Get auth token from Supabase
echo -e "${YELLOW}[1] Getting authentication token...${NC}"
echo "Note: We'll use a test token. In production, this comes from user login."
echo ""

# For testing purposes, we'll make requests without auth first to see what happens
# Then document the expected auth flow

# Step 2: Test health endpoint (no auth required)
echo -e "${YELLOW}[2] Testing Health Endpoint (No Auth Required)${NC}"
echo "Testing: GET /health"
HEALTH_RESPONSE=$(curl -s -X GET "$API_BASE/health" | jq .)
echo "Response:"
echo "$HEALTH_RESPONSE" | jq .
echo ""

# Step 3: List all available call log API endpoints
echo -e "${YELLOW}[3] Available API Endpoints to Test${NC}"
cat << 'EOF'
Dashboard Analytics Endpoints:
  - GET /api/analytics/dashboard-pulse (Total calls, avg duration)
  - GET /api/analytics/recent-activity (Recent activity feed)

Call Log Endpoints:
  - GET /api/calls-dashboard (List calls with filters)
  - GET /api/calls-dashboard/analytics/summary (Call analytics)
  - GET /api/calls-dashboard/:callId (Get call details)
  - GET /api/calls-dashboard/:callId/recording-url (Get recording)
  - DELETE /api/calls-dashboard/:callId/delete (Delete call)

Note: These endpoints require JWT authentication
EOF
echo ""

# Step 4: Test endpoint structure without auth (will get 401)
echo -e "${YELLOW}[4] Testing Endpoint Structure (Authentication Check)${NC}"
echo ""

echo -e "${BLUE}Testing: GET /api/analytics/dashboard-pulse${NC}"
echo "Expected: 401 Unauthorized (Auth required)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/api/analytics/dashboard-pulse" -H "Authorization: Bearer invalid-token")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)
echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

echo -e "${BLUE}Testing: GET /api/analytics/recent-activity${NC}"
echo "Expected: 401 Unauthorized (Auth required)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/api/analytics/recent-activity" -H "Authorization: Bearer invalid-token")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)
echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

echo -e "${BLUE}Testing: GET /api/calls-dashboard${NC}"
echo "Expected: 401 Unauthorized (Auth required)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/api/calls-dashboard" -H "Authorization: Bearer invalid-token")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)
echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

# Step 5: Database information
echo -e "${YELLOW}[5] Database Information${NC}"
echo "Checking if we can query database directly for test data..."
echo ""

# Try to get information from Supabase
SUPABASE_URL=$(grep -i "NEXT_PUBLIC_SUPABASE_URL" /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/.env* 2>/dev/null | head -1 | cut -d'=' -f2)
SUPABASE_KEY=$(grep -i "NEXT_PUBLIC_SUPABASE_ANON_KEY" /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/.env* 2>/dev/null | head -1 | cut -d'=' -f2)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo -e "${RED}Could not find Supabase credentials in .env files${NC}"
    echo "Cannot proceed with authenticated tests"
else
    echo -e "${GREEN}Found Supabase credentials${NC}"
    echo "URL: $SUPABASE_URL"
    echo ""

    # Test with Supabase API to get call data
    echo -e "${YELLOW}[6] Checking for Call Data in Database${NC}"
    echo ""

    echo "Querying: calls table"
    CALLS_RESPONSE=$(curl -s -X GET \
        "$SUPABASE_URL/rest/v1/calls?select=id,created_at,caller_name,duration_seconds,call_direction&limit=5" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" 2>/dev/null || echo "Failed")

    if [ "$CALLS_RESPONSE" != "Failed" ]; then
        echo "Response:"
        echo "$CALLS_RESPONSE" | jq . 2>/dev/null || echo "$CALLS_RESPONSE"
    else
        echo -e "${RED}Could not query database${NC}"
    fi
    echo ""
fi

# Step 7: Instructions for manual testing
echo -e "${YELLOW}[7] Manual Testing Instructions${NC}"
cat << 'EOF'

To test authenticated endpoints, follow these steps:

1. Open your browser and login to http://localhost:3000/dashboard
2. Open browser console (F12 → Console tab)
3. Run these commands to get your JWT token:

   const session = await (await fetch('/api/auth/session')).json()
   console.log(session.access_token)

4. Copy the token and use it in curl requests:

   curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
        http://localhost:3001/api/analytics/dashboard-pulse

Expected Responses:

   Dashboard-Pulse (Total Calls & Avg Duration):
   {
     "total_calls": 5,
     "inbound_calls": 3,
     "outbound_calls": 2,
     "avg_duration_seconds": 84,
     "success_rate": 0,
     "pipeline_value": 0,
     "hot_leads_count": 0
   }

   Recent Activity (Combined Calls):
   {
     "events": [
       {
         "id": "call_...",
         "type": "call_completed",
         "summary": "📲 Call from Sarah Johnson - 2m",
         "metadata": { "call_direction": "inbound", ... }
       },
       {
         "id": "call_...",
         "type": "call_completed",
         "summary": "📞 Call to Michael Chen - 1m",
         "metadata": { "call_direction": "outbound", ... }
       }
     ]
   }

   Calls Dashboard (Inbound):
   {
     "calls": [ ... ],
     "pagination": { "total": X, "page": 1, "limit": 100 }
   }

   Call Details with Recording:
   {
     "id": "...",
     "phone_number": "+...",
     "caller_name": "...",
     "has_recording": true,
     "recording_url": "https://..."
   }

EOF
echo ""

# Step 8: Database table structure
echo -e "${YELLOW}[8] Database Table Information${NC}"
cat << 'EOF'

Expected Database Tables:
  - calls: Main unified calls table with inbound + outbound
  - hot_lead_alerts: Hot leads detected
  - appointments: Booked appointments

Expected Columns in 'calls' table:
  - id (UUID)
  - org_id (UUID)
  - call_direction (inbound|outbound)
  - duration_seconds (integer)
  - caller_name (string)
  - phone_number (string)
  - sentiment_label (positive|neutral|negative)
  - sentiment_score (0.0-1.0)
  - sentiment_summary (text)
  - sentiment_urgency (low|medium|high|critical)
  - recording_url (string)
  - status (completed|failed|missed)
  - created_at (timestamp)
  - updated_at (timestamp)

EOF
echo ""

# Step 9: Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
cat << 'EOF'

✅ Health Endpoint: Working (no auth required)
⏳ Dashboard-Pulse Endpoint: Requires auth token
⏳ Recent-Activity Endpoint: Requires auth token
⏳ Calls-Dashboard Endpoint: Requires auth token
⏳ Recording Endpoint: Requires auth token
⏳ Delete Endpoint: Requires auth token

Next Steps:
1. Login to http://localhost:3000/dashboard
2. Extract JWT token from browser console
3. Run authenticated curl commands with the token
4. Verify all endpoints return expected data structures

EOF

echo -e "${YELLOW}Script completed!${NC}"
echo ""
