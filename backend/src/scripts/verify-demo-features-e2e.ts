#!/usr/bin/env ts-node
/**
 * E2E Demo Feature Verification - Main Orchestrator
 *
 * Runs all 5 critical demo feature tests in sequence:
 * 1. Real-Time Availability (Google Calendar API)
 * 2. Atomic Booking (Google → DB)
 * 3. Live SMS Confirmation (Twilio)
 * 4. Sentiment Analysis (GPT-4o)
 * 5. Zero-Hallucination RAG (pgvector)
 *
 * Usage:
 *   npm run test:demo-features
 */

import { setupTestEnvironment, cleanupTestEnvironment } from './e2e-utils/test-environment-setup';
import { testRealTimeAvailability } from './e2e-tests/test-real-time-availability';
import { testAtomicBooking } from './e2e-tests/test-atomic-booking';
import { testLiveSMS } from './e2e-tests/test-live-sms';
import { testSentimentAnalysis } from './e2e-tests/test-sentiment-analysis';
import { testZeroHallucinationRAG } from './e2e-tests/test-zero-hallucination-rag';

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

async function runAllTests() {
  console.log('🚀 Starting E2E Demo Feature Verification\n');
  console.log('='.repeat(70) + '\n');

  let env: any;
  const results: TestResult[] = [];
  const startTime = Date.now();

  try {
    // Setup test environment
    console.log('⚙️  Setting up test environment...');
    env = await setupTestEnvironment();
    console.log(`✅ Test environment ready (Org ID: ${env.orgId.substring(0, 8)}...)\n`);

    // Define tests to run
    const tests = [
      async () => testRealTimeAvailability(env.orgId),
      async () => testAtomicBooking(env.orgId, env.contactId),
      async () => testLiveSMS(env.orgId),
      async () => testSentimentAnalysis(),
      async () => testZeroHallucinationRAG(env.orgId)
    ];

    // Run tests sequentially
    for (const test of tests) {
      const result = await test();
      results.push(result);

      if (result.passed) {
        console.log(`✅ ${result.testName} - PASS (${result.duration}ms)`);
        if (result.details) {
          console.log(`   ${result.details}`);
        }
      } else {
        console.log(`❌ ${result.testName} - FAIL`);
        console.log(`   Error: ${result.error}`);
      }
    }

  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message || error);
    process.exit(1);
  } finally {
    // Cleanup
    if (env) {
      try {
        console.log('\n🧹 Cleaning up test environment...');
        await cleanupTestEnvironment(env.orgId);
        console.log('✅ Cleanup complete\n');
      } catch (cleanupError: any) {
        console.error('⚠️  Cleanup failed:', cleanupError.message);
        // Don't fail the test suite if cleanup fails
      }
    }
  }

  // Report
  const totalDuration = Date.now() - startTime;

  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Results Summary\n');

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log(`Tests Passed: ${passedCount}/${totalCount}`);
  console.log(`Tests Failed: ${totalCount - passedCount}/${totalCount}`);
  console.log(`Total Duration: ${Math.round(totalDuration / 1000)}s\n`);

  if (passedCount === totalCount) {
    console.log('🎉 ALL TESTS PASSED - DEMO READY!\n');
    console.log('You can confidently demonstrate all 5 critical features:\n');
    console.log('  ✅ Real-time calendar availability checks');
    console.log('  ✅ Atomic booking (Google → Database)');
    console.log('  ✅ Live SMS confirmations');
    console.log('  ✅ Sentiment analysis with GPT-4o');
    console.log('  ✅ Zero-hallucination knowledge base\n');
    process.exit(0);
  } else {
    console.log('⚠️  SOME TESTS FAILED - DEMO NOT READY\n');
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.testName}: ${r.error}`);
    });
    console.log('\nPlease fix the failing tests before proceeding with the demo.\n');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
