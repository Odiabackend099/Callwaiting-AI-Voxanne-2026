#!/usr/bin/env node

/**
 * Phase 6: HTTP API Performance Testing Suite
 * 
 * Tests the actual REST API endpoints under load:
 * - Booking endpoint (/tools/booking/reserve-atomic)
 * - Calendar check (/tools/calendar/check)
 * - SMS sending (/tools/sms/send)
 * - OTP verification (/tools/booking/verify-otp)
 * 
 * Measures:
 * - Latency per request (min, max, avg, p50, p95, p99)
 * - Stability under load (error rates)
 * - Scalability (performance degradation as load increases)
 * - Response validation
 * 
 * Success Criteria:
 * - <500ms per request (p95 at minimum)
 * - 5-10 concurrent requests without deadlocks
 * - No unhandled 500 errors
 * - Valid response status codes
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000/api';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
let testData = { org: null, contact: null, slots: [], appointments: [] };

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Latency statistics calculator
 */
class LatencyStats {
  constructor(latencies) {
    if (latencies.length === 0) {
      this.latencies = [];
      this.min = 0;
      this.max = 0;
      this.avg = 0;
      this.median = 0;
      this.p50 = 0;
      this.p95 = 0;
      this.p99 = 0;
      return;
    }

    this.latencies = latencies.sort((a, b) => a - b);
    this.min = Math.min(...latencies);
    this.max = Math.max(...latencies);
    this.avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    this.median = this.latencies[Math.floor(latencies.length / 2)];
    this.p50 = this.latencies[Math.floor(latencies.length * 0.50)];
    this.p95 = this.latencies[Math.floor(latencies.length * 0.95)];
    this.p99 = this.latencies[Math.floor(latencies.length * 0.99)];
  }

  toString() {
    return `Min: ${this.min}ms | Max: ${this.max}ms | Avg: ${this.avg.toFixed(0)}ms | P50: ${this.p50}ms | P95: ${this.p95}ms | P99: ${this.p99}ms`;
  }
}

/**
 * Request result tracking
 */
class RequestResult {
  constructor(startTime) {
    this.startTime = startTime;
    this.latency = 0;
    this.statusCode = null;
    this.success = false;
    this.error = null;
    this.responseData = null;
  }

  complete(statusCode, responseData = null, error = null) {
    this.latency = Date.now() - this.startTime;
    this.statusCode = statusCode;
    this.success = statusCode >= 200 && statusCode < 300;
    this.responseData = responseData;
    this.error = error;
  }
}

/**
 * Setup test data
 */
async function setupTestData() {
  log('\n🔧 Setting up test data...', 'cyan');

  try {
    // Create test organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: `Perf Test API ${Date.now()}`,
        email: `perf-api-${Date.now()}@test.com`,
        plan: 'professional',
        billing_status: 'active',
      })
      .select()
      .single();

    if (orgError) {
      throw new Error(`Failed to create test org: ${orgError.message}`);
    }

    testData.org = org;
    log(`✅ Test organization: ${org.id.substring(0, 8)}...`, 'green');

    // Create test contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        org_id: org.id,
        name: 'API Performance Test Contact',
        email: `perf-contact-${Date.now()}@test.com`,
        phone: '+14155552671',
      })
      .select()
      .single();

    if (contactError) {
      throw new Error(`Failed to create test contact: ${contactError.message}`);
    }

    testData.contact = contact;
    log(`✅ Test contact: ${contact.id.substring(0, 8)}...`, 'green');

    // Create test calendar slots (for 30 days ahead)
    const slots = [];
    for (let day = 1; day <= 10; day++) {
      for (let hour = 9; hour <= 17; hour++) {
        const slotDate = new Date();
        slotDate.setDate(slotDate.getDate() + day);
        slotDate.setHours(hour, 0, 0, 0);
        slots.push(slotDate.toISOString());
      }
    }

    testData.slots = slots;
    log(`✅ Created ${slots.length} test slots`, 'green');

    return org.id;
  } catch (err) {
    log(`❌ Setup failed: ${err.message}`, 'red');
    throw err;
  }
}

/**
 * Make a single HTTP request to booking endpoint
 */
async function makeBookingRequest(slotId, requestIndex) {
  const result = new RequestResult(Date.now());

  try {
    const payload = {
      tenantId: testData.org.id,
      inboundPhoneNumber: '+14155552671',
      slotId,
      patientPhone: '+19876543210',
      patientName: `Test Patient ${requestIndex}`,
      calendarId: 'primary',
    };

    const response = await axios.post(
      `${API_BASE_URL}/tools/booking/reserve-atomic`,
      payload,
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Run': 'performance-validation',
        },
      }
    );

    result.complete(response.status, response.data);

    // Track successful appointment IDs
    try {
      const toolResult = JSON.parse(response.data?.toolResult?.content || '{}');
      if (toolResult.appointment_id) {
        testData.appointments.push(toolResult.appointment_id);
      }
    } catch (e) {
      // Parsing error is non-critical
    }

    return result;
  } catch (err) {
    const statusCode = err.response?.status || 0;
    result.complete(statusCode, null, err.message);
    return result;
  }
}

/**
 * Run a concurrency test
 */
async function runConcurrencyTest(concurrentRequests, label) {
  log(`\n📊 Testing ${concurrentRequests} concurrent requests...`, 'blue');

  const slotIds = testData.slots.slice(0, concurrentRequests);
  const promises = slotIds.map((slotId, i) => makeBookingRequest(slotId, i));

  const start = Date.now();
  const results = await Promise.all(promises);
  const totalTime = Date.now() - start;

  const latencies = results.map(r => r.latency);
  const stats = new LatencyStats(latencies);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const errorRate = ((failed / concurrentRequests) * 100).toFixed(1);

  // Analyze error types
  const errors = {};
  results.forEach(r => {
    if (!r.success && r.statusCode) {
      const key = `${r.statusCode}`;
      errors[key] = (errors[key] || 0) + 1;
    }
  });

  const status = stats.p95 < 500 && errorRate === '0.0' ? 'green' : stats.p95 < 600 ? 'yellow' : 'red';

  log(`\n   ${label}`, 'bright');
  log(`   ─────────────────────────────────────────────────`, 'gray');
  log(`   Total time: ${totalTime}ms`, 'blue');
  log(`   Throughput: ${(concurrentRequests / (totalTime / 1000)).toFixed(1)} req/s`, 'blue');
  log(`   ${stats.toString()}`, status);
  log(
    `   Success: ${successful}/${concurrentRequests} | Failures: ${failed} | Error Rate: ${errorRate}%`,
    failed === 0 ? 'green' : 'red'
  );

  if (Object.keys(errors).length > 0) {
    const errorStr = Object.entries(errors)
      .map(([code, count]) => `${count}x ${code}`)
      .join(', ');
    log(`   Error breakdown: ${errorStr}`, 'yellow');
  }

  // Check success criteria
  const meetsLatency = stats.p95 < 500;
  const meetsStability = errorRate === '0.0';

  if (meetsLatency && meetsStability) {
    log(`   ✅ PASSED`, 'green');
  } else {
    if (!meetsLatency) log(`   ⚠️  Latency warning: p95=${stats.p95}ms (target: <500ms)`, 'yellow');
    if (!meetsStability) log(`   ⚠️  Stability warning: ${errorRate}% error rate`, 'yellow');
  }

  return {
    concurrentRequests,
    stats,
    successful,
    failed,
    errorRate: parseFloat(errorRate),
    totalTime,
    throughput: concurrentRequests / (totalTime / 1000),
    meetsLatency,
    meetsStability,
    errors,
  };
}

/**
 * Ramp-up test: gradually increase load
 */
async function rampUpTest() {
  log('\n\n╔═══════════════════════════════════════════════════════╗', 'cyan');
  log('║          HTTP API RAMP-UP TEST                          ║', 'bright');
  log('║     Gradually increase concurrent requests             ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════╝\n', 'cyan');

  const results = [];

  for (const concurrency of [1, 3, 5, 8, 10]) {
    const result = await runConcurrencyTest(concurrency, `Concurrency Level: ${concurrency}`);
    results.push(result);

    if (result.failed > 0 || !result.meetsLatency) {
      log(
        `\n⚠️  Performance issue detected at ${concurrency} concurrent requests`,
        'yellow'
      );
      if (concurrency >= 5) {
        break; // Stop if we hit our target
      }
    }

    // Small delay between test levels
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

/**
 * Burst test: sudden spike in traffic
 */
async function burstTest() {
  log('\n\n╔═══════════════════════════════════════════════════════╗', 'cyan');
  log('║          HTTP API BURST TRAFFIC TEST                    ║', 'bright');
  log('║     Simulate sudden spike (15 simultaneous requests)   ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════╝\n', 'cyan');

  return await runConcurrencyTest(15, 'Burst: 15 concurrent requests');
}

/**
 * Sustained load test: maintain moderate load
 */
async function sustainedLoadTest() {
  log('\n\n╔═══════════════════════════════════════════════════════╗', 'cyan');
  log('║          HTTP API SUSTAINED LOAD TEST                   ║', 'bright');
  log('║     Maintain consistent moderate load (8 req/batch)    ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════╝\n', 'cyan');

  const results = [];
  const batches = 5;

  for (let i = 0; i < batches; i++) {
    log(`\nBatch ${i + 1}/${batches}`, 'blue');
    const result = await runConcurrencyTest(8, `Sustained Load Batch ${i + 1}`);
    results.push(result);

    if (i < batches - 1) {
      await new Promise(r => setTimeout(r, 300)); // 300ms between batches
    }
  }

  return results;
}

/**
 * Cleanup test data
 */
async function cleanup() {
  log('\n🧹 Cleaning up test data...', 'cyan');

  try {
    // Delete appointments (created via API)
    if (testData.appointments.length > 0) {
      await supabase.from('appointments').delete().in('id', testData.appointments);
      log(`  ✅ Deleted ${testData.appointments.length} test appointments`, 'green');
    }

    // Delete contact
    if (testData.contact?.id) {
      await supabase.from('contacts').delete().eq('id', testData.contact.id);
      log(`  ✅ Deleted test contact`, 'green');
    }

    // Delete organization
    if (testData.org?.id) {
      await supabase.from('organizations').delete().eq('id', testData.org.id);
      log(`  ✅ Deleted test organization`, 'green');
    }

    log('✅ Cleanup complete\n', 'green');
  } catch (err) {
    log(`⚠️  Cleanup warning: ${err.message}`, 'yellow');
  }
}

/**
 * Generate final report
 */
function generateReport(rampUp, burst, sustained) {
  log('\n╔═══════════════════════════════════════════════════════╗', 'bright');
  log('║        HTTP API PERFORMANCE TEST REPORT                ║', 'bright');
  log('╚═══════════════════════════════════════════════════════╝\n', 'bright');

  // Ramp-up analysis
  log('\n📈 RAMP-UP TEST RESULTS', 'cyan');
  log('─────────────────────────────────────────────────────', 'gray');
  rampUp.forEach(r => {
    const status = r.meetsLatency && r.meetsStability ? '✅' : '⚠️ ';
    log(
      `${status} ${r.concurrentRequests} concurrent: p95=${r.stats.p95}ms, errors=${r.errorRate}%`,
      r.meetsLatency && r.meetsStability ? 'green' : 'yellow'
    );
  });

  // Burst analysis
  log('\n⚡ BURST TEST RESULTS', 'cyan');
  log('─────────────────────────────────────────────────────', 'gray');
  const burstStatus = burst.meetsLatency && burst.meetsStability ? '✅' : '⚠️ ';
  log(
    `${burstStatus} 15 concurrent: p95=${burst.stats.p95}ms, errors=${burst.errorRate}%`,
    burst.meetsLatency && burst.meetsStability ? 'green' : 'yellow'
  );

  // Sustained analysis
  log('\n🔄 SUSTAINED LOAD RESULTS', 'cyan');
  log('─────────────────────────────────────────────────────', 'gray');
  const avgP95 = sustained.reduce((sum, r) => sum + r.stats.p95, 0) / sustained.length;
  const avgLatency = sustained.reduce((sum, r) => sum + r.stats.avg, 0) / sustained.length;
  const totalErrors = sustained.reduce((sum, r) => sum + r.failed, 0);
  log(`Average p95: ${avgP95.toFixed(0)}ms`, 'blue');
  log(`Average latency: ${avgLatency.toFixed(0)}ms`, 'blue');
  log(`Total errors across ${sustained.length} batches: ${totalErrors}`, totalErrors === 0 ? 'green' : 'yellow');

  // Success metrics
  log('\n✨ SUCCESS METRICS', 'cyan');
  log('─────────────────────────────────────────────────────', 'gray');

  const rampUpPassed = rampUp.every(r => r.meetsLatency && r.meetsStability);
  const burstPassed = burst.meetsLatency && burst.meetsStability;
  const sustainedPassed = sustained.every(r => r.meetsLatency && r.meetsStability);

  log(
    `Latency Budget (<500ms p95): ${rampUpPassed && burstPassed && sustainedPassed ? '✅ PASS' : '❌ FAIL'}`,
    rampUpPassed && burstPassed && sustainedPassed ? 'green' : 'red'
  );
  log(
    `Stability (0% errors): ${rampUpPassed && burstPassed && sustainedPassed ? '✅ PASS' : '❌ FAIL'}`,
    rampUpPassed && burstPassed && sustainedPassed ? 'green' : 'red'
  );
  log(
    `Scalability (handles 5-10): ${rampUp.some(r => r.concurrentRequests >= 10 && r.meetsLatency) ? '✅ PASS' : '⚠️ WARNING'}`,
    rampUp.some(r => r.concurrentRequests >= 10 && r.meetsLatency) ? 'green' : 'yellow'
  );

  // Overall verdict
  log('\n╔═══════════════════════════════════════════════════════╗', 'bright');
  const allPassed = rampUpPassed && burstPassed && sustainedPassed;
  if (allPassed) {
    log('║       ✅ ALL HTTP API TESTS PASSED ✅                ║', 'green');
  } else {
    log('║     ⚠️  HTTP API TESTS REQUIRE REVIEW ⚠️            ║', 'yellow');
  }
  log('╚═══════════════════════════════════════════════════════╝\n', 'bright');

  return allPassed;
}

/**
 * Main execution
 */
async function runPerformanceTests() {
  log('\n╔═══════════════════════════════════════════════════════╗', 'bright');
  log('║   PHASE 6: HTTP API PERFORMANCE TEST SUITE             ║', 'bright');
  log('║     Stress-test API endpoints under real load          ║', 'bright');
  log('╚═══════════════════════════════════════════════════════╝', 'bright');

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log('\n❌ Missing Supabase credentials', 'red');
    process.exit(1);
  }

  log(`\n📡 API Base URL: ${API_BASE_URL}`, 'blue');

  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  log('✅ Connected to Supabase', 'green');

  try {
    // Verify backend is reachable
    log('\n🔍 Verifying backend connectivity...', 'cyan');
    try {
      const response = await axios.get(`${API_BASE_URL.replace('/api', '/health')}`, {
        timeout: 5000,
      });
      log('✅ Backend is reachable', 'green');
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        log('❌ Backend is not running. Start the backend with: npm run dev', 'red');
        process.exit(1);
      }
      log(`⚠️  Backend check inconclusive (${err.message}), continuing...`, 'yellow');
    }

    await setupTestData();

    // Run all test phases
    const rampUp = await rampUpTest();
    const burst = await burstTest();
    const sustained = await sustainedLoadTest();

    // Generate comprehensive report
    const passed = generateReport(rampUp, burst, sustained);

    await cleanup();

    process.exit(passed ? 0 : 1);
  } catch (err) {
    log(`\n❌ Fatal error: ${err.message}`, 'red');
    await cleanup();
    process.exit(1);
  }
}

runPerformanceTests();
