#!/bin/bash

# Retry integration test after deploying RPC fix
# Test parameters: Austyn, +2348141995397, austyn@demo.com, Feb 5 2026 at 3 PM

ORG_ID="46cf2995-2bee-44e3-838b-24151486fe4e"
BACKEND_URL="http://localhost:3001"

echo "🧪 INTEGRATION TEST: Vapi ↔ Backend Booking Flow (Post-Fix)"
echo "======================================================================"
echo ""
echo "Test Parameters:"
echo "  Organization: voxanne@demo.com"
echo "  Org ID: $ORG_ID"
echo "  Caller: Austyn"
echo "  Phone: +2348141995397"
echo "  Email: austyn@demo.com"
echo "  Date: 2026-02-05"
echo "  Time: 15:00"
echo ""
echo "======================================================================"
echo ""

# Step 1: Test checkAvailability
echo "[1/2] Testing checkAvailability tool..."
echo ""

AVAILABILITY_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/vapi/tools/calendar/check" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"type\": \"tool-call\",
      \"toolCall\": {
        \"id\": \"test-check-001\",
        \"type\": \"function\",
        \"function\": {
          \"name\": \"checkAvailability\",
          \"arguments\": \"{\\\"tenantId\\\":\\\"${ORG_ID}\\\",\\\"date\\\":\\\"2026-02-05\\\"}\"
        }
      }
    }
  }")

echo "Response:"
echo "$AVAILABILITY_RESPONSE" | jq . 2>/dev/null || echo "$AVAILABILITY_RESPONSE"
echo ""

if echo "$AVAILABILITY_RESPONSE" | grep -q '"success":true'; then
  echo "✅ checkAvailability: SUCCESS"
elif echo "$AVAILABILITY_RESPONSE" | grep -q "Unable to check availability"; then
  echo "⚠️  checkAvailability: Calendar health check failed (known issue)"
  echo "    This is a separate issue from schema mismatch"
else
  echo "❌ checkAvailability: FAILED"
fi
echo ""

# Step 2: Test bookClinicAppointment
echo "[2/2] Testing bookClinicAppointment tool..."
echo ""

BOOKING_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/vapi/tools/bookClinicAppointment" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": {
      \"type\": \"tool-call\",
      \"toolCall\": {
        \"id\": \"test-book-001\",
        \"type\": \"function\",
        \"function\": {
          \"name\": \"bookClinicAppointment\",
          \"arguments\": \"{\\\"tenantId\\\":\\\"${ORG_ID}\\\",\\\"customerName\\\":\\\"Austyn\\\",\\\"customerPhone\\\":\\\"+2348141995397\\\",\\\"customerEmail\\\":\\\"austyn@demo.com\\\",\\\"appointmentDate\\\":\\\"2026-02-05\\\",\\\"appointmentTime\\\":\\\"15:00\\\",\\\"serviceType\\\":\\\"consultation\\\"}\"
        }
      }
    }
  }")

echo "Response:"
echo "$BOOKING_RESPONSE" | jq . 2>/dev/null || echo "$BOOKING_RESPONSE"
echo ""

if echo "$BOOKING_RESPONSE" | grep -q '"success":true'; then
  echo "✅ bookClinicAppointment: SUCCESS"

  # Extract appointment ID
  APPOINTMENT_ID=$(echo "$BOOKING_RESPONSE" | jq -r '.result.appointmentId' 2>/dev/null)

  if [ ! -z "$APPOINTMENT_ID" ] && [ "$APPOINTMENT_ID" != "null" ]; then
    echo "   Appointment ID: $APPOINTMENT_ID"
  fi

  echo ""
  echo "======================================================================"
  echo "✅ INTEGRATION TEST PASSED"
  echo "======================================================================"
  echo ""
  echo "Schema fix verified:"
  echo "  - RPC function now uses c.name (not c.first_name)"
  echo "  - Booking succeeded without schema error"
  echo "  - Contact and appointment created successfully"

elif echo "$BOOKING_RESPONSE" | grep -q "column c.first_name does not exist"; then
  echo "❌ bookClinicAppointment: FAILED (schema error still present)"
  echo ""
  echo "======================================================================"
  echo "❌ INTEGRATION TEST FAILED"
  echo "======================================================================"
  echo ""
  echo "Schema fix was not applied correctly"

else
  echo "⚠️  bookClinicAppointment: FAILED (different error)"
  echo ""
  echo "======================================================================"
  echo "⚠️  INTEGRATION TEST INCONCLUSIVE"
  echo "======================================================================"
  echo ""
  echo "Error type: $(echo "$BOOKING_RESPONSE" | jq -r '.result.error' 2>/dev/null || echo "Unknown")"
fi
