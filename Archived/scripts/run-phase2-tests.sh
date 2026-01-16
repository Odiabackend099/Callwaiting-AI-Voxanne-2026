#!/bin/bash

# Phase 2: Integration Tests Execution Script
# Purpose: Run cross-tenant isolation tests (RLS + API level)
# Date: 2025-01-10

set -e

echo "🧪 Phase 2: Integration Tests for Cross-Tenant Isolation"
echo "=================================================="
echo ""

# Check if we're in the backend directory
if [ ! -f "package.json" ] || [ ! -d "tests" ]; then
    echo "❌ Error: Must run from backend directory"
    echo "   Usage: cd backend && bash scripts/run-phase2-tests.sh"
    exit 1
fi

# Check environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "⚠️  Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set"
    echo "   Loading from .env file if available..."
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    else
        echo "❌ Error: No .env file found"
        exit 1
    fi
fi

# Verify environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    exit 1
fi

echo "✅ Environment variables configured"
echo "   SUPABASE_URL: ${SUPABASE_URL:0:30}..."
echo ""

# Step 1: Run RLS database-level tests (no backend server needed)
echo "📋 Step 1: Running RLS database-level tests..."
echo "   Test: rls-cross-tenant-isolation.test.ts"
echo ""

npm test -- rls-cross-tenant-isolation.test.ts

RLS_TEST_EXIT_CODE=$?

if [ $RLS_TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ RLS tests PASSED"
    echo ""
else
    echo ""
    echo "❌ RLS tests FAILED (exit code: $RLS_TEST_EXIT_CODE)"
    echo "   Please review test output above"
    exit 1
fi

# Step 2: Check if backend server is running
echo "📋 Step 2: Checking backend server status..."
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

if curl -s -f "${BACKEND_URL}/health" > /dev/null 2>&1; then
    echo "✅ Backend server is running at ${BACKEND_URL}"
    echo ""
elif curl -s -f "${BACKEND_URL}/api/health" > /dev/null 2>&1; then
    echo "✅ Backend server is running at ${BACKEND_URL}/api/health"
    echo ""
else
    echo "⚠️  Warning: Backend server not responding at ${BACKEND_URL}"
    echo ""
    echo "   To start backend server:"
    echo "   Terminal 1: cd backend && npm run dev"
    echo ""
    echo "   Then re-run this script in Terminal 2:"
    echo "   cd backend && bash scripts/run-phase2-tests.sh"
    echo ""
    read -p "   Start backend server now? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⏭️  Skipping API tests. Run manually:"
        echo "   npm test -- api-cross-tenant-isolation.test.ts"
        exit 0
    fi
    
    echo "🚀 Starting backend server in background..."
    npm run dev > /tmp/backend-server.log 2>&1 &
    BACKEND_PID=$!
    
    echo "   Waiting for server to start..."
    sleep 5
    
    # Check if server started successfully
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Error: Backend server failed to start"
        echo "   Check logs: cat /tmp/backend-server.log"
        exit 1
    fi
    
    echo "✅ Backend server started (PID: $BACKEND_PID)"
    echo ""
    
    # Cleanup function
    trap "echo ''; echo '🧹 Stopping backend server...'; kill $BACKEND_PID 2>/dev/null; echo '✅ Cleanup complete';" EXIT
fi

# Step 3: Run API application-level tests
echo "📋 Step 3: Running API application-level tests..."
echo "   Test: api-cross-tenant-isolation.test.ts"
echo "   Backend URL: ${BACKEND_URL}"
echo ""

export BACKEND_URL=$BACKEND_URL
npm test -- api-cross-tenant-isolation.test.ts

API_TEST_EXIT_CODE=$?

if [ $API_TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ API tests PASSED"
    echo ""
else
    echo ""
    echo "❌ API tests FAILED (exit code: $API_TEST_EXIT_CODE)"
    echo "   Please review test output above"
    exit 1
fi

# Summary
echo "=================================================="
echo "✅ Phase 2: Integration Tests - COMPLETE"
echo ""
echo "📊 Test Results:"
echo "   ✅ RLS database-level tests: PASSED"
echo "   ✅ API application-level tests: PASSED"
echo ""
echo "🎯 Next Steps:"
echo "   1. Review test output above"
echo "   2. Proceed to Phase 3: Manual Verification"
echo "   3. See MANUAL_VERIFICATION_CHECKLIST.md"
echo ""
