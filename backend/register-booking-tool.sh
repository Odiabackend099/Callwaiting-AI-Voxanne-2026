#!/bin/bash

# Register bookClinicAppointment tool with Vapi assistant

ASSISTANT_ID="0bcc5fd8-77b0-4bce-81cd-abfa107dfea5"
VAPI_PUBLIC_KEY="9829e1f5-e367-427c-934d-0de75f8801cf"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

echo "Fetching assistant configuration..."

# Get current assistant
ASSISTANT=$(curl -s "https://api.vapi.ai/assistant/$ASSISTANT_ID" \
  -H "Authorization: Bearer $VAPI_PUBLIC_KEY")

echo "Current assistant:"
echo "$ASSISTANT" | head -20

# Extract current toolIds
TOOL_IDS=$(echo "$ASSISTANT" | grep -o '"toolIds":\[[^]]*\]')
echo "Current toolIds: $TOOL_IDS"
