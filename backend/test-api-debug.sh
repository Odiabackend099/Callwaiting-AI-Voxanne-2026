#!/bin/bash
echo "Testing /api/calls-dashboard endpoint..."
RESPONSE=$(curl -s 'http://localhost:3001/api/calls-dashboard' \
  -H 'Authorization: Bearer test-token' \
  -H 'Content-Type: application/json')

echo "Response:"
echo "$RESPONSE" | jq '.'

# Also check if the endpoint is even registered
echo -e "\n\nChecking all registered routes..."
curl -s 'http://localhost:3001/health' | jq '.services'
