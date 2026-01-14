
import { supabase } from '../services/supabase-client';
import { RedactionService } from '../services/redaction-service';

async function runPerformanceBenchmarks() {
    console.log('🏎️  PERFORMANCE BENCHMARKS & STRESS TEST');
    console.log('==================================================');

    let orgId: string | null = null;
    let slotTime = new Date(Date.now() + 86400000); // 24h from now
    slotTime.setMinutes(0, 0, 0);

    // Setup
    try {
        const { data } = await supabase.from('organizations').select('id').limit(1).single();
        if (!data) throw new Error('No Organization found.');
        orgId = data.id!;
        console.log(`ℹ️  Target Org: ${orgId}`);

        // Cleanup previous runs
        await supabase.from('appointment_holds').delete().eq('calendar_id', 'cal_perf_test');
    } catch (err: any) {
        console.error('Setup failed:', err.message);
        process.exit(1);
    }

    // =================================================================
    // TEST 1: DATABASE CONCURRENCY (Atomic Locking)
    // =================================================================
    console.log('\n🧪 TEST 1: High-Concurrency Slot Claims (100 Users)');
    console.log('--------------------------------------------------');

    const CONCURRENT_REQUESTS = 100;
    const stats1 = { successes: 0, conflicts: 0, errors: 0, totalTime: 0 };

    const start1 = performance.now();

    const promises = Array(CONCURRENT_REQUESTS).fill(0).map(async (_, i) => {
        try {
            const { data, error } = await supabase.rpc('claim_slot_atomic', {
                p_org_id: orgId,
                p_calendar_id: 'cal_perf_test',
                p_slot_time: slotTime.toISOString(),
                p_call_sid: `perf_call_${i}`,
                p_patient_name: `Perf User ${i}`,
                p_patient_phone: '+447700900000',
                p_hold_duration_minutes: 5
            });

            if (error) throw error;
            const result = data && data[0] ? data[0] : null;
            if (result?.success) stats1.successes++;
            else if (result?.action === 'OFFER_ALTERNATIVES') stats1.conflicts++;
            else {
                stats1.errors++;
                if (stats1.errors === 1) console.error('RPC Error Result:', JSON.stringify(result));
            }

        } catch (err: any) {
            stats1.errors++;
            if (stats1.errors === 1) {
                console.error('Example Error:', err.message || JSON.stringify(err));
            }
        }
    });

    await Promise.all(promises);
    stats1.totalTime = performance.now() - start1;

    console.log(`> Requests: ${CONCURRENT_REQUESTS}`);
    console.log(`> Time Taken: ${stats1.totalTime.toFixed(2)}ms`);
    console.log(`> Throughput: ${(CONCURRENT_REQUESTS / (stats1.totalTime / 1000)).toFixed(2)} RPS`);
    console.log(`> Successes: ${stats1.successes} (Expected: 1)`);
    console.log(`> Conflicts: ${stats1.conflicts} (Expected: 99)`);
    console.log(`> Errors: ${stats1.errors}`);

    if (stats1.successes !== 1 || stats1.conflicts < 90) {
        console.error('❌ FAILED: Atomic Locking broke under load.');
    } else {
        console.log('✅ PASSED: Atomic Integrity maintained under stress.');
    }

    // =================================================================
    // TEST 2: CPU LATENCY (Redaction Pipeline)
    // =================================================================
    console.log('\n🧪 TEST 2: Pipeline Latency (Redaction)');
    console.log('--------------------------------------------------');

    const ITERATIONS = 50;
    const input = "My name is John Doe, I have diabetes and my phone is 07700 900 456.";
    const latencies: number[] = [];

    const start2 = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
        const t0 = performance.now();
        RedactionService.redact(input);
        latencies.push(performance.now() - t0);
    }
    const totalTime2 = performance.now() - start2;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p99 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];

    console.log(`> Iterations: ${ITERATIONS}`);
    console.log(`> Avg Latency: ${avgLatency.toFixed(3)}ms`);
    console.log(`> P99 Latency: ${p99.toFixed(3)}ms`);

    if (avgLatency > 10) { // CPU task should be very fast (<10ms)
        console.warn('⚠️ WARNING: Redaction is slow.');
    } else {
        console.log('✅ PASSED: Redaction pipeline is optimized.');
    }

    // =================================================================
    // SUMMARY
    // =================================================================
    console.log('\n📊 PERFORMANCE REPORT');
    console.log('==================================================');

    if (stats1.successes === 1 && avgLatency < 50) {
        console.log('🏆 SYSTEM PERFORMANCE: OPTIMAL');
        process.exit(0);
    } else {
        console.error('🔥 SYSTEM PERFORMANCE: DEGRADED');
        process.exit(1);
    }
}

runPerformanceBenchmarks();
