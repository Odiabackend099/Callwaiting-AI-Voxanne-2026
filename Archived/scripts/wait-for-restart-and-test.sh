#!/bin/bash

# Wait for Backend Server Restart and Run Phase 1 Tests
# This script waits for the server to restart, then automatically runs tests

set -e

BACKEND_URL="http://localhost:3001"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Phase 1 Testing - Auto-Restart Detection & Verification   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check current state
echo "Step 1: Checking current server state..."
STATUS_CHECK=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BACKEND_URL}/api/calls-dashboard/stats" 2>&1 | tail -1 | cut -d: -f2)
HEALTH_CHECK=$(curl -s "${BACKEND_URL}/health" 2>&1 | jq -r '.status // "error"' 2>/dev/null || echo "error")

if [ "$HEALTH_CHECK" != "ok" ]; then
    echo -e "${RED}❌ Backend server is not running${NC}"
    echo ""
    echo "Please start the backend server first:"
    echo "  cd backend && npm run dev"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Backend server is running${NC}"

if [ "$STATUS_CHECK" = "404" ]; then
    echo -e "${YELLOW}⚠️  Server is running OLD code (returns 404 for /stats)${NC}"
    echo -e "${YELLOW}⚠️  Route order fix requires server restart${NC}"
    echo ""
    echo "📝 To restart the server:"
    echo "   1. Go to the terminal where backend server is running"
    echo "   2. Press ${RED}Ctrl+C${NC} to stop it"
    echo "   3. Run: ${GREEN}cd backend && npm run dev${NC}"
    echo "   4. Wait for: ${GREEN}'Server listening on port 3001'${NC}"
    echo ""
    echo -e "${BLUE}Waiting for server restart... (I'll check every 3 seconds)${NC}"
    echo ""
    
    # Wait for restart - check every 3 seconds
    MAX_WAIT=300  # 5 minutes max
    WAIT_COUNT=0
    RESTARTED=false
    
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        sleep 3
        WAIT_COUNT=$((WAIT_COUNT + 3))
        
        # Check if /stats now returns something other than 404
        NEW_STATUS=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BACKEND_URL}/api/calls-dashboard/stats" 2>&1 | tail -1 | cut -d: -f2 2>/dev/null || echo "000")
        
        if [ "$NEW_STATUS" != "404" ] && [ "$NEW_STATUS" != "000" ]; then
            echo ""
            echo -e "${GREEN}✅ Server has been restarted! (Status: $NEW_STATUS)${NC}"
            RESTARTED=true
            break
        fi
        
        # Progress indicator
        if [ $((WAIT_COUNT % 15)) -eq 0 ]; then
            echo -e "${YELLOW}   Still waiting... (${WAIT_COUNT}s elapsed)${NC}"
        fi
    done
    
    if [ "$RESTARTED" = false ]; then
        echo ""
        echo -e "${RED}❌ Timeout: Server did not restart within 5 minutes${NC}"
        echo "Please restart the server manually and then run:"
        echo "  ./scripts/test-phase1-verify.sh"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Server appears to be running NEW code (Status: $STATUS_CHECK)${NC}"
    echo -e "${GREEN}✅ Route order fix is active!${NC}"
fi

echo ""
echo "=========================================="
echo "Step 2: Running Phase 1 Verification Tests"
echo "=========================================="
echo ""

# Run verification tests
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
./scripts/test-phase1-verify.sh

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Phase 1 Verification Complete!${NC}"
echo "=========================================="
echo ""
