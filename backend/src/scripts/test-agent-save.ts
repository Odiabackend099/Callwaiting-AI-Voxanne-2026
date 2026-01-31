/**
 * Test Script: Agent Save Endpoint
 *
 * Tests the POST /api/founder-console/agent/behavior endpoint
 * with various scenarios to verify the fix is working.
 *
 * Usage: NODE_ENV=development npx ts-node src/scripts/test-agent-save.ts
 */

// Use native fetch (Node 18+) or require node-fetch dynamically
const fetchImpl = typeof fetch !== 'undefined' ? fetch : require('node-fetch').default;

// Ensure we're in development mode for testing
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const USE_DEV_MODE = process.env.NODE_ENV === 'development';
const TEST_JWT = process.env.TEST_JWT;

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(`  ${title}`, 'bold');
  console.log('='.repeat(80) + '\n');
}

async function testSaveEndpoint(
  testName: string,
  payload: any,
  expectedStatus: number,
  expectedResult: 'success' | 'error'
) {
  logSection(`Test: ${testName}`);

  log('Request Payload:', 'cyan');
  console.log(JSON.stringify(payload, null, 2));

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // In dev mode, no auth header needed (middleware uses default dev user)
    // In production mode, must provide JWT
    if (!USE_DEV_MODE && TEST_JWT) {
      headers['Authorization'] = `Bearer ${TEST_JWT}`;
    }

    const response = await fetchImpl(`${BACKEND_URL}/api/founder-console/agent/behavior`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    log(`\nResponse Status: ${response.status}`, response.status === expectedStatus ? 'green' : 'red');
    log('Response Body:', 'cyan');
    console.log(JSON.stringify(data, null, 2));

    // Verify result
    const actualResult = data.success ? 'success' : 'error';

    if (response.status === expectedStatus && actualResult === expectedResult) {
      log('\n✅ TEST PASSED', 'green');
      return { passed: true, response: data };
    } else {
      log('\n❌ TEST FAILED', 'red');
      if (response.status !== expectedStatus) {
        log(`   Expected status: ${expectedStatus}, Got: ${response.status}`, 'red');
      }
      if (actualResult !== expectedResult) {
        log(`   Expected result: ${expectedResult}, Got: ${actualResult}`, 'red');
      }
      return { passed: false, response: data };
    }
  } catch (error: any) {
    log('\n❌ TEST FAILED (Exception)', 'red');
    log(`   Error: ${error.message}`, 'red');
    return { passed: false, error: error.message };
  }
}

async function runTests() {
  log('╔════════════════════════════════════════════════════════════════════════════╗', 'bold');
  log('║                    Agent Save Endpoint Test Suite                          ║', 'bold');
  log('╚════════════════════════════════════════════════════════════════════════════╝', 'bold');

  if (USE_DEV_MODE) {
    log('\n🔧 Running in DEV MODE (NODE_ENV=development)', 'cyan');
    log('Backend URL: ' + BACKEND_URL, 'cyan');
    log('Using default dev org: a0000000-0000-0000-0000-000000000001', 'cyan');
    log('Auth: No JWT required (uses dev-user fallback)\n', 'cyan');
  } else {
    log('\n🔐 Running in PRODUCTION MODE (NODE_ENV=production)', 'cyan');
    if (!TEST_JWT) {
      log('\n⚠️  WARNING: No JWT token provided!', 'yellow');
      log('Please set TEST_JWT environment variable.', 'yellow');
      log('\nTo get a JWT token:', 'cyan');
      log('1. Login to http://localhost:3000 as voxanne@demo.com', 'cyan');
      log('2. Open browser DevTools > Application > Local Storage', 'cyan');
      log('3. Copy the token from Supabase auth', 'cyan');
      log('4. Run: TEST_JWT="your-token-here" NODE_ENV=production npx ts-node src/scripts/test-agent-save.ts\n', 'cyan');
      return;
    }
    log('Using JWT: ' + TEST_JWT.substring(0, 20) + '...', 'cyan');
  }

  const results: any[] = [];

  // Test 1: Valid payload with all fields
  results.push(await testSaveEndpoint(
    'Valid Outbound Agent Save',
    {
      outbound: {
        name: 'Test Sales Agent',
        systemPrompt: 'You are a helpful sales assistant at Voxanne AI. Be professional and friendly.',
        firstMessage: 'Hello! Thanks for calling Voxanne AI. How can I assist you today?',
        voiceId: 'en-US-JennyNeural',
        voiceProvider: 'azure',
        language: 'en-US',
        maxDurationSeconds: 600
      }
    },
    200,
    'success'
  ));

  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests

  // Test 2: Valid payload with minimal fields
  results.push(await testSaveEndpoint(
    'Minimal Valid Payload',
    {
      outbound: {
        systemPrompt: 'Updated prompt',
        firstMessage: 'Hello',
        voiceId: 'Rohan',
        language: 'en-US',
        maxDurationSeconds: 300
      }
    },
    200,
    'success'
  ));

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Empty payload (should return "No changes to save")
  results.push(await testSaveEndpoint(
    'Empty Payload (No Changes)',
    {
      outbound: {}
    },
    200,
    'success'
  ));

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Invalid voice ID (should fail with clear error)
  results.push(await testSaveEndpoint(
    'Invalid Voice ID',
    {
      outbound: {
        systemPrompt: 'Test',
        firstMessage: 'Test',
        voiceId: 'invalid-voice-that-does-not-exist',
        language: 'en-US',
        maxDurationSeconds: 300
      }
    },
    400,
    'error'
  ));

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 5: Update name only
  results.push(await testSaveEndpoint(
    'Update Name Only',
    {
      outbound: {
        name: 'Updated Agent Name'
      }
    },
    200,
    'success'
  ));

  // Summary
  logSection('Test Summary');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  log(`Total Tests: ${total}`, 'bold');
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`Success Rate: ${Math.round((passed / total) * 100)}%`, passed === total ? 'green' : 'yellow');

  if (passed === total) {
    log('\n🎉 All tests passed! The fix is working correctly.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Review the output above for details.', 'yellow');
  }

  console.log('\n');
}

// Run the tests
runTests().catch(error => {
  log('Fatal error running tests:', 'red');
  console.error(error);
  process.exit(1);
});
