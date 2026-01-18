#!/bin/bash

# Test Vapi Assistant Call
# Replace placeholders before running

curl --request POST \
  --url https://api.vapi.ai/call/test \
  --header "Authorization: Bearer YOUR_VAPI_PRIVATE_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "assistantId": "YOUR_ASSISTANT_ID",
    "customer": {
      "number": "+1234567890", 
      "metadata": {
        "org_id": "YOUR_ACTUAL_ORG_ID"
      }
    },
    "messages": [
      {
        "role": "user",
        "content": "Hi, I have a question from the knowledge base: What is the clinic procedure for first-time visitors? Also, I want to book an appointment for Monday morning, January 19, 2026, at 9:00 AM."
      }
    ]
  }'
