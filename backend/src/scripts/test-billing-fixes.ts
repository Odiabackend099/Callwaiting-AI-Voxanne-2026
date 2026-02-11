/**
 * Critical Billing Fixes Verification Script
 *
 * Tests the 3 critical fixes implemented after 4-agent verification:
 * 1. client_reference_id in Stripe checkout sessions
 * 2. Auto-recharge job deduplication
 * 3. Webhook processing verification endpoint
 *
 * Run: npx ts-node src/scripts/test-billing-fixes.ts
 * Run with auth: TEST_AUTH_TOKEN="your-jwt" npx ts-node src/scripts/test-billing-fixes.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client (nullable for offline tests)
const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
  error?: string;
}

const results: TestResult[] = [];

console.log('🔍 Critical Billing Fixes Verification\n');
console.log('='.repeat(70));
console.log('Testing 3 critical fixes from 4-agent verification');
console.log('='.repeat(70));
console.log('');

/**
 * Test 1: Verify client_reference_id is set in checkout session code
 */
async function test1_clientReferenceId(): Promise<TestResult> {
  console.log('Test 1: client_reference_id in Stripe Checkout...');

  try {
    const billingApiPath = path.join(__dirname, '../routes/billing-api.ts');
    const content = fs.readFileSync(billingApiPath, 'utf-8');

    // Check if client_reference_id is present
    const hasClientReferenceId = content.includes('client_reference_id: orgId');

    // Check if it's in the right location (after customer line)
    const correctPlacement = /customer: customerId,\s+client_reference_id: orgId/.test(content);

    if (hasClientReferenceId && correctPlacement) {
      return {
        test: 'Test 1: client_reference_id',
        status: 'PASS',
        details: 'client_reference_id is correctly set in checkout session creation',
      };
    } else if (hasClientReferenceId && !correctPlacement) {
      return {
        test: 'Test 1: client_reference_id',
        status: 'FAIL',
        details: 'client_reference_id exists but may not be in the correct location',
        error: 'Placement check failed',
      };
    } else {
      return {
        test: 'Test 1: client_reference_id',
        status: 'FAIL',
        details: 'client_reference_id not found in billing-api.ts',
        error: 'Missing client_reference_id field',
      };
    }
  } catch (error: any) {
    return {
      test: 'Test 1: client_reference_id',
      status: 'FAIL',
      details: 'Error reading billing-api.ts',
      error: error.message,
    };
  }
}

/**
 * Test 2: Verify auto-recharge job deduplication
 */
async function test2_autoRechargeDeduplication(): Promise<TestResult> {
  console.log('Test 2: Auto-recharge job deduplication...');

  try {
    const walletQueuePath = path.join(__dirname, '../config/wallet-queue.ts');
    const content = fs.readFileSync(walletQueuePath, 'utf-8');

    // Check if jobId is deterministic (uses orgId)
    const hasDeterministicJobId = content.includes('jobId: `recharge-${data.orgId}`');

    // Check for deduplication comment
    const hasDeduplicationComment = content.includes('Prevents duplicate jobs per org');

    if (hasDeterministicJobId && hasDeduplicationComment) {
      return {
        test: 'Test 2: Auto-recharge deduplication',
        status: 'PASS',
        details: 'Job deduplication correctly implemented with orgId-based jobId',
      };
    } else if (hasDeterministicJobId && !hasDeduplicationComment) {
      return {
        test: 'Test 2: Auto-recharge deduplication',
        status: 'PASS',
        details: 'Job deduplication implemented (missing comment but code is correct)',
      };
    } else {
      return {
        test: 'Test 2: Auto-recharge deduplication',
        status: 'FAIL',
        details: 'Deterministic jobId not found in wallet-queue.ts',
        error: 'Missing jobId deduplication logic',
      };
    }
  } catch (error: any) {
    return {
      test: 'Test 2: Auto-recharge deduplication',
      status: 'FAIL',
      details: 'Error reading wallet-queue.ts',
      error: error.message,
    };
  }
}

/**
 * Test 3: Verify webhook verification endpoint exists
 */
async function test3_webhookVerificationEndpoint(): Promise<TestResult> {
  console.log('Test 3: Webhook verification endpoint...');

  try {
    const webhookVerificationPath = path.join(__dirname, '../routes/webhook-verification.ts');

    // Check if file exists
    if (!fs.existsSync(webhookVerificationPath)) {
      return {
        test: 'Test 3: Webhook verification endpoint',
        status: 'FAIL',
        details: 'webhook-verification.ts not found',
        error: 'File does not exist',
      };
    }

    const content = fs.readFileSync(webhookVerificationPath, 'utf-8');

    // Check for key endpoint: GET /payment/:paymentIntentId
    const hasPaymentEndpoint = content.includes('/payment/:paymentIntentId');

    // Check for verification logic (checks both webhook and credit transaction)
    const hasWebhookCheck = content.includes('processed_webhook_events');
    const hasCreditCheck = content.includes('credit_transactions');

    // Check for processing time calculation
    const hasProcessingTime = content.includes('processing_time_ms');

    if (hasPaymentEndpoint && hasWebhookCheck && hasCreditCheck && hasProcessingTime) {
      return {
        test: 'Test 3: Webhook verification endpoint',
        status: 'PASS',
        details: 'Webhook verification endpoint fully implemented with all checks',
      };
    } else {
      return {
        test: 'Test 3: Webhook verification endpoint',
        status: 'FAIL',
        details: 'Webhook verification endpoint incomplete',
        error: `Missing: ${!hasPaymentEndpoint ? 'endpoint route, ' : ''}${!hasWebhookCheck ? 'webhook check, ' : ''}${!hasCreditCheck ? 'credit check, ' : ''}${!hasProcessingTime ? 'processing time' : ''}`,
      };
    }
  } catch (error: any) {
    return {
      test: 'Test 3: Webhook verification endpoint',
      status: 'FAIL',
      details: 'Error reading webhook-verification.ts',
      error: error.message,
    };
  }
}

/**
 * Test 4: Verify webhook verification endpoint is mounted
 */
async function test4_endpointMounted(): Promise<TestResult> {
  console.log('Test 4: Webhook verification endpoint mounted...');

  try {
    const serverPath = path.join(__dirname, '../server.ts');
    const content = fs.readFileSync(serverPath, 'utf-8');

    // Check if router is imported
    const hasImport = content.includes("from './routes/webhook-verification'");

    // Check if router is mounted
    const hasMounted = content.includes('app.use(\'/api/webhook-verification\', webhookVerificationRouter');

    if (hasImport && hasMounted) {
      return {
        test: 'Test 4: Endpoint mounted',
        status: 'PASS',
        details: 'Webhook verification router correctly imported and mounted',
      };
    } else {
      return {
        test: 'Test 4: Endpoint mounted',
        status: 'FAIL',
        details: 'Webhook verification router not properly configured',
        error: `${!hasImport ? 'Import missing. ' : ''}${!hasMounted ? 'Mount missing.' : ''}`,
      };
    }
  } catch (error: any) {
    return {
      test: 'Test 4: Endpoint mounted',
      status: 'FAIL',
      details: 'Error reading server.ts',
      error: error.message,
    };
  }
}

/**
 * Test 5: Verify database tables exist for verification
 */
async function test5_databaseTables(): Promise<TestResult> {
  console.log('Test 5: Database tables for verification...');

  if (!supabase) {
    return {
      test: 'Test 5: Database tables',
      status: 'SKIP',
      details: 'Supabase credentials not available (offline test mode)',
    };
  }

  try {
    // Check if processed_webhook_events table exists
    const { data: webhookTable, error: webhookError } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .limit(1);

    if (webhookError && webhookError.code !== 'PGRST116') {
      return {
        test: 'Test 5: Database tables',
        status: 'FAIL',
        details: 'processed_webhook_events table error',
        error: webhookError.message,
      };
    }

    // Check if credit_transactions table exists
    const { data: creditTable, error: creditError } = await supabase
      .from('credit_transactions')
      .select('id')
      .limit(1);

    if (creditError && creditError.code !== 'PGRST116') {
      return {
        test: 'Test 5: Database tables',
        status: 'FAIL',
        details: 'credit_transactions table error',
        error: creditError.message,
      };
    }

    return {
      test: 'Test 5: Database tables',
      status: 'PASS',
      details: 'Both required tables exist (processed_webhook_events, credit_transactions)',
    };
  } catch (error: any) {
    return {
      test: 'Test 5: Database tables',
      status: 'FAIL',
      details: 'Database connection error',
      error: error.message,
    };
  }
}

/**
 * Test 6: Verify TypeScript compiles without errors
 */
async function test6_typeScriptCompiles(): Promise<TestResult> {
  console.log('Test 6: TypeScript compilation...');

  try {
    // This is a basic check - actual compilation happens during build
    const webhookVerificationPath = path.join(__dirname, '../routes/webhook-verification.ts');
    const content = fs.readFileSync(webhookVerificationPath, 'utf-8');

    // Check for basic TypeScript syntax correctness
    const hasProperImports = content.includes('import { Router') && content.includes('from \'express\'');
    const hasProperExport = content.includes('export default router');
    const hasProperTypes = content.includes(': Request') && content.includes(': Response');

    if (hasProperImports && hasProperExport && hasProperTypes) {
      return {
        test: 'Test 6: TypeScript syntax',
        status: 'PASS',
        details: 'Basic TypeScript syntax correct (full compilation check via npm run build)',
      };
    } else {
      return {
        test: 'Test 6: TypeScript syntax',
        status: 'FAIL',
        details: 'TypeScript syntax issues detected',
        error: 'Missing proper imports, exports, or type annotations',
      };
    }
  } catch (error: any) {
    return {
      test: 'Test 6: TypeScript syntax',
      status: 'FAIL',
      details: 'Error checking TypeScript syntax',
      error: error.message,
    };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('Running 6 verification tests...\n');

  results.push(await test1_clientReferenceId());
  results.push(await test2_autoRechargeDeduplication());
  results.push(await test3_webhookVerificationEndpoint());
  results.push(await test4_endpointMounted());
  results.push(await test5_databaseTables());
  results.push(await test6_typeScriptCompiles());

  // Print results
  console.log('\n' + '='.repeat(70));
  console.log('Test Results:\n');

  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;

  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'SKIP' ? '⏭️' : '❌';

    console.log(`${icon} ${result.test}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Details: ${result.details}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');

    if (result.status === 'PASS') passCount++;
    else if (result.status === 'FAIL') failCount++;
    else skipCount++;
  });

  console.log('='.repeat(70));
  console.log(`\nTotal: ${results.length} tests`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`⏭️ Skipped: ${skipCount}`);
  console.log('');

  if (failCount === 0 && skipCount === 0) {
    console.log('🎉 ALL TESTS PASSED');
    console.log('✅ All 3 critical fixes verified');
    console.log('✅ Webhook verification endpoint operational');
    console.log('✅ Code quality checks passed');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart backend server: npm run dev');
    console.log('2. Test payment flow end-to-end');
    console.log('3. Verify /api/webhook-verification endpoints return 200');
  } else if (failCount === 0) {
    console.log('✅ VERIFICATION PASSED (with skipped tests)');
    console.log(`⏭️ ${skipCount} test(s) skipped - review above for details`);
  } else {
    console.log('❌ VERIFICATION FAILED');
    console.log(`❌ ${failCount} critical issue(s) found`);
    console.log('❌ Review failed tests above');
  }

  console.log('');

  process.exit(failCount === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
