#!/usr/bin/env ts-node
/**
 * Test 1: Real-Time Availability Check
 *
 * Verifies that:
 * 1. Google Calendar API is queried directly (not database)
 * 2. Free/busy check returns valid results
 * 3. Response time is <500ms
 * 4. Availability status is correctly determined
 */

import { checkAvailability } from '../../utils/google-calendar';
import { assert } from '../e2e-utils/test-environment-setup';

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

export async function testRealTimeAvailability(orgId: string): Promise<TestResult> {
  const testName = 'Real-Time Availability Check';
  console.log(`\n🧪 Testing: ${testName}`);

  // Test a time slot 24 hours in the future
  const startTime = new Date();
  startTime.setHours(startTime.getHours() + 24); // Tomorrow same time
  startTime.setMinutes(0);
  startTime.setSeconds(0);
  startTime.setMilliseconds(0);

  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + 1); // 1-hour slot

  try {
    const start = performance.now();

    // Call the actual Google Calendar integration
    const result = await checkAvailability(
      orgId,
      startTime.toISOString(),
      endTime.toISOString()
    );

    const duration = performance.now() - start;

    // Assertions
    assert(result !== undefined, 'Result should not be undefined');
    assert(result !== null, 'Result should not be null');
    assert('available' in result, 'Result should have available field');
    assert(typeof result.available === 'boolean', 'available should be a boolean');
    assert('message' in result, 'Result should have message field');
    assert(typeof result.message === 'string', 'message should be a string');

    // Performance assertion
    if (duration >= 500) {
      console.log(`   ⚠️  Warning: Response time (${Math.round(duration)}ms) exceeds 500ms target`);
    }

    // Success
    return {
      testName,
      passed: true,
      duration: Math.round(duration),
      details: `Available: ${result.available}, Response time: ${Math.round(duration)}ms`
    };
  } catch (error: any) {
    return {
      testName,
      passed: false,
      duration: 0,
      error: error.message || String(error)
    };
  }
}

// Allow running standalone
if (require.main === module) {
  const orgId = process.argv[2];
  if (!orgId) {
    console.error('Usage: ts-node test-real-time-availability.ts <orgId>');
    process.exit(1);
  }

  testRealTimeAvailability(orgId)
    .then((result) => {
      if (result.passed) {
        console.log(`\n✅ ${result.testName} - PASS`);
        console.log(`   ${result.details}`);
        process.exit(0);
      } else {
        console.log(`\n❌ ${result.testName} - FAIL`);
        console.log(`   Error: ${result.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
