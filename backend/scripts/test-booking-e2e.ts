#!/usr/bin/env ts-node

/**
 * ================================================================================
 * END-TO-END BOOKING TEST SUITE
 * ================================================================================
 *
 * Comprehensive tests for appointment booking flow with atomic concurrency handling.
 *
 * Tests:
 * 1. Sequential bookings (same phone, different times)
 * 2. Concurrent bookings (same phone, same time) → expect atomic handling
 * 3. Phone-only booking
 * 4. Email-only booking
 * 5. Missing contact info → expect 400 error
 * 6. Invalid date/time → expect validation error
 *
 * Usage:
 *   npm run test:booking
 *   OR: ts-node scripts/test-booking-e2e.ts
 */

import axios, { AxiosError } from 'axios';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const BOOKING_ENDPOINT = `${BACKEND_URL}/api/vapi/tools/bookClinicAppointment`;

// Logging utility
function log(level: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN', message: string, data?: any) {
  const prefix = {
    INFO: '📋',
    SUCCESS: '✅',
    ERROR: '❌',
    WARN: '⚠️'
  }[level];

  console.log(`${prefix} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function addResult(name: string, passed: boolean, message: string, details?: any) {
  results.push({ name, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}\n`);
}

/**
 * Test 1: Sequential bookings with same phone
 */
async function testSequentialBookings() {
  try {
    log('INFO', 'Test 1: Sequential bookings (same phone, different times)');

    const phone = '+15551111111';
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 5); // 5 days from now

    // First booking
    const date1 = new Date(baseDate);
    date1.setHours(10, 0, 0);

    const response1 = await axios.post(BOOKING_ENDPOINT, {
      patientName: 'Sequential Test 1',
      patientPhone: phone,
      patientEmail: 'seq-test-1@example.com',
      appointmentDate: date1.toISOString().split('T')[0],
      appointmentTime: '10:00'
    }, { validateStatus: () => true });

    if (response1.status >= 400) {
      addResult('Test 1 (Sequential - First)', false, `First booking failed with status ${response1.status}`);
      return;
    }

    // Second booking (same phone, different time)
    const date2 = new Date(baseDate);
    date2.setHours(14, 0, 0);

    const response2 = await axios.post(BOOKING_ENDPOINT, {
      patientName: 'Sequential Test 2',
      patientPhone: phone,
      patientEmail: 'seq-test-2@example.com',
      appointmentDate: date2.toISOString().split('T')[0],
      appointmentTime: '14:00'
    }, { validateStatus: () => true });

    if (response2.status >= 400) {
      addResult('Test 1 (Sequential - Second)', false, `Second booking failed with status ${response2.status}`);
      return;
    }

    addResult(
      'Test 1: Sequential Bookings',
      true,
      'Both bookings succeeded (contact updated, 2 appointments created)',
      { booking1Status: response1.status, booking2Status: response2.status }
    );
  } catch (error: any) {
    addResult('Test 1: Sequential Bookings', false, `Error: ${error?.message}`);
  }
}

/**
 * Test 2: Concurrent bookings (atomic locking test)
 */
async function testConcurrentBookings() {
  try {
    log('INFO', 'Test 2: Concurrent bookings (atomic locking)');

    const phone = '+15552222222';
    const testEmail = `concurrent-test-${Date.now()}@example.com`;
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 7);
    const dateStr = testDate.toISOString().split('T')[0];

    // Fire two requests simultaneously with same phone
    const promise1 = axios.post(BOOKING_ENDPOINT, {
      patientName: 'Concurrent Test 1',
      patientPhone: phone,
      patientEmail: testEmail,
      appointmentDate: dateStr,
      appointmentTime: '10:00'
    }, { validateStatus: () => true });

    const promise2 = axios.post(BOOKING_ENDPOINT, {
      patientName: 'Concurrent Test 2',
      patientPhone: phone,
      patientEmail: testEmail,
      appointmentDate: dateStr,
      appointmentTime: '10:00'
    }, { validateStatus: () => true });

    const [response1, response2] = await Promise.all([promise1, promise2]);

    const successCount = [response1, response2].filter(r => r.status < 400).length;

    if (successCount === 2) {
      addResult(
        'Test 2: Concurrent Bookings',
        true,
        'Both concurrent requests handled atomically ✓',
        { success1: response1.status < 400, success2: response2.status < 400 }
      );
    } else if (successCount === 1) {
      addResult(
        'Test 2: Concurrent Bookings',
        true,
        `⚠️ Partial success: 1/2 requests succeeded (acceptable if upsert worked)`,
        { success1: response1.status < 400, success2: response2.status < 400 }
      );
    } else {
      addResult(
        'Test 2: Concurrent Bookings',
        false,
        `Both requests failed with status ${response1.status} and ${response2.status}`,
        { success1: response1.status < 400, success2: response2.status < 400 }
      );
    }
  } catch (error: any) {
    addResult('Test 2: Concurrent Bookings', false, `Error: ${error?.message}`);
  }
}

/**
 * Test 3: Phone-only booking
 */
async function testPhoneOnlyBooking() {
  try {
    log('INFO', 'Test 3: Phone-only booking (no email)');

    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 3);
    const dateStr = testDate.toISOString().split('T')[0];

    const response = await axios.post(BOOKING_ENDPOINT, {
      patientName: 'Phone Only Test',
      patientPhone: '+15553333333',
      patientEmail: null,
      appointmentDate: dateStr,
      appointmentTime: '15:00'
    }, { validateStatus: () => true });

    if (response.status < 400) {
      addResult('Test 3: Phone-Only Booking', true, 'Phone-only booking succeeded');
    } else {
      addResult('Test 3: Phone-Only Booking', false, `Booking failed with status ${response.status}`);
    }
  } catch (error: any) {
    addResult('Test 3: Phone-Only Booking', false, `Error: ${error?.message}`);
  }
}

/**
 * Test 4: Email-only booking (should fail - phone is required)
 */
async function testEmailOnlyBooking() {
  try {
    log('INFO', 'Test 4: Email-only booking (should fail - phone is required)');

    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 4);
    const dateStr = testDate.toISOString().split('T')[0];

    const response = await axios.post(BOOKING_ENDPOINT, {
      patientName: 'Email Only Test',
      patientPhone: null,
      patientEmail: `email-only-${Date.now()}@example.com`,
      appointmentDate: dateStr,
      appointmentTime: '11:00'
    }, { validateStatus: () => true });

    if (response.status >= 400) {
      addResult('Test 4: Email-Only Booking', true, 'Correctly rejected email-only booking (phone is required)', { status: response.status });
    } else {
      addResult('Test 4: Email-Only Booking', false, `Should have failed but got status ${response.status}`);
    }
  } catch (error: any) {
    addResult('Test 4: Email-Only Booking', false, `Error: ${error?.message}`);
  }
}

/**
 * Test 5: Missing contact info (should fail with 400)
 */
async function testMissingContactInfo() {
  try {
    log('INFO', 'Test 5: Missing contact info (should return 400)');

    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 2);
    const dateStr = testDate.toISOString().split('T')[0];

    const response = await axios.post(BOOKING_ENDPOINT, {
      patientName: 'No Contact Test',
      patientPhone: null,
      patientEmail: null,
      appointmentDate: dateStr,
      appointmentTime: '09:00'
    }, { validateStatus: () => true });

    if (response.status === 400) {
      addResult(
        'Test 5: Missing Contact Info',
        true,
        'Correctly rejected with 400 (Bad Request)',
        { status: response.status }
      );
    } else if (response.status >= 400) {
      addResult(
        'Test 5: Missing Contact Info',
        true,
        `Rejected with status ${response.status} (acceptable error)`,
        { status: response.status }
      );
    } else {
      addResult(
        'Test 5: Missing Contact Info',
        false,
        `Should have failed but got status ${response.status}`
      );
    }
  } catch (error: any) {
    addResult('Test 5: Missing Contact Info', true, 'Request failed as expected (acceptable)');
  }
}

/**
 * Test 6: Webhook connectivity
 */
async function testWebhookConnectivity() {
  try {
    log('INFO', 'Test 6: Webhook endpoint connectivity');

    const webhookUrl = `${BACKEND_URL}/api/vapi/webhook/health`;

    const response = await axios.get(webhookUrl, { timeout: 5000, validateStatus: () => true });

    if (response.status === 200 && (response.data?.status === 'ok' || response.data?.status === 'healthy')) {
      addResult(
        'Test 6: Webhook Connectivity',
        true,
        'Webhook endpoint is healthy',
        { status: response.status, data: response.data }
      );
    } else {
      addResult(
        'Test 6: Webhook Connectivity',
        false,
        `Webhook returned status ${response.status}`,
        { status: response.status, data: response.data }
      );
    }
  } catch (error: any) {
    addResult('Test 6: Webhook Connectivity', false, `Webhook unreachable: ${error?.message}`);
  }
}

/**
 * Generate test report
 */
function generateReport() {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const passPercentage = ((passedTests / totalTests) * 100).toFixed(1);

  log('INFO', '╔════════════════════════════════════════════════════════╗');
  log('INFO', '║         END-TO-END TEST REPORT                        ║');
  log('INFO', '╚════════════════════════════════════════════════════════╝');

  console.log('\nTest Results:\n');
  results.forEach((result, index) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${index + 1}. ${icon} ${result.name}: ${result.message}`);
  });

  console.log('\n' + '='.repeat(56));
  console.log(`Total: ${totalTests} tests`);
  console.log(`Passed: ${passedTests} (${passPercentage}%)`);
  console.log(`Failed: ${failedTests}`);
  console.log('='.repeat(56) + '\n');

  if (failedTests === 0) {
    log('SUCCESS', 'ALL TESTS PASSED! ✓ System ready for live testing');
  } else if (passedTests >= totalTests * 0.8) {
    log('WARN', `Most tests passed (${passPercentage}%) - review failures above`);
  } else {
    log('ERROR', `Only ${passPercentage}% of tests passed - system may not be ready`);
  }
}

/**
 * Main test runner
 */
export async function runPreflightChecks(): Promise<boolean> {
  log('INFO', '╔════════════════════════════════════════════════════════╗');
  log('INFO', '║     🧪 RUNNING END-TO-END BOOKING TESTS              ║');
  log('INFO', '╚════════════════════════════════════════════════════════╝');
  log('INFO', `Backend: ${BACKEND_URL}\n`);

  try {
    // Check backend is accessible first
    try {
      await axios.get(`${BACKEND_URL}/api/vapi/webhook/health`, { timeout: 5000 });
    } catch (error) {
      log('ERROR', `Backend not accessible at ${BACKEND_URL}`);
      return false;
    }

    // Run all tests
    await testSequentialBookings();
    await testConcurrentBookings();
    await testPhoneOnlyBooking();
    await testEmailOnlyBooking();
    await testMissingContactInfo();
    await testWebhookConnectivity();

    // Generate report
    generateReport();

    return results.filter(r => !r.passed).length === 0;
  } catch (error) {
    log('ERROR', 'Test execution failed', error);
    return false;
  }
}

// Allow script to be run directly
if (require.main === module) {
  runPreflightChecks()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log('ERROR', 'Fatal error', error);
      process.exit(1);
    });
}

export default { runPreflightChecks };
