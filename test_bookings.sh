#!/bin/bash
# Define the Org ID and Base URL
ORG_ID="46cf2995-2bee-44e3-838b-24151486fe4e"
API_URL="http://localhost:3001/api/vapi/tools/bookClinicAppointment"

# Array of Appointment Slots (Date and Time)
slots=(
  "2026-01-19 10:00" "2026-01-19 16:00" 
  "2026-01-20 18:00" "2026-01-20 08:00"
  "2026-01-21 19:00" "2026-01-21 03:00"
  "2026-01-22 14:00" "2026-01-22 15:00"
  "2026-01-23 16:00" "2026-01-23 17:00"
)

for slot in "${slots[@]}"; do
  DATE=$(echo $slot | cut -d' ' -f1)
  TIME=$(echo $slot | cut -d' ' -f2)
  
  echo "Booking Slot: $DATE at $TIME..."
  
  curl -s -X POST $API_URL \
    -H "Content-Type: application/json" \
    -d "{
      \"toolCall\": {
        \"name\": \"bookClinicAppointment\",
        \"arguments\": {
          \"appointmentDate\": \"$DATE\",
          \"appointmentTime\": \"$TIME\",
          \"patientName\": \"BUSINESS_USER_TEST\",
          \"patientEmail\": \"test_business@example.com\"
        }
      },
      \"customer\": { \"metadata\": { \"org_id\": \"$ORG_ID\" } }
    }" | jq -c '{success: .toolResult.content | fromjson | .success, calendarSynced: .toolResult.content | fromjson | .calendarSynced, htmlLink: .toolResult.content | fromjson | .htmlLink, error: .toolResult.content | fromjson | .error}'
    
  sleep 1
done
