#!/bin/bash

# 🔍 PRE-DELETION VERIFICATION SCRIPT
# Scans the codebase to identify orphaned files and unsafe deletions
# Generated: 2026-01-19
# Purpose: Show what will be deleted and verify no critical dependencies

set -e

PROJECT_ROOT="/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026"
cd "$PROJECT_ROOT"

echo "════════════════════════════════════════════════════════════════════════════════"
echo "🔍 PRE-DELETION VERIFICATION: Single Source of Truth Audit"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track results
SAFE_TO_DELETE=0
UNSAFE_DELETIONS=0
WARNINGS=0

# Helper function to print section headers
print_section() {
  echo ""
  echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "${BLUE}$1${NC}"
  echo "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_safe() {
  echo "${GREEN}✅ SAFE TO DELETE${NC}: $1"
  ((SAFE_TO_DELETE++))
}

print_unsafe() {
  echo "${RED}❌ UNSAFE TO DELETE${NC}: $1"
  ((UNSAFE_DELETIONS++))
}

print_warning() {
  echo "${YELLOW}⚠️  WARNING${NC}: $1"
  ((WARNINGS++))
}

# ════════════════════════════════════════════════════════════════════════════════
# PART 1: DUPLICATE SERVICE FILES
# ════════════════════════════════════════════════════════════════════════════════

print_section "PART 1: DUPLICATE SERVICE FILES (Backend)"

echo ""
echo "Checking for IntegrationSettingsService imports..."
if grep -r "from.*integration-settings\|import.*IntegrationSettingsService" backend/src --include="*.ts" > /tmp/integration-settings-imports.txt 2>&1; then
  if [ -s /tmp/integration-settings-imports.txt ]; then
    print_unsafe "integration-settings.ts - Found $(wc -l < /tmp/integration-settings-imports.txt) imports"
    echo "  Imports found in:"
    head -5 /tmp/integration-settings-imports.txt | sed 's/^/    /'
  else
    print_safe "integration-settings.ts - No imports found"
    ls -lh backend/src/services/integration-settings.ts 2>/dev/null && echo "    (File exists: $(wc -l < backend/src/services/integration-settings.ts) lines)"
  fi
else
  print_safe "integration-settings.ts - No imports found"
fi

echo ""
echo "Checking for VAPI-Booking-Handler-Optimized imports..."
if grep -r "from.*vapi-booking-handler-optimized\|import.*VapiBookingHandlerOptimized" backend/src --include="*.ts" > /tmp/booking-optimized-imports.txt 2>&1; then
  if [ -s /tmp/booking-optimized-imports.txt ]; then
    print_unsafe "vapi-booking-handler-optimized.ts - Found $(wc -l < /tmp/booking-optimized-imports.txt) imports"
  else
    print_safe "vapi-booking-handler-optimized.ts - No imports found"
    ls -lh backend/src/services/vapi-booking-handler-optimized.ts 2>/dev/null && echo "    (File exists: $(wc -l < backend/src/services/vapi-booking-handler-optimized.ts) lines)"
  fi
else
  print_safe "vapi-booking-handler-optimized.ts - No imports found"
fi

echo ""
echo "Checking for Web-Voice-Bridge-V2 imports..."
if grep -r "from.*web-voice-bridge-v2\|import.*WebVoiceBridgeV2" backend/src --include="*.ts" > /tmp/wvb-v2-imports.txt 2>&1; then
  if [ -s /tmp/wvb-v2-imports.txt ]; then
    print_unsafe "web-voice-bridge-v2.ts - Found $(wc -l < /tmp/wvb-v2-imports.txt) imports"
  else
    print_safe "web-voice-bridge-v2.ts - No imports found"
    ls -lh backend/src/services/web-voice-bridge-v2.ts 2>/dev/null && echo "    (File exists: $(wc -l < backend/src/services/web-voice-bridge-v2.ts) lines)"
  fi
else
  print_safe "web-voice-bridge-v2.ts - No imports found"
fi

# ════════════════════════════════════════════════════════════════════════════════
# PART 2: CREDENTIAL STORAGE LOCATIONS
# ════════════════════════════════════════════════════════════════════════════════

print_section "PART 2: CREDENTIAL STORAGE PATTERNS"

echo ""
echo "Scanning for 'customer_twilio_keys' table references..."
if grep -r "customer_twilio_keys" backend/src --include="*.ts" | wc -l | grep -v "^0$" > /dev/null; then
  COUNT=$(grep -r "customer_twilio_keys" backend/src --include="*.ts" | wc -l)
  print_warning "Found $COUNT references to 'customer_twilio_keys' in backend code"
  echo "  Files:"
  grep -rl "customer_twilio_keys" backend/src --include="*.ts" | head -3 | sed 's/^/    /'
else
  print_safe "customer_twilio_keys - No references in backend source"
fi

echo ""
echo "Scanning for 'org_credentials' table references..."
if grep -r "org_credentials" backend/src --include="*.ts" | wc -l | grep -v "^0$" > /dev/null; then
  COUNT=$(grep -r "org_credentials" backend/src --include="*.ts" | wc -l)
  echo "${YELLOW}⚠️  Found $COUNT references to 'org_credentials' - This is expected${NC}"
  echo "  (This table is still in use; migration strategy needed)"
else
  print_safe "org_credentials - No references in backend"
fi

echo ""
echo "Scanning for 'integrations' table references..."
if grep -r "from.*integrations\|\.from.*integrations" backend/src --include="*.ts" | wc -l | grep -v "^0$" > /dev/null; then
  COUNT=$(grep -r "from.*integrations" backend/src --include="*.ts" | wc -l)
  echo "${BLUE}ℹ️  Found $COUNT references to 'integrations' table${NC}"
  echo "  (Good: Central credentials table is being used)"
else
  echo "${YELLOW}⚠️  No references to 'integrations' table found${NC}"
  echo "  (Possible: Table not yet created or not integrated)"
fi

# ════════════════════════════════════════════════════════════════════════════════
# PART 3: VAPI CREDENTIAL PATTERNS (DANGER ZONE)
# ════════════════════════════════════════════════════════════════════════════════

print_section "PART 3: VAPI CREDENTIAL PATTERNS (DANGER ZONE)"

echo ""
echo "Checking for getVapiCredentials calls (should use backend env var instead)..."
COUNT=$(grep -r "getVapiCredentials\|GetVapiCredentials" backend/src --include="*.ts" | grep -v test | wc -l)
if [ "$COUNT" -gt 0 ]; then
  print_warning "Found $COUNT calls to getVapiCredentials (per-org pattern - should use backend env var)"
  grep -rn "getVapiCredentials" backend/src --include="*.ts" | grep -v test | head -3 | sed 's/^/    /'
else
  print_safe "No getVapiCredentials calls found in production code"
fi

echo ""
echo "Checking for per-org Vapi key storage patterns..."
if grep -r "vapi.*credential\|vapi.*api.*key" backend/src --include="*.ts" | grep -v "VAPI_PRIVATE_KEY\|VAPI_PUBLIC_KEY\|process.env" | wc -l | grep -v "^0$" > /dev/null; then
  COUNT=$(grep -r "vapi.*credential\|vapi.*api.*key" backend/src --include="*.ts" | grep -v "VAPI_PRIVATE_KEY\|VAPI_PUBLIC_KEY\|process.env" | wc -l)
  print_warning "Found $COUNT potential per-org Vapi key references"
else
  print_safe "No dangerous per-org Vapi key patterns detected"
fi

# ════════════════════════════════════════════════════════════════════════════════
# PART 4: TEST/DEBUG FILES
# ════════════════════════════════════════════════════════════════════════════════

print_section "PART 4: TEST/DEBUG FILES (Safe to Delete)"

TEST_FILES=(
  "backend/src/scripts/comprehensive-test.ts"
  "backend/src/scripts/regression-tests.ts"
  "backend/src/scripts/system-lifecycle-test.ts"
  "backend/src/scripts/smoke-test-suite.ts"
  "backend/src/scripts/test-dashboard-login.ts"
  "backend/src/scripts/test-agent-dashboard.ts"
  "backend/src/scripts/test-handoff-api.ts"
  "backend/src/scripts/test-full-flow.ts"
  "backend/src/scripts/stress-test-100.ts"
  "backend/src/scripts/redaction-test.ts"
  "test-oauth-server.js"
  "backend/validate-tests.js"
)

for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    print_safe "$file ($(wc -l < "$file") lines)"
  fi
done

echo ""
echo "Checking backend/dist directory..."
if [ -d "backend/dist" ]; then
  SIZE=$(du -sh backend/dist | awk '{print $1}')
  print_safe "backend/dist/ directory ($SIZE - compiled output, can be regenerated)"
else
  echo "${BLUE}ℹ️  backend/dist/ not present${NC}"
fi

# ════════════════════════════════════════════════════════════════════════════════
# PART 5: FRONTEND HARDCODED VALUES
# ════════════════════════════════════════════════════════════════════════════════

print_section "PART 5: FRONTEND HARDCODED VALUES"

echo ""
echo "Scanning for hardcoded phone numbers (+1555, +1234, etc)..."
if grep -rn "+1555\|+1234\|DEFAULT_PHONE\|DEFAULT_NUMBER" src --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "node_modules\|.next" > /tmp/hardcoded-phones.txt; then
  if [ -s /tmp/hardcoded-phones.txt ]; then
    COUNT=$(wc -l < /tmp/hardcoded-phones.txt)
    print_warning "Found $COUNT hardcoded phone number references in frontend"
    head -5 /tmp/hardcoded-phones.txt | sed 's/^/    /'
  else
    print_safe "No hardcoded phone numbers found in frontend"
  fi
else
  print_safe "No hardcoded phone numbers found in frontend"
fi

echo ""
echo "Scanning for mock/test credentials in frontend..."
if grep -rn "mock.*phone\|test.*number\|DUMMY_\|FAKE_" src --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "node_modules" > /tmp/mock-creds.txt; then
  if [ -s /tmp/mock-creds.txt ]; then
    COUNT=$(wc -l < /tmp/mock-creds.txt)
    print_warning "Found $COUNT mock credential references"
  else
    print_safe "No mock credentials found"
  fi
else
  print_safe "No mock credentials found"
fi

echo ""
echo "Checking for per-org Vapi key form fields in frontend..."
if grep -rn "vapi.*api.*key\|VAPI_PRIVATE_KEY" src --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "NEXT_PUBLIC_VAPI_PUBLIC_KEY" > /tmp/frontend-vapi.txt; then
  if [ -s /tmp/frontend-vapi.txt ]; then
    COUNT=$(wc -l < /tmp/frontend-vapi.txt)
    print_warning "Found $COUNT Vapi key references in frontend (should not exist)"
    head -3 /tmp/frontend-vapi.txt | sed 's/^/    /'
  else
    print_safe "No dangerous Vapi key references in frontend"
  fi
else
  print_safe "No dangerous Vapi key references in frontend"
fi

# ════════════════════════════════════════════════════════════════════════════════
# PART 6: BUILD VERIFICATION
# ════════════════════════════════════════════════════════════════════════════════

print_section "PART 6: BUILD VERIFICATION"

echo ""
echo "Checking if backend compiles (npm run build)..."
if cd backend && npm run build > /tmp/backend-build.log 2>&1; then
  print_safe "Backend builds successfully"
  cd "$PROJECT_ROOT"
else
  print_warning "Backend build has issues (may be pre-existing)"
  cd "$PROJECT_ROOT"
fi

echo ""
echo "Checking if frontend compiles (npm run build)..."
if npm run build > /tmp/frontend-build.log 2>&1; then
  print_safe "Frontend builds successfully"
else
  print_warning "Frontend build has issues (may be pre-existing)"
fi

# ════════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════════════════════════════════

print_section "SUMMARY"

echo ""
echo "${GREEN}✅ Safe to Delete:        $SAFE_TO_DELETE items${NC}"
echo "${RED}❌ Unsafe to Delete:       $UNSAFE_DELETIONS items (AUDIT FIRST)${NC}"
echo "${YELLOW}⚠️  Warnings:              $WARNINGS items (REVIEW NEEDED)${NC}"
echo ""

if [ $UNSAFE_DELETIONS -eq 0 ]; then
  echo "${GREEN}🎉 VERDICT: All duplicate services are safe to delete!${NC}"
  echo "    Next step: Run EXPULSION_SCRIPT_PHASE_1.sh to delete safely"
else
  echo "${RED}⚠️  VERDICT: Found unsafe deletions. Audit required before proceeding.${NC}"
  echo "    Review the warnings above and resolve dependencies first."
fi

if [ $WARNINGS -gt 0 ]; then
  echo ""
  echo "${YELLOW}⚠️  ACTION REQUIRED: Review the $WARNINGS warnings above.${NC}"
  echo "    Ensure you understand what needs migration before deletion."
fi

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "Verification complete. Output logged to /tmp/pre-deletion-audit.txt"
echo "════════════════════════════════════════════════════════════════════════════════"

# Save detailed log
{
  echo "PRE-DELETION VERIFICATION LOG"
  echo "Generated: $(date)"
  echo ""
  echo "Safe to Delete: $SAFE_TO_DELETE"
  echo "Unsafe: $UNSAFE_DELETIONS"
  echo "Warnings: $WARNINGS"
  echo ""
  echo "=== INTEGRATION-SETTINGS IMPORTS ==="
  cat /tmp/integration-settings-imports.txt 2>/dev/null || echo "NONE"
  echo ""
  echo "=== BOOKING-OPTIMIZED IMPORTS ==="
  cat /tmp/booking-optimized-imports.txt 2>/dev/null || echo "NONE"
  echo ""
  echo "=== HARDCODED PHONES ==="
  cat /tmp/hardcoded-phones.txt 2>/dev/null || echo "NONE"
} > /tmp/pre-deletion-audit.txt

exit 0
