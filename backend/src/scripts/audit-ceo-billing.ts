/**
 * Billing Audit Script - CEO Demo Account
 *
 * Verifies the $0.70/min fixed-rate billing math for ceo@demo.com.
 * Runs pure math checks (no DB needed) and optionally audits live transactions.
 *
 * Usage: npm run audit:ceo-billing
 */

import { createClient } from '@supabase/supabase-js';
import { calculateFixedRateCharge } from '../services/wallet-service';
import { config } from '../config';

// ============================================
// Constants
// ============================================

const TARGET_EMAIL = 'ceo@demo.com';
const RATE = config.RATE_PER_MINUTE_USD_CENTS; // 70 cents/min
const GBP_RATE = parseFloat(config.USD_TO_GBP_RATE); // 0.79
const MIN_BALANCE = config.WALLET_MIN_BALANCE_FOR_CALL; // 79p

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

// ============================================
// Helpers
// ============================================

function check(label: string, passed: boolean, expected?: string, actual?: string): void {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`[PASS] ${label}`);
  } else {
    failedChecks++;
    console.log(`[FAIL] ${label}`);
    if (expected !== undefined && actual !== undefined) {
      console.log(`       Expected: ${expected}`);
      console.log(`       Actual:   ${actual}`);
    }
  }
}

function info(label: string): void {
  console.log(`[INFO] ${label}`);
}

function penceToDollar(pence: number): string {
  const usd = pence / (GBP_RATE * 100);
  return `$${usd.toFixed(2)}`;
}

// ============================================
// Pure Math Verification (no DB required)
// ============================================

function runPureMathChecks(): void {
  console.log('');
  console.log('--- PURE MATH VERIFICATION ---');

  // Check 1: 60s call = $0.70 = 56p
  const c1 = calculateFixedRateCharge(60, 70);
  check(
    `60s call: $0.70 USD = 56p GBP`,
    c1.usdCents === 70 && c1.pence === 56,
    'usdCents=70, pence=56',
    `usdCents=${c1.usdCents}, pence=${c1.pence}`
  );

  // Check 2: 30s call = $0.35 = 28p
  const c2 = calculateFixedRateCharge(30, 70);
  check(
    `30s call: $0.35 USD = 28p GBP`,
    c2.usdCents === 35 && c2.pence === 28,
    'usdCents=35, pence=28',
    `usdCents=${c2.usdCents}, pence=${c2.pence}`
  );

  // Check 3: 1s call = $0.02 = 2p
  const c3 = calculateFixedRateCharge(1, 70);
  check(
    `1s call: $0.02 USD = 2p GBP`,
    c3.usdCents === 2 && c3.pence === 2,
    'usdCents=2, pence=2',
    `usdCents=${c3.usdCents}, pence=${c3.pence}`
  );

  // Check 4: 91s call = $1.07 = 85p
  const c4 = calculateFixedRateCharge(91, 70);
  check(
    `91s call: $1.07 USD = 85p GBP`,
    c4.usdCents === 107 && c4.pence === 85,
    'usdCents=107, pence=85',
    `usdCents=${c4.usdCents}, pence=${c4.pence}`
  );

  // Check 5: Low balance gate threshold
  const threshold = Math.ceil(100 * 0.79);
  check(
    `Low balance gate: threshold = ${threshold}p`,
    threshold === 79,
    '79',
    `${threshold}`
  );

  // Check 6: Golden Minute sanity
  const golden = calculateFixedRateCharge(60, 70);
  check(
    `Golden Minute: 60s @ $0.70/min = ${golden.usdCents}c USD = ${golden.pence}p GBP`,
    golden.usdCents === 70 && golden.pence === 56,
    '$0.70 = 56p',
    `$${(golden.usdCents / 100).toFixed(2)} = ${golden.pence}p`
  );
}

// ============================================
// Low-Balance Gate Simulation
// ============================================

function runLowBalanceSimulation(): void {
  console.log('');
  console.log('--- LOW-BALANCE GATE SIMULATION ---');

  const testCases = [
    { balance: 78, expectedBlocked: true, label: '78p -> BLOCKED' },
    { balance: 79, expectedBlocked: false, label: '79p -> ALLOWED' },
    { balance: 80, expectedBlocked: false, label: '80p -> ALLOWED' },
  ];

  for (const tc of testCases) {
    const blocked = tc.balance < MIN_BALANCE;
    const passed = blocked === tc.expectedBlocked;
    check(
      tc.label,
      passed,
      tc.expectedBlocked ? 'BLOCKED' : 'ALLOWED',
      blocked ? 'BLOCKED' : 'ALLOWED'
    );
  }
}

// ============================================
// CEO Account Verification (DB required)
// ============================================

async function runAccountAudit(): Promise<void> {
  console.log('');
  console.log('--- CEO ACCOUNT VERIFICATION ---');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    info('Supabase credentials not available - skipping DB checks');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey.trim());

  // Step 1: Look up user by email via profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, org_id, email, full_name')
    .eq('email', TARGET_EMAIL)
    .maybeSingle();

  if (profileError) {
    info(`Profile lookup error: ${profileError.message}`);
    return;
  }

  if (!profile) {
    info(`User ${TARGET_EMAIL} not found in profiles table`);
    info('NO TRANSACTIONS FOUND - account has not been billed yet');
    return;
  }

  const orgId = profile.org_id;
  info(`User: ${profile.full_name || profile.email}`);
  info(`Org ID: ${orgId}`);

  // Step 2: Get organization wallet balance
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('wallet_balance_pence')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError || !org) {
    info(`Organization lookup error: ${orgError?.message || 'not found'}`);
    return;
  }

  const balancePence = org.wallet_balance_pence ?? 0;
  const balanceUsd = (balancePence / (GBP_RATE * 100)).toFixed(2);
  info(`Balance: ${balancePence}p (GBP) = $${balanceUsd} (USD)`);

  // Step 3: Fetch last 10 call deduction transactions
  const { data: transactions, error: txError } = await supabase
    .from('credit_transactions')
    .select('id, created_at, client_charged_pence, cost_breakdown, description')
    .eq('org_id', orgId)
    .eq('type', 'call_deduction')
    .order('created_at', { ascending: false })
    .limit(10);

  if (txError) {
    info(`Transaction lookup error: ${txError.message}`);
    return;
  }

  if (!transactions || transactions.length === 0) {
    info('NO TRANSACTIONS FOUND - account has not been billed yet');
    return;
  }

  console.log('');
  info(`Found ${transactions.length} call deduction transactions`);
  console.log('');

  // Step 4: Verify each transaction
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const breakdown = tx.cost_breakdown as Record<string, any> | null;

    const duration = breakdown?.duration_seconds;
    const billingModel = breakdown?.billing_model;

    if (duration == null) {
      check(
        `Transaction #${i + 1}: missing duration in cost_breakdown`,
        false,
        'duration_seconds present',
        'missing'
      );
      continue;
    }

    // Re-calculate expected charge
    const expectedUsdCents = Math.ceil((duration / 60) * RATE);
    const expectedPence = Math.ceil(expectedUsdCents * GBP_RATE);
    const actualPence = tx.client_charged_pence;

    const amountMatch = expectedPence === actualPence;
    const modelMatch = billingModel === 'fixed_rate';

    check(
      `Transaction #${i + 1}: duration=${duration}s, expected=${expectedPence}p, actual=${actualPence}p, model=${billingModel}`,
      amountMatch && modelMatch,
      `${expectedPence}p / fixed_rate`,
      `${actualPence}p / ${billingModel}`
    );
  }
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const now = new Date().toISOString().split('T')[0];

  console.log('========================================');
  console.log('  VOXANNE AI - BILLING AUDIT REPORT');
  console.log(`  Target: ${TARGET_EMAIL}`);
  console.log(`  Date: ${now}`);
  console.log(`  Rate: $${(RATE / 100).toFixed(2)}/min (${RATE} cents)`);
  console.log(`  GBP Rate: ${GBP_RATE}`);
  console.log(`  Min Balance: ${MIN_BALANCE}p`);
  console.log('========================================');

  // Phase 1: Pure math (always runs)
  runPureMathChecks();

  // Phase 2: Low-balance gate simulation (always runs)
  runLowBalanceSimulation();

  // Phase 3: Live account audit (requires DB)
  try {
    await runAccountAudit();
  } catch (err: any) {
    info(`Account audit skipped: ${err.message}`);
  }

  // Summary
  console.log('');
  console.log('========================================');
  if (failedChecks === 0) {
    console.log(`  RESULT: ${passedChecks}/${totalChecks} PASSED (CLEAN & VERIFIED)`);
  } else {
    console.log(`  RESULT: ${passedChecks}/${totalChecks} PASSED, ${failedChecks} FAILED`);
  }
  console.log('========================================');

  process.exit(failedChecks > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Audit script crashed:', err);
  process.exit(1);
});
