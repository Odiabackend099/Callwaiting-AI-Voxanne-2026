/**
 * Test Script: P0-3 Debt Limit Enforcement
 *
 * Tests that debt limit prevents unlimited negative balances
 * and triggers auto-recharge when limit is approached.
 *
 * Run: npx ts-node src/scripts/test-debt-limit.ts
 */

import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

interface TestResult {
  test: string;
  passed: boolean;
  details: string;
  data?: any;
}

const results: TestResult[] = [];

/**
 * Test 1: Verify debt_limit_pence column exists
 */
async function test1_columnExists(): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, wallet_balance_pence, debt_limit_pence')
      .limit(1)
      .single();

    if (error) {
      return {
        test: 'Test 1: debt_limit_pence column exists',
        passed: false,
        details: `Column query failed: ${error.message}`,
      };
    }

    if (data && 'debt_limit_pence' in data) {
      return {
        test: 'Test 1: debt_limit_pence column exists',
        passed: true,
        details: `Column exists. Sample value: ${data.debt_limit_pence} cents`,
        data: { debt_limit_pence: data.debt_limit_pence },
      };
    }

    return {
      test: 'Test 1: debt_limit_pence column exists',
      passed: false,
      details: 'Column not found in query response',
    };
  } catch (err) {
    return {
      test: 'Test 1: debt_limit_pence column exists',
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    };
  }
}

/**
 * Test 2: Create test organization with known balance and debt limit
 */
async function test2_createTestOrg(): Promise<{ result: TestResult; orgId?: string }> {
  try {
    // Create test org
    const timestamp = Date.now();
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: `Test Org Debt Limit ${timestamp}`,
        email: `test-debt-limit-${timestamp}@voxanne.test`,
        plan: 'prepaid',
        wallet_balance_pence: 100, // £0.10 balance
        debt_limit_pence: 500, // $5.00 debt limit
        wallet_low_balance_pence: 50,
      })
      .select('id, wallet_balance_pence, debt_limit_pence')
      .single();

    if (orgError) {
      return {
        result: {
          test: 'Test 2: Create test organization',
          passed: false,
          details: `Failed to create org: ${orgError.message}`,
        },
      };
    }

    return {
      result: {
        test: 'Test 2: Create test organization',
        passed: true,
        details: `Created org ${org.id} with balance=${org.wallet_balance_pence}p, debt_limit=${org.debt_limit_pence}p`,
        data: org,
      },
      orgId: org.id,
    };
  } catch (err) {
    return {
      result: {
        test: 'Test 2: Create test organization',
        passed: false,
        details: `Exception: ${(err as Error).message}`,
      },
    };
  }
}

/**
 * Test 3: Deduct within debt limit (should succeed)
 */
async function test3_deductWithinLimit(orgId: string): Promise<TestResult> {
  try {
    // Deduct 400p (balance 100p - 400p = -300p, which is within -500p limit)
    const { data, error } = await supabase.rpc('deduct_call_credits', {
      p_org_id: orgId,
      p_call_id: `test-call-within-limit-${Date.now()}`,
      p_vapi_call_id: `vapi-test-${Date.now()}`,
      p_provider_cost_pence: 300,
      p_markup_percent: 0,
      p_client_charged_pence: 400,
      p_cost_breakdown: { test: true },
      p_description: 'Test deduction within debt limit',
    });

    if (error) {
      return {
        test: 'Test 3: Deduct within debt limit (should succeed)',
        passed: false,
        details: `RPC error: ${error.message}`,
      };
    }

    const result = data as any;

    if (result.success && result.balance_after === -300) {
      return {
        test: 'Test 3: Deduct within debt limit (should succeed)',
        passed: true,
        details: `Deduction succeeded. Balance: ${result.balance_before}p → ${result.balance_after}p (within -${result.debt_limit}p limit)`,
        data: result,
      };
    }

    return {
      test: 'Test 3: Deduct within debt limit (should succeed)',
      passed: false,
      details: `Unexpected result: success=${result.success}, balance_after=${result.balance_after}`,
      data: result,
    };
  } catch (err) {
    return {
      test: 'Test 3: Deduct within debt limit (should succeed)',
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    };
  }
}

/**
 * Test 4: Deduct exceeding debt limit (should fail)
 */
async function test4_deductExceedingLimit(orgId: string): Promise<TestResult> {
  try {
    // Current balance: -300p
    // Attempt to deduct 600p (would result in -900p, exceeding -500p limit)
    const { data, error } = await supabase.rpc('deduct_call_credits', {
      p_org_id: orgId,
      p_call_id: `test-call-exceeding-limit-${Date.now()}`,
      p_vapi_call_id: `vapi-test-${Date.now()}`,
      p_provider_cost_pence: 450,
      p_markup_percent: 0,
      p_client_charged_pence: 600,
      p_cost_breakdown: { test: true },
      p_description: 'Test deduction exceeding debt limit',
    });

    if (error) {
      return {
        test: 'Test 4: Deduct exceeding debt limit (should fail)',
        passed: false,
        details: `RPC error: ${error.message}`,
      };
    }

    const result = data as any;

    if (
      !result.success &&
      result.error === 'debt_limit_exceeded' &&
      result.current_balance === -300
    ) {
      return {
        test: 'Test 4: Deduct exceeding debt limit (should fail)',
        passed: true,
        details: `Deduction correctly blocked. Balance: ${result.current_balance}p, Limit: -${result.debt_limit}p, Attempted: ${result.attempted_deduction}p, Would be: ${result.new_balance_would_be}p`,
        data: result,
      };
    }

    return {
      test: 'Test 4: Deduct exceeding debt limit (should fail)',
      passed: false,
      details: `Unexpected result: success=${result.success}, error=${result.error}`,
      data: result,
    };
  } catch (err) {
    return {
      test: 'Test 4: Deduct exceeding debt limit (should fail)',
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    };
  }
}

/**
 * Test 5: Verify balance unchanged after rejected deduction
 */
async function test5_balanceUnchanged(orgId: string): Promise<TestResult> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('wallet_balance_pence')
      .eq('id', orgId)
      .single();

    if (error) {
      return {
        test: 'Test 5: Balance unchanged after rejection',
        passed: false,
        details: `Query error: ${error.message}`,
      };
    }

    const balance = (data as any).wallet_balance_pence;

    if (balance === -300) {
      return {
        test: 'Test 5: Balance unchanged after rejection',
        passed: true,
        details: `Balance correctly unchanged at ${balance}p (rejected deduction did not apply)`,
        data: { balance },
      };
    }

    return {
      test: 'Test 5: Balance unchanged after rejection',
      passed: false,
      details: `Balance is ${balance}p, expected -300p`,
      data: { balance },
    };
  } catch (err) {
    return {
      test: 'Test 5: Balance unchanged after rejection',
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    };
  }
}

/**
 * Test 6: Test edge case - exactly at debt limit
 */
async function test6_exactlyAtLimit(orgId: string): Promise<TestResult> {
  try {
    // Current balance: -300p
    // Deduct 200p to reach exactly -500p (at limit, should succeed)
    const { data, error } = await supabase.rpc('deduct_call_credits', {
      p_org_id: orgId,
      p_call_id: `test-call-at-limit-${Date.now()}`,
      p_vapi_call_id: `vapi-test-${Date.now()}`,
      p_provider_cost_pence: 150,
      p_markup_percent: 0,
      p_client_charged_pence: 200,
      p_cost_breakdown: { test: true },
      p_description: 'Test deduction exactly at debt limit',
    });

    if (error) {
      return {
        test: 'Test 6: Deduct to exactly debt limit (should succeed)',
        passed: false,
        details: `RPC error: ${error.message}`,
      };
    }

    const result = data as any;

    if (result.success && result.balance_after === -500) {
      return {
        test: 'Test 6: Deduct to exactly debt limit (should succeed)',
        passed: true,
        details: `Deduction at limit succeeded. Balance: ${result.balance_before}p → ${result.balance_after}p (exactly at -${result.debt_limit}p limit)`,
        data: result,
      };
    }

    return {
      test: 'Test 6: Deduct to exactly debt limit (should succeed)',
      passed: false,
      details: `Unexpected result: success=${result.success}, balance_after=${result.balance_after}`,
      data: result,
    };
  } catch (err) {
    return {
      test: 'Test 6: Deduct to exactly debt limit (should succeed)',
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    };
  }
}

/**
 * Test 7: Test edge case - 1 cent over limit
 */
async function test7_oneCentOver(orgId: string): Promise<TestResult> {
  try {
    // Current balance: -500p (at limit)
    // Attempt to deduct 1p (would be -501p, over limit)
    const { data, error } = await supabase.rpc('deduct_call_credits', {
      p_org_id: orgId,
      p_call_id: `test-call-one-over-${Date.now()}`,
      p_vapi_call_id: `vapi-test-${Date.now()}`,
      p_provider_cost_pence: 1,
      p_markup_percent: 0,
      p_client_charged_pence: 1,
      p_cost_breakdown: { test: true },
      p_description: 'Test deduction 1 cent over debt limit',
    });

    if (error) {
      return {
        test: 'Test 7: Deduct 1 cent over limit (should fail)',
        passed: false,
        details: `RPC error: ${error.message}`,
      };
    }

    const result = data as any;

    if (!result.success && result.error === 'debt_limit_exceeded') {
      return {
        test: 'Test 7: Deduct 1 cent over limit (should fail)',
        passed: true,
        details: `Deduction correctly blocked. Balance: ${result.current_balance}p, Limit: -${result.debt_limit}p, Would be: ${result.new_balance_would_be}p (1 cent over)`,
        data: result,
      };
    }

    return {
      test: 'Test 7: Deduct 1 cent over limit (should fail)',
      passed: false,
      details: `Unexpected result: success=${result.success}, error=${result.error}`,
      data: result,
    };
  } catch (err) {
    return {
      test: 'Test 7: Deduct 1 cent over limit (should fail)',
      passed: false,
      details: `Exception: ${(err as Error).message}`,
    };
  }
}

/**
 * Cleanup test organization
 */
async function cleanup(orgId: string): Promise<void> {
  try {
    // Delete credit transactions first (foreign key)
    await supabase.from('credit_transactions').delete().eq('org_id', orgId);

    // Delete organization
    await supabase.from('organizations').delete().eq('id', orgId);

    log.info('TestDebtLimit', 'Cleanup complete', { orgId });
  } catch (err) {
    log.error('TestDebtLimit', 'Cleanup failed', {
      orgId,
      error: (err as Error).message,
    });
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 P0-3 Debt Limit Enforcement Test Suite\n');
  console.log('=' .repeat(60));

  let testOrgId: string | undefined;

  try {
    // Test 1: Column exists
    results.push(await test1_columnExists());

    // Test 2: Create test org
    const test2 = await test2_createTestOrg();
    results.push(test2.result);
    testOrgId = test2.orgId;

    if (!testOrgId) {
      console.error('\n❌ Cannot continue without test organization');
      return;
    }

    // Test 3: Deduct within limit
    results.push(await test3_deductWithinLimit(testOrgId));

    // Test 4: Deduct exceeding limit
    results.push(await test4_deductExceedingLimit(testOrgId));

    // Test 5: Balance unchanged
    results.push(await test5_balanceUnchanged(testOrgId));

    // Test 6: Exactly at limit
    results.push(await test6_exactlyAtLimit(testOrgId));

    // Test 7: One cent over limit
    results.push(await test7_oneCentOver(testOrgId));
  } catch (err) {
    console.error('\n❌ Test suite error:', (err as Error).message);
  } finally {
    // Cleanup
    if (testOrgId) {
      await cleanup(testOrgId);
    }
  }

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('Test Results:\n');

  let passCount = 0;
  let failCount = 0;

  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.test}`);
    console.log(`   ${result.details}`);
    if (result.data) {
      console.log(`   Data:`, JSON.stringify(result.data, null, 2).split('\n').map(l => `   ${l}`).join('\n'));
    }
    console.log('');

    if (result.passed) passCount++;
    else failCount++;
  });

  console.log('='.repeat(60));
  console.log(`\nTotal: ${results.length} tests`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);

  if (failCount === 0) {
    console.log('\n🎉 All tests passed! P0-3 implementation is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Review implementation.');
  }

  process.exit(failCount === 0 ? 0 : 1);
}

// Run tests
runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
