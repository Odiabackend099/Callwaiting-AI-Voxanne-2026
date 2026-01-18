#!/bin/bash

# Step 1: Create the tool
echo "Creating Vapi tool..."
TOOL_RESPONSE=$(curl -s -X POST https://api.vapi.ai/tool \
  -H "Authorization: Bearer c08c442b-cc56-4a05-8bfa-34d46a5efccd" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "function",
    "function": {
      "name": "bookClinicAppointment",
      "description": "Books clinic appointment with patient details. Call this when patient confirms booking.",
      "parameters": {
        "type": "object",
        "properties": {
          "appointmentDate": {"type": "string", "description": "Date in YYYY-MM-DD format"},
          "appointmentTime": {"type": "string", "description": "Time in HH:MM format"},
          "patientName": {"type": "string", "description": "Patient full name"},
          "patientEmail": {"type": "string", "description": "Patient email"},
          "patientPhone": {"type": "string", "description": "Patient phone number"},
          "serviceType": {"type": "string", "description": "Service type"}
        },
        "required": ["appointmentDate", "appointmentTime", "patientName", "patientEmail"]
      }
    },
    "server": {
      "url": "https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/vapi/tools/bookClinicAppointment"
    }
  }')

echo "Tool creation response:"
echo "$TOOL_RESPONSE" | jq '.'

# Extract tool ID
TOOL_ID=$(echo "$TOOL_RESPONSE" | jq -r '.id')

if [ "$TOOL_ID" = "null" ] || [ -z "$TOOL_ID" ]; then
  echo "ERROR: Failed to create tool"
  echo "$TOOL_RESPONSE"
  exit 1
fi

echo ""
echo "✅ Tool created with ID: $TOOL_ID"
echo ""

# Step 2: Link tool to assistant
echo "Linking tool to assistant..."
ASSISTANT_RESPONSE=$(curl -s -X PATCH https://api.vapi.ai/assistant/38a9c7b8-56d7-468a-b5e0-05588a518c51 \
  -H "Authorization: Bearer c08c442b-cc56-4a05-8bfa-34d46a5efccd" \
  -H "Content-Type: application/json" \
  -d "{\"model\": {\"toolIds\": [\"$TOOL_ID\"]}}")

echo "Assistant update response:"
echo "$ASSISTANT_RESPONSE" | jq '.'

echo ""
echo "✅ DONE! Tool $TOOL_ID linked to assistant"
echo ""
echo "Now make the call to Sarah. The booking will work."
