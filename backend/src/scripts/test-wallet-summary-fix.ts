#!/usr/bin/env ts-node
/**
 * TEST: Wallet Summary RPC Fix
 * 
 * This script tests that the fixed get_wallet_summary() RPC function returns data correctly.
 * Run AFTER applying the migration: supabase/migrations/20260213_fix_wallet_summary_rpc.sql
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n🧪 Testing Wallet Summary RPC Fix\n');

  // Test with demo org
  const testOrgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

  try {
    console.log(`Testing org: ${testOrgId}\n`);

    // Call the fixed RPC function
    const { data, error } = await supabase.rpc('get_wallet_summary', {
      p_org_id: testOrgId,
    });

    if (error) {
      console.error('❌ RPC ERROR:', error.message);
      console.error('Details:', error);
      process.exit(1);
    }

    if (!data) {
      console.error('❌ RPC returned null data');
      process.exit(1);
    }

    console.log('✅ RPC returned data successfully!\n');
    console.log('Response:');
    console.log(JSON.stringify(data, null, 2));

    // Verify key fields
    const requiredFields = [
      'balance_pence',
      'balance_formatted',
      'low_balance_pence',
      'auto_recharge_enabled',
      'recharge_amount_pence',
      'total_spent_pence',
      'total_calls',
      'total_topped_up_pence',
      'total_profit_pence',
    ];

    console.log('\n📊 Field Validation:\n');
    let allFieldsPresent = true;
    requiredFields.forEach((field) => {
      const exists = field in data;
      const status = exists ? '✅' : '❌';
      console.log(`${status} ${field}: ${exists ? data[field] : 'MISSING'}`);
      if (!exists) allFieldsPresent = false;
    });

    if (!allFieldsPresent) {
      console.error('\n❌ Some fields are missing from RPC response');
      process.exit(1);
    }

    console.log('\n✅ All fields present!\n');

    // Verify data types
    console.log('📋 Data Type Validation:\n');
    const typeChecks = {
      balance_pence: 'number',
      balance_formatted: 'string',
      low_balance_pence: 'number',
      auto_recharge_enabled: 'boolean',
      recharge_amount_pence: 'number',
      total_spent_pence: 'number',
      total_calls: 'number',
      total_topped_up_pence: 'number',
      total_profit_pence: 'number',
    };

    let allTypesCorrect = true;
    Object.entries(typeChecks).forEach(([field, expectedType]) => {
      const actualType = typeof data[field];
      const isCorrect = actualType === expectedType;
      const status = isCorrect ? '✅' : '❌';
      console.log(`${status} ${field}: ${actualType} (expected: ${expectedType})`);
      if (!isCorrect) allTypesCorrect = false;
    });

    if (!allTypesCorrect) {
      console.error('\n❌ Some fields have incorrect types');
      process.exit(1);
    }

    console.log('\n✅ All types correct!\n');

    // Summary
    console.log('━'.repeat(60));
    console.log('🎉 SUCCESS: Wallet Summary RPC fix is working correctly!');
    console.log('━'.repeat(60));
    console.log('\nSummary for wallet page:');
    console.log(`  Current Balance: ${data.balance_formatted}`);
    console.log(`  Total Spent: £${(data.total_spent_pence / 100).toFixed(2)}`);
    console.log(`  Total Top-Ups: £${(data.total_topped_up_pence / 100).toFixed(2)}`);
    console.log(`  Total Calls: ${data.total_calls}`);
    console.log(`  Auto-Recharge: ${data.auto_recharge_enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log();
    
    process.exit(0);
  } catch (err) {
    console.error('❌ FATAL ERROR:', err);
    process.exit(1);
  }
}

main();
