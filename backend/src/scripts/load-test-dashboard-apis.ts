#!/usr/bin/env npx tsx
/**
 * Load Test Dashboard APIs
 * Deliverable #4: backend/src/scripts/load-test-dashboard-apis.ts
 *
 * Tests: p50/p95/p99 response times for 100 concurrent requests
 * Target: Sub-200ms at p95
 *
 * Usage: npx tsx src/scripts/load-test-dashboard-apis.ts
 * Requires: Backend running on localhost:3001
 */

import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const CONCURRENCY = 50;
const ITERATIONS = 100;

interface LoadTestResult {
    endpoint: string;
    method: string;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    avg: number;
    errors: number;
    total: number;
}

function percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

async function runLoadTest(
    name: string,
    method: string,
    path: string,
    concurrent: number,
    total: number
): Promise<LoadTestResult> {
    const latencies: number[] = [];
    let errors = 0;

    const runSingle = async () => {
        const start = Date.now();
        try {
            const response = await fetch(`${BASE_URL}${path}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
            });
            const latency = Date.now() - start;
            latencies.push(latency);
            if (response.status >= 500) errors++;
        } catch {
            errors++;
            latencies.push(Date.now() - start);
        }
    };

    // Execute in batches
    for (let i = 0; i < total; i += concurrent) {
        const batchSize = Math.min(concurrent, total - i);
        const batch = Array.from({ length: batchSize }, () => runSingle());
        await Promise.all(batch);
    }

    const result: LoadTestResult = {
        endpoint: path,
        method,
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        p99: percentile(latencies, 99),
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
        errors,
        total: latencies.length,
    };

    const p95Status = result.p95 < 200 ? '✅' : '⚠️';
    console.log(`${p95Status} ${name}: p50=${result.p50}ms p95=${result.p95}ms p99=${result.p99}ms avg=${result.avg}ms errors=${errors}/${total}`);

    return result;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DASHBOARD API LOAD TEST');
    console.log(`  Base URL: ${BASE_URL}`);
    console.log(`  Concurrency: ${CONCURRENCY} | Iterations: ${ITERATIONS}`);
    console.log(`  Run at: ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    const results: LoadTestResult[] = [];

    // Test 1: Call List (most frequent endpoint)
    results.push(await runLoadTest('Call List', 'GET', '/api/calls-dashboard?limit=10&offset=0', CONCURRENCY, ITERATIONS));

    // Test 2: Dashboard Stats
    results.push(await runLoadTest('Dashboard Stats', 'GET', '/api/calls-dashboard/stats?time_window=7d', CONCURRENCY, ITERATIONS));

    // Test 3: Health Check
    results.push(await runLoadTest('Health Check', 'GET', '/api/health/dashboard', CONCURRENCY, ITERATIONS));

    // ── Summary ──
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  LOAD TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Endpoint                  p50    p95    p99    avg    errors');
    console.log('  ─────────────────────────────────────────────────────────────');
    for (const r of results) {
        const name = `${r.method} ${r.endpoint}`.padEnd(28);
        console.log(`  ${name}${String(r.p50).padStart(4)}ms ${String(r.p95).padStart(4)}ms ${String(r.p99).padStart(4)}ms ${String(r.avg).padStart(4)}ms ${r.errors}/${r.total}`);
    }

    const allPass = results.every(r => r.p95 < 200 && r.errors === 0);
    console.log(`\n  Target: p95 < 200ms`);
    console.log(`  Result: ${allPass ? '✅ ALL TARGETS MET' : '⚠️ SOME TARGETS MISSED'}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
