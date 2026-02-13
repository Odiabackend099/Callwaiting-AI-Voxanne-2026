/**
 * Load Test: Prepaid Billing Race Conditions
 *
 * Tests concurrent operations to verify no double-spending or race conditions
 * Simulates:
 * 1. 100 concurrent phone provisions with limited balance (should block most)
 * 2. 100 concurrent call reservations (should fail gracefully)
 * 3. Concurrent provision + reservation conflicts
 */

import axios from 'axios';

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const TEST_ORG_ID = process.env.TEST_ORG_ID || '550e8400-e29b-41d4-a716-446655440000';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-123';
const CONCURRENT_REQUESTS = 100;
const CONCURRENT_CALLS = 50;

interface LoadTestResult {
  scenario: string;
  totalRequests: number;
  successful: number;
  failed: number;
  duplicateDetected: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: LoadTestResult[] = [];

async function scenario1_ConcurrentPhoneProvisioning() {
  console.log('\n📊 Scenario 1: 100 Concurrent Phone Provisions (1000p balance, 1000p each)');
  console.log('   Expected: 1 succeeds, 99 rejected (insufficient balance)\n');

  const startTime = Date.now();
  const requests = [];

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const promise = axios.post(
      `${BASE_URL}/api/managed-telephony/provision`,
      {
        country: 'US',
        numberType: 'local',
        areaCode: '415',
      },
      {
        headers: {
          Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
          'X-Org-Id': TEST_ORG_ID,
        },
        validateStatus: () => true,
      }
    );

    requests.push(promise);
  }

  const responses = await Promise.all(requests);
  const endTime = Date.now();

  const successful = responses.filter((r) => r.status === 200).length;
  const failed = responses.filter((r) => r.status === 402 || r.status === 409).length;
  const duplicate = responses.filter((r) => r.status === 409).length;
  const avgTime = responses.reduce((sum, r) => sum + (r.headers['x-response-time'] || 0), 0) / responses.length;

  const result: LoadTestResult = {
    scenario: 'Concurrent Phone Provisioning',
    totalRequests: CONCURRENT_REQUESTS,
    successful,
    failed,
    duplicateDetected: duplicate,
    averageResponseTime: endTime - startTime,
    maxResponseTime: Math.max(...responses.map((r) => r.headers['x-response-time'] || 0)),
    minResponseTime: Math.min(...responses.map((r) => r.headers['x-response-time'] || 100)),
    status: successful <= 1 && failed >= CONCURRENT_REQUESTS - 1 ? 'PASS' : 'FAIL',
    details: `${successful} succeeded, ${failed} rejected, ${duplicate} duplicates detected`,
  };

  console.log(`   ✅ Success: ${successful}`);
  console.log(`   ❌ Rejected: ${failed}`);
  console.log(`   🔄 Duplicates: ${duplicate}`);
  console.log(`   ⏱️  Total time: ${endTime - startTime}ms`);
  console.log(`   📊 Status: ${result.status}\n`);

  results.push(result);
}

async function scenario2_ConcurrentCallReservations() {
  console.log('📊 Scenario 2: 50 Concurrent Call Reservations (same call ID)');
  console.log('   Expected: 1 succeeds, 49 detected as duplicate\n');

  const callId = `load-test-call-${Date.now()}`;
  const startTime = Date.now();
  const requests = [];

  for (let i = 0; i < CONCURRENT_CALLS; i++) {
    const promise = axios.post(
      `${BASE_URL}/api/billing/reserve-credits`,
      {
        callId,
        vapiCallId: `vapi-${callId}`,
        estimatedMinutes: 5,
      },
      {
        headers: {
          Authorization: `Bearer ${TEST_AUTH_TOKEN}`,
          'X-Org-Id': TEST_ORG_ID,
        },
        validateStatus: () => true,
      }
    );

    requests.push(promise);
  }

  const responses = await Promise.all(requests);
  const endTime = Date.now();

  const successful = responses.filter((r) => r.status === 200 && r.data?.success).length;
  const duplicates = responses.filter((r) => r.data?.duplicate).length;
  const failed = responses.filter((r) => r.status >= 400 || !r.data?.success).length;

  const result: LoadTestResult = {
    scenario: 'Concurrent Call Reservations',
    totalRequests: CONCURRENT_CALLS,
    successful,
    failed,
    duplicateDetected: duplicates,
    averageResponseTime: (endTime - startTime) / CONCURRENT_CALLS,
    maxResponseTime: 0,
    minResponseTime: 0,
    status: successful <= 1 && duplicates >= CONCURRENT_CALLS - 2 ? 'PASS' : 'FAIL',
    details: `${successful} succeeded, ${duplicates} duplicates, ${failed} failed`,
  };

  console.log(`   ✅ Success: ${successful}`);
  console.log(`   🔄 Duplicates: ${duplicates}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️  Total time: ${endTime - startTime}ms`);
  console.log(`   📊 Status: ${result.status}\n`);

  results.push(result);
}

async function scenario3_ProvisionVsReservationConflict() {
  console.log('📊 Scenario 3: Concurrent Provision + Reservation (same org, limited balance)');
  console.log('   Expected: Only 1 operation succeeds, others fail gracefully\n');

  const startTime = Date.now();
  const callId = `conflict-test-${Date.now()}`;
  const provisionRequests = [];
  const reserveRequests = [];

  // 25 concurrent provisions
  for (let i = 0; i < 25; i++) {
    provisionRequests.push(
      axios.post(
        `${BASE_URL}/api/managed-telephony/provision`,
        { country: 'US', numberType: 'local' },
        {
          headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}`, 'X-Org-Id': TEST_ORG_ID },
          validateStatus: () => true,
        }
      )
    );
  }

  // 25 concurrent reservations
  for (let i = 0; i < 25; i++) {
    reserveRequests.push(
      axios.post(
        `${BASE_URL}/api/billing/reserve-credits`,
        { callId: `${callId}-${i}`, vapiCallId: `vapi-${i}`, estimatedMinutes: 5 },
        {
          headers: { Authorization: `Bearer ${TEST_AUTH_TOKEN}`, 'X-Org-Id': TEST_ORG_ID },
          validateStatus: () => true,
        }
      )
    );
  }

  const allResponses = await Promise.all([...provisionRequests, ...reserveRequests]);
  const endTime = Date.now();

  const provisionSuccess = allResponses.slice(0, 25).filter((r) => r.status === 200).length;
  const reserveSuccess = allResponses.slice(25).filter((r) => r.status === 200 && r.data?.success).length;
  const totalSuccess = provisionSuccess + reserveSuccess;

  const result: LoadTestResult = {
    scenario: 'Provision vs Reservation Conflict',
    totalRequests: 50,
    successful: totalSuccess,
    failed: 50 - totalSuccess,
    duplicateDetected: 0,
    averageResponseTime: (endTime - startTime) / 50,
    maxResponseTime: 0,
    minResponseTime: 0,
    status: totalSuccess <= 2 ? 'PASS' : 'FAIL',
    details: `${provisionSuccess} provisions succeeded, ${reserveSuccess} reservations succeeded`,
  };

  console.log(`   ✅ Provisions succeeded: ${provisionSuccess}`);
  console.log(`   ✅ Reservations succeeded: ${reserveSuccess}`);
  console.log(`   ❌ Total failed: ${50 - totalSuccess}`);
  console.log(`   ⏱️  Total time: ${endTime - startTime}ms`);
  console.log(`   📊 Status: ${result.status}\n`);

  results.push(result);
}

async function runAllTests() {
  console.log('🚀 Starting Load Tests for Prepaid Billing Engine\n');
  console.log(`Backend: ${BASE_URL}`);
  console.log(`Test Org: ${TEST_ORG_ID}`);
  console.log(`========================================\n`);

  try {
    await scenario1_ConcurrentPhoneProvisioning();
    await scenario2_ConcurrentCallReservations();
    await scenario3_ProvisionVsReservationConflict();
  } catch (error: any) {
    console.error('❌ Test execution failed:', error.message);
  }

  // Print summary
  console.log('========================================');
  console.log('📋 LOAD TEST SUMMARY\n');

  let passCount = 0;
  let failCount = 0;

  results.forEach((r) => {
    console.log(`Test: ${r.scenario}`);
    console.log(`  Total: ${r.totalRequests} | Success: ${r.successful} | Failed: ${r.failed} | Duplicates: ${r.duplicateDetected}`);
    console.log(`  Avg Response: ${r.averageResponseTime.toFixed(2)}ms`);
    console.log(`  Status: ${r.status} ${r.status === 'PASS' ? '✅' : '❌'}`);
    console.log(`  Details: ${r.details}\n`);

    if (r.status === 'PASS') passCount++;
    else failCount++;
  });

  console.log(`========================================`);
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log(`Overall: ${failCount === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);

  process.exit(failCount === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
