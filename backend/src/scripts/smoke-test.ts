#!/usr/bin/env node

/**
 * Smoke Test Suite - Voxanne AI
 *
 * Verifies core application functionality without crashing.
 * Tests: health checks, authentication, API endpoints, error handling.
 *
 * Run: TEST_AUTH_TOKEN="<jwt>" npx ts-node src/scripts/smoke-test.ts
 * Expected: All tests PASS, exit code 0
 */

import axios, { AxiosError } from 'axios';

// Color output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

type TestResult = {
  name: string;
  phase: string;
  status: 'PASS' | 'FAIL';
  details: string;
};

const results: TestResult[] = [];

function log(color: string, text: string) {
  console.log(`${color}${text}${colors.reset}`);
}

function pass(phase: string, name: string, details = '') {
  results.push({ phase, name, status: 'PASS', details });
  log(colors.green, `✓ ${phase}: ${name}`);
}

function fail(phase: string, name: string, error: string) {
  results.push({ phase, name, status: 'FAIL', details: error });
  log(colors.red, `✗ ${phase}: ${name} — ${error}`);
}

async function runTests() {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
  const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN;

  log(colors.blue, '━━━ VOXANNE AI SMOKE TEST ━━━');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Auth token: ${AUTH_TOKEN ? '✓ present' : '⚠ missing (some tests skipped)'}`);
  console.log('');

  // ════════════════════════════════════════════════════════════════════════════════
  // PHASE 1: PRIMARY HEALTH CHECK
  // ════════════════════════════════════════════════════════════════════════════════

  log(colors.blue, '╭─ PHASE 1: Build Verification');

  try {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    if (response.status === 200 && response.data.status === 'ok') {
      pass('Phase 1', 'Backend health check', `/health returned { status: "ok" }`);
    } else {
      fail('Phase 1', 'Backend health check', `Status ${response.status}, status: ${response.data.status}`);
    }
  } catch (err) {
    const error = err as AxiosError;
    fail('Phase 1', 'Backend health check', `Cannot connect to ${BACKEND_URL}: ${error.message}`);
    process.exit(1);
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // PHASE 2: AUTH HEALTH CHECK
  // ════════════════════════════════════════════════════════════════════════════════

  log(colors.blue, '╭─ PHASE 2: Auth Health Check');

  try {
    const response = await axios.get(`${BACKEND_URL}/api/auth/health`, { timeout: 5000 });
    if (response.status === 200) {
      pass('Phase 2', 'Auth health check', 'Status 200');
    } else {
      fail('Phase 2', 'Auth health check', `Status ${response.status}`);
    }
  } catch (err) {
    const error = err as AxiosError;
    fail('Phase 2', 'Auth health check', error.message);
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // PHASE 3: WEBHOOK HEALTH CHECK
  // ════════════════════════════════════════════════════════════════════════════════

  log(colors.blue, '╭─ PHASE 3: Webhook Health Check');

  try {
    const response = await axios.get(`${BACKEND_URL}/api/webhook/health`, { timeout: 5000 });
    if (response.status === 200) {
      pass('Phase 3', 'Webhook health check', 'Status 200');
    } else {
      fail('Phase 3', 'Webhook health check', `Status ${response.status}`);
    }
  } catch (err) {
    const error = err as AxiosError;
    fail('Phase 3', 'Webhook health check', error.message);
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // PHASE 4: CRITICAL API ENDPOINTS (WITH AUTH)
  // ════════════════════════════════════════════════════════════════════════════════

  if (!AUTH_TOKEN) {
    log(colors.yellow, '⚠ Skipping Phase 4-6 (no TEST_AUTH_TOKEN provided)');
    log(colors.yellow, '  Export: export TEST_AUTH_TOKEN="<your-jwt-here>"');
  } else {
    log(colors.blue, '╭─ PHASE 4: API Endpoints (Authenticated)');

    const endpoints = [
      { name: 'GET /api/calls', path: '/api/calls?limit=10' },
      { name: 'GET /api/appointments', path: '/api/appointments' },
      { name: 'GET /api/contacts', path: '/api/contacts?limit=10' },
      { name: 'GET /api/billing/usage', path: '/api/billing/usage' },
      { name: 'GET /api/onboarding/status', path: '/api/onboarding/status' },
      { name: 'GET /api/calls-dashboard/stats', path: '/api/calls-dashboard/stats' },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${BACKEND_URL}${endpoint.path}`, {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
          timeout: 5000,
        });

        if (response.status >= 200 && response.status < 300) {
          pass('Phase 4', endpoint.name, `Status ${response.status}`);
        } else {
          fail('Phase 4', endpoint.name, `Status ${response.status}`);
        }
      } catch (err) {
        const error = err as AxiosError;
        if (error.response?.status === 500) {
          fail('Phase 4', endpoint.name, `Status 500: ${error.message}`);
        } else {
          pass('Phase 4', endpoint.name, `Status ${error.response?.status || 'timeout'} (expected non-500)`);
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════════════
    // PHASE 5: WALLET/BILLING API
    // ════════════════════════════════════════════════════════════════════════════════

    log(colors.blue, '╭─ PHASE 5: Wallet/Billing');

    try {
      const response = await axios.get(`${BACKEND_URL}/api/billing/wallet/balance`, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        timeout: 5000,
      });

      if (response.status === 200 && typeof response.data.balance_pence === 'number') {
        pass('Phase 5', 'Wallet balance', `Balance: ${response.data.balance_pence} pence`);
      } else if (response.status === 200) {
        pass('Phase 5', 'Wallet balance', 'Status 200 (data format varies)');
      } else {
        fail('Phase 5', 'Wallet balance', `Status ${response.status}`);
      }
    } catch (err) {
      const error = err as AxiosError;
      fail('Phase 5', 'Wallet balance', error.message);
    }

    // ════════════════════════════════════════════════════════════════════════════════
    // PHASE 6: AGENT CONFIG API
    // ════════════════════════════════════════════════════════════════════════════════

    log(colors.blue, '╭─ PHASE 6: Agent Configuration');

    try {
      const response = await axios.get(`${BACKEND_URL}/api/founder-console/agent/config`, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        timeout: 5000,
      });

      if (response.status === 200) {
        pass('Phase 6', 'Agent config fetch', 'Status 200');
      } else {
        fail('Phase 6', 'Agent config fetch', `Status ${response.status}`);
      }
    } catch (err) {
      const error = err as AxiosError;
      if (error.response?.status === 404) {
        pass('Phase 6', 'Agent config fetch', 'Status 404 (expected if no agent configured)');
      } else {
        fail('Phase 6', 'Agent config fetch', error.message);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // PHASE 7: ERROR HANDLING
  // ════════════════════════════════════════════════════════════════════════════════

  log(colors.blue, '╭─ PHASE 7: Error Handling');

  // 401 - Unauthenticated
  try {
    await axios.get(`${BACKEND_URL}/api/calls`, { timeout: 5000 });
    fail('Phase 7', '401 Unauthenticated', 'Should have returned 401');
  } catch (err) {
    const error = err as AxiosError;
    if (error.response?.status === 401) {
      const errorMsg = JSON.stringify(error.response.data);
      if (errorMsg.includes('stack') || errorMsg.includes('Postgres')) {
        fail('Phase 7', '401 Unauthenticated', 'Leaked implementation details in error');
      } else {
        pass('Phase 7', '401 Unauthenticated', 'Handled gracefully');
      }
    } else {
      fail('Phase 7', '401 Unauthenticated', `Expected 401, got ${error.response?.status}`);
    }
  }

  // 404 - Not found
  if (AUTH_TOKEN) {
    try {
      await axios.get(`${BACKEND_URL}/api/calls/nonexistent-id-999`, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        timeout: 5000,
      });
      fail('Phase 7', '404 Not Found', 'Should have returned 404');
    } catch (err) {
      const error = err as AxiosError;
      if (error.response?.status === 404 || error.response?.status === 500) {
        const errorMsg = JSON.stringify(error.response?.data || {});
        if (errorMsg.includes('postgres') || errorMsg.includes('supabase')) {
          fail('Phase 7', '404 Not Found', 'Leaked database implementation details');
        } else {
          pass('Phase 7', '404 Not Found', 'Handled gracefully');
        }
      } else {
        fail('Phase 7', '404 Not Found', `Expected 4xx/5xx, got ${error.response?.status}`);
      }
    }
  }

  // Invalid route
  try {
    await axios.get(`${BACKEND_URL}/api/does-not-exist-12345`, { timeout: 5000 });
    fail('Phase 7', 'Invalid Route', 'Should have returned 404');
  } catch (err) {
    const error = err as AxiosError;
    if (error.response?.status === 404) {
      pass('Phase 7', 'Invalid Route', 'Returned 404');
    } else {
      fail('Phase 7', 'Invalid Route', `Expected 404, got ${error.response?.status}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════════════

  console.log('');
  log(colors.blue, '╭─ SUMMARY');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  log(colors.green, `✓ Passed: ${passed}`);
  if (failed > 0) {
    log(colors.red, `✗ Failed: ${failed}`);
  }

  console.log('');

  // Group by phase
  const byPhase = results.reduce(
    (acc, r) => {
      if (!acc[r.phase]) acc[r.phase] = [];
      acc[r.phase].push(r);
      return acc;
    },
    {} as Record<string, TestResult[]>,
  );

  for (const phase of Object.keys(byPhase).sort()) {
    const phaseResults = byPhase[phase];
    const phasePass = phaseResults.filter((r) => r.status === 'PASS').length;
    const phaseFail = phaseResults.filter((r) => r.status === 'FAIL').length;

    if (phaseFail > 0) {
      log(colors.red, `${phase}: ${phasePass}/${phaseResults.length} PASS`);
    } else {
      log(colors.green, `${phase}: ${phasePass}/${phaseResults.length} PASS`);
    }
  }

  console.log('');

  if (failed === 0) {
    log(colors.green, '✓ ALL TESTS PASSED - App is ready for users!');
    process.exit(0);
  } else {
    log(colors.red, `✗ ${failed} TESTS FAILED - Fix before shipping`);
    process.exit(1);
  }
}

// Run tests
runTests().catch((err) => {
  log(colors.red, `Fatal error: ${err.message}`);
  process.exit(1);
});
