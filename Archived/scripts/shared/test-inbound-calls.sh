#!/bin/bash

# Test Feature 1: Inbound Call Handling
# Simulates 10 inbound webhook calls to verify fixes

BASE_URL="http://localhost:3001"
WEBHOOK_URL="$BASE_URL/api/webhooks/vapi"
VAPI_SECRET="test-secret-key"

# Generate test calls
for i in {1..10}; do
  CALL_ID="test-call-$i-$(date +%s%N)"
  ASSISTANT_ID="test-assistant-id"
  CUSTOMER_NUMBER="+1234567890"
  
  echo "=== Test Call $i ==="
  echo "Call ID: $CALL_ID"
  
  # Create webhook payload
  PAYLOAD=$(cat <<EOF
{
  "type": "call.started",
  "call": {
    "id": "$CALL_ID",
    "status": "ringing",
    "assistantId": "$ASSISTANT_ID",
    "customer": {
      "number": "$CUSTOMER_NUMBER",
      "name": "Test Customer $i"
    }
  }
}
EOF
)
  
  # Send webhook
  RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -H "x-vapi-signature: test-signature" \
    -d "$PAYLOAD")
  
  echo "Response: $RESPONSE"
  echo ""
  
  # Small delay between calls
  sleep 0.5
done

echo "=== Test Complete ==="
echo "Check logs for:"
echo "1. 'Call type detected' - should show isInboundCall: true"
echo "2. 'Agent found' - should show agent lookup succeeded"
echo "3. 'Created call_tracking for inbound call' - should show call_tracking created"
echo "4. 'Call log created' - should show call_logs created"
echo "5. 'Call started successfully' - should show webhook completed"
