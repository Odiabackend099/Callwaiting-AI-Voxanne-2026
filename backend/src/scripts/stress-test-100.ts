/**
 * 100-Call Concurrent Stress Test
 * Proves atomic locking prevents double-booking at scale
 * 
 * Expected Result: 1 success, 99 failures
 */

import { config } from 'dotenv';
import path from 'path';

// Load env
config({ path: path.join(__dirname, '../../.env') });
process.env.SUPABASE_FETCH_TIMEOUT_MS = '30000';

import { supabase } from '../services/supabase-client';
import { AtomicBookingService } from '../services/atomic-booking-service';

async function run100CallStressTest() {
    console.log('🔥 STARTING 100-CALL CONCURRENT STRESS TEST 🔥');
    console.log('='.repeat(60));

    try {
        // Get QA org
        const { data: org } = await supabase.from('organizations')
            .select('id, name')
            .eq('name', 'QA Audit Labs')
            .limit(1)
            .single();

        if (!org) {
            throw new Error('QA Audit Labs organization not found. Run seed-qa.ts first.');
        }

        const orgId = org.id;
        console.log(`Testing against Organization: ${org.id} (${org.name})\n`);

        // Clean up old test holds
        console.log('🧹 Cleaning up old test holds...');
        await supabase.from('appointment_holds')
            .delete()
            .like('call_sid', 'stress_test_call_%');

        // Define slot time (tomorrow at 2 PM)
        const slotTime = new Date();
        slotTime.setDate(slotTime.getDate() + 1);
        slotTime.setHours(14, 0, 0, 0);

        console.log(`📅 Target Slot: ${slotTime.toISOString()}`);
        console.log(`⏱️  Preparing 100 concurrent requests...\n`);

        // Create 100 concurrent requests
        const requests = Array.from({ length: 100 }, (_, i) =>
            AtomicBookingService.claimSlotAtomic(
                orgId,
                'primary',
                slotTime,
                `stress_test_call_${i}`,
                `Patient ${i}`,
                `+1555000${String(i).padStart(4, '0')}`
            )
        );

        // Execute all concurrently
        console.log('🚀 Executing 100 concurrent requests...');
        const startTime = Date.now();
        const results = await Promise.all(requests);
        const duration = Date.now() - startTime;

        // Analyze results
        const successes = results.filter(r => r.success);
        const failures = results.filter(r => !r.success);

        console.log('\n' + '='.repeat(60));
        console.log('📊 STRESS TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`✅ Successes: ${successes.length}`);
        console.log(`❌ Failures: ${failures.length}`);
        console.log(`⏱️  Total Time: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
        console.log(`⚡ Avg Time per Request: ${(duration / 100).toFixed(2)}ms`);

        // Detailed success info
        if (successes.length > 0) {
            console.log('\n📝 Successful Requests:');
            successes.forEach((s, i) => {
                console.log(`  ${i + 1}. Hold ID: ${s.holdId}`);
            });
        }

        // Sample failure reasons
        if (failures.length > 0) {
            console.log('\n📝 Sample Failure Reasons (first 3):');
            failures.slice(0, 3).forEach((f, i) => {
                console.log(`  ${i + 1}. ${f.error} (Action: ${f.action})`);
            });
        }

        // Verify database state
        console.log('\n🔍 Verifying Database State...');
        const { data: holds, error: holdsError } = await supabase
            .from('appointment_holds')
            .select('id, call_sid, status')
            .like('call_sid', 'stress_test_call_%')
            .eq('status', 'held');

        if (holdsError) {
            console.error('❌ Error querying holds:', holdsError);
        } else {
            console.log(`📦 Active Holds in DB: ${holds?.length || 0}`);
        }

        // Cleanup
        console.log('\n🧹 Cleaning up test holds...');
        const { error: cleanupError } = await supabase
            .from('appointment_holds')
            .delete()
            .like('call_sid', 'stress_test_call_%');

        if (cleanupError) {
            console.error('❌ Cleanup error:', cleanupError);
        } else {
            console.log('✅ Cleanup complete');
        }

        // Final verdict
        console.log('\n' + '='.repeat(60));
        if (successes.length === 1 && failures.length === 99) {
            console.log('✅ STRESS TEST PASSED');
            console.log('   Atomic locking working perfectly!');
            console.log('   Only 1 request succeeded, 99 were blocked.');
        } else if (successes.length === 0 && failures.length === 100) {
            console.log('⚠️  STRESS TEST PARTIAL PASS');
            console.log('   No double-booking occurred (safe)');
            console.log('   But all requests failed (investigate logic)');
        } else if (successes.length > 1) {
            console.log('❌ STRESS TEST FAILED');
            console.log(`   CRITICAL: ${successes.length} requests succeeded!`);
            console.log('   Double-booking vulnerability detected!');
        } else {
            console.log('⚠️  STRESS TEST INCONCLUSIVE');
            console.log(`   Unexpected result: ${successes.length} successes, ${failures.length} failures`);
        }
        console.log('='.repeat(60));

    } catch (error: any) {
        console.error('\n❌ STRESS TEST ERROR:', error.message);
        process.exit(1);
    }
}

run100CallStressTest();
