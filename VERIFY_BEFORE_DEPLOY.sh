#!/bin/bash

# Quick Verification Script - Run Before Deploying
# Usage: bash VERIFY_BEFORE_DEPLOY.sh

set -e  # Exit on any error

echo "🔍 TIME TRAVEL BUG FIX - PRE-DEPLOYMENT VERIFICATION"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
TOTAL=0
PASSED=0

# Test 1: Check all files exist
echo "📁 Test 1: Checking all files exist..."
TOTAL=$((TOTAL+1))
FILES=(
    "backend/src/utils/date-validation.ts"
    "backend/src/routes/monitoring.ts"
    "backend/src/services/super-system-prompt.ts"
    "backend/src/config/system-prompts.ts"
    "backend/src/routes/vapi-tools-routes.ts"
    "backend/src/__tests__/unit/date-validation.test.ts"
    "backend/src/__tests__/integration/time-travel-fix.test.ts"
    "backend/scripts/verify-time-travel-fix.ts"
)

ALL_EXIST=true
for file in "${FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}   ❌ Missing: $file${NC}"
        ALL_EXIST=false
    fi
done

if [ "$ALL_EXIST" = true ]; then
    echo -e "${GREEN}   ✅ All 8 files exist${NC}"
    PASSED=$((PASSED+1))
else
    echo -e "${RED}   ❌ Some files missing${NC}"
fi
echo ""

# Test 2: Check TypeScript compiles
echo "🔨 Test 2: Checking TypeScript compilation..."
TOTAL=$((TOTAL+1))
cd backend
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ TypeScript compiles successfully${NC}"
    PASSED=$((PASSED+1))
else
    echo -e "${RED}   ❌ TypeScript compilation errors${NC}"
    echo -e "${YELLOW}   Run 'cd backend && npm run build' to see details${NC}"
fi
cd ..
echo ""

# Test 3: Check for import errors
echo "🔍 Test 3: Checking for common import issues..."
TOTAL=$((TOTAL+1))
IMPORT_ERRORS=0

# Check if date-validation is imported in monitoring.ts
if grep -q "getDateCorrectionStats" backend/src/routes/monitoring.ts; then
    echo -e "${GREEN}   ✅ monitoring.ts imports date-validation${NC}"
else
    echo -e "${RED}   ❌ monitoring.ts missing date-validation import${NC}"
    IMPORT_ERRORS=$((IMPORT_ERRORS+1))
fi

# Check if date-validation is imported in vapi-tools-routes.ts
if grep -q "validateBookingDate" backend/src/routes/vapi-tools-routes.ts; then
    echo -e "${GREEN}   ✅ vapi-tools-routes.ts imports date-validation${NC}"
else
    echo -e "${RED}   ❌ vapi-tools-routes.ts missing date-validation import${NC}"
    IMPORT_ERRORS=$((IMPORT_ERRORS+1))
fi

if [ $IMPORT_ERRORS -eq 0 ]; then
    PASSED=$((PASSED+1))
fi
echo ""

# Test 4: Check for ISO date in prompts
echo "📝 Test 4: Checking system prompts have ISO date..."
TOTAL=$((TOTAL+1))
if grep -q "currentDateISO" backend/src/services/super-system-prompt.ts && \
   grep -q "currentYear" backend/src/services/super-system-prompt.ts; then
    echo -e "${GREEN}   ✅ System prompts include ISO date and year${NC}"
    PASSED=$((PASSED+1))
else
    echo -e "${RED}   ❌ System prompts missing ISO date/year${NC}"
fi
echo ""

# Test 5: Check validation is applied in booking
echo "🛡️  Test 5: Checking validation is applied in bookings..."
TOTAL=$((TOTAL+1))
if grep -q "validateBookingDate" backend/src/routes/vapi-tools-routes.ts && \
   grep -q "dateValidation" backend/src/routes/vapi-tools-routes.ts; then
    echo -e "${GREEN}   ✅ Booking endpoints use date validation${NC}"
    PASSED=$((PASSED+1))
else
    echo -e "${RED}   ❌ Booking endpoints missing validation${NC}"
fi
echo ""

# Test 6: Run verification script (if ts-node available)
echo "🧪 Test 6: Running automated verification script..."
TOTAL=$((TOTAL+1))
cd backend
if command -v npx &> /dev/null; then
    if npx ts-node scripts/verify-time-travel-fix.ts > /dev/null 2>&1; then
        echo -e "${GREEN}   ✅ Verification script passed${NC}"
        PASSED=$((PASSED+1))
    else
        echo -e "${RED}   ❌ Verification script failed${NC}"
        echo -e "${YELLOW}   Run 'cd backend && npx ts-node scripts/verify-time-travel-fix.ts' to see details${NC}"
    fi
else
    echo -e "${YELLOW}   ⏭️  Skipped (ts-node not available)${NC}"
    echo -e "${YELLOW}   Install: npm install -g ts-node${NC}"
fi
cd ..
echo ""

# Summary
echo "=================================================="
echo -e "📊 VERIFICATION SUMMARY"
echo "=================================================="
echo -e "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $((TOTAL-PASSED))${NC}"
SUCCESS_RATE=$(awk "BEGIN {printf \"%.0f\", ($PASSED/$TOTAL)*100}")
echo -e "Success Rate: ${SUCCESS_RATE}%"
echo ""

if [ $PASSED -eq $TOTAL ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED! Ready to deploy.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. git add ."
    echo "2. git commit -m \"fix: time travel bug - prevent AI from booking in past years\""
    echo "3. git push origin main"
    exit 0
else
    echo -e "${RED}⚠️  SOME CHECKS FAILED. Please fix before deploying.${NC}"
    echo ""
    echo "To debug:"
    echo "1. cd backend && npm run build  # Check TypeScript errors"
    echo "2. npx ts-node scripts/verify-time-travel-fix.ts  # Run full verification"
    exit 1
fi
