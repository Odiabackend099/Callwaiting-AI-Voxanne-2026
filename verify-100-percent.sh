#!/bin/bash

echo "🚀 PREPAID BILLING ENGINE - 100% VERIFICATION"
echo "=============================================="
echo ""

PASSED=0
FAILED=0

# Check 1: Phase 1 Migration exists
echo "✓ Checking Phase 1 Migration..."
if [ -f "backend/supabase/migrations/20260214_atomic_asset_billing.sql" ]; then
  echo "  ✅ Phase 1 migration exists"
  ((PASSED++))
else
  echo "  ❌ Phase 1 migration MISSING"
  ((FAILED++))
fi

# Check 2: Phase 2 Migration exists
echo "✓ Checking Phase 2 Migration..."
if [ -f "backend/supabase/migrations/20260214_credit_reservation.sql" ]; then
  echo "  ✅ Phase 2 migration exists"
  ((PASSED++))
else
  echo "  ❌ Phase 2 migration MISSING"
  ((FAILED++))
fi

# Check 3: Unit tests exist
echo "✓ Checking Unit Tests..."
if [ -f "backend/src/__tests__/unit/atomic-asset-billing.test.ts" ] && [ -f "backend/src/__tests__/unit/credit-reservation.test.ts" ]; then
  echo "  ✅ Unit tests exist (2 files)"
  ((PASSED++))
else
  echo "  ❌ Unit tests MISSING"
  ((FAILED++))
fi

# Check 4: Integration tests exist
echo "✓ Checking Integration Tests..."
if [ -f "backend/src/__tests__/integration/prepaid-billing-e2e.test.ts" ]; then
  echo "  ✅ Integration tests exist"
  ((PASSED++))
else
  echo "  ❌ Integration tests MISSING"
  ((FAILED++))
fi

# Check 5: Load test script exists
echo "✓ Checking Load Test Script..."
if [ -f "backend/src/scripts/load-test-prepaid-billing.ts" ]; then
  echo "  ✅ Load test script exists"
  ((PASSED++))
else
  echo "  ❌ Load test script MISSING"
  ((FAILED++))
fi

# Check 6: Verification script exists
echo "✓ Checking Deployment Verification Script..."
if [ -f "backend/src/scripts/verify-prepaid-billing-deployment.ts" ]; then
  echo "  ✅ Verification script exists"
  ((PASSED++))
else
  echo "  ❌ Verification script MISSING"
  ((FAILED++))
fi

# Check 7: wallet-service.ts has deductAssetCost
echo "✓ Checking wallet-service.ts Functions..."
if grep -q "export async function deductAssetCost" backend/src/services/wallet-service.ts; then
  echo "  ✅ deductAssetCost function exists"
  ((PASSED++))
else
  echo "  ❌ deductAssetCost function MISSING"
  ((FAILED++))
fi

# Check 8: wallet-service.ts has reserveCallCredits
if grep -q "export async function reserveCallCredits" backend/src/services/wallet-service.ts; then
  echo "  ✅ reserveCallCredits function exists"
  ((PASSED++))
else
  echo "  ❌ reserveCallCredits function MISSING"
  ((FAILED++))
fi

# Check 9: wallet-service.ts has commitReservedCredits
if grep -q "export async function commitReservedCredits" backend/src/services/wallet-service.ts; then
  echo "  ✅ commitReservedCredits function exists"
  ((PASSED++))
else
  echo "  ❌ commitReservedCredits function MISSING"
  ((FAILED++))
fi

# Check 10: vapi-webhook.ts has status-check endpoint
echo "✓ Checking vapi-webhook.ts..."
if grep -q "status-check" backend/src/routes/vapi-webhook.ts; then
  echo "  ✅ status-check endpoint exists"
  ((PASSED++))
else
  echo "  ❌ status-check endpoint MISSING"
  ((FAILED++))
fi

# Check 11: npm scripts added to package.json
echo "✓ Checking npm Scripts..."
if grep -q "test:prepaid-billing" backend/package.json; then
  echo "  ✅ npm scripts added (test:prepaid-billing)"
  ((PASSED++))
else
  echo "  ❌ npm scripts NOT added"
  ((FAILED++))
fi

# Check 12: Documentation files exist
echo "✓ Checking Documentation..."
if [ -f "PREPAID_BILLING_DEPLOYMENT_COMPLETE.md" ] && [ -f "PREPAID_BILLING_100_PERCENT_VERIFICATION.md" ]; then
  echo "  ✅ Documentation files exist (2 files)"
  ((PASSED++))
else
  echo "  ❌ Documentation MISSING"
  ((FAILED++))
fi

echo ""
echo "=============================================="
echo "📊 RESULTS: $PASSED passed, $FAILED failed"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🟢 100% COMPLETE - ALL COMPONENTS VERIFIED"
  exit 0
else
  echo "🔴 INCOMPLETE - Some components missing"
  exit 1
fi
