import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 Load Test Script for Voxanne Backend
 * Tests system stability under concurrent user load
 *
 * Run locally: k6 run load-test.js
 * Run against production: BASE_URL=https://voxanne-backend.onrender.com k6 run load-test.js
 */

export const options = {
  stages: [
    { duration: '1m', target: 5 },    // Ramp up to 5 concurrent users over 1 minute
    { duration: '2m', target: 10 },   // Ramp up to 10 concurrent users over 2 minutes
    { duration: '3m', target: 10 },   // Hold at 10 concurrent users for 3 minutes
    { duration: '1m', target: 0 },    // Ramp down to 0 concurrent users over 1 minute
  ],
  thresholds: {
    http_req_duration: ['p(99)<1000'],  // 99th percentile response time must be < 1 second
    http_req_failed: ['rate<0.05'],     // Error rate must be < 5%
    http_reqs: ['rate>1'],              // At least 1 request per second
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_TOKEN = __ENV.API_TOKEN || 'test-token-for-load-test';

/**
 * Main test function - runs once per VU per iteration
 */
export default function () {
  // Test 1: Health check endpoint (most critical - should always succeed)
  {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health check status 200': (r) => r.status === 200,
      'health check has database service': (r) => JSON.parse(r.body).services?.database !== undefined,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
    });
  }

  sleep(0.5);

  // Test 2: Root endpoint
  {
    const res = http.get(`${BASE_URL}/`);
    check(res, {
      'root endpoint status 200': (r) => r.status === 200,
      'root endpoint has name field': (r) => JSON.parse(r.body).name === 'Voxanne Backend',
    });
  }

  sleep(0.5);

  // Test 3: Calls dashboard endpoint (requires auth)
  {
    const res = http.get(`${BASE_URL}/api/calls-dashboard?limit=20`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // Accept 401 (auth error with test token) as "works" - we're testing connectivity, not auth
    check(res, {
      'calls dashboard request completed': (r) => r.status === 200 || r.status === 401 || r.status === 403,
      'calls dashboard response time < 500ms': (r) => r.timings.duration < 500,
    });
  }

  sleep(1);

  // Test 4: Vapi webhook health check
  {
    const res = http.get(`${BASE_URL}/api/vapi/webhook/health`);
    check(res, {
      'vapi webhook health check status 200': (r) => r.status === 200,
      'vapi webhook response time < 200ms': (r) => r.timings.duration < 200,
    });
  }

  sleep(0.5);

  // Test 5: Assistants endpoint (read operation)
  {
    const res = http.get(`${BASE_URL}/api/assistants`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    check(res, {
      'assistants endpoint request completed': (r) => r.status === 200 || r.status === 401,
      'assistants endpoint response time < 500ms': (r) => r.timings.duration < 500,
    });
  }

  sleep(2);
}

/**
 * Setup function - runs once before all tests
 */
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);

  // Verify health check passes before starting load test
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    throw new Error(`Health check failed at ${BASE_URL}: ${healthRes.status}`);
  }

  console.log('Health check passed - beginning load test');
}

/**
 * Teardown function - runs once after all tests complete
 */
export function teardown() {
  console.log('Load test completed');

  // Final health check to verify system stability
  const healthRes = http.get(`${BASE_URL}/health`);
  if (healthRes.status !== 200) {
    console.error('WARNING: Health check failed after load test');
  } else {
    console.log('Final health check passed - system stable');
  }
}
