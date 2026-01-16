/**
 * MASTER_ORCHESTRATOR_LOAD_TEST.ts
 * 
 * Comprehensive load testing for the Master Orchestrator implementation
 * Tests all 5 tasks under realistic load conditions
 * 
 * Run with: npx ts-node scripts/master-orchestrator-load-test.ts
 */

import fetch from 'node-fetch';

interface LoadTestResult {
  name: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  errors: string[];
}

class MasterOrchestratorLoadTest {
  private baseUrl = 'http://localhost:3000';
  private backendUrl = 'http://localhost:8000';
  private results: LoadTestResult[] = [];

  /**
   * Task 1: Atomic Slot Locking - Test concurrent claims
   */
  async testAtomicSlotLocking(): Promise<LoadTestResult> {
    const testName = 'Task 1: Atomic Slot Locking';
    console.log(`\n🧪 Testing ${testName}...`);

    const latencies: number[] = [];
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const concurrency = 10;  // 10 concurrent attempts on same slot
    const promises = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        (async () => {
          const start = Date.now();
          try {
            const response = await fetch(
              `${this.backendUrl}/api/booking/claim-slot-atomic`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  slotId: 'slot-test-1',
                  orgId: 'org-test-1',
                  patientPhone: '+1234567890',
                  ttlMinutes: 15,
                }),
              }
            );

            const latency = Date.now() - start;
            latencies.push(latency);

            if (response.ok) {
              successCount++;
            } else {
              errorCount++;
              errors.push(`HTTP ${response.status}`);
            }
          } catch (err: any) {
            errorCount++;
            errors.push(err.message);
            latencies.push(Date.now() - start);
          }
        })()
      );
    }

    await Promise.all(promises);

    return this.generateResult(testName, latencies, successCount, errorCount, errors);
  }

  /**
   * Task 2: Contextual Memory - Test booking confirmation handoff
   */
  async testContextualMemory(): Promise<LoadTestResult> {
    const testName = 'Task 2: Contextual Memory (SMS Handoff)';
    console.log(`\n🧪 Testing ${testName}...`);

    const latencies: number[] = [];
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Simulate call ended without confirmation → SMS trigger
    for (let i = 0; i < 20; i++) {
      const start = Date.now();
      try {
        const response = await fetch(
          `${this.backendUrl}/api/webhooks/vapi/call-ended`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callId: `call-${i}`,
              orgId: 'org-test-1',
              phoneNumber: '+1234567890',
              bookingConfirmed: false,
              duration: 120,
            }),
          }
        );

        const latency = Date.now() - start;
        latencies.push(latency);

        if (response.ok || response.status === 202) {
          // 202 Accepted for async SMS
          successCount++;
        } else {
          errorCount++;
          errors.push(`HTTP ${response.status}`);
        }
      } catch (err: any) {
        errorCount++;
        errors.push(err.message);
        latencies.push(Date.now() - start);
      }
    }

    return this.generateResult(testName, latencies, successCount, errorCount, errors);
  }

  /**
   * Task 3: PII Redaction - Test redaction at scale
   */
  async testPIIRedaction(): Promise<LoadTestResult> {
    const testName = 'Task 3: PII Redaction';
    console.log(`\n🧪 Testing ${testName}...`);

    const latencies: number[] = [];
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const testInputs = [
      'Patient contact: john@example.com, phone +1-202-555-0173',
      'Address: 123 Main St, New York, NY 10001',
      'Medical history: Had cardiac surgery in 2020',
      'Insurance: +44 20 7946 0958, postcode SW1A 2AA',
      'Call notes: Patient called from 07700 900000, emergency situation',
    ];

    for (let i = 0; i < 50; i++) {
      const input = testInputs[i % testInputs.length];
      const start = Date.now();
      try {
        const response = await fetch(`${this.backendUrl}/api/redaction/redact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: input }),
        });

        const latency = Date.now() - start;
        latencies.push(latency);

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`HTTP ${response.status}`);
        }
      } catch (err: any) {
        errorCount++;
        errors.push(err.message);
        latencies.push(Date.now() - start);
      }
    }

    return this.generateResult(testName, latencies, successCount, errorCount, errors);
  }

  /**
   * Task 4: Latency Optimization - Measure TTFB
   */
  async testLatencyOptimization(): Promise<LoadTestResult> {
    const testName = 'Task 4: Latency Optimization (TTFB)';
    console.log(`\n🧪 Testing ${testName}...`);

    const latencies: number[] = [];
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < 50; i++) {
      const start = Date.now();
      try {
        const response = await fetch(
          `${this.backendUrl}/api/calendar/check-availability`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenantId: `org-test-${i % 5}`,
              date: '2026-01-20',
              serviceType: 'consultation',
            }),
          }
        );

        const latency = Date.now() - start;
        latencies.push(latency);

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          errors.push(`HTTP ${response.status}`);
        }
      } catch (err: any) {
        errorCount++;
        errors.push(err.message);
        latencies.push(Date.now() - start);
      }
    }

    return this.generateResult(testName, latencies, successCount, errorCount, errors);
  }

  /**
   * Task 5: Multi-Tenant RLS - Test isolation
   */
  async testMultiTenantRLS(): Promise<LoadTestResult> {
    const testName = 'Task 5: Multi-Tenant RLS Isolation';
    console.log(`\n🧪 Testing ${testName}...`);

    const latencies: number[] = [];
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Try to access org-1 data with org-2 JWT
    for (let i = 0; i < 30; i++) {
      const start = Date.now();
      try {
        const response = await fetch(
          `${this.backendUrl}/api/org/org-test-1/appointments`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.getJWT('org-test-2')}`,  // Wrong org
              'Content-Type': 'application/json',
            },
          }
        );

        const latency = Date.now() - start;
        latencies.push(latency);

        // Should get 403 Forbidden for cross-tenant access
        if (response.status === 403) {
          successCount++;  // Correct: denied access
        } else if (response.status === 401) {
          errorCount++;
          errors.push('401 Unauthorized (RLS may not be enforced)');
        } else {
          errorCount++;
          errors.push(`HTTP ${response.status} (expected 403)`);
        }
      } catch (err: any) {
        errorCount++;
        errors.push(err.message);
        latencies.push(Date.now() - start);
      }
    }

    return this.generateResult(testName, latencies, successCount, errorCount, errors);
  }

  /**
   * Generate result summary from latency data
   */
  private generateResult(
    name: string,
    latencies: number[],
    successCount: number,
    errorCount: number,
    errors: string[]
  ): LoadTestResult {
    const sorted = latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    const result: LoadTestResult = {
      name,
      totalRequests: latencies.length,
      successCount,
      errorCount,
      avgLatency: Math.round(avg),
      p95Latency: p95,
      p99Latency: p99,
      minLatency: sorted[0],
      maxLatency: sorted[sorted.length - 1],
      errors: [...new Set(errors)].slice(0, 5),  // Deduplicate
    };

    this.results.push(result);
    return result;
  }

  /**
   * Helper: Generate JWT token for testing
   */
  private getJWT(orgId: string): string {
    // Simplified JWT (in production, would be real JWT)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ org_id: orgId, exp: Date.now() + 3600000 })).toString('base64');
    const signature = 'test-signature';
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Print results summary
   */
  async printResults(): Promise<void> {
    console.log('\n' + '='.repeat(100));
    console.log('MASTER ORCHESTRATOR LOAD TEST RESULTS');
    console.log('='.repeat(100));

    this.results.forEach((result) => {
      const statusEmoji = result.errorCount === 0 ? '✅' : '⚠️';
      console.log(`\n${statusEmoji} ${result.name}`);
      console.log(`   Total Requests: ${result.totalRequests}`);
      console.log(`   Success Rate: ${result.successCount}/${result.totalRequests} (${((result.successCount / result.totalRequests) * 100).toFixed(1)}%)`);
      console.log(`   Latency (avg): ${result.avgLatency}ms`);
      console.log(`   Latency (p95): ${result.p95Latency}ms`);
      console.log(`   Latency (p99): ${result.p99Latency}ms`);
      console.log(`   Latency (min/max): ${result.minLatency}ms / ${result.maxLatency}ms`);

      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
    });

    console.log('\n' + '='.repeat(100));
    console.log('PERFORMANCE BENCHMARKS');
    console.log('='.repeat(100));

    // Task 4: Check if <800ms target met
    const task4Result = this.results.find((r) => r.name.includes('Task 4'));
    if (task4Result) {
      const targetMet = task4Result.p95Latency < 800;
      console.log(`\nTask 4 Latency Target (<800ms):`);
      console.log(`  P95 Latency: ${task4Result.p95Latency}ms - ${targetMet ? '✅ TARGET MET' : '❌ TARGET MISSED'}`);
    }

    // Task 5: Check if RLS enforced
    const task5Result = this.results.find((r) => r.name.includes('Task 5'));
    if (task5Result) {
      const rlsEnforced = task5Result.errorCount === 0;  // All should be denied (403)
      console.log(`\nTask 5 Multi-Tenant Isolation:`);
      console.log(`  Cross-tenant requests denied: ${rlsEnforced ? '✅ YES' : '❌ NO'}`);
    }

    // Task 1: Check for atomic locking
    const task1Result = this.results.find((r) => r.name.includes('Task 1'));
    if (task1Result) {
      // In a real test, exactly 1 should succeed out of 10 concurrent claims
      console.log(`\nTask 1 Atomic Locking:`);
      console.log(`  Concurrent claim attempts: ${task1Result.totalRequests}`);
      console.log(`  Successful claims: ${task1Result.successCount} (should be ≤1)`);
    }

    console.log('\n' + '='.repeat(100) + '\n');
  }

  /**
   * Run all tests
   */
  async runAll(): Promise<void> {
    console.log('\n🚀 Starting Master Orchestrator Load Tests...\n');

    try {
      await this.testAtomicSlotLocking();
      await this.testContextualMemory();
      await this.testPIIRedaction();
      await this.testLatencyOptimization();
      await this.testMultiTenantRLS();

      await this.printResults();
    } catch (err: any) {
      console.error('\n❌ Load test failed:', err.message);
      process.exit(1);
    }
  }
}

// Run tests
const test = new MasterOrchestratorLoadTest();
test.runAll();
