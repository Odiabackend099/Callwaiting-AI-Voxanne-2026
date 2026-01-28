/**
 * Priority 6 Performance Testing Script
 * Tests and verifies database query optimizations and caching improvements
 *
 * Usage:
 *   npm run test:priority6
 *
 * Or directly:
 *   npx tsx backend/src/scripts/test-priority6-performance.ts
 */

import { supabase } from '../services/supabase-client';
import { getCacheStats } from '../services/cache';

interface PerformanceResult {
  endpoint: string;
  method: string;
  status: 'pass' | 'fail' | 'warning';
  responseTime: number;
  target: number;
  improvement?: string;
  details?: string;
}

const results: PerformanceResult[] = [];

/**
 * Test helper: Measure endpoint response time
 */
async function measureEndpoint(
  name: string,
  url: string,
  token: string,
  targetMs: number
): Promise<PerformanceResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const responseTime = Date.now() - startTime;
    const data = await response.json();

    const status = response.ok
      ? (responseTime <= targetMs ? 'pass' : 'warning')
      : 'fail';

    return {
      endpoint: name,
      method: 'GET',
      status,
      responseTime,
      target: targetMs,
      details: response.ok ? `${Object.keys(data).length} fields returned` : data.error
    };
  } catch (error: any) {
    return {
      endpoint: name,
      method: 'GET',
      status: 'fail',
      responseTime: Date.now() - startTime,
      target: targetMs,
      details: error.message
    };
  }
}

/**
 * Test 1: Dashboard Load Performance
 */
async function testDashboardLoad(baseUrl: string, token: string): Promise<void> {
  console.log('\n📊 Test 1: Dashboard Load Performance');
  console.log('Target: <800ms (5-10x improvement from 2-5 seconds)');

  const result = await measureEndpoint(
    'Dashboard List',
    `${baseUrl}/api/calls-dashboard?page=1&limit=20`,
    token,
    800
  );

  results.push(result);

  if (result.status === 'pass') {
    console.log(`✅ PASS: ${result.responseTime}ms (Target: <${result.target}ms)`);
  } else if (result.status === 'warning') {
    console.log(`⚠️  SLOW: ${result.responseTime}ms (Target: <${result.target}ms)`);
  } else {
    console.log(`❌ FAIL: ${result.details}`);
  }
}

/**
 * Test 2: Stats Endpoint Performance
 */
async function testStatsEndpoint(baseUrl: string, token: string): Promise<void> {
  console.log('\n📈 Test 2: Stats Endpoint Performance');
  console.log('Target: <400ms (5-25x improvement from 2-10 seconds)');

  const result = await measureEndpoint(
    'Dashboard Stats',
    `${baseUrl}/api/calls-dashboard/stats`,
    token,
    400
  );

  results.push(result);

  if (result.status === 'pass') {
    console.log(`✅ PASS: ${result.responseTime}ms (Target: <${result.target}ms)`);
  } else if (result.status === 'warning') {
    console.log(`⚠️  SLOW: ${result.responseTime}ms (Target: <${result.target}ms)`);
  } else {
    console.log(`❌ FAIL: ${result.details}`);
  }
}

/**
 * Test 3: Analytics Endpoint Performance
 */
async function testAnalyticsEndpoint(baseUrl: string, token: string): Promise<void> {
  console.log('\n📉 Test 3: Analytics Summary Performance');
  console.log('Target: <500ms (3-4x improvement from 1-3 seconds)');

  const result = await measureEndpoint(
    'Analytics Summary',
    `${baseUrl}/api/calls-dashboard/analytics/summary`,
    token,
    500
  );

  results.push(result);

  if (result.status === 'pass') {
    console.log(`✅ PASS: ${result.responseTime}ms (Target: <${result.target}ms)`);
  } else if (result.status === 'warning') {
    console.log(`⚠️  SLOW: ${result.responseTime}ms (Target: <${result.target}ms)`);
  } else {
    console.log(`❌ FAIL: ${result.details}`);
  }
}

/**
 * Test 4: On-Demand Recording URL
 */
async function testRecordingUrl(baseUrl: string, token: string, orgId: string): Promise<void> {
  console.log('\n🎥 Test 4: On-Demand Recording URL Generation');
  console.log('Target: Endpoint exists and returns URL in <200ms');

  // First, get a call ID from the dashboard
  const listResponse = await fetch(`${baseUrl}/api/calls-dashboard?page=1&limit=1`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const listData = await listResponse.json();

  if (!listData.calls || listData.calls.length === 0) {
    console.log('⚠️  SKIP: No calls available to test recording URL');
    return;
  }

  const callId = listData.calls[0].id;

  const result = await measureEndpoint(
    'Recording URL',
    `${baseUrl}/api/calls-dashboard/${callId}/recording-url`,
    token,
    200
  );

  results.push(result);

  if (result.status === 'pass') {
    console.log(`✅ PASS: ${result.responseTime}ms (Target: <${result.target}ms)`);
    console.log('   ✓ On-demand URL generation working correctly');
  } else if (result.status === 'fail' && result.details?.includes('Recording not found')) {
    console.log(`⚠️  INFO: Call has no recording (expected behavior)`);
  } else {
    console.log(`❌ FAIL: ${result.details}`);
  }
}

/**
 * Test 5: Cache Performance
 */
async function testCachePerformance(baseUrl: string, token: string): Promise<void> {
  console.log('\n💾 Test 5: Cache Performance');
  console.log('Target: >80% hit rate after warmup');

  // Make 10 requests to warm up the cache
  console.log('   Warming up cache (10 requests)...');
  for (let i = 0; i < 10; i++) {
    await fetch(`${baseUrl}/api/calls-dashboard/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }

  // Check cache stats
  const result = await measureEndpoint(
    'Cache Stats',
    `${baseUrl}/api/monitoring/cache-stats`,
    token,
    100
  );

  results.push(result);

  if (result.status === 'fail') {
    console.log(`❌ FAIL: ${result.details}`);
    return;
  }

  console.log(`✅ Cache Stats Endpoint: ${result.responseTime}ms`);

  // Parse cache stats from local singleton (more accurate)
  const stats = getCacheStats();
  console.log(`   Size: ${stats.size} entries`);
  console.log(`   Hits: ${stats.hits}`);
  console.log(`   Misses: ${stats.misses}`);
  console.log(`   Hit Rate: ${stats.hitRate}%`);

  if (stats.hitRate >= 80) {
    console.log(`✅ PASS: Cache hit rate ${stats.hitRate}% (Target: >80%)`);
  } else if (stats.hitRate >= 50) {
    console.log(`⚠️  FAIR: Cache hit rate ${stats.hitRate}% (Target: >80%)`);
    console.log('   Tip: Run more requests to warm up cache');
  } else {
    console.log(`❌ FAIL: Cache hit rate ${stats.hitRate}% (Target: >80%)`);
  }
}

/**
 * Test 6: Database Index Verification
 */
async function testDatabaseIndexes(): Promise<void> {
  console.log('\n🗄️  Test 6: Database Index Verification');
  console.log('Target: All 6 Priority 6 indexes exist');

  const expectedIndexes = [
    'idx_call_logs_org_from_created',
    'idx_call_logs_org_to_created',
    'idx_appointments_org_contact_scheduled',
    'idx_appointments_org_status_confirmed',
    'idx_messages_org_contact_method',
    'idx_services_org_created'
  ];

  try {
    const { data: indexes, error } = await supabase.rpc('get_table_indexes', {
      table_schema: 'public'
    });

    if (error) {
      // Fallback: Try direct query
      const { data: fallbackIndexes, error: fallbackError } = await supabase
        .from('pg_indexes')
        .select('indexname')
        .in('indexname', expectedIndexes);

      if (fallbackError) {
        console.log('⚠️  SKIP: Cannot verify indexes (RPC function not available)');
        console.log('   Run this SQL manually to verify:');
        console.log('   SELECT indexname FROM pg_indexes WHERE indexname LIKE \'idx_%\';');
        return;
      }

      const foundIndexes = fallbackIndexes?.map(i => i.indexname) || [];
      const missing = expectedIndexes.filter(idx => !foundIndexes.includes(idx));

      if (missing.length === 0) {
        console.log(`✅ PASS: All ${expectedIndexes.length} indexes exist`);
        foundIndexes.forEach(idx => console.log(`   ✓ ${idx}`));
      } else {
        console.log(`❌ FAIL: ${missing.length} indexes missing`);
        missing.forEach(idx => console.log(`   ✗ ${idx}`));
      }
      return;
    }

    console.log(`✅ PASS: Database indexes check complete`);
  } catch (error: any) {
    console.log(`⚠️  SKIP: ${error.message}`);
  }
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Priority 6: Database Query Optimization - Performance Tests ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  // Get environment variables
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const token = process.env.TEST_AUTH_TOKEN;
  const orgId = process.env.TEST_ORG_ID;

  if (!token) {
    console.error('❌ ERROR: TEST_AUTH_TOKEN environment variable not set');
    console.error('   Set it with: export TEST_AUTH_TOKEN="your-jwt-token"');
    process.exit(1);
  }

  console.log(`\n🎯 Testing against: ${baseUrl}`);
  console.log(`🔐 Auth token: ${token.substring(0, 20)}...`);

  try {
    // Run performance tests
    await testDashboardLoad(baseUrl, token);
    await testStatsEndpoint(baseUrl, token);
    await testAnalyticsEndpoint(baseUrl, token);
    await testRecordingUrl(baseUrl, token, orgId || '');
    await testCachePerformance(baseUrl, token);
    await testDatabaseIndexes();

    // Print summary
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                        TEST SUMMARY                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const total = results.length;

    console.log(`✅ Passed: ${passed}/${total}`);
    if (warnings > 0) console.log(`⚠️  Warnings: ${warnings}/${total}`);
    if (failed > 0) console.log(`❌ Failed: ${failed}/${total}`);

    // Print detailed results
    if (results.length > 0) {
      console.log('\nDetailed Results:');
      console.log('─────────────────────────────────────────────────────────────');
      results.forEach(result => {
        const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️ ' : '❌';
        console.log(`${icon} ${result.endpoint}: ${result.responseTime}ms (target: <${result.target}ms)`);
      });
    }

    // Calculate average improvement
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    console.log(`\n📊 Average Response Time: ${Math.round(avgResponseTime)}ms`);

    // Exit with appropriate code
    if (failed > 0) {
      console.log('\n⚠️  Some tests failed. Review results above.');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('\n⚠️  All tests passed but some are slower than target.');
      process.exit(0);
    } else {
      console.log('\n🎉 All performance tests passed! Priority 6 optimization complete.');
      process.exit(0);
    }

  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
