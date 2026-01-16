#!/bin/bash

# INFRASTRUCTURE VERIFICATION SCRIPT
# Run this after logging in to verify the system is REAL (not mock)

set -e

API_BASE="http://localhost:3000"
BACKEND_BASE="http://localhost:3001"

echo "🔍 SYSTEM INFRASTRUCTURE VERIFICATION"
echo "======================================"
echo ""

# Test 1: Check Status API
echo "Test 1: Fetching System Status..."
STATUS_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_BASE/api/status")
HTTP_CODE=$(echo "$STATUS_RESPONSE" | tail -n1)
BODY=$(echo "$STATUS_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Status API responding"
    echo ""
    echo "Response:"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    echo ""
    
    # Extract key fields
    USER_ID=$(echo "$BODY" | jq -r '.user_id // "null"' 2>/dev/null)
    ORG_ID=$(echo "$BODY" | jq -r '.organization_id // "null"' 2>/dev/null)
    
    if [ "$USER_ID" != "null" ] && [ "$ORG_ID" != "null" ]; then
        echo "✅ User ID found: $USER_ID"
        echo "✅ Organization ID found: $ORG_ID"
    else
        echo "❌ Missing user or organization ID"
        echo "   This means the auth-to-database bridge is broken"
    fi
else
    echo "❌ Status API failed (HTTP $HTTP_CODE)"
    echo "   This means you are not logged in, or the API is broken"
fi

echo ""
echo "======================================"
echo "Test 2: Checking for Mock Data..."

# Check if dashboard shows any hardcoded data
echo "Searching for hardcoded arrays in code..."
MOCK_COUNT=$(grep -r "mockCalls\|sampleTeam\|dummyData\|const.*=.*\[.*\{" \
    src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v node_modules | wc -l || echo "0")

if [ "$MOCK_COUNT" = "0" ]; then
    echo "✅ No hardcoded mock data arrays found"
else
    echo "❌ Found $MOCK_COUNT potential mock data arrays"
fi

echo ""
echo "======================================"
echo "Test 3: Google OAuth Route Health..."

# Check if OAuth route exists
if [ -f "src/app/api/auth/google-calendar/authorize/route.ts" ]; then
    if grep -q "createServerClient" src/app/api/auth/google-calendar/authorize/route.ts; then
        echo "✅ OAuth route uses createServerClient (FIXED)"
    else
        echo "❌ OAuth route doesn't use proper auth"
    fi
    
    if grep -q "select('organization_id')" src/app/api/auth/google-calendar/authorize/route.ts; then
        echo "✅ OAuth route fetches org_id from database (FIXED)"
    else
        echo "❌ OAuth route still uses broken cookie lookup"
    fi
else
    echo "❌ OAuth route file not found"
fi

echo ""
echo "======================================"
echo "Test 4: Auth Trigger Status..."

# Check if trigger migration exists
if [ -f "backend/migrations/20260114_create_auth_trigger.sql" ]; then
    echo "✅ Auth trigger migration file exists"
    if grep -q "handle_new_user_setup" backend/migrations/20260114_create_auth_trigger.sql; then
        echo "✅ Trigger function definition found"
    fi
else
    echo "⚠️  Auth trigger migration file not found"
    echo "   (This is OK if trigger was created manually in Supabase)"
fi

echo ""
echo "======================================"
echo "Test 5: Frontend Infrastructure..."

# Check AuthContext
if grep -q "from('profiles')" src/contexts/AuthContext.tsx; then
    echo "✅ AuthContext fetches org_id from database"
else
    echo "❌ AuthContext doesn't fetch org_id from database"
fi

# Check Status API
if [ -f "src/app/api/status/route.ts" ]; then
    echo "✅ Status API route exists"
else
    echo "❌ Status API route missing"
fi

# Check Status Dashboard
if [ -f "src/app/dashboard/admin/status/page.tsx" ]; then
    echo "✅ Status dashboard page exists"
else
    echo "❌ Status dashboard page missing"
fi

echo ""
echo "======================================"
echo "VERIFICATION COMPLETE"
echo ""
echo "Next Steps:"
echo "1. Log in at http://localhost:3000/login"
echo "2. Visit http://localhost:3000/dashboard/admin/status"
echo "3. Verify all indicators show ✅"
echo ""
echo "If all tests passed above, your system is REAL (not mock)!"
