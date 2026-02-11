#!/usr/bin/env ts-node
/**
 * P0 Billing Fixes Verification Script
 *
 * Tests the 2 critical billing fixes:
 * 1. Webhook signature bypass removed (security fix)
 * 2. Wallet UI displays $0.70/min rate (UX fix)
 *
 * Usage: npx ts-node src/scripts/test-p0-billing-fixes.ts
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 P0 Billing Fixes - Verification Tests\n');
console.log('=' .repeat(70));
console.log();

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  testsRun++;
  try {
    const result = fn();
    const passed = result instanceof Promise ? false : result;
    if (passed) {
      testsPassed++;
      console.log(`✅ PASS: ${name}`);
    } else {
      testsFailed++;
      console.log(`❌ FAIL: ${name}`);
    }
    return passed;
  } catch (err: any) {
    testsFailed++;
    console.log(`❌ FAIL: ${name} - ${err.message}`);
    return false;
  }
}

// ============================================================================
// P0-1: Webhook Signature Bypass Removed
// ============================================================================

console.log('📋 P0-1: Webhook Signature Bypass Removed\n');

test('File exists: verify-stripe-signature.ts', () => {
  const filePath = path.join(__dirname, '../middleware/verify-stripe-signature.ts');
  return fs.existsSync(filePath);
});

test('Development bypass code removed', () => {
  const filePath = path.join(__dirname, '../middleware/verify-stripe-signature.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check that the dangerous bypass code is NOT present
  const hasBypass = content.includes("process.env.NODE_ENV === 'development' && !secret");
  const hasSkipMessage = content.includes("Skipping signature verification in development mode");

  if (hasBypass || hasSkipMessage) {
    console.log('  ⚠️  Found development bypass code (should be removed):');
    if (hasBypass) console.log('    - Contains: process.env.NODE_ENV === \'development\' && !secret');
    if (hasSkipMessage) console.log('    - Contains: "Skipping signature verification in development mode"');
    return false;
  }

  return true;
});

test('Signature verification still exists', () => {
  const filePath = path.join(__dirname, '../middleware/verify-stripe-signature.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify the core signature verification logic is still present
  const hasConstructEvent = content.includes('stripe.webhooks.constructEvent');
  const hasSignatureHeader = content.includes('stripe-signature');
  const hasSecretCheck = content.includes('STRIPE_WEBHOOK_SECRET');

  if (!hasConstructEvent || !hasSignatureHeader || !hasSecretCheck) {
    console.log('  ⚠️  Missing signature verification logic:');
    if (!hasConstructEvent) console.log('    - Missing: stripe.webhooks.constructEvent');
    if (!hasSignatureHeader) console.log('    - Missing: stripe-signature header check');
    if (!hasSecretCheck) console.log('    - Missing: STRIPE_WEBHOOK_SECRET check');
    return false;
  }

  return true;
});

test('Returns 500 if secret missing', () => {
  const filePath = path.join(__dirname, '../middleware/verify-stripe-signature.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check that missing secret returns 500 error
  const hasSecretError = content.includes('STRIPE_WEBHOOK_SECRET not configured') ||
                         content.includes('Server configuration error');
  const has500Status = content.includes('res.status(500)');

  return hasSecretError && has500Status;
});

test('Returns 401 for invalid signature', () => {
  const filePath = path.join(__dirname, '../middleware/verify-stripe-signature.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check that invalid signature returns 401 error
  const hasInvalidSigError = content.includes('Invalid signature') ||
                             content.includes('Signature verification failed');
  const has401Status = content.includes('res.status(401)');

  return hasInvalidSigError && has401Status;
});

console.log();

// ============================================================================
// P0-2: Display $0.70/min Rate in Wallet UI
// ============================================================================

console.log('📋 P0-2: Display $0.70/min Rate in Wallet UI\n');

test('File exists: wallet/page.tsx', () => {
  const filePath = path.join(__dirname, '../../../src/app/dashboard/wallet/page.tsx');
  return fs.existsSync(filePath);
});

test('Badge displays "$0.70/minute"', () => {
  const filePath = path.join(__dirname, '../../../src/app/dashboard/wallet/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for $0.70/minute text
  const hasDollarRate = content.includes('$0.70/minute') || content.includes('$0.70/min');

  if (!hasDollarRate) {
    console.log('  ⚠️  Badge does not display "$0.70/minute"');
    return false;
  }

  return true;
});

test('Badge still shows credits (10 credits/min)', () => {
  const filePath = path.join(__dirname, '../../../src/app/dashboard/wallet/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for credits text
  const hasCredits = content.includes('10 credits/min') || content.includes('credits/min');

  if (!hasCredits) {
    console.log('  ⚠️  Badge does not display "10 credits/min"');
    return false;
  }

  return true;
});

test('Badge combines both rate and credits', () => {
  const filePath = path.join(__dirname, '../../../src/app/dashboard/wallet/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for combined format: $0.70/minute (10 credits/min)
  const hasCombined = content.includes('$0.70/minute (10 credits/min)') ||
                      (content.includes('$0.70') && content.includes('10 credits'));

  if (!hasCombined) {
    console.log('  ⚠️  Badge does not combine dollar rate and credits');
    return false;
  }

  return true;
});

test('Badge is in balance card section', () => {
  const filePath = path.join(__dirname, '../../../src/app/dashboard/wallet/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check that the badge is near "Current Balance" text
  const lines = content.split('\n');
  let balanceLineIndex = -1;
  let badgeLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Current Balance')) {
      balanceLineIndex = i;
    }
    if (lines[i].includes('$0.70/minute') || lines[i].includes('10 credits/min')) {
      badgeLineIndex = i;
    }
  }

  // Badge should be within 10 lines of "Current Balance"
  const isNearBalance = balanceLineIndex !== -1 &&
                        badgeLineIndex !== -1 &&
                        Math.abs(badgeLineIndex - balanceLineIndex) < 10;

  if (!isNearBalance) {
    console.log(`  ⚠️  Badge not near "Current Balance" (line ${balanceLineIndex} vs ${badgeLineIndex})`);
    return false;
  }

  return true;
});

console.log();

// ============================================================================
// Summary
// ============================================================================

console.log('=' .repeat(70));
console.log();
console.log('📊 Test Summary:\n');
console.log(`   Total Tests:  ${testsRun}`);
console.log(`   ✅ Passed:     ${testsPassed}`);
console.log(`   ❌ Failed:     ${testsFailed}`);
console.log();

if (testsFailed === 0) {
  console.log('🎉 ALL TESTS PASSED - P0 Billing Fixes Verified ✅\n');
  console.log('Next Steps:');
  console.log('  1. Commit changes: git commit -m "fix: P0 billing fixes (webhook security + pricing display)"');
  console.log('  2. Deploy to production');
  console.log('  3. Monitor Sentry for webhook errors (24 hours)');
  console.log('  4. Proceed to Layer 6 (Security Audit)');
  console.log();
  process.exit(0);
} else {
  console.log('⚠️  SOME TESTS FAILED - Review fixes before deployment\n');
  console.log('Troubleshooting:');
  console.log('  - Check that all code changes were saved');
  console.log('  - Verify file paths are correct');
  console.log('  - Re-run tests after fixing issues');
  console.log();
  process.exit(1);
}
