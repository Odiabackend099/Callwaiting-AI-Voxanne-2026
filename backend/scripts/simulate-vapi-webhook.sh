#!/bin/bash

# Vapi Webhook Simulation Script
# Simulates a "tool-calls" event from Vapi to the local backend

URL="http://localhost:3001/api/vapi/tools/bookClinicAppointment"
SECRET="some-secret-key" # This won't match server if server expects something else, but we want to see if it even gets processed

# Payload representing a tool call
PAYLOAD='{
  "message": {
    "type": "tool-calls",
    "toolCallList": [
      {
        "id": "call_123456",
        "type": "function",
        "function": {
          "name": "bookClinicAppointment",
          "arguments": "{\"appointmentDate\":\"2026-06-25\",\"appointmentTime\":\"14:00\",\"patientEmail\":\"sim-test@example.com\",\"patientName\":\"Simulation Test\",\"patientPhone\":\"+15550000000\"}"
        }
      }
    ],
    "call": {
        "id": "vapi-call-id",
        "assistantId": "vapi-assistant-id",
        "metadata": {
            "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"
        }
    }
  },
  "customer": {
      "metadata": {
          "org_id": "46cf2995-2bee-44e3-838b-24151486fe4e"
      }
  }
}'

# Calculate signature
TIMESTAMP=$(date +%s)
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

echo "Sending request to $URL"
echo "Timestamp: $TIMESTAMP"
echo "Signature: $SIGNATURE"

curl -v -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-vapi-signature: $SIGNATURE" \
  -H "x-vapi-timestamp: $TIMESTAMP" \
  -d "$PAYLOAD"

echo ""
