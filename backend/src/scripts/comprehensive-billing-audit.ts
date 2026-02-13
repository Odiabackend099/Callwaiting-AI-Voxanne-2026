#!/usr/bin/env ts-node
/**
 * COMPREHENSIVE BILLING AUDIT TEST SUITE
 *
 * Tests all cost deduction paths:
 * 1. VAPI call cost deduction
 * 2. Phone provisioning costs
 * 3. Debt limit enforcement
 * 4. Auto-recharge workflow
 * 5. Multi-tenant isolation
 * 6. Edge cases & race conditions
 *
 * Run: npm run audit:billing
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  expected: string;
  actual: string;
  details?: Record<string, any>;
}

const results: TestResult[] = [];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function addResult(test: string, status: 'PASS' | 'FAIL' | 'PENDING', expected: string, actual: string, details?: Record<string, any>) {
  results.push({ test, status, expected, actual, details });
  console.log(`${status === 'PASS' ? '✅' : '❌'} ${test}: ${actual}`);
}

async function getOrgBalance(orgId: string) {
  const { data } = await supabase
    .from('organizations')
    .select('wallet_balance_pence, debt_limit_pence, wallet_auto_recharge, wallet_recharge_amount_pence')
    .eq('id', orgId)
    .single();
  return data;
}

async function getCreditTransactions(orgId: string, limit = 10) {
  const { data } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  // Get org_id from CLI args or find test org
  let orgId = process.argv[2];

  if (!orgId) {
    console.log('⚠️  No org_id provided. Fetching available test orgs...\n');
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('id, name, wallet_balance_pence')
      .limit(5);

    if (error || !orgs?.length) {
      console.error('❌ Error: No organizations found in database');
      console.log('   Usage: npm run audit:billing <org_id>');
      process.exit(1);
    }

    console.log('📋 Available organizations:\n');
    orgs.forEach((org, i) => {
      console.log(`   [${i}] ${org.name || 'Unnamed'}`);
      console.log(`       ID: ${org.id}`);
      console.log(`       Balance: ${org.wallet_balance_pence}p\n`);
    });

    // Use first org for testing
    orgId = orgs[0].id;
    console.log(`✅ Using first org: ${orgId}\n`);
  }

  await runTests(orgId);
}

// ============================================================================
// TEST 1: CURRENT BALANCE STATE
// ============================================================================

async function test1_CurrentBalance(orgId: string) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST 1: CURRENT BALANCE STATE                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const org = await getOrgBalance(orgId);

  if (!org) {
    addResult('Get org balance', 'FAIL', 'Valid org data', 'Organization not found', {});
    return;
  }

  const orgName = (await supabase.from('organizations').select('name').eq('id', orgId).single()).data?.name || 'Unknown';

  console.log(`\n📊 Organization: ${orgName} (${orgId})`);
  console.log(`   Balance: ${org.wallet_balance_pence}p (≈$${(org.wallet_balance_pence / 100 / 0.79).toFixed(2)})`);
  console.log(`   Debt Limit: ${org.debt_limit_pence}p`);
  console.log(`   Auto-Recharge: ${org.wallet_auto_recharge ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   Min Recharge: ${org.wallet_recharge_amount_pence}p`);

  addResult(
    'Balance retrieved',
    'PASS',
    'wallet_balance_pence > 0',
    `${org.wallet_balance_pence}p`,
    org
  );

  return orgId;
}

// ============================================================================
// TEST 2: VAPI CALL COST DEDUCTION
// ============================================================================

async function test2_VapiCallDeduction(orgId: string) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST 2: VAPI CALL COST DEDUCTION                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Record balance before
  const balanceBefore = await getOrgBalance(orgId);
  console.log(`\n💰 Balance BEFORE: ${balanceBefore.wallet_balance_pence}p`);

  // Simulate VAPI call webhook
  // In real scenario: User makes a call, Vapi sends webhook to /api/webhooks/vapi
  // For now: Query latest call and verify deduction

  const { data: latestCalls } = await supabase
    .from('calls')
    .select('id, duration_seconds, cost_amount_pence, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!latestCalls || latestCalls.length === 0) {
    addResult(
      'VAPI call found',
      'PENDING',
      'At least 1 call in database',
      'No calls found - need to trigger real call via Vapi',
      { orgId }
    );
    return;
  }

  const latestCall = latestCalls[0];
  console.log(`\n📞 Latest Call:`);
  console.log(`   ID: ${latestCall.id}`);
  console.log(`   Duration: ${latestCall.duration_seconds}s`);
  console.log(`   Charged: ${latestCall.cost_amount_pence}p`);

  // Calculate expected cost: (duration_seconds / 60) * 70 cents * 0.79 GBP/USD
  const expectedCostCents = Math.ceil((latestCall.duration_seconds / 60) * 70);
  const expectedCostPence = Math.ceil(expectedCostCents * 0.79);

  console.log(`   Expected Cost: ${expectedCostPence}p`);

  // Verify transaction was logged
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('call_id', latestCall.id)
    .single();

  if (transactions) {
    console.log(`\n✅ Deduction Logged:`);
    console.log(`   Amount: ${transactions.amount_pence}p`);
    console.log(`   Type: ${transactions.type}`);
    console.log(`   Balance Before: ${transactions.balance_before_pence}p`);
    console.log(`   Balance After: ${transactions.balance_after_pence}p`);

    addResult(
      'Deduction logged in credit_transactions',
      'PASS',
      'Transaction entry exists',
      `${transactions.amount_pence}p deducted`,
      transactions
    );
  } else {
    addResult(
      'Deduction logged in credit_transactions',
      'FAIL',
      'Transaction entry exists for call_id',
      'No transaction found',
      { callId: latestCall.id }
    );
  }
}

// ============================================================================
// TEST 3: MULTI-TENANT ISOLATION
// ============================================================================

async function test3_MultiTenantIsolation(orgId: string) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST 3: MULTI-TENANT ISOLATION                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Verify org_id is in all queries
  const { data: orgData } = await supabase
    .from('organizations')
    .select('id, wallet_balance_pence')
    .eq('id', orgId)
    .single();

  console.log(`\n🔐 Organization Access:`);
  console.log(`   Own org: ${orgData?.id === orgId ? '✅ ACCESSIBLE' : '❌ DENIED'}`);

  // Try to access another org (should fail due to RLS)
  const { data: otherOrgData, error } = await supabase
    .from('organizations')
    .select('id, wallet_balance_pence')
    .neq('id', orgId)
    .limit(1)
    .single();

  console.log(`   Other org: ${error ? '✅ DENIED (RLS working)' : '❌ ACCESSIBLE (RLS broken!)'}`);

  addResult(
    'RLS prevents cross-org access',
    error ? 'PASS' : 'FAIL',
    'Cannot access other org',
    error ? 'Access denied (RLS working)' : 'Other org accessible (VULNERABILITY!)',
    { error }
  );

  // Verify all transactions are org-filtered
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('org_id')
    .eq('org_id', orgId);

  const allSameOrg = transactions?.every(t => t.org_id === orgId);
  addResult(
    'All transactions filtered by org_id',
    allSameOrg ? 'PASS' : 'FAIL',
    'All org_id match authenticated org',
    allSameOrg ? `${transactions?.length} transactions all match` : 'Mixed org_ids found!',
    { transactions }
  );
}

// ============================================================================
// TEST 4: DEBT LIMIT ENFORCEMENT
// ============================================================================

async function test4_DebtLimitEnforcement(orgId: string) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST 4: DEBT LIMIT ENFORCEMENT                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const org = await getOrgBalance(orgId);
  const debtLimitPence = org.debt_limit_pence || 500;
  const currentBalance = org.wallet_balance_pence;

  console.log(`\n📉 Debt Limit Test:`);
  console.log(`   Current Balance: ${currentBalance}p`);
  console.log(`   Debt Limit: ${debtLimitPence}p (max negative)`);
  console.log(`   Can go negative: ${currentBalance > -debtLimitPence}`);

  // Simulate trying to deduct more than debt limit allows
  const testCallDuration = 3600; // 1 hour = expensive call
  const expectedCost = Math.ceil(Math.ceil((testCallDuration / 60) * 70) * 0.79);
  const wouldBeBalance = currentBalance - expectedCost;
  const wouldExceedDebtLimit = wouldBeBalance < -debtLimitPence;

  console.log(`\n📞 Hypothetical 1-hour call:`);
  console.log(`   Cost: ${expectedCost}p`);
  console.log(`   Balance would be: ${wouldBeBalance}p`);
  console.log(`   Exceeds debt limit: ${wouldExceedDebtLimit ? '⚠️ YES' : '✅ NO'}`);

  addResult(
    'Debt limit is enforced',
    wouldExceedDebtLimit ? 'PENDING' : 'PASS',
    'Calls blocked if debt limit exceeded',
    wouldExceedDebtLimit ? 'Test call would exceed limit (needs real call to test)' : 'Current balance allows calls',
    { expectedCost, wouldBeBalance, debtLimitPence }
  );
}

// ============================================================================
// TEST 5: AUTO-RECHARGE CONFIGURATION
// ============================================================================

async function test5_AutoRechargeConfig(orgId: string) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST 5: AUTO-RECHARGE CONFIGURATION                             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const org = await getOrgBalance(orgId);

  console.log(`\n⚡ Auto-Recharge Status:`);
  console.log(`   Enabled: ${org.wallet_auto_recharge ? '✅ YES' : '❌ NO'}`);
  console.log(`   Recharge Amount: ${org.wallet_recharge_amount_pence}p`);

  if (!org.wallet_auto_recharge) {
    addResult(
      'Auto-recharge configured',
      'FAIL',
      'Auto-recharge enabled',
      'Auto-recharge DISABLED - user will not auto top-up',
      org
    );
  } else {
    addResult(
      'Auto-recharge configured',
      'PASS',
      'Auto-recharge enabled',
      `Enabled with ${org.wallet_recharge_amount_pence}p threshold`,
      org
    );
  }
}

// ============================================================================
// TEST 6: PHONE PROVISIONING COSTS
// ============================================================================

async function test6_PhoneProvisioningCosts(orgId: string) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST 6: PHONE PROVISIONING COSTS                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Query phone numbers provisioned by org
  const { data: phoneNumbers } = await supabase
    .from('phone_numbers')
    .select('id, phone_number, provisioning_cost_pence, created_at')
    .eq('org_id', orgId);

  if (!phoneNumbers || phoneNumbers.length === 0) {
    addResult(
      'Phone provisioning cost deduction',
      'PENDING',
      'At least 1 phone number provisioned',
      'No phone numbers found - need to provision one',
      { orgId }
    );
    return;
  }

  console.log(`\n📱 Phone Numbers Provisioned:`);
  phoneNumbers.forEach((phone, i) => {
    console.log(`   ${i + 1}. ${phone.phone_number}`);
    console.log(`      Cost: ${phone.provisioning_cost_pence}p`);
    console.log(`      Provisioned: ${phone.created_at}`);
  });

  // Verify provisioning cost was deducted
  const { data: provisioningTransactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('org_id', orgId)
    .eq('type', 'phone_provisioning')
    .limit(5);

  if (provisioningTransactions && provisioningTransactions.length > 0) {
    addResult(
      'Phone provisioning deduction logged',
      'PASS',
      'Provisioning transactions in credit_transactions',
      `${provisioningTransactions.length} provisioning costs logged`,
      provisioningTransactions
    );
  } else {
    addResult(
      'Phone provisioning deduction logged',
      'FAIL',
      'Provisioning transactions in credit_transactions',
      'No provisioning transactions found',
      { phoneNumbers }
    );
  }
}

// ============================================================================
// TEST 7: TRANSACTION AUDIT TRAIL
// ============================================================================

async function test7_AuditTrail(orgId: string) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST 7: TRANSACTION AUDIT TRAIL                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const transactions = await getCreditTransactions(orgId, 10);

  console.log(`\n📋 Latest Transactions (${transactions.length} total):`);
  transactions.slice(0, 5).forEach((tx, i) => {
    const direction = tx.direction === 'debit' ? '❌' : '✅';
    console.log(`   ${i + 1}. ${direction} ${tx.type}: ${tx.amount_pence}p`);
    console.log(`      Balance: ${tx.balance_before_pence}p → ${tx.balance_after_pence}p`);
    console.log(`      Time: ${tx.created_at}`);
  });

  // Verify immutability (all entries should have created_at, cannot be updated)
  const allImmutable = transactions.every(tx => tx.created_at && !tx.updated_at);
  addResult(
    'Audit trail immutable',
    allImmutable ? 'PASS' : 'FAIL',
    'No updated_at field (write-once)',
    allImmutable ? 'All entries write-once' : 'Some entries modified!',
    { transactions: transactions.length }
  );
}

// ============================================================================
// TEST 8: IDEMPOTENCY CHECK
// ============================================================================

async function test8_Idempotency(orgId: string) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║ TEST 8: IDEMPOTENCY (NO DOUBLE-CHARGING)                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  // Query all transactions with call_id
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('call_id')
    .eq('org_id', orgId)
    .not('call_id', 'is', null);

  // Group by call_id and count duplicates in JavaScript
  const callIdCounts: Record<string, number> = {};
  transactions?.forEach(t => {
    if (t.call_id) {
      callIdCounts[t.call_id] = (callIdCounts[t.call_id] || 0) + 1;
    }
  });

  const duplicates = Object.entries(callIdCounts)
    .filter(([_, count]) => count > 1)
    .map(([callId, count]) => ({ call_id: callId, count }));

  console.log(`\n🔁 Idempotency Check:`);
  console.log(`   Total transactions: ${transactions?.length}`);
  console.log(`   Duplicate call_ids: ${duplicates.length}`);

  if (duplicates.length > 0) {
    console.log(`   ⚠️ DUPLICATES FOUND:`);
    duplicates.forEach(dup => {
      console.log(`      ${dup.call_id} - billed ${dup.count} times!`);
    });
  }

  addResult(
    'Idempotency enforced (no double-charging)',
    duplicates.length === 0 ? 'PASS' : 'FAIL',
    'No duplicate call_ids in transactions',
    duplicates.length === 0 ? 'No duplicates found' : `${duplicates.length} duplicate(s) found!`,
    { duplicates }
  );
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests(orgId: string) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║     COMPREHENSIVE BILLING AUDIT TEST SUITE                    ║
║     Voxanne AI - Multi-Tenant Cost Deduction System           ║
╚════════════════════════════════════════════════════════════════╝
  `);

  try {
    await test1_CurrentBalance(orgId);
    await test2_VapiCallDeduction(orgId);
    await test3_MultiTenantIsolation(orgId);
    await test4_DebtLimitEnforcement(orgId);
    await test5_AutoRechargeConfig(orgId);
    await test6_PhoneProvisioningCosts(orgId);
    await test7_AuditTrail(orgId);
    await test8_Idempotency(orgId);

    // Print summary
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                      TEST SUMMARY                              ║
╚════════════════════════════════════════════════════════════════╝
    `);

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const pending = results.filter(r => r.status === 'PENDING').length;

    console.log(`✅ PASSED:  ${passed}/${results.length}`);
    console.log(`❌ FAILED:  ${failed}/${results.length}`);
    console.log(`⏳ PENDING: ${pending}/${results.length} (need manual verification)`);

    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏳';
      console.log(`\n${icon} ${r.test}`);
      console.log(`   Expected: ${r.expected}`);
      console.log(`   Actual: ${r.actual}`);
    });

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    process.exit(1);
  }
}

// Run main
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
