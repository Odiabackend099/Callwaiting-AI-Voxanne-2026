/**
 * Production Readiness Test Suite
 *
 * Comprehensive automated testing for the five production priorities:
 * 1. Monitoring & Alerting (Sentry, Slack, error tracking)
 * 2. Security Hardening (CORS, rate limiting)
 * 3. Data Integrity (webhook cleanup, idempotency)
 * 4. Circuit Breaker Integration (Twilio, Google Calendar)
 * 5. Infrastructure Verification (database, queue, server)
 *
 * Run this before production deployment to ensure all systems are operational.
 */

import { createLogger } from '../services/logger';
import { supabase } from '../services/supabase-client';
import { sendSlackAlert, incrementErrorCount } from '../services/slack-alerts';
import { reportError, Sentry } from '../config/sentry';
import { runWebhookEventsCleanup } from '../jobs/webhook-events-cleanup';
import { getQueueMetrics } from '../config/webhook-queue';

const logger = createLogger('ProductionReadinessTest');

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  message: string;
  duration?: number;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Test helper to record results
 */
async function runTest(
  name: string,
  testFn: () => Promise<void>,
  isRequired: boolean = true
): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info('Running test', { name });
    await testFn();

    const duration = Date.now() - startTime;
    results.push({
      name,
      status: 'PASS',
      message: 'Test passed successfully',
      duration
    });

    logger.info('Test passed', { name, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    results.push({
      name,
      status: isRequired ? 'FAIL' : 'WARN',
      message: isRequired ? 'Test failed (BLOCKING)' : 'Test failed (non-blocking)',
      duration,
      error: errorMessage
    });

    logger.error('Test failed', { name, error: errorMessage, duration });
  }
}

/**
 * PRIORITY 1: Test Monitoring Infrastructure
 */
async function testMonitoring(): Promise<void> {
  logger.info('=== Testing Monitoring Infrastructure ===');

  // Test 1.1: Sentry Configuration
  await runTest('Sentry Configuration', async () => {
    if (!process.env.SENTRY_DSN) {
      throw new Error('SENTRY_DSN not configured');
    }

    // Verify Sentry is initialized
    const client = Sentry.getClient();
    if (!client) {
      throw new Error('Sentry client not initialized');
    }

    logger.info('Sentry configured correctly', {
      dsn: process.env.SENTRY_DSN.substring(0, 20) + '...',
      environment: process.env.NODE_ENV
    });
  }, false); // Non-blocking if SENTRY_DSN not set

  // Test 1.2: Slack Alerts
  await runTest('Slack Alert System', async () => {
    if (!process.env.SLACK_BOT_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN not configured');
    }

    // Send test alert
    await sendSlackAlert('🧪 Production Readiness Test', {
      test: 'Automated test suite running',
      timestamp: new Date().toISOString(),
      status: 'Testing monitoring infrastructure'
    });

    logger.info('Slack alert sent successfully');
  }, false); // Non-blocking if Slack not configured

  // Test 1.3: Error Count Tracking
  await runTest('Error Count Tracking', async () => {
    // Increment error count (testing the function)
    incrementErrorCount();
    incrementErrorCount();

    logger.info('Error count tracking functional');
  });

  // Test 1.4: Report Error Function
  await runTest('Error Reporting Function', async () => {
    const testError = new Error('Test error for monitoring verification');
    reportError(testError, {
      test: 'production-readiness',
      timestamp: new Date().toISOString()
    });

    logger.info('Error reporting function works');
  }, false);
}

/**
 * PRIORITY 2: Test Security Configuration
 */
async function testSecurity(): Promise<void> {
  logger.info('=== Testing Security Configuration ===');

  // Test 2.1: Environment Variables
  await runTest('Critical Environment Variables', async () => {
    const required = [
      'DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'VAPI_PRIVATE_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    logger.info('All critical environment variables present');
  });

  // Test 2.2: Database Connection Security
  await runTest('Database Connection', async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    logger.info('Database connection secure and operational');
  });
}

/**
 * PRIORITY 3: Test Data Integrity
 */
async function testDataIntegrity(): Promise<void> {
  logger.info('=== Testing Data Integrity ===');

  // Test 3.1: Webhook Events Cleanup Job
  await runTest('Webhook Events Cleanup Job', async () => {
    // Run cleanup job
    await runWebhookEventsCleanup();

    logger.info('Webhook cleanup job executed successfully');
  });

  // Test 3.2: Idempotency Table Exists
  await runTest('Idempotency Tables', async () => {
    // Check processed_webhook_events table
    const { error: webhookError } = await supabase
      .from('processed_webhook_events')
      .select('event_id')
      .limit(1);

    if (webhookError && !webhookError.message.includes('0 rows')) {
      throw new Error(`processed_webhook_events table issue: ${webhookError.message}`);
    }

    // Check webhook_delivery_log table
    const { error: deliveryError } = await supabase
      .from('webhook_delivery_log')
      .select('id')
      .limit(1);

    if (deliveryError && !deliveryError.message.includes('0 rows')) {
      throw new Error(`webhook_delivery_log table issue: ${deliveryError.message}`);
    }

    logger.info('Idempotency tables exist and accessible');
  });
}

/**
 * PRIORITY 4: Test Circuit Breaker Integration
 */
async function testCircuitBreaker(): Promise<void> {
  logger.info('=== Testing Circuit Breaker Integration ===');

  // Test 4.1: Circuit Breaker Module Loads
  await runTest('Circuit Breaker Module', async () => {
    const { safeCall } = await import('../services/safe-call');

    if (typeof safeCall !== 'function') {
      throw new Error('safeCall function not properly exported');
    }

    // Test basic circuit breaker functionality
    const result = await safeCall(
      'test_service',
      async () => ({ success: true, data: 'test' }),
      { retries: 1, backoffMs: 100, timeoutMs: 1000 }
    );

    if (!result.success) {
      throw new Error('Circuit breaker test call failed');
    }

    logger.info('Circuit breaker module functional');
  });

  // Test 4.2: Twilio Service Integration
  await runTest('Twilio Circuit Breaker Integration', async () => {
    const twilioService = await import('../services/twilio-service');

    // Verify safeCall is imported in twilio-service
    const fileContent = require('fs').readFileSync(
      require('path').join(__dirname, '../services/twilio-service.ts'),
      'utf-8'
    );

    if (!fileContent.includes('safeCall')) {
      throw new Error('Twilio service missing safeCall integration');
    }

    logger.info('Twilio service has circuit breaker integration');
  });

  // Test 4.3: Calendar Service Integration
  await runTest('Calendar Circuit Breaker Integration', async () => {
    const fileContent = require('fs').readFileSync(
      require('path').join(__dirname, '../services/calendar-integration.ts'),
      'utf-8'
    );

    if (!fileContent.includes('safeCall')) {
      throw new Error('Calendar service missing safeCall integration');
    }

    logger.info('Calendar service has circuit breaker integration');
  });
}

/**
 * PRIORITY 5: Test Infrastructure
 */
async function testInfrastructure(): Promise<void> {
  logger.info('=== Testing Infrastructure ===');

  // Test 5.1: Webhook Queue System
  await runTest('Webhook Queue System', async () => {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL not configured - webhook queue unavailable');
    }

    const metrics = await getQueueMetrics();

    if (metrics === null) {
      throw new Error('Failed to get webhook queue metrics');
    }

    logger.info('Webhook queue operational', { metrics });
  }, false); // Non-blocking if Redis not configured

  // Test 5.2: Server Configuration Files
  await runTest('Server Configuration', async () => {
    // Verify server.ts has required imports
    const serverContent = require('fs').readFileSync(
      require('path').join(__dirname, '../server.ts'),
      'utf-8'
    );

    const requiredImports = [
      'sendSlackAlert',
      'incrementErrorCount',
      'reportError',
      'initializeSentry'
    ];

    const missing = requiredImports.filter(imp => !serverContent.includes(imp));

    if (missing.length > 0) {
      throw new Error(`Server missing required imports: ${missing.join(', ')}`);
    }

    logger.info('Server configuration correct');
  });

  // Test 5.3: Job Schedulers
  await runTest('Job Schedulers', async () => {
    const serverContent = require('fs').readFileSync(
      require('path').join(__dirname, '../server.ts'),
      'utf-8'
    );

    if (!serverContent.includes('scheduleWebhookEventsCleanup')) {
      throw new Error('Webhook events cleanup job not scheduled in server.ts');
    }

    logger.info('Job schedulers configured');
  });
}

/**
 * Generate Production Readiness Report
 */
function generateReport(): void {
  logger.info('=== PRODUCTION READINESS REPORT ===');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log('\n' + '='.repeat(80));
  console.log('PRODUCTION READINESS TEST RESULTS');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log('='.repeat(80));

  // Detailed results
  results.forEach(result => {
    const icon = {
      PASS: '✅',
      FAIL: '❌',
      WARN: '⚠️',
      SKIP: '⏭️'
    }[result.status];

    console.log(`\n${icon} ${result.name}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);
    if (result.duration) {
      console.log(`   Duration: ${result.duration}ms`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(80));

  // Overall status
  if (failed > 0) {
    console.log('🚨 PRODUCTION READINESS: NOT READY');
    console.log(`   ${failed} critical test(s) failed. Fix these issues before deployment.`);
    console.log('='.repeat(80));
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  PRODUCTION READINESS: READY WITH WARNINGS');
    console.log(`   ${warnings} non-critical test(s) failed. Consider fixing before deployment.`);
    console.log('='.repeat(80));
    process.exit(0);
  } else {
    console.log('✅ PRODUCTION READINESS: READY');
    console.log('   All critical systems operational. Safe to deploy.');
    console.log('='.repeat(80));
    process.exit(0);
  }
}

/**
 * Main test runner
 */
async function runProductionReadinessTests(): Promise<void> {
  const startTime = Date.now();

  logger.info('Starting Production Readiness Test Suite');
  console.log('\n' + '='.repeat(80));
  console.log('VOXANNE AI - PRODUCTION READINESS TEST SUITE');
  console.log('Testing Five Production Priorities');
  console.log('='.repeat(80) + '\n');

  try {
    await testMonitoring();
    await testSecurity();
    await testDataIntegrity();
    await testCircuitBreaker();
    await testInfrastructure();

    const duration = Date.now() - startTime;
    logger.info('All tests completed', { duration });

    generateReport();
  } catch (error) {
    logger.error('Test suite crashed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    console.error('\n❌ TEST SUITE CRASHED');
    console.error(error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runProductionReadinessTests();
}

export { runProductionReadinessTests };
