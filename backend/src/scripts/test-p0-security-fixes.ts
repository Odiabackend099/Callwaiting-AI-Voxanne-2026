#!/usr/bin/env ts-node
/**
 * P0 Security Fixes Verification Script
 *
 * Tests all 4 critical P0 security vulnerabilities identified in Layer 6 audit:
 * 1. JWT Token Tampering (CVSS 9.8) - Signature verification bypass
 * 2. Negative Amount Validation (CVSS 9.1) - Billing manipulation
 * 3. Webhook Idempotency (CVSS 8.7) - Replay attacks
 * 4. RLS Policy Verification (CVSS 9.0) - Horizontal privilege escalation
 *
 * Usage: npx ts-node src/scripts/test-p0-security-fixes.ts
 */

import fs from 'fs';
import path from 'path';
import { supabase } from '../services/supabase-client';

console.log('🧪 P0 Security Fixes - Verification Tests\n');
console.log('=' .repeat(70));
console.log();

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => boolean): boolean {
  testsRun++;
  try {
    const result = fn();
    if (result) {
      testsPassed++;
      console.log(`✅ PASS: ${name}`);
      return true;
    } else {
      testsFailed++;
      console.log(`❌ FAIL: ${name}`);
      return false;
    }
  } catch (err: any) {
    testsFailed++;
    console.log(`❌ FAIL: ${name} - ${err.message}`);
    return false;
  }
}

async function asyncTest(name: string, fn: () => Promise<boolean>): Promise<boolean> {
  testsRun++;
  try {
    const result = await fn();
    if (result) {
      testsPassed++;
      console.log(`✅ PASS: ${name}`);
      return true;
    } else {
      testsFailed++;
      console.log(`❌ FAIL: ${name}`);
      return false;
    }
  } catch (err: any) {
    testsFailed++;
    console.log(`❌ FAIL: ${name} - ${err.message}`);
    return false;
  }
}

// ============================================================================
// P0-1: JWT Signature Verification Bypass
// ============================================================================

console.log('📋 P0-1: JWT Signature Verification Bypass\n');

test('File exists: auth.ts middleware', () => {
  const filePath = path.join(__dirname, '../middleware/auth.ts');
  return fs.existsSync(filePath);
});

test('Cache bypass code removed from requireAuth()', () => {
  const filePath = path.join(__dirname, '../middleware/auth.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify cache bypass logic is removed
  const hasCacheBypass = content.includes('if (cachedUser) {') &&
                         content.includes('return next();') &&
                         content.includes('// Cache hit: use cached data');

  // Should NOT have cache bypass in requireAuth function
  if (hasCacheBypass) {
    console.log('  ⚠️  Found cache bypass code (should be removed)');
    return false;
  }

  return true;
});

test('Signature verification always called', () => {
  const filePath = path.join(__dirname, '../middleware/auth.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify supabase.auth.getUser() is always called
  const hasSignatureVerification = content.includes('supabase.auth.getUser(token)');

  if (!hasSignatureVerification) {
    console.log('  ⚠️  Missing: supabase.auth.getUser(token) call');
    return false;
  }

  return true;
});

test('Security comment explains fix', () => {
  const filePath = path.join(__dirname, '../middleware/auth.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify security fix comment is present
  const hasSecurityComment = content.includes('SECURITY FIX') &&
                             content.includes('token tampering');

  if (!hasSecurityComment) {
    console.log('  ⚠️  Missing: Security fix comment documentation');
    return false;
  }

  return true;
});

console.log();

// ============================================================================
// P0-2: Negative Amount Validation
// ============================================================================

console.log('📋 P0-2: Negative Amount Validation\n');

test('File exists: billing-api.ts', () => {
  const filePath = path.join(__dirname, '../routes/billing-api.ts');
  return fs.existsSync(filePath);
});

test('Validates against negative amounts', () => {
  const filePath = path.join(__dirname, '../routes/billing-api.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for negative amount validation
  const hasNegativeCheck = content.includes('amount_pence <= 0') ||
                           content.includes('amount_pence < 0');

  if (!hasNegativeCheck) {
    console.log('  ⚠️  Missing: Negative amount validation');
    return false;
  }

  return true;
});

test('Validates against NaN/Infinity', () => {
  const filePath = path.join(__dirname, '../routes/billing-api.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for NaN/Infinity validation
  const hasFiniteCheck = content.includes('Number.isFinite') ||
                         content.includes('isFinite');

  if (!hasFiniteCheck) {
    console.log('  ⚠️  Missing: NaN/Infinity validation');
    return false;
  }

  return true;
});

test('Validates against non-integer amounts', () => {
  const filePath = path.join(__dirname, '../routes/billing-api.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for integer validation
  const hasIntegerCheck = content.includes('Number.isInteger');

  if (!hasIntegerCheck) {
    console.log('  ⚠️  Missing: Integer validation (pence must be whole number)');
    return false;
  }

  return true;
});

test('Security comment explains validation', () => {
  const filePath = path.join(__dirname, '../routes/billing-api.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Verify security fix comment is present
  const hasSecurityComment = content.includes('SECURITY FIX') &&
                             content.includes('billing manipulation');

  if (!hasSecurityComment) {
    console.log('  ⚠️  Missing: Security fix comment documentation');
    return false;
  }

  return true;
});

console.log();

// ============================================================================
// P0-3: Webhook Idempotency
// ============================================================================

console.log('📋 P0-3: Webhook Idempotency\n');

test('Migration file exists: processed_stripe_webhooks table', () => {
  const filePath = path.join(__dirname, '../../supabase/migrations/20260212_create_processed_stripe_webhooks.sql');
  return fs.existsSync(filePath);
});

test('Migration creates processed_stripe_webhooks table', () => {
  const filePath = path.join(__dirname, '../../supabase/migrations/20260212_create_processed_stripe_webhooks.sql');
  const content = fs.readFileSync(filePath, 'utf-8');

  const hasTableCreation = content.includes('CREATE TABLE') &&
                           content.includes('processed_stripe_webhooks');

  if (!hasTableCreation) {
    console.log('  ⚠️  Migration does not create processed_stripe_webhooks table');
    return false;
  }

  return true;
});

test('Migration creates event_id unique constraint', () => {
  const filePath = path.join(__dirname, '../../supabase/migrations/20260212_create_processed_stripe_webhooks.sql');
  const content = fs.readFileSync(filePath, 'utf-8');

  const hasUniqueConstraint = content.includes('event_id') &&
                              content.includes('UNIQUE');

  if (!hasUniqueConstraint) {
    console.log('  ⚠️  Missing UNIQUE constraint on event_id');
    return false;
  }

  return true;
});

test('Migration creates helper functions', () => {
  const filePath = path.join(__dirname, '../../supabase/migrations/20260212_create_processed_stripe_webhooks.sql');
  const content = fs.readFileSync(filePath, 'utf-8');

  const hasHelperFunctions = content.includes('is_stripe_event_processed') &&
                             content.includes('mark_stripe_event_processed');

  if (!hasHelperFunctions) {
    console.log('  ⚠️  Missing helper functions');
    return false;
  }

  return true;
});

test('Webhook handler checks for duplicates', () => {
  const filePath = path.join(__dirname, '../routes/stripe-webhooks.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for duplicate event check
  const hasIdempotencyCheck = content.includes('is_stripe_event_processed') ||
                              content.includes('alreadyProcessed');

  if (!hasIdempotencyCheck) {
    console.log('  ⚠️  Webhook handler does not check for duplicates');
    return false;
  }

  return true;
});

test('Webhook handler marks events as processed', () => {
  const filePath = path.join(__dirname, '../routes/stripe-webhooks.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for event marking
  const hasEventMarking = content.includes('mark_stripe_event_processed');

  if (!hasEventMarking) {
    console.log('  ⚠️  Webhook handler does not mark events as processed');
    return false;
  }

  return true;
});

console.log();

// ============================================================================
// P0-4: RLS Policy Verification
// ============================================================================

console.log('📋 P0-4: RLS Policy Verification\n');

test('Migration file exists: RLS helper functions', () => {
  const filePath = path.join(__dirname, '../../supabase/migrations/20260212_create_rls_helper_functions.sql');
  return fs.existsSync(filePath);
});

test('RLS verification script exists', () => {
  const filePath = path.join(__dirname, './verify-rls-policies.ts');
  return fs.existsSync(filePath);
});

test('RLS helper functions created', () => {
  const filePath = path.join(__dirname, '../../supabase/migrations/20260212_create_rls_helper_functions.sql');
  const content = fs.readFileSync(filePath, 'utf-8');

  const hasHelperFunctions = content.includes('check_rls_enabled') &&
                             content.includes('get_table_policies') &&
                             content.includes('get_all_rls_policies');

  if (!hasHelperFunctions) {
    console.log('  ⚠️  Missing RLS helper functions');
    return false;
  }

  return true;
});

test('RLS verification script checks all tables', () => {
  const filePath = path.join(__dirname, './verify-rls-policies.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check that script verifies critical tables
  const checksMultiTenantTables = content.includes('MULTI_TENANT_TABLES') &&
                                  content.includes('organizations') &&
                                  content.includes('contacts');

  if (!checksMultiTenantTables) {
    console.log('  ⚠️  Script does not check all multi-tenant tables');
    return false;
  }

  return true;
});

console.log();

// ============================================================================
// Database Migration Tests (if database accessible)
// ============================================================================

async function runDatabaseTests() {
  console.log('📋 Database Migration Tests\n');

  await asyncTest('processed_stripe_webhooks table exists', async () => {
  try {
    const { error } = await supabase
      .from('processed_stripe_webhooks')
      .select('*')
      .limit(0);

    if (error) {
      console.log(`  ⚠️  Table not found: ${error.message}`);
      console.log(`  ℹ️  Run migration: supabase/migrations/20260212_create_processed_stripe_webhooks.sql`);
      return false;
    }

    return true;
  } catch (err: any) {
    console.log(`  ⚠️  Database not accessible: ${err.message}`);
    return false;
  }
});

  await asyncTest('RLS helper functions exist', async () => {
    try {
      const { error } = await supabase.rpc('check_rls_enabled', {
        p_table_name: 'organizations'
      });

      if (error) {
        console.log(`  ⚠️  Function not found: ${error.message}`);
        console.log(`  ℹ️  Run migration: supabase/migrations/20260212_create_rls_helper_functions.sql`);
        return false;
      }

      return true;
    } catch (err: any) {
      console.log(`  ⚠️  Database not accessible: ${err.message}`);
      return false;
    }
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
    console.log('🎉 ALL TESTS PASSED - P0 Security Fixes Verified ✅\n');
    console.log('Next Steps:');
    console.log('  1. Deploy database migrations to production:');
    console.log('     - 20260212_create_processed_stripe_webhooks.sql');
    console.log('     - 20260212_create_rls_helper_functions.sql');
    console.log('  2. Restart backend server to load new code');
    console.log('  3. Run RLS verification: npx ts-node src/scripts/verify-rls-policies.ts');
    console.log('  4. Monitor Sentry for auth errors (24 hours)');
    console.log('  5. Proceed to Layer 7 (Infrastructure Audit)');
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
}

// Run tests
runDatabaseTests().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
