/**
 * Billing Configuration Audit Script
 *
 * Verifies that no legacy markup multipliers or hidden rate adjustments exist.
 * Ensures all billing constants match the CTO directive.
 *
 * Run: npx ts-node src/scripts/audit-billing-config.ts
 */

import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

interface AuditResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  expected: any;
  actual: any;
  details: string;
}

const results: AuditResult[] = [];

console.log('🔍 Billing Configuration Audit\n');
console.log('=' .repeat(70));
console.log('CTO Directive: Verify NO legacy markup multipliers exist');
console.log('=' .repeat(70));
console.log('');

/**
 * Check 1: Rate constant is exactly 70
 */
function check1_rateConstant(): AuditResult {
  const expected = 70;
  const actual = config.RATE_PER_MINUTE_USD_CENTS;

  return {
    check: 'Check 1: RATE_PER_MINUTE_USD_CENTS === 70',
    status: actual === expected ? 'PASS' : 'FAIL',
    expected,
    actual,
    details: actual === expected
      ? '✅ Rate constant is correct'
      : `❌ CRITICAL: Rate is ${actual}, should be 70`,
  };
}

/**
 * Check 2: USD to GBP rate is 0.79
 */
function check2_exchangeRate(): AuditResult {
  const expected = '0.79';
  const actual = config.USD_TO_GBP_RATE;

  return {
    check: 'Check 2: USD_TO_GBP_RATE === "0.79"',
    status: actual === expected ? 'PASS' : 'WARNING',
    expected,
    actual,
    details: actual === expected
      ? '✅ Exchange rate is correct'
      : `⚠️ Exchange rate is ${actual} (may be outdated)`,
  };
}

/**
 * Check 3: Minimum balance for call is 79 pence ($1.00)
 */
function check3_minBalance(): AuditResult {
  const expected = 79;
  const actual = config.WALLET_MIN_BALANCE_FOR_CALL;

  return {
    check: 'Check 3: WALLET_MIN_BALANCE_FOR_CALL === 79',
    status: actual === expected ? 'PASS' : 'WARNING',
    expected,
    actual,
    details: actual === expected
      ? '✅ Minimum balance is correct ($1.00 = 79p)'
      : `⚠️ Minimum balance is ${actual}p (may have changed)`,
  };
}

/**
 * Check 4: Low balance warning threshold is reasonable
 */
function check4_lowBalanceWarning(): AuditResult {
  const expected = 1400; // $14.00 = ~20 minutes at $0.70/min
  const actual = config.WALLET_LOW_BALANCE_WARNING_CENTS;

  return {
    check: 'Check 4: WALLET_LOW_BALANCE_WARNING_CENTS is reasonable',
    status: actual === expected ? 'PASS' : 'WARNING',
    expected,
    actual,
    details: `Balance warning triggers at ${actual} cents ($${(actual/100).toFixed(2)})`,
  };
}

/**
 * Check 5: No wallet_markup_percent in service layer
 */
function check5_noMarkupInService(): AuditResult {
  const servicePath = path.join(__dirname, '../services/wallet-service.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');

  // Check if wallet_markup_percent appears (should not)
  const hasMarkupReference = serviceContent.includes('wallet_markup_percent');

  // The only allowed reference is in the RPC call where it's set to 0
  const rpcCallPattern = /p_markup_percent:\s*0/;
  const correctUsage = rpcCallPattern.test(serviceContent);

  const status = !hasMarkupReference || correctUsage ? 'PASS' : 'FAIL';

  return {
    check: 'Check 5: No wallet_markup_percent in billing logic',
    status,
    expected: 'p_markup_percent: 0',
    actual: correctUsage ? 'p_markup_percent: 0' : 'markup found',
    details: status === 'PASS'
      ? '✅ Fixed-rate model confirmed (no markup multiplication)'
      : '❌ CRITICAL: Markup percentage found in service layer',
  };
}

/**
 * Check 6: Configuration file has no conditional rate adjustments
 */
function check6_noConditionalRates(): AuditResult {
  const configPath = path.join(__dirname, '../config/index.ts');
  const configContent = fs.readFileSync(configPath, 'utf-8');

  // Check for conditional rate logic (shouldn't exist)
  const hasConditionalRate = /RATE_PER_MINUTE.*\?|if.*RATE_PER_MINUTE/i.test(configContent);

  return {
    check: 'Check 6: No conditional rate adjustments',
    status: !hasConditionalRate ? 'PASS' : 'FAIL',
    expected: 'Static rate constant',
    actual: hasConditionalRate ? 'Conditional logic found' : 'Static constant',
    details: !hasConditionalRate
      ? '✅ Rate is static (no per-org adjustments)'
      : '❌ CRITICAL: Conditional rate logic detected',
  };
}

/**
 * Check 7: Billing manager routes to wallet-service correctly
 */
function check7_billingManagerRouting(): AuditResult {
  const managerPath = path.join(__dirname, '../services/billing-manager.ts');
  const managerContent = fs.readFileSync(managerPath, 'utf-8');

  // Check that it imports from wallet-service
  const importsWalletService = managerContent.includes('from \'./wallet-service\'');

  // Check that it calls deductCallCredits
  const callsDeductCredits = managerContent.includes('deductCallCredits');

  const status = importsWalletService && callsDeductCredits ? 'PASS' : 'FAIL';

  return {
    check: 'Check 7: Billing manager routes to wallet-service',
    status,
    expected: 'Imports and calls deductCallCredits',
    actual: importsWalletService && callsDeductCredits ? 'Correct routing' : 'Incorrect',
    details: status === 'PASS'
      ? '✅ Billing flows through wallet-service'
      : '❌ CRITICAL: Billing manager routing incorrect',
  };
}

/**
 * Check 8: Credits per minute display ratio is 10:1
 */
function check8_creditsPerMinute(): AuditResult {
  const expected = 10;
  const actual = config.CREDITS_PER_MINUTE;

  return {
    check: 'Check 8: CREDITS_PER_MINUTE === 10',
    status: actual === expected ? 'PASS' : 'WARNING',
    expected,
    actual,
    details: actual === expected
      ? '✅ Display ratio is correct (10 credits = 1 minute)'
      : `⚠️ Display ratio is ${actual}:1 (may confuse users)`,
  };
}

/**
 * Check 9: Verify calculateFixedRateCharge uses config constant
 */
function check9_calculationUsesConfig(): AuditResult {
  const servicePath = path.join(__dirname, '../services/wallet-service.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');

  // Check that calculateFixedRateCharge uses config.RATE_PER_MINUTE_USD_CENTS
  const usesConfigConstant = serviceContent.includes('config.RATE_PER_MINUTE_USD_CENTS');

  // Also check the function signature has default parameter
  const hasDefaultParam = /ratePerMinuteCents.*=.*config\.RATE_PER_MINUTE_USD_CENTS/.test(serviceContent);

  const status = usesConfigConstant && hasDefaultParam ? 'PASS' : 'FAIL';

  return {
    check: 'Check 9: calculateFixedRateCharge uses config constant',
    status,
    expected: 'Uses config.RATE_PER_MINUTE_USD_CENTS',
    actual: usesConfigConstant ? 'Uses config constant' : 'Hardcoded value',
    details: status === 'PASS'
      ? '✅ Billing calculation uses centralized config'
      : '❌ CRITICAL: Billing uses hardcoded rate',
  };
}

/**
 * Check 10: No organization-specific rate overrides
 */
function check10_noOrgOverrides(): AuditResult {
  const servicePath = path.join(__dirname, '../services/wallet-service.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');

  // Check for org-specific rate logic (shouldn't exist)
  const hasOrgSpecificRate = /org.*rate|rate.*org_id/i.test(serviceContent);

  return {
    check: 'Check 10: No organization-specific rate overrides',
    status: !hasOrgSpecificRate ? 'PASS' : 'FAIL',
    expected: 'Same rate for all organizations',
    actual: hasOrgSpecificRate ? 'Org-specific logic found' : 'Uniform rate',
    details: !hasOrgSpecificRate
      ? '✅ All organizations pay $0.70/min'
      : '❌ CRITICAL: Per-organization rate logic detected',
  };
}

/**
 * Run all checks
 */
function runAudit() {
  console.log('Running 10 configuration checks...\n');

  results.push(check1_rateConstant());
  results.push(check2_exchangeRate());
  results.push(check3_minBalance());
  results.push(check4_lowBalanceWarning());
  results.push(check5_noMarkupInService());
  results.push(check6_noConditionalRates());
  results.push(check7_billingManagerRouting());
  results.push(check8_creditsPerMinute());
  results.push(check9_calculationUsesConfig());
  results.push(check10_noOrgOverrides());

  // Print results
  console.log('=' .repeat(70));
  console.log('Audit Results:\n');

  let passCount = 0;
  let warningCount = 0;
  let failCount = 0;

  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' :
                 result.status === 'WARNING' ? '⚠️' : '❌';

    console.log(`${icon} ${result.check}`);
    console.log(`   Expected: ${JSON.stringify(result.expected)}`);
    console.log(`   Actual:   ${JSON.stringify(result.actual)}`);
    console.log(`   ${result.details}`);
    console.log('');

    if (result.status === 'PASS') passCount++;
    else if (result.status === 'WARNING') warningCount++;
    else failCount++;
  });

  console.log('=' .repeat(70));
  console.log(`\nTotal: ${results.length} checks`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`⚠️ Warnings: ${warningCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log('');

  if (failCount === 0 && warningCount === 0) {
    console.log('🎉 ALL CONFIGURATIONS MATCH CTO DIRECTIVE');
    console.log('✅ No legacy markup multipliers found');
    console.log('✅ No conditional rate adjustments');
    console.log('✅ No organization-specific overrides');
    console.log('✅ Billing constants are correct');
  } else if (failCount === 0) {
    console.log('✅ CONFIGURATION AUDIT PASSED (with warnings)');
    console.log(`⚠️ ${warningCount} warning(s) - review above for details`);
  } else {
    console.log('❌ CONFIGURATION AUDIT FAILED');
    console.log(`❌ ${failCount} critical issue(s) found`);
    console.log('❌ Review failed checks above');
  }

  console.log('');

  process.exit(failCount === 0 ? 0 : 1);
}

// Run audit
runAudit();
