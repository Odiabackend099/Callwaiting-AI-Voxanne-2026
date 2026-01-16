#!/bin/bash

# Phase 1 API Testing Script
# Tests backend API endpoints for dashboard stats and knowledge base
# Usage: ./scripts/test-phase1-api.sh [backend-url] [auth-token]

set -e

BACKEND_URL="${1:-http://localhost:3001}"
AUTH_TOKEN="${2:-}"

if [ -z "$AUTH_TOKEN" ]; then
    echo "❌ Error: AUTH_TOKEN is required"
    echo "Usage: $0 [backend-url] [auth-token]"
    echo "Example: $0 http://localhost:3001 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    exit 1
fi

echo "🧪 Testing Phase 1 API Endpoints"
echo "Backend URL: $BACKEND_URL"
echo "=========================================="
echo ""

# Test 1: Dashboard Stats Endpoint
echo "Test 1: GET /api/calls-dashboard/stats"
STATS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X GET \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    "$BACKEND_URL/api/calls-dashboard/stats")

HTTP_CODE=$(echo "$STATS_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
STATS_BODY=$(echo "$STATS_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Status: $HTTP_CODE OK"
    
    # Check response fields
    if echo "$STATS_BODY" | grep -q "totalCalls"; then
        echo "✅ Response contains 'totalCalls'"
    else
        echo "❌ Response missing 'totalCalls'"
    fi
    
    if echo "$STATS_BODY" | grep -q "recentCalls"; then
        echo "✅ Response contains 'recentCalls'"
    else
        echo "❌ Response missing 'recentCalls'"
    fi
    
    echo "Response body:"
    echo "$STATS_BODY" | jq '.' 2>/dev/null || echo "$STATS_BODY"
else
    echo "❌ Status: $HTTP_CODE"
    echo "Response: $STATS_BODY"
fi

echo ""
echo "=========================================="
echo ""

# Test 2: Knowledge Base GET Endpoint
echo "Test 2: GET /api/knowledge-base"
KB_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X GET \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    "$BACKEND_URL/api/knowledge-base")

HTTP_CODE=$(echo "$KB_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
KB_BODY=$(echo "$KB_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Status: $HTTP_CODE OK"
    
    # Check response format
    if echo "$KB_BODY" | grep -q "items"; then
        echo "✅ Response contains 'items' array"
    else
        echo "❌ Response missing 'items' array"
    fi
    
    echo "Response body (first 500 chars):"
    echo "$KB_BODY" | head -c 500
    echo "..."
else
    echo "❌ Status: $HTTP_CODE"
    echo "Response: $KB_BODY"
fi

echo ""
echo "=========================================="
echo ""

# Test 3: Knowledge Base POST Endpoint
echo "Test 3: POST /api/knowledge-base"
POST_DATA=$(cat <<EOF
{
    "filename": "test-document-$(date +%s).md",
    "content": "This is a test document created by Phase 1 testing script.",
    "category": "general",
    "active": true
}
EOF
)

KB_POST_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$POST_DATA" \
    "$BACKEND_URL/api/knowledge-base")

HTTP_CODE=$(echo "$KB_POST_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
KB_POST_BODY=$(echo "$KB_POST_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ Status: $HTTP_CODE OK"
    echo "✅ Document created successfully"
    
    # Extract document ID for deletion test
    DOC_ID=$(echo "$KB_POST_BODY" | jq -r '.id // empty' 2>/dev/null || echo "")
    
    if [ -n "$DOC_ID" ] && [ "$DOC_ID" != "null" ]; then
        echo "✅ Document ID: $DOC_ID"
        
        # Test 4: Knowledge Base DELETE Endpoint
        echo ""
        echo "Test 4: DELETE /api/knowledge-base/$DOC_ID"
        KB_DELETE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
            -X DELETE \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            "$BACKEND_URL/api/knowledge-base/$DOC_ID")
        
        HTTP_CODE=$(echo "$KB_DELETE_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
        KB_DELETE_BODY=$(echo "$KB_DELETE_RESPONSE" | sed '/HTTP_CODE/d')
        
        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
            echo "✅ Status: $HTTP_CODE OK"
            echo "✅ Document deleted successfully"
        else
            echo "❌ Status: $HTTP_CODE"
            echo "Response: $KB_DELETE_BODY"
        fi
    else
        echo "⚠️  Could not extract document ID for deletion test"
    fi
    
    echo "Response body:"
    echo "$KB_POST_BODY" | jq '.' 2>/dev/null || echo "$KB_POST_BODY"
else
    echo "❌ Status: $HTTP_CODE"
    echo "Response: $KB_POST_BODY"
fi

echo ""
echo "=========================================="
echo ""

# Test 5: Authentication Required (No Token)
echo "Test 5: GET /api/calls-dashboard/stats (No Auth Token)"
NO_AUTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X GET \
    -H "Content-Type: application/json" \
    "$BACKEND_URL/api/calls-dashboard/stats")

HTTP_CODE=$(echo "$NO_AUTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
NO_AUTH_BODY=$(echo "$NO_AUTH_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "401" ]; then
    echo "✅ Status: $HTTP_CODE Unauthorized (Expected)"
    echo "✅ Authentication required - security check passed"
else
    echo "⚠️  Status: $HTTP_CODE (Expected 401)"
    echo "Response: $NO_AUTH_BODY"
fi

echo ""
echo "=========================================="
echo ""

# Summary
echo "📊 Test Summary"
echo "=========================================="
echo "All API endpoint tests completed."
echo ""
echo "Next Steps:"
echo "1. Review test results above"
echo "2. Perform manual UI testing (see manual-testing-phase1.md)"
echo "3. Check backend logs for any errors"
echo "4. Verify rate limiting (may require multiple rapid requests)"
echo ""
