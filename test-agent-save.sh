#!/bin/bash

# Test script to trigger agent save and capture timing

# You need to get a valid JWT token first
# For now, use curl with header that matches your auth pattern

BACKEND_URL="http://localhost:3001"
NGROK_URL="https://sobriquetical-zofia-abysmally.ngrok-free.dev"

# Get a sample org ID from the database (using Supabase client)
# For now, we'll use a hardcoded test

echo "🔍 Testing agent save endpoint..."
echo ""

# Make the request and capture timing
echo "[Client] Sending POST /api/founder-console/agent/behavior"
echo ""

curl -X POST "${BACKEND_URL}/api/founder-console/agent/behavior" \
  -H "Content-Type: application/json" \
  -H "X-Dev-Mode: true" \
  -d '{
    "inbound": {
      "system_prompt": "You are a helpful medical clinic assistant.",
      "voice": "alloy",
      "language": "en",
      "first_message": "Hello, how can I help?"
    },
    "outbound": null,
    "orgId": "test-org-2026"
  }' \
  2>&1

echo ""
echo ""
echo "✅ Test complete. Check backend console for timing logs."
