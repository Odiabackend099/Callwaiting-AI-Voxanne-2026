#!/bin/bash

PROJECT_REF="lbjymlodxprzqgtyqtcq"
ACCESS_TOKEN="sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8"

echo "🔍 Checking book_appointment_with_lock function definition..."
echo ""

curl -s -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT pg_get_functiondef(oid) as function_def FROM pg_proc WHERE proname = '"'"'book_appointment_with_lock'"'"' LIMIT 1;"}' \
  | jq -r '.[0].function_def' \
  | grep -A 3 "SELECT a.id, a.scheduled_at"
