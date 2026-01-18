#!/bin/bash

# Technical Co-CEO: Recovery Test - Single Slot
ORG_ID="46cf2995-2bee-44e3-838b-24151486fe4e"
API_URL="http://localhost:3001/api/vapi/tools/bookClinicAppointment"

echo "🚀 SINGLE SLOT RECOVERY TEST"
echo "================================"
echo ""

# Test ONE slot
DATE="2026-01-19"
TIME="10:00"

echo "📅 Attempting: $DATE at $TIME"
echo "Org ID: $ORG_ID"
echo ""

RESPONSE=$(curl -i -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "{\"toolCall\":{\"name\":\"bookClinicAppointment\",\"arguments\":{\"appointmentDate\":\"$DATE\",\"appointmentTime\":\"$TIME\",\"patientName\":\"RECOVERY_TEST\",\"patientEmail\":\"test@business.com\"}},\"customer\":{\"metadata\":{\"org_id\":\"$ORG_ID\"}}}")

echo "$RESPONSE"
echo ""
echo "================================"
echo "✅ Check Google Calendar now for blue box at Monday 10:00 AM"
echo "If it appears, the system works. If not, see error above."
