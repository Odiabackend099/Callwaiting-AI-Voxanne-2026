#!/bin/bash

# Register bookClinicAppointment tool with Vapi assistant

ASSISTANT_ID="0bcc5fd8-77b0-4bce-81cd-abfa107dfea5"
VAPI_PUBLIC_KEY="ddd720c5-6fb8-4174-b7a6-729d7b308cb9"
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
