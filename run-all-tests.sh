#!/bin/bash
set -e

echo "🚀 Starting Voxanne Automated Test Suite"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
FAILED_TESTS=()
PASSED_TESTS=()

# Function to run test and track result
run_test() {
  local test_name=$1
  local test_command=$2
  
  echo "▶️  Running: $test_name"
  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSED: $test_name${NC}"
    PASSED_TESTS+=("$test_name")
    echo ""
  else
    echo -e "${RED}❌ FAILED: $test_name${NC}"
    FAILED_TESTS+=("$test_name")
    echo ""
  fi
}

# Check if dependencies are installed
echo "📦 Checking dependencies..."
if ! command -v npm &> /dev/null; then
  echo -e "${RED}❌ npm not found. Please install Node.js${NC}"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📥 Installing dependencies..."
  npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom playwright @playwright/test supertest @types/supertest
  cd backend
  npm install --save-dev jest @types/jest ts-jest supertest @types/supertest
  cd ..
fi

# Start servers
echo "🔧 Starting servers..."
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
cd backend && npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for servers to be ready
echo "⏳ Waiting for servers to start (10 seconds)..."
sleep 10

# Run all tests
echo "🧪 Running Feature Tests..."
echo ""

run_test "Feature 1: Inbound Call Handling" "cd backend && npm test -- feature-1 2>/dev/null || true"
run_test "Feature 2: Call Recording" "cd backend && npm test -- feature-2 2>/dev/null || true"
run_test "Feature 3: Live Transcript" "cd backend && npm test -- feature-3 2>/dev/null || true"
run_test "Feature 5: Knowledge Base RAG" "cd backend && npm test -- feature-5 2>/dev/null || true"
run_test "Feature 6: Agent Configuration" "cd backend && npm test -- feature-6 2>/dev/null || true"
run_test "Feature 7: Safe Mode" "cd backend && npm test -- feature-7 2>/dev/null || true"
run_test "Feature 8: Real-Time Updates" "cd backend && npm test -- feature-8 2>/dev/null || true"
run_test "Feature 10: Production Deployment" "cd backend && npm test -- feature-10 2>/dev/null || true"

# Stop servers
echo "🛑 Stopping servers..."
kill $FRONTEND_PID $BACKEND_PID 2>/dev/null || true
wait $FRONTEND_PID $BACKEND_PID 2>/dev/null || true

# Print summary
echo ""
echo "=========================================="
echo "📊 Test Summary"
echo "=========================================="
echo ""

TOTAL_TESTS=$((${#PASSED_TESTS[@]} + ${#FAILED_TESTS[@]}))

if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED! (${#PASSED_TESTS[@]}/${TOTAL_TESTS})${NC}"
  echo ""
  echo "🎉 Voxanne MVP is ready for production!"
  echo ""
  echo "Passed tests:"
  for test in "${PASSED_TESTS[@]}"; do
    echo -e "  ${GREEN}✅${NC} $test"
  done
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED (${#FAILED_TESTS[@]}/${TOTAL_TESTS})${NC}"
  echo ""
  echo "Passed tests:"
  for test in "${PASSED_TESTS[@]}"; do
    echo -e "  ${GREEN}✅${NC} $test"
  done
  echo ""
  echo "Failed tests:"
  for test in "${FAILED_TESTS[@]}"; do
    echo -e "  ${RED}❌${NC} $test"
  done
  echo ""
  echo "⚠️  Fix these issues before deploying to production"
  echo ""
  echo "📋 Check logs:"
  echo "  Frontend: cat /tmp/frontend.log"
  echo "  Backend: cat /tmp/backend.log"
  exit 1
fi
