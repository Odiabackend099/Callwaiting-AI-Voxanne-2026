#!/bin/bash

# Deploy book_appointment_with_lock RPC function fix via Supabase Management API
# This fixes the schema mismatch: c.name instead of c.first_name || c.last_name

PROJECT_REF="lbjymlodxprzqgtyqtcq"
ACCESS_TOKEN="sbp_fb6d4524ee1a54f6715fa5df2a0f2de97b71beb8"

echo "🚀 Deploying fixed book_appointment_with_lock RPC function..."
echo ""

# Read and escape the SQL (replacing single quotes with escaped version for JSON)
SQL=$(cat deploy-fix.sql | sed "s/'/\\\\'/g")

# Execute via Supabase Management API
RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$SQL\"}")

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Check for errors
if echo "$RESPONSE" | grep -q "error\|Error\|ERROR"; then
  echo "❌ DEPLOYMENT FAILED"
  exit 1
fi

echo "✅ DEPLOYMENT SUCCESSFUL"
echo ""

# Verify function exists
echo "🔍 Verifying function was created..."
VERIFY_RESPONSE=$(curl -s -X POST "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = '\''book_appointment_with_lock'\'') as function_exists;"}')

echo "$VERIFY_RESPONSE" | jq . 2>/dev/null || echo "$VERIFY_RESPONSE"

if echo "$VERIFY_RESPONSE" | grep -q '"function_exists":true'; then
  echo ""
  echo "✅ VERIFICATION PASSED: Function book_appointment_with_lock exists"
else
  echo ""
  echo "❌ VERIFICATION FAILED: Function not found"
  exit 1
fi
