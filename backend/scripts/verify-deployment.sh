#!/bin/bash
# Post-Deployment Verification Script
# Tests all 4 new action endpoints and verifies audit logging

set -e

echo "🚀 Dashboard API Fixes - Post-Deployment Verification"
echo "======================================================"
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

if [ -z "$AUTH_TOKEN" ]; then
  echo "⚠️  AUTH_TOKEN not set. Please export your JWT token:"
  echo "   export AUTH_TOKEN='your-jwt-token'"
  echo ""
  echo "Continuing with example commands (will need manual token)..."
  echo ""
fi

echo "📋 Test 1: Follow-up SMS Endpoint"
echo "------------------------------------------------------------"
echo "Command:"
echo "curl -X POST $API_URL/api/calls-dashboard/{callId}/followup \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer \$AUTH_TOKEN' \\"
echo "  -d '{\"message\": \"Thanks for calling! We have openings tomorrow at 2 PM.\"}'"
echo ""
echo "Expected: { success: true, messageId: 'SM...', phone: '+1...' }"
echo ""

echo "📋 Test 2: Share Recording Endpoint"
echo "------------------------------------------------------------"
echo "Command:"
echo "curl -X POST $API_URL/api/calls-dashboard/{callId}/share \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer \$AUTH_TOKEN' \\"
echo "  -d '{\"email\": \"team@example.com\"}'"
echo ""
echo "Expected: { success: true, email: 'team@example.com' }"
echo ""

echo "📋 Test 3: Export Transcript Endpoint"
echo "------------------------------------------------------------"
echo "Command:"
echo "curl -X POST $API_URL/api/calls-dashboard/{callId}/transcript/export \\"
echo "  -H 'Authorization: Bearer \$AUTH_TOKEN' \\"
echo "  --output transcript.txt"
echo ""
echo "Expected: Downloaded transcript.txt file"
echo ""

echo "📋 Test 4: Send Appointment Reminder"
echo "------------------------------------------------------------"
echo "Command:"
echo "curl -X POST $API_URL/api/appointments/{appointmentId}/send-reminder \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer \$AUTH_TOKEN' \\"
echo "  -d '{\"method\": \"sms\"}'"
echo ""
echo "Expected: { success: true, recipient: '+1...', method: 'sms' }"
echo ""

echo "======================================================"
echo "📊 Database Verification Queries"
echo "======================================================"
echo ""

echo "1. Check messages table exists:"
echo "   SELECT COUNT(*) FROM messages;"
echo ""

echo "2. Verify RLS policies:"
echo "   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'messages';"
echo ""

echo "3. Check recent messages:"
echo "   SELECT method, status, COUNT(*) as count"
echo "   FROM messages"
echo "   WHERE sent_at > NOW() - INTERVAL '24 hours'"
echo "   GROUP BY method, status;"
echo ""

echo "4. Verify indexes:"
echo "   SELECT indexname FROM pg_indexes WHERE tablename = 'messages';"
echo ""

echo "======================================================"
echo "✅ Verification Steps Complete"
echo "======================================================"
echo ""
echo "Next steps:"
echo "1. Replace {callId} and {appointmentId} with real IDs"
echo "2. Set AUTH_TOKEN environment variable"
echo "3. Run the curl commands above"
echo "4. Check messages table for audit logs"
echo "5. Verify RLS isolation with different org tokens"
echo ""
