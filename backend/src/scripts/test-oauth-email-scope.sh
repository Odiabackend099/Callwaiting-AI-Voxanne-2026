#!/bin/bash
# Test the Google Calendar OAuth Flow with new email scope
# Run this after clearing the connection via reset-calendar-connection.sql

set -e

echo "🧪 Google Calendar OAuth Email Scope Test"
echo "=========================================="
echo ""

# Check if backend is running
if ! curl -s http://localhost:3001/api/google-oauth/test > /dev/null 2>&1; then
    echo "❌ Backend not running on port 3001"
    echo "   Run: npm run dev:all"
    exit 1
fi

echo "✅ Backend is running"
echo ""

# Step 1: Check current status
echo "📋 Step 1: Checking current connection status..."
ORG_ID="${1:-46cf2995-2bee-44e3-838b-24151486fe4e}"

STATUS=$(curl -s "http://localhost:3001/api/google-oauth/status/${ORG_ID}")
echo "   Response: $STATUS"
echo ""

# Step 2: Generate OAuth URL
echo "🔗 Step 2: Generating OAuth URL..."
AUTH_RESPONSE=$(curl -s -H "Accept: application/json" "http://localhost:3001/api/google-oauth/authorize?orgId=${ORG_ID}")
AUTH_URL=$(echo "$AUTH_RESPONSE" | grep -o '"url":"[^"]*' | cut -d'"' -f4 | sed 's/\\u0026/\&/g')

if [ -z "$AUTH_URL" ]; then
    echo "   ❌ Failed to generate OAuth URL"
    echo "   Response: $AUTH_RESPONSE"
    exit 1
fi

echo "   ✅ OAuth URL generated"
echo ""

# Step 3: Check if email scope is present
if echo "$AUTH_URL" | grep -q "userinfo.email"; then
    echo "✅ Step 3: Email scope PRESENT in OAuth URL ✓"
else
    echo "❌ Step 3: Email scope MISSING from OAuth URL"
    echo "   Expected: https://www.googleapis.com/auth/userinfo.email"
    exit 1
fi
echo ""

# Step 4: Instructions for manual testing
echo "📱 Step 4: Manual Testing Required"
echo "=================================="
echo ""
echo "1. Open this URL in your browser:"
echo "   ${AUTH_URL}"
echo ""
echo "2. On the Google consent screen, verify you see:"
echo "   ✓ View and edit events on all your calendars"
echo "   ✓ View your email address  <-- NEW!"
echo ""
echo "3. Click 'Allow'"
echo ""
echo "4. After redirect, verify dashboard shows:"
echo "   ✓ Green success toast"
echo "   ✓ 'Connected as clinic@gmail.com' (not 'Not Linked')"
echo ""
echo "5. Run diagnostic:"
echo "   cd backend/src/scripts"
echo "   npx tsx link-doctor.ts"
echo ""
echo "Expected output:"
echo "   Email (Column): clinic@gmail.com"
echo "   Email (Config): clinic@gmail.com"
echo "   Refresh Token: ✅ Present"
echo "   DIAGNOSIS: Healthy Connection"
echo ""
echo "🎉 Test complete!"
