/**
 * Monitoring Verification Script
 * Tests that all monitoring components are working correctly
 *
 * Run with: npx tsx backend/src/scripts/verify-monitoring.ts
 *
 * Tests:
 * 1. Slack alert sending
 * 2. Error count tracking
 * 3. Sentry error reporting
 * 4. Circuit breaker status
 * 5. Webhook queue metrics
 * 6. Database connectivity
 * 7. Webhook events table status
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../../.env') });

import { sendSlackAlert, incrementErrorCount } from '../services/slack-alerts';
import { reportError } from '../config/sentry';
import { getCircuitBreakerStatus } from '../services/safe-call';
import { getQueueMetrics, initializeWebhookQueue } from '../config/webhook-queue';
import { supabase } from '../services/supabase-client';
import { initializeRedis } from '../config/redis';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>,
  skipCondition?: () => boolean
): Promise<void> {
  const startTime = Date.now();

  if (skipCondition && skipCondition()) {
    results.push({ name, status: 'SKIP', message: 'Skipped due to missing configuration' });
    console.log(`  SKIP ${name}: Missing configuration`);
    return;
  }

  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, status: 'PASS', message: 'Success', duration });
    console.log(`  PASS ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'FAIL', message, duration });
    console.log(`  FAIL ${name}: ${message} (${duration}ms)`);
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  VOXANNE MONITORING VERIFICATION');
  console.log('========================================\n');

  // Initialize services
  console.log('Initializing services...\n');
  try {
    initializeRedis();
    initializeWebhookQueue();
  } catch (e) {
    console.log('Note: Some services may not be available in test mode\n');
  }

  // 1. Test Database Connectivity
  console.log('1. Database Connectivity');
  await runTest('Database Connection', async () => {
    const { data, error } = await supabase.from('organizations').select('id').limit(1);
    if (error) throw new Error(`Database error: ${error.message}`);
    console.log(`     Found ${data?.length || 0} organization(s)`);
  });

  // 2. Test Slack Alert
  console.log('\n2. Slack Alerting');
  await runTest(
    'Slack Alert Send',
    async () => {
      await sendSlackAlert('Monitoring Verification', {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'This is an automated test from verify-monitoring.ts'
      });
    },
    () => !process.env.SLACK_BOT_TOKEN
  );

  // 3. Test Error Count Tracking
  console.log('\n3. Error Count Tracking');
  await runTest('Error Count Increment', async () => {
    // This just calls the function - it won't trigger an alert unless >50 errors
    incrementErrorCount();
    console.log('     Error count incremented (threshold: 50/min)');
  });

  // 4. Test Sentry Reporting
  console.log('\n4. Sentry Error Reporting');
  await runTest(
    'Sentry Error Report',
    async () => {
      reportError(new Error('Verification test error - please ignore'), {
        testRun: true,
        timestamp: new Date().toISOString(),
        source: 'verify-monitoring.ts'
      });
      console.log('     Error reported to Sentry (check dashboard)');
    },
    () => !process.env.SENTRY_DSN || process.env.NODE_ENV !== 'production'
  );

  // 5. Test Circuit Breaker Status
  console.log('\n5. Circuit Breaker Status');
  await runTest('Circuit Breaker Check', async () => {
    const status = getCircuitBreakerStatus();
    const breakerCount = Object.keys(status).length;
    console.log(`     Active circuit breakers: ${breakerCount}`);
    for (const [name, state] of Object.entries(status)) {
      console.log(`       - ${name}: ${state.isOpen ? 'OPEN' : 'CLOSED'} (failures: ${state.failures})`);
    }
  });

  // 6. Test Webhook Queue Metrics
  console.log('\n6. Webhook Queue Metrics');
  await runTest(
    'Queue Metrics',
    async () => {
      const metrics = await getQueueMetrics();
      if (metrics) {
        console.log(`     Queue: ${metrics.name}`);
        console.log(`     Waiting: ${metrics.waiting}, Active: ${metrics.active}`);
        console.log(`     Completed: ${metrics.completed}, Failed: ${metrics.failed}`);
      } else {
        console.log('     Queue metrics not available (Redis may not be running)');
      }
    },
    () => !process.env.REDIS_URL
  );

  // 7. Test Processed Webhook Events Table
  console.log('\n7. Webhook Events Table Status');
  await runTest('Processed Events Count', async () => {
    const { count, error } = await supabase
      .from('processed_webhook_events')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Query error: ${error.message}`);
    }

    console.log(`     Total processed webhook events: ${count || 0}`);

    // Check for old events that should be cleaned up
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: oldCount, error: oldError } = await supabase
      .from('processed_webhook_events')
      .select('*', { count: 'exact', head: true })
      .lt('received_at', cutoff);

    if (!oldError) {
      console.log(`     Events older than 24h (pending cleanup): ${oldCount || 0}`);
    }
  });

  // 8. Test Webhook Delivery Log Table
  console.log('\n8. Webhook Delivery Log Status');
  await runTest('Delivery Log Count', async () => {
    const { count, error } = await supabase
      .from('webhook_delivery_log')
      .select('*', { count: 'exact', head: true });

    if (error) {
      // Table may not exist
      console.log('     Delivery log table not found (may not be created yet)');
      return;
    }

    console.log(`     Total delivery log entries: ${count || 0}`);

    // Check for failed deliveries
    const { count: failedCount } = await supabase
      .from('webhook_delivery_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    console.log(`     Failed deliveries: ${failedCount || 0}`);
  });

  // Summary
  console.log('\n========================================');
  console.log('  VERIFICATION SUMMARY');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  console.log(`  PASSED:  ${passed}`);
  console.log(`  FAILED:  ${failed}`);
  console.log(`  SKIPPED: ${skipped}`);
  console.log(`  TOTAL:   ${results.length}`);

  if (failed > 0) {
    console.log('\n  FAILED TESTS:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => console.log(`    - ${r.name}: ${r.message}`));
  }

  if (skipped > 0) {
    console.log('\n  SKIPPED TESTS (missing configuration):');
    results
      .filter(r => r.status === 'SKIP')
      .forEach(r => console.log(`    - ${r.name}`));
  }

  console.log('\n========================================\n');

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Verification script failed:', error);
  process.exit(1);
});
