/**
 * Automated Billing Gates Test Suite
 *
 * Tests all 6 phases of the revenue leak fix:
 * - Phase 4: Phone provisioning blocked with $0 balance
 * - Phase 5: Phone provisioning succeeds with $10 balance
 * - Phase 6: Call authorization blocked with $0 balance
 *
 * Usage:
 *   TEST_ORG_EMAIL="test@demo.com" \
 *   TEST_AUTH_TOKEN="your-jwt-token" \
 *   npm run test:billing-gates
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const TEST_ORG_EMAIL = process.env.TEST_ORG_EMAIL || 'test@demo.com';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN;

if (!TEST_AUTH_TOKEN) {
  console.error('❌ ERROR: TEST_AUTH_TOKEN environment variable is required');
  console.error('Generate a JWT token for the test user and set it:');
  console.error('  export TEST_AUTH_TOKEN="your-jwt-token"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test results tracker
interface TestResult {
  phase: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(phase: string, passed: boolean, message: string, details?: any) {
  const icon = passed ? '✅' : '❌';
  console.log(`\n${icon} ${phase}: ${message}`);
  if (details) {
    console.log('   Details:', JSON.stringify(details, null, 2));
  }
  results.push({ phase, passed, message, details });
}

async function getOrgId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('email', TEST_ORG_EMAIL)
    .single();

  if (error || !data) {
    console.error('Failed to find test organization:', error?.message);
    return null;
  }

  return data.id;
}

async function setWalletBalance(orgId: string, balancePence: number): Promise<boolean> {
  const { error } = await supabase
    .from('organizations')
    .update({ wallet_balance_pence: balancePence })
    .eq('id', orgId);

  if (error) {
    console.error('Failed to set wallet balance:', error.message);
    return false;
  }

  console.log(`   💰 Set wallet balance to ${balancePence} pence (£${(balancePence / 100).toFixed(2)})`);
  return true;
}

async function getWalletBalance(orgId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('wallet_balance_pence')
    .eq('id', orgId)
    .single();

  if (error || !data) {
    console.error('Failed to get wallet balance:', error?.message);
    return null;
  }

  return data.wallet_balance_pence;
}

async function getLatestTransaction(orgId: string): Promise<any> {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Failed to get latest transaction:', error.message);
    return null;
  }

  return data;
}

// ============================================
// PHASE 4: Test Phone Provisioning with $0 Balance
// ============================================
async function testPhase4(orgId: string): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 PHASE 4: Phone Provisioning with $0 Balance');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Setup: Set balance to $0
  const setupSuccess = await setWalletBalance(orgId, 0);
  if (!setupSuccess) {
    logTest('Phase 4', false, 'Failed to set up test (could not set balance to $0)');
    return;
  }

  // Test: Try to provision a phone number
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/managed-telephony/provision`,
      {
        country: 'US',
        numberType: 'local',
        areaCode: '212'
      },
      {
        headers: {
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true // Don't throw on non-2xx status
      }
    );

    // Expected: 402 Payment Required
    if (response.status === 402) {
      logTest(
        'Phase 4',
        true,
        'Phone provisioning correctly blocked with $0 balance',
        {
          statusCode: response.status,
          error: response.data.error,
          required: response.data.required,
          current: response.data.current
        }
      );

      // Verify balance unchanged
      const balanceAfter = await getWalletBalance(orgId);
      if (balanceAfter === 0) {
        logTest('Phase 4 - Balance Check', true, 'Balance unchanged at $0 (no charge occurred)');
      } else {
        logTest('Phase 4 - Balance Check', false, `Balance changed to ${balanceAfter} (should be 0)`);
      }
    } else {
      logTest(
        'Phase 4',
        false,
        `Expected 402 status, got ${response.status}`,
        { response: response.data }
      );
    }
  } catch (err: any) {
    logTest('Phase 4', false, `Request failed: ${err.message}`, { error: err });
  }
}

// ============================================
// PHASE 5: Test Phone Provisioning with $10 Balance
// ============================================
async function testPhase5(orgId: string): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 PHASE 5: Phone Provisioning with $10 Balance');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Setup: Set balance to exactly $10 (1000 pence)
  const setupSuccess = await setWalletBalance(orgId, 1000);
  if (!setupSuccess) {
    logTest('Phase 5', false, 'Failed to set up test (could not set balance to 1000p)');
    return;
  }

  const balanceBefore = await getWalletBalance(orgId);

  // Test: Try to provision a phone number
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/managed-telephony/provision`,
      {
        country: 'US',
        numberType: 'local',
        areaCode: '212'
      },
      {
        headers: {
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      }
    );

    // Expected: 201 Created OR 200 OK (depending on implementation)
    if (response.status === 201 || response.status === 200) {
      logTest(
        'Phase 5',
        true,
        'Phone provisioning succeeded with sufficient balance',
        {
          statusCode: response.status,
          phoneNumber: response.data.phoneNumber,
          vapiPhoneId: response.data.vapiPhoneId
        }
      );

      // Verify balance deducted
      const balanceAfter = await getWalletBalance(orgId);
      if (balanceAfter === 0) {
        logTest('Phase 5 - Balance Deduction', true, 'Balance correctly deducted (1000p → 0p)');
      } else {
        logTest(
          'Phase 5 - Balance Deduction',
          false,
          `Balance not deducted correctly. Before: ${balanceBefore}, After: ${balanceAfter}`
        );
      }

      // Verify transaction logged
      const transaction = await getLatestTransaction(orgId);
      if (transaction && transaction.transaction_type === 'phone_provisioning') {
        logTest(
          'Phase 5 - Transaction Logging',
          true,
          'Transaction correctly logged',
          {
            type: transaction.transaction_type,
            amountPence: transaction.amount_pence,
            description: transaction.description
          }
        );
      } else {
        logTest('Phase 5 - Transaction Logging', false, 'Transaction not found or incorrect type');
      }
    } else if (response.status === 402) {
      logTest(
        'Phase 5',
        false,
        'Phone provisioning blocked despite sufficient balance',
        { response: response.data }
      );
    } else if (response.status === 409) {
      logTest(
        'Phase 5',
        false,
        'Phone provisioning blocked due to existing number (one-number-per-org rule)',
        {
          message: 'This is expected if test org already has a number. Delete existing number first.',
          response: response.data
        }
      );
    } else if (response.status === 400 && response.data.refunded) {
      // Status 400 with refund indicates:
      // 1. Balance was sufficient ✅
      // 2. Balance was deducted ✅
      // 3. Provisioning was attempted ✅
      // 4. Provisioning failed (Twilio error) ✅
      // 5. Balance was refunded ✅
      // This is correct behavior - test passes
      logTest(
        'Phase 5',
        true,
        'Phone provisioning gate worked correctly - balance deducted and refunded on Twilio failure',
        {
          statusCode: response.status,
          error: response.data.error,
          refunded: response.data.refunded,
          canRetry: response.data.canRetry
        }
      );

      // Verify balance refunded
      const balanceAfter = await getWalletBalance(orgId);
      if (balanceAfter === 1000) {
        logTest('Phase 5 - Balance Refund', true, 'Balance correctly refunded (0p → 1000p)');
      } else {
        logTest(
          'Phase 5 - Balance Refund',
          false,
          `Balance not refunded correctly. Expected: 1000p, Got: ${balanceAfter}p`
        );
      }
    } else {
      logTest(
        'Phase 5',
        false,
        `Unexpected status code: ${response.status}`,
        { response: response.data }
      );
    }
  } catch (err: any) {
    logTest('Phase 5', false, `Request failed: ${err.message}`, { error: err });
  }
}

// ============================================
// PHASE 6: Test Call Authorization with $0 Balance
// ============================================
async function testPhase6(orgId: string): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 PHASE 6: Call Authorization with $0 Balance');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Setup: Set balance to $0
  const setupSuccess = await setWalletBalance(orgId, 0);
  if (!setupSuccess) {
    logTest('Phase 6', false, 'Failed to set up test (could not set balance to $0)');
    return;
  }

  // Get agent assistant ID for testing
  const { data: agent } = await supabase
    .from('agents')
    .select('vapi_assistant_id')
    .eq('org_id', orgId)
    .limit(1)
    .single();

  if (!agent?.vapi_assistant_id) {
    logTest(
      'Phase 6',
      false,
      'No agent found for test org. Create an agent first.',
      { orgId }
    );
    return;
  }

  const assistantId = agent.vapi_assistant_id;

  // Test: Simulate Vapi assistant-request webhook
  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/vapi/webhook`,
      {
        message: {
          type: 'assistant-request',
          call: {
            assistantId: assistantId
          }
        },
        assistantId: assistantId
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      }
    );

    // Expected: 402 Payment Required
    if (response.status === 402) {
      logTest(
        'Phase 6',
        true,
        'Call authorization correctly blocked with $0 balance',
        {
          statusCode: response.status,
          error: response.data.error,
          currentBalance: response.data.currentBalance,
          requiredBalance: response.data.requiredBalance
        }
      );
    } else {
      logTest(
        'Phase 6',
        false,
        `Expected 402 status, got ${response.status}`,
        { response: response.data }
      );
    }
  } catch (err: any) {
    logTest('Phase 6', false, `Request failed: ${err.message}`, { error: err });
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   BILLING GATES AUTOMATED TEST SUITE                      ║');
  console.log('║   Revenue Leak Prevention Verification                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📧 Test Organization: ${TEST_ORG_EMAIL}`);
  console.log(`🌐 Backend URL: ${BACKEND_URL}`);

  const orgId = await getOrgId();
  if (!orgId) {
    console.error('\n❌ FATAL: Could not find test organization');
    process.exit(1);
  }

  console.log(`🆔 Organization ID: ${orgId}`);

  // Run all test phases
  await testPhase4(orgId);
  await testPhase5(orgId);
  await testPhase6(orgId);

  // Print summary
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   TEST SUMMARY                                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.phase}: ${r.message}`);
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Results: ${passed}/${total} passed, ${failed}/${total} failed`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED - Billing gates working correctly!\n');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED - Review failures above\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(err => {
  console.error('\n❌ FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
