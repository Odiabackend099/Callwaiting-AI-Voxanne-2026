#!/usr/bin/env node

/**
 * Phase 6: Performance Testing Suite
 * 
 * Measures:
 * - Latency per request (min, max, avg, p95, p99)
 * - Stability under load (error rates)
 * - Scalability (performance degradation as load increases)
 * 
 * Success Criteria:
 * - <500ms per request (p95 at minimum)
 * - 5-10 concurrent requests without deadlocks
 * - No unhandled 500 errors
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

let supabase;
let testData = { orgs: [], contacts: [], appointments: [] };

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Statistics calculator
 */
class LatencyStats {
  constructor(latencies) {
    this.latencies = latencies.sort((a, b) => a - b);
    this.min = Math.min(...latencies);
    this.max = Math.max(...latencies);
    this.avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    this.median = this.latencies[Math.floor(latencies.length / 2)];
    this.p95 = this.latencies[Math.floor(latencies.length * 0.95)];
    this.p99 = this.latencies[Math.floor(latencies.length * 0.99)];
  }

  toString() {
    return `Min: ${this.min}ms | Max: ${this.max}ms | Avg: ${this.avg.toFixed(0)}ms | P95: ${this.p95}ms | P99: ${this.p99}ms`;
  }
}

/**
 * Setup test data
 */
async function setupTestData() {
  log('\n🔧 Setting up test data...', 'cyan');

  const { data: org } = await supabase
    .from('organizations')
    .insert({
      name: `Perf Test ${Date.now()}`,
      email: `perf-${Date.now()}@test.com`,
      plan: 'professional',
      billing_status: 'active',
    })
    .select()
    .single();

  testData.orgs.push(org.id);

  const { data: contact } = await supabase
    .from('contacts')
    .insert({
      org_id: org.id,
      name: 'Performance Test Contact',
      email: `perf-contact-${Date.now()}@test.com`,
      phone: '+14155552671',
    })
    .select()
    .single();

  testData.contacts.push(contact.id);

  log(`✅ Test org: ${org.id.substring(0, 8)}...`, 'green');
  log(`✅ Test contact: ${contact.id.substring(0, 8)}...`, 'green');

  return { orgId: org.id, contactId: contact.id };
}

/**
 * Simulate a single appointment booking
 */
async function bookAppointment(orgId, contactId, offset = 0) {
  const appointmentDate = new Date();
  appointmentDate.setDate(appointmentDate.getDate() + 30 + offset);

  const start = Date.now();

  try {
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        org_id: orgId,
        contact_id: contactId,
        service_type: 'demo',
        scheduled_at: appointmentDate.toISOString(),
      })
      .select()
      .single();

    const latency = Date.now() - start;

    if (error) {
      return { success: false, latency, error: error.message };
    }

    if (data) {
      testData.appointments.push(data.id);
    }

    return { success: true, latency };
  } catch (err) {
    const latency = Date.now() - start;
    return { success: false, latency, error: err.message };
  }
}

/**
 * Run a concurrency test
 */
async function runConcurrencyTest(concurrentRequests, orgId, contactId, label) {
  log(`\n📊 Testing ${concurrentRequests} concurrent requests...`, 'blue');

  const promises = [];
  for (let i = 0; i < concurrentRequests; i++) {
    promises.push(bookAppointment(orgId, contactId, i));
  }

  const start = Date.now();
  const results = await Promise.all(promises);
  const totalTime = Date.now() - start;

  const latencies = results.map(r => r.latency);
  const stats = new LatencyStats(latencies);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const errorRate = ((failed / concurrentRequests) * 100).toFixed(1);

  const status = stats.p95 < 500 && errorRate === '0.0' ? 'green' : stats.p95 < 600 ? 'yellow' : 'red';

  log(`\n   ${label}`, 'bright');
  log(`   ─────────────────────────────────────────────────`, 'gray');
  log(`   Total time: ${totalTime}ms`, 'blue');
  log(`   Throughput: ${(concurrentRequests / (totalTime / 1000)).toFixed(1)} req/s`, 'blue');
  log(`   ${stats.toString()}`, status);
  log(`   Success: ${successful}/${concurrentRequests} | Failures: ${failed} | Error Rate: ${errorRate}%`, 
    failed === 0 ? 'green' : 'red');

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
  };
}

/**
 * Ramp-up test: gradually increase load
 */
async function rampUpTest(orgId, contactId) {
  log('\n\n╔═══════════════════════════════════════════════════════╗', 'cyan');
  log('║            LOAD RAMP-UP TEST                            ║', 'bright');
  log('║     Gradually increase concurrent requests             ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════╝\n', 'cyan');

  const results = [];

  for (const concurrency of [1, 5, 10, 15, 20]) {
    const result = await runConcurrencyTest(concurrency, orgId, contactId, `Concurrency Level: ${concurrency}`);
    results.push(result);

    if (result.failed > 0 || !result.meetsLatency) {
      log(`\n⚠️  Performance degradation detected at ${concurrency} concurrent requests`, 'yellow');
      break;
    }
  }

  return results;
}

/**
 * Burst test: sudden spike in traffic
 */
async function burstTest(orgId, contactId) {
  log('\n\n╔═══════════════════════════════════════════════════════╗', 'cyan');
  log('║            BURST TRAFFIC TEST                           ║', 'bright');
  log('║     Simulate sudden spike (30 simultaneous requests)   ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════╝\n', 'cyan');

  return await runConcurrencyTest(30, orgId, contactId, 'Burst: 30 concurrent requests');
}

/**
 * Sustained load test: maintain moderate load
 */
async function sustainedLoadTest(orgId, contactId) {
  log('\n\n╔═══════════════════════════════════════════════════════╗', 'cyan');
  log('║            SUSTAINED LOAD TEST                          ║', 'bright');
  log('║     Maintain consistent moderate load (10 req/batch)   ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════╝\n', 'cyan');

  const results = [];
  const batches = 5;

  for (let i = 0; i < batches; i++) {
    log(`\nBatch ${i + 1}/${batches}`, 'blue');
    const result = await runConcurrencyTest(10, orgId, contactId, `Sustained Load Batch ${i + 1}`);
    results.push(result);

    if (i < batches - 1) {
      await new Promise(r => setTimeout(r, 500)); // 500ms between batches
    }
  }

  return results;
}

/**
 * Cleanup
 */
async function cleanup() {
  log('\n🧹 Cleaning up test data...', 'cyan');

  for (const apptId of testData.appointments) {
    try {
      await supabase.from('appointments').delete().eq('id', apptId);
    } catch (e) {}
  }

  for (const contactId of testData.contacts) {
    try {
      await supabase.from('contacts').delete().eq('id', contactId);
    } catch (e) {}
  }

  for (const orgId of testData.orgs) {
    try {
      await supabase.from('organizations').delete().eq('id', orgId);
    } catch (e) {}
  }

  log('✅ Cleanup complete\n', 'green');
}

/**
 * Generate final report
 */
function generateReport(rampUp, burst, sustained) {
  log('\n╔═══════════════════════════════════════════════════════╗', 'bright');
  log('║            PERFORMANCE TEST REPORT                     ║', 'bright');
  log('╚═══════════════════════════════════════════════════════╝\n', 'bright');

  // Ramp-up analysis
  log('\n📈 RAMP-UP TEST RESULTS', 'cyan');
  log('─────────────────────────────────────────────────────', 'gray');
  rampUp.forEach(r => {
    const status = r.meetsLatency && r.meetsStability ? '✅' : '⚠️ ';
    log(`${status} ${r.concurrentRequests} concurrent: p95=${r.stats.p95}ms, errors=${r.errorRate}%`, 
      r.meetsLatency && r.meetsStability ? 'green' : 'yellow');
  });

  // Burst analysis
  log('\n⚡ BURST TEST RESULTS', 'cyan');
  log('─────────────────────────────────────────────────────', 'gray');
  const burstStatus = burst.meetsLatency && burst.meetsStability ? '✅' : '⚠️ ';
  log(`${burstStatus} 30 concurrent: p95=${burst.stats.p95}ms, errors=${burst.errorRate}%`, 
    burst.meetsLatency && burst.meetsStability ? 'green' : 'yellow');

  // Sustained analysis
  log('\n🔄 SUSTAINED LOAD RESULTS', 'cyan');
  log('─────────────────────────────────────────────────────', 'gray');
  const avgLatency = sustained.reduce((sum, r) => sum + r.stats.avg, 0) / sustained.length;
  const totalErrors = sustained.reduce((sum, r) => sum + r.failed, 0);
  log(`Average p95: ${(sustained[sustained.length - 1].stats.p95)}ms`, 'blue');
  log(`Average latency: ${avgLatency.toFixed(0)}ms`, 'blue');
  log(`Total errors across ${sustained.length} batches: ${totalErrors}`, totalErrors === 0 ? 'green' : 'yellow');

  // Success metrics
  log('\n✨ SUCCESS METRICS', 'cyan');
  log('─────────────────────────────────────────────────────', 'gray');

  const rampUpPassed = rampUp.every(r => r.meetsLatency && r.meetsStability);
  const burstPassed = burst.meetsLatency && burst.meetsStability;
  const sustainedPassed = sustained.every(r => r.meetsLatency && r.meetsStability);

  log(`Latency Budget (<500ms p95): ${rampUpPassed && burstPassed && sustainedPassed ? '✅ PASS' : '❌ FAIL'}`, 
    rampUpPassed && burstPassed && sustainedPassed ? 'green' : 'red');
  log(`Stability (0% errors): ${rampUpPassed && burstPassed && sustainedPassed ? '✅ PASS' : '❌ FAIL'}`, 
    rampUpPassed && burstPassed && sustainedPassed ? 'green' : 'red');
  log(`Scalability (maintains at 10+): ${rampUp.some(r => r.concurrentRequests >= 10 && r.meetsLatency) ? '✅ PASS' : '⚠️ WARNING'}`, 
    rampUp.some(r => r.concurrentRequests >= 10 && r.meetsLatency) ? 'green' : 'yellow');

  // Overall verdict
  log('\n╔═══════════════════════════════════════════════════════╗', 'bright');
  const allPassed = rampUpPassed && burstPassed && sustainedPassed;
  if (allPassed) {
    log('║         ✅ ALL PERFORMANCE TESTS PASSED ✅             ║', 'green');
  } else {
    log('║       ⚠️  PERFORMANCE TESTS REQUIRE REVIEW ⚠️         ║', 'yellow');
  }
  log('╚═══════════════════════════════════════════════════════╝\n', 'bright');

  return allPassed;
}

/**
 * Main execution
 */
async function runPerformanceTests() {
  log('\n╔═══════════════════════════════════════════════════════╗', 'bright');
  log('║    PHASE 6: COMPREHENSIVE PERFORMANCE TEST SUITE      ║', 'bright');
  log('║     Stress-test under realistic traffic patterns       ║', 'bright');
  log('╚═══════════════════════════════════════════════════════╝', 'bright');

  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) {
    log('\n❌ Missing Supabase credentials', 'red');
    process.exit(1);
  }

  supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  log('\n✅ Connected to Supabase', 'green');

  try {
    const { orgId, contactId } = await setupTestData();

    // Run all test phases
    const rampUp = await rampUpTest(orgId, contactId);
    const burst = await burstTest(orgId, contactId);
    const sustained = await sustainedLoadTest(orgId, contactId);

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
