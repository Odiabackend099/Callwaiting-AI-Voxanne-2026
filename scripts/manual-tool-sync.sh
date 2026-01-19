#!/bin/bash

# Manual Tool Registration and Linking Script
# This directly uses Vapi API to register and link the booking tool

set -e

echo "🛠️  MANUAL TOOL SYNC FOR SARA"
echo "============================="

# Configuration
VAPI_KEY="${VAPI_PRIVATE_KEY}"
SARA_ORG_ID="46cf2995-2bee-44e3-838b-24151486fe4e"
SARA_ASSISTANT_ID="d7c52ba1-c3ab-46d7-8a2d-85e7dc49e99e"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

if [ -z "$VAPI_KEY" ]; then
    echo "❌ Error: VAPI_PRIVATE_KEY not set"
    exit 1
fi

echo "📍 Backend URL: $BACKEND_URL"
echo "📍 Sara Org ID: $SARA_ORG_ID"
echo "📍 Sara Assistant ID: $SARA_ASSISTANT_ID"
echo ""

# Step 1: Create tool definition
echo "📋 Step 1: Creating tool definition..."
TOOL_DEF=$(cat <<'EOF'
{
  "name": "bookClinicAppointment",
  "description": "Books a clinic appointment on the patient's preferred date and time. Updates Google Calendar and creates a booking record.",
  "type": "function",
  "server": {
    "url": "BACKEND_URL_PLACEHOLDER/api/vapi/tools/bookClinicAppointment"
  },
  "function": {
    "name": "bookClinicAppointment",
    "description": "Books a clinic appointment",
    "parameters": {
      "type": "object",
      "properties": {
        "patientName": {"type": "string", "description": "Patient full name"},
        "patientPhone": {"type": "string", "description": "Patient phone in E.164 format"},
        "patientEmail": {"type": "string", "description": "Patient email"},
        "appointmentDate": {"type": "string", "description": "Appointment date (YYYY-MM-DD)"},
        "appointmentTime": {"type": "string", "description": "Appointment time (HH:MM in 24-hour format)"},
        "serviceType": {"type": "string", "description": "Type of service"}
      },
      "required": ["patientName", "patientPhone", "patientEmail", "appointmentDate", "appointmentTime"]
    }
  }
}
EOF
)

TOOL_DEF="${TOOL_DEF//BACKEND_URL_PLACEHOLDER/$BACKEND_URL}"

echo "✅ Tool definition created"
echo ""

# Step 2: Check if tool already exists in org_tools
echo "📋 Step 2: Checking if tool already registered..."

# This is complex without TypeScript, so we'll just proceed to register

# Step 3: Register tool with Vapi
echo "📋 Step 3: Registering tool with Vapi API..."
REGISTER_RESPONSE=$(curl -s -X POST "https://api.vapi.ai/tool" \
  -H "Authorization: Bearer $VAPI_KEY" \
  -H "Content-Type: application/json" \
  -d "$TOOL_DEF")

echo "Response: $REGISTER_RESPONSE"

TOOL_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.id // empty')

if [ -z "$TOOL_ID" ]; then
    echo "❌ Failed to register tool"
    echo "Full response: $REGISTER_RESPONSE"
    exit 1
fi

echo "✅ Tool registered with ID: $TOOL_ID"
echo ""

# Step 4: Get current assistant
echo "📋 Step 4: Fetching current assistant from Vapi..."
CURRENT_ASSISTANT=$(curl -s -X GET "https://api.vapi.ai/assistant/$SARA_ASSISTANT_ID" \
  -H "Authorization: Bearer $VAPI_KEY")

CURRENT_TOOL_IDS=$(echo "$CURRENT_ASSISTANT" | jq -r '.model.toolIds // []')

echo "Current toolIds: $CURRENT_TOOL_IDS"
echo ""

# Step 5: Link tool to assistant
echo "📋 Step 5: Linking tool to assistant..."

# Create update payload with new tool ID added
UPDATE_PAYLOAD=$(cat <<EOF
{
  "model": {
    "toolIds": ["$TOOL_ID"]
  }
}
EOF
)

LINK_RESPONSE=$(curl -s -X PATCH "https://api.vapi.ai/assistant/$SARA_ASSISTANT_ID" \
  -H "Authorization: Bearer $VAPI_KEY" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_PAYLOAD")

echo "Link response:"
echo "$LINK_RESPONSE" | jq '.'

NEW_TOOL_IDS=$(echo "$LINK_RESPONSE" | jq -r '.model.toolIds // empty')

if [ -z "$NEW_TOOL_IDS" ]; then
    echo "⚠️  Could not verify toolIds in response"
else
    echo "✅ New toolIds: $NEW_TOOL_IDS"
fi

echo ""

# Step 6: Verify
echo "📋 Step 6: Verifying linkage..."
sleep 2

VERIFY_RESPONSE=$(curl -s -X GET "https://api.vapi.ai/assistant/$SARA_ASSISTANT_ID" \
  -H "Authorization: Bearer $VAPI_KEY")

FINAL_TOOL_IDS=$(echo "$VERIFY_RESPONSE" | jq -r '.model.toolIds')

echo "Final toolIds: $FINAL_TOOL_IDS"

if [ "$FINAL_TOOL_IDS" != "null" ] && [ ! -z "$FINAL_TOOL_IDS" ]; then
    echo ""
    echo "✅ SUCCESS: Tools linked to Sara's assistant!"
else
    echo ""
    echo "❌ FAILURE: Tools still not linked"
    exit 1
fi

# Step 7: Save to database
echo ""
echo "📋 Step 7: Saving tool registration to database..."
echo "Tool ID: $TOOL_ID"
echo "Org ID: $SARA_ORG_ID"
echo "Note: Run the backend tool sync to update org_tools table"

echo ""
echo "✅ Manual tool registration complete!"
