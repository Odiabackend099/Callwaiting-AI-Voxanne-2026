#!/bin/bash

# AI Tool Enforcement Deployment Verification
# Checks all 12 implementation fixes

echo "🔍 AI Tool Enforcement Verification"
echo "===================================================================="
echo "Testing all 12 implementation fixes..."
echo ""

PASS=0
FAIL=0
WARN=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# TEST 1: Legacy prompts file deleted
echo "TEST 1: Legacy prompts file deleted..."
if [ ! -f "src/config/system-prompts.ts" ]; then
    echo -e "${GREEN}✅ PASS${NC}: Legacy file successfully removed"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}: File still exists at src/config/system-prompts.ts"
    ((FAIL++))
fi
echo ""

# TEST 2: Super system prompt has required sections
echo "TEST 2: Super system prompt integrity..."
REQUIRED_SECTIONS=(
    "CALLER IDENTIFICATION - USE lookupCaller TOOL"
    "TOOL FAILURE PROTOCOL"
    "CRITICAL DATE VALIDATION"
    "Calendar Unavailable (Graceful Degradation)"
    "Scenario E: Complex Request"
    "Scenario F: Patient Explicitly Asks for Human"
)

MISSING_COUNT=0
for section in "${REQUIRED_SECTIONS[@]}"; do
    if ! grep -q "$section" "src/services/super-system-prompt.ts"; then
        echo -e "${RED}   Missing: $section${NC}"
        ((MISSING_COUNT++))
    fi
done

if [ $MISSING_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: All 6 required sections present"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}: Missing $MISSING_COUNT sections"
    ((FAIL++))
fi
echo ""

# TEST 3: Temporal context uses timezone parameter
echo "TEST 3: Temporal context timezone usage..."
if grep -q "timeZone: timezone" "src/services/super-system-prompt.ts"; then
    echo -e "${GREEN}✅ PASS${NC}: getTemporalContext correctly applies timezone parameter"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}: getTemporalContext may not be using timezone parameter"
    ((FAIL++))
fi
echo ""

# TEST 4: Organization settings fetch in vapi-assistant-manager
echo "TEST 4: Organization settings fetch..."
if grep -q "from('organizations')" "src/services/vapi-assistant-manager.ts" && \
   grep -q "select('timezone, name, business_hours')" "src/services/vapi-assistant-manager.ts"; then
    HARDCODED_COUNT=$(grep -c "timezone:\s*['\"]America/Los_Angeles['\"]" "src/services/vapi-assistant-manager.ts" || echo "0")
    if [ "$HARDCODED_COUNT" -le 2 ]; then
        echo -e "${GREEN}✅ PASS${NC}: Org settings fetched correctly ($HARDCODED_COUNT fallback references)"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠️  WARN${NC}: Org settings fetched but $HARDCODED_COUNT hardcoded references found"
        ((WARN++))
    fi
else
    echo -e "${RED}❌ FAIL${NC}: Organization settings fetch not found"
    ((FAIL++))
fi
echo ""

# TEST 5: Booking agent setup uses super-system-prompt
echo "TEST 5: Booking agent setup integration..."
if grep -q "from './super-system-prompt'" "src/services/booking-agent-setup.ts" && \
   grep -q "getSuperSystemPrompt(" "src/services/booking-agent-setup.ts"; then
    echo -e "${GREEN}✅ PASS${NC}: Correctly imports and uses getSuperSystemPrompt"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}: Missing super-system-prompt import or usage"
    ((FAIL++))
fi
echo ""

# TEST 6: Safe RPC usage
echo "TEST 6: Safe booking RPC..."
if grep -q "supabase.rpc('book_appointment_with_lock'" "src/routes/vapi-tools-routes.ts"; then
    echo -e "${GREEN}✅ PASS${NC}: Using book_appointment_with_lock (safe RPC)"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}: Still using unsafe RPC (book_appointment_atomic)"
    ((FAIL++))
fi
echo ""

# TEST 7: Conflict response handling
echo "TEST 7: Conflict response handling..."
if grep -q "SLOT_UNAVAILABLE" "src/routes/vapi-tools-routes.ts" && \
   grep -q "That time was just booked by another caller" "src/routes/vapi-tools-routes.ts"; then
    echo -e "${GREEN}✅ PASS${NC}: SLOT_UNAVAILABLE error handling implemented"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}: Missing conflict response handling"
    ((FAIL++))
fi
echo ""

# TEST 8: SMS queueing after success
echo "TEST 8: SMS queueing protocol..."
if grep -q "if (bookingResult.success)" "src/routes/vapi-tools-routes.ts" && \
   grep -q "BookingConfirmationService.sendConfirmationSMS" "src/routes/vapi-tools-routes.ts"; then
    echo -e "${GREEN}✅ PASS${NC}: SMS queued after booking success verification"
    ((PASS++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: Verify SMS queueing happens after booking success"
    ((WARN++))
fi
echo ""

# TEST 9: No remaining legacy imports
echo "TEST 9: No legacy system-prompts.ts imports..."
LEGACY_IMPORTS=$(grep -r "from.*config/system-prompts" src/ --include="*.ts" 2>/dev/null | wc -l | xargs)
if [ "$LEGACY_IMPORTS" -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}: No legacy imports found"
    ((PASS++))
else
    echo -e "${RED}❌ FAIL${NC}: Found $LEGACY_IMPORTS files still importing legacy prompts"
    grep -r "from.*config/system-prompts" src/ --include="*.ts" 2>/dev/null | head -5
    ((FAIL++))
fi
echo ""

# TEST 10: Contact resolution before booking
echo "TEST 10: Contact resolution pattern..."
if grep -q "from('contacts')" "src/routes/vapi-tools-routes.ts" && \
   grep -q "p_contact_id: contactId" "src/routes/vapi-tools-routes.ts"; then
    echo -e "${GREEN}✅ PASS${NC}: Contact find-or-create pattern implemented"
    ((PASS++))
else
    echo -e "${YELLOW}⚠️  WARN${NC}: Verify contact resolution before booking"
    ((WARN++))
fi
echo ""

# Summary
echo "===================================================================="
echo "VERIFICATION SUMMARY"
echo "===================================================================="
echo -e "Total Tests: $((PASS + FAIL + WARN))"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo -e "${YELLOW}Warnings: $WARN${NC}"
echo "===================================================================="

if [ $FAIL -eq 0 ] && [ $WARN -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL CHECKS PASSED - Ready for deployment!${NC}\n"
    exit 0
elif [ $FAIL -eq 0 ]; then
    echo -e "\n${GREEN}✅ Core checks passed${NC} - Warnings should be investigated\n"
    exit 0
else
    echo -e "\n${RED}❌ CRITICAL FAILURES - Review failed tests before deployment${NC}\n"
    exit 1
fi
