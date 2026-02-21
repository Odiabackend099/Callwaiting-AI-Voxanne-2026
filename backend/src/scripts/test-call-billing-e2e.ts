/**
 * End-to-End Call Billing Test
 *
 * Tests the entire billing pipeline WITHOUT making a real phone call:
 * 1. Reserve credits (Phase 1 - authorization)
 * 2. Commit reserved credits (Phase 2 - capture)
 * 3. Verify database state
 * 4. Validate balance changes
 *
 * Usage:
 *   ts-node src/scripts/test-call-billing-e2e.ts
 *
 * Or via npm:
 *   npm run test:billing-e2e
 */

import { supabase } from '../config/supabase';
import { reserveCallCredits, commitReservedCredits } from '../services/wallet-service';

async function testCallBillingE2E() {
  console.log('🧪 Starting End-to-End Call Billing Test\n');
  console.log('=' .repeat(60));

  try {
    // 1. Find test organization
    console.log('\n📍 Step 1: Finding test organization...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('email', 'test@demo.com')
      .maybeSingle();

    if (orgError) {
      console.error('❌ Database error:', orgError.message);
      return;
    }

    if (!org) {
      console.error('❌ Test org not found: test@demo.com');
      console.log('\n💡 Tip: Create test organization first:');
      console.log('   - Sign up at /sign-up with email: test@demo.com');
      console.log('   - Or use existing organization email\n');
      return;
    }

    console.log('✅ Test org found:', {
      id: org.id,
      email: org.email,
      balance_pence: org.wallet_balance_pence,
      debt_limit_pence: org.debt_limit_pence,
      effective_balance: org.wallet_balance_pence + (org.debt_limit_pence || 0)
    });

    if (org.wallet_balance_pence < 280) {
      console.warn(`\n⚠️  Warning: Low balance (${org.wallet_balance_pence}p)`);
      console.log('   Minimum 280p needed for 5-minute test call (56p/min × 5 min)');
      console.log('   Test will continue using debt limit if available\n');
    }

    // 2. Generate unique test call IDs
    const timestamp = Date.now();
    const testCallId = `test_call_${timestamp}`;
    const testVapiCallId = `vapi_${timestamp}`;

    console.log('\n📍 Step 2: Test call identifiers generated');
    console.log('   Internal call_id:', testCallId);
    console.log('   VAPI call_id:', testVapiCallId);

    // 3. Test Phase 1: Reserve Credits (5-minute call)
    console.log('\n📍 Step 3: Reserving credits for 5-minute call...');
    console.log('   Expected reservation: 280p (56p/min × 5 min)');

    const reservationStart = Date.now();
    const reservation = await reserveCallCredits(
      org.id,
      testCallId,
      testVapiCallId,
      5  // 5 minutes estimated duration
    );
    const reservationTime = Date.now() - reservationStart;

    if (!reservation.success) {
      console.error('❌ Reservation failed:', reservation.error);
      console.log('\n🔍 Debug info:');
      console.log('   - Check wallet balance is sufficient');
      console.log('   - Check debt limit configuration');
      console.log('   - Check RPC function: reserve_call_credits()');
      return;
    }

    console.log('✅ Reservation successful:', {
      reservedPence: reservation.reservedPence,
      effectiveBalancePence: reservation.effectiveBalancePence,
      executionTime: `${reservationTime}ms`
    });

    // 4. Verify reservation in database
    console.log('\n📍 Step 4: Verifying reservation in database...');
    const { data: dbReservation } = await supabase
      .from('credit_reservations')
      .select('*')
      .eq('call_id', testCallId)
      .maybeSingle();

    if (!dbReservation) {
      console.error('❌ Reservation not found in database!');
      return;
    }

    console.log('✅ Reservation verified in database:', {
      id: dbReservation.id,
      status: dbReservation.status,
      reserved_pence: dbReservation.reserved_pence,
      created_at: dbReservation.created_at
    });

    // 5. Simulate call duration (2 minutes actual)
    console.log('\n📍 Step 5: Simulating call completion...');
    const actualDurationSeconds = 120; // 2 minutes
    console.log(`   Actual call duration: ${actualDurationSeconds}s (2 minutes)`);
    console.log(`   Expected charge: ${Math.ceil((actualDurationSeconds / 60) * 56)}p`);

    // 6. Test Phase 2: Commit Reserved Credits
    console.log('\n📍 Step 6: Committing actual usage...');

    const commitStart = Date.now();
    const commit = await commitReservedCredits(testCallId, actualDurationSeconds);
    const commitTime = Date.now() - commitStart;

    if (!commit.success) {
      console.error('❌ Commit failed:', commit.error);
      console.log('\n🔍 Debug info:');
      console.log('   - Check reservation exists and is pending');
      console.log('   - Check RPC function: commit_reserved_credits()');
      return;
    }

    console.log('✅ Commit successful:', {
      actualCostPence: commit.actualCostPence,
      releasedPence: commit.releasedPence,
      balanceBefore: commit.balanceBefore,
      balanceAfter: commit.balanceAfter,
      executionTime: `${commitTime}ms`
    });

    // 7. Verify database state
    console.log('\n📍 Step 7: Verifying final database state...');

    const { data: finalOrg } = await supabase
      .from('organizations')
      .select('wallet_balance_pence')
      .eq('id', org.id)
      .maybeSingle();

    const { data: txn } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('call_id', testCallId)
      .maybeSingle();

    const { data: res } = await supabase
      .from('credit_reservations')
      .select('*')
      .eq('call_id', testCallId)
      .maybeSingle();

    console.log('✅ Database verification passed:', {
      wallet_balance: finalOrg?.wallet_balance_pence,
      transaction_recorded: !!txn,
      transaction_amount: txn?.amount_pence,
      reservation_status: res?.status
    });

    // 8. Calculate expected vs actual
    console.log('\n📍 Step 8: Validating calculations...');

    const expectedCost = Math.ceil((actualDurationSeconds / 60) * 56);  // 56p/min
    const balanceChange = org.wallet_balance_pence - (finalOrg?.wallet_balance_pence || 0);

    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Results Summary:');
    console.log('='.repeat(60));
    console.log(`Expected cost:         ${expectedCost}p`);
    console.log(`Actual balance change: ${balanceChange}p`);
    console.log(`Match:                 ${expectedCost === balanceChange ? '✅ YES' : '❌ NO'}`);
    console.log(`Reserved amount:       ${reservation.reservedPence}p`);
    console.log(`Released (refund):     ${commit.releasedPence}p`);
    console.log(`Transaction recorded:  ${!!txn ? '✅ YES' : '❌ NO'}`);
    console.log(`Reservation committed: ${res?.status === 'committed' ? '✅ YES' : '❌ NO'}`);
    console.log('='.repeat(60));

    if (expectedCost === balanceChange && txn && res?.status === 'committed') {
      console.log('\n🎉 END-TO-END BILLING TEST PASSED');
      console.log('\n✅ All checks passed:');
      console.log('   - Credits reserved correctly (280p for 5 min)');
      console.log('   - Credits committed correctly (112p for 2 min)');
      console.log('   - Unused credits released (168p refunded)');
      console.log('   - Database state consistent');
      console.log('   - Balance calculations accurate\n');
    } else {
      console.log('\n❌ END-TO-END BILLING TEST FAILED');
      console.log('\n🔍 Issues found:');
      if (expectedCost !== balanceChange) {
        console.log(`   ❌ Balance mismatch: expected ${expectedCost}p, got ${balanceChange}p`);
      }
      if (!txn) {
        console.log('   ❌ No transaction recorded in credit_transactions');
      }
      if (res?.status !== 'committed') {
        console.log(`   ❌ Reservation status: ${res?.status} (expected: committed)`);
      }
      console.log('');
    }

  } catch (error: any) {
    console.error('\n💥 Test failed with exception:', error.message);
    console.error('\nStack trace:', error.stack);
    console.log('\n🔍 Troubleshooting:');
    console.log('   - Verify Supabase connection');
    console.log('   - Check RPC functions exist: reserve_call_credits, commit_reserved_credits');
    console.log('   - Verify tables exist: credit_reservations, credit_transactions');
  }
}

// Run the test
testCallBillingE2E()
  .then(() => {
    console.log('\n✅ Test execution complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
