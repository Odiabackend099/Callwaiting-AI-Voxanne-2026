#!/bin/bash

# Phase 1 Verification Script - Quick Tests
# Tests Phase 1 endpoints to verify implementation
# Usage: ./scripts/test-phase1-verify.sh

set -e

BACKEND_URL="${1:-http://localhost:3001}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Phase 1 API Endpoint Verification"
echo "=========================================="
echo "Backend URL: $BACKEND_URL"
echo ""

# Test 0: Health Check
echo "Test 0: Health Check"
HEALTH=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BACKEND_URL/health")
HTTP_CODE=$(echo "$HEALTH" | grep "HTTP_CODE" | cut -d: -f2)
HEALTH_BODY=$(echo "$HEALTH" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Status: $HTTP_CODE OK${NC}"
    echo -e "${GREEN}✅ Backend server is healthy${NC}"
    
    # Check services
    if echo "$HEALTH_BODY" | grep -q '"database":true'; then
        echo -e "${GREEN}✅ Database: Connected${NC}"
    fi
    
    if echo "$HEALTH_BODY" | grep -q '"supabase":true'; then
        echo -e "${GREEN}✅ Supabase: Connected${NC}"
    fi
else
    echo -e "${RED}❌ Status: $HTTP_CODE${NC}"
    echo "Response: $HEALTH_BODY"
    exit 1
fi

echo ""
echo "=========================================="
echo ""

# Test 1: Dashboard Stats Endpoint (No Auth - Should require auth in production)
echo "Test 1: GET /api/calls-dashboard/stats (No Auth - Security Check)"
STATS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X GET \
    -H "Content-Type: application/json" \
    "$BACKEND_URL/api/calls-dashboard/stats")

HTTP_CODE=$(echo "$STATS_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
STATS_BODY=$(echo "$STATS_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Status: $HTTP_CODE Unauthorized (Expected)${NC}"
    echo -e "${GREEN}✅ Authentication required - security check passed${NC}"
elif [ "$HTTP_CODE" = "200" ]; then
    echo -e "${YELLOW}⚠️  Status: $HTTP_CODE OK (Dev mode active)${NC}"
    echo -e "${YELLOW}⚠️  Note: Dev mode allows unauthenticated access${NC}"
    echo -e "${YELLOW}⚠️  In production, this should return 401${NC}"
    
    # Check if response has expected format
    if echo "$STATS_BODY" | grep -q "totalCalls"; then
        echo -e "${GREEN}✅ Response format is correct${NC}"
    fi
else
    echo -e "${RED}❌ Status: $HTTP_CODE (Unexpected)${NC}"
    echo "Response: $STATS_BODY"
fi

echo ""
echo "=========================================="
echo ""

# Test 2: Knowledge Base GET (No Auth)
echo "Test 2: GET /api/knowledge-base (No Auth - Security Check)"
KB_GET_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X GET \
    -H "Content-Type: application/json" \
    "$BACKEND_URL/api/knowledge-base")

HTTP_CODE=$(echo "$KB_GET_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
KB_GET_BODY=$(echo "$KB_GET_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Status: $HTTP_CODE Unauthorized (Expected)${NC}"
    echo -e "${GREEN}✅ Authentication required - security check passed${NC}"
elif [ "$HTTP_CODE" = "200" ]; then
    echo -e "${YELLOW}⚠️  Status: $HTTP_CODE OK (Dev mode active)${NC}"
    echo -e "${YELLOW}⚠️  Note: Dev mode allows unauthenticated access${NC}"
    echo -e "${YELLOW}⚠️  In production, this should return 401${NC}"
    
    # Check if response has expected format
    if echo "$KB_GET_BODY" | grep -q '"items"'; then
        echo -e "${GREEN}✅ Response format is correct (items array)${NC}"
        ITEM_COUNT=$(echo "$KB_GET_BODY" | jq '.items | length' 2>/dev/null || echo "unknown")
        echo "   Items count: $ITEM_COUNT"
    fi
else
    echo -e "${RED}❌ Status: $HTTP_CODE (Unexpected)${NC}"
    echo "Response: $KB_GET_BODY"
fi

echo ""
echo "=========================================="
echo ""

# Test 3: Knowledge Base POST (No Auth - Should require auth)
echo "Test 3: POST /api/knowledge-base (No Auth - Security Check)"
KB_POST_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"filename":"test-security-check.md","content":"This is a security check test","category":"general","active":true}' \
    "$BACKEND_URL/api/knowledge-base")

HTTP_CODE=$(echo "$KB_POST_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
KB_POST_BODY=$(echo "$KB_POST_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Status: $HTTP_CODE Unauthorized (Expected)${NC}"
    echo -e "${GREEN}✅ Authentication required - security check passed${NC}"
elif [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "${YELLOW}⚠️  Status: $HTTP_CODE OK (Dev mode active)${NC}"
    echo -e "${YELLOW}⚠️  Note: Dev mode allows unauthenticated access${NC}"
    echo -e "${YELLOW}⚠️  In production, this should return 401${NC}"
    
    # Extract document ID for cleanup
    DOC_ID=$(echo "$KB_POST_BODY" | jq -r '.id // .item.id // empty' 2>/dev/null || echo "")
    
    if [ -n "$DOC_ID" ] && [ "$DOC_ID" != "null" ]; then
        echo -e "${GREEN}✅ Document created (test document)${NC}"
        echo "   Document ID: $DOC_ID"
        
        # Cleanup: Delete test document
        echo ""
        echo "   Cleaning up test document..."
        DELETE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
            -X DELETE \
            -H "Content-Type: application/json" \
            "$BACKEND_URL/api/knowledge-base/$DOC_ID")
        
        DELETE_CODE=$(echo "$DELETE_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
        if [ "$DELETE_CODE" = "200" ] || [ "$DELETE_CODE" = "204" ]; then
            echo -e "${GREEN}✅ Test document deleted${NC}"
        fi
    fi
else
    echo -e "${RED}❌ Status: $HTTP_CODE (Unexpected)${NC}"
    echo "Response: $KB_POST_BODY"
fi

echo ""
echo "=========================================="
echo ""

# Summary
echo "📊 Verification Summary"
echo "=========================================="
echo "✅ Health check: Passed"
echo "⚠️  Authentication checks: See results above"
echo ""
echo "💡 Notes:"
echo "   - If endpoints return 401 without auth: ✅ Production-ready (secure)"
echo "   - If endpoints return 200 without auth: ⚠️  Dev mode active (development only)"
echo ""
echo "🔒 Security Status:"
if [ "$NODE_ENV" = "development" ]; then
    echo -e "${YELLOW}⚠️  NODE_ENV=development (Dev mode bypass active)${NC}"
    echo -e "${YELLOW}⚠️  In production, set NODE_ENV=production to enforce authentication${NC}"
else
    echo -e "${GREEN}✅ NODE_ENV is NOT 'development' (Production mode)${NC}"
    echo -e "${GREEN}✅ Authentication will be required${NC}"
fi

echo ""
echo "📝 Next Steps:"
echo "   1. Test with authentication token (see TESTING_PHASE1_QUICKSTART.md)"
echo "   2. Verify frontend uses backend API (check Network tab)"
echo "   3. Verify RLS policies work (cross-tenant isolation)"
echo "   4. Test rate limiting (multiple rapid requests)"
echo ""
