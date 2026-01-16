#!/bin/bash

# Restart Backend Server and Run Phase 1 Tests
# This script helps restart the backend server and verify Phase 1 implementation

set -e

BACKEND_DIR="/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend"
BACKEND_URL="http://localhost:3001"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔄 Backend Server Restart & Test Helper"
echo "=========================================="
echo ""

# Check if backend server is running
echo "Step 1: Checking backend server status..."
if curl -s "${BACKEND_URL}/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Backend server is currently running${NC}"
    echo ""
    echo "📝 To restart the backend server:"
    echo "   1. Go to the terminal where the backend server is running"
    echo "   2. Press Ctrl+C to stop it"
    echo "   3. Run: cd backend && npm run dev"
    echo "   4. Wait for the server to start (you'll see 'Server listening on port 3001')"
    echo "   5. Then press Enter here to continue testing"
    echo ""
    read -p "Press Enter once you've restarted the backend server..."
else
    echo -e "${RED}❌ Backend server is not running${NC}"
    echo ""
    echo "📝 To start the backend server:"
    echo "   cd backend && npm run dev"
    echo ""
    read -p "Press Enter once you've started the backend server..."
fi

# Wait for server to be ready
echo ""
echo "Step 2: Waiting for server to be ready..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s "${BACKEND_URL}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend server is ready!${NC}"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "   Waiting... (${RETRY_COUNT}/${MAX_RETRIES})"
        sleep 2
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Backend server did not start in time${NC}"
    echo "   Please check the server logs for errors"
    exit 1
fi

echo ""
echo "Step 3: Running Phase 1 verification tests..."
echo ""

# Run the verification script
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
./scripts/test-phase1-verify.sh

echo ""
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo ""
echo "✅ If all tests passed, Phase 1 is working correctly!"
echo ""
echo "📝 Next steps:"
echo "   1. Test with authentication token (see TESTING_PHASE1_QUICKSTART.md)"
echo "   2. Verify frontend integration (browser Network tab)"
echo "   3. Proceed to Phase 2 (Index Optimization) or Phase 3 (RLS Test Suite)"
echo ""
