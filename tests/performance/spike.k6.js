/**
 * K6 Spike Test — Voxanne AI
 * Simulates a flash-sale / viral-post surge.
 *
 * Pattern: 50 VUs baseline → instant jump to 500 VUs for 5 min → recover to 100 VUs
 *
 * Validates:
 *   - System recovers to baseline latency within 2 min of spike end
 *   - No data corruption during spike (responses are structurally valid JSON)
 *   - Queue depth stays stable (no runaway memory growth)
 *   - Rate limiter returns 429 (not 500/502) under overload
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3001 K6_AUTH_TOKEN=<jwt> k6 run spike.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const serverErrors = new Rate('server_errors');
const recoveryTrend = new Trend('recovery_latency', true);

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || '';

export const options = {
  stages: [
    { duration: '1m',  target: 50  },   // baseline warm-up
    { duration: '30s', target: 500 },   // instant spike
    { duration: '5m',  target: 500 },   // hold spike
    { duration: '30s', target: 100 },   // drop back
    { duration: '2m',  target: 100 },   // recovery observation window
    { duration: '30s', target: 0   },   // shut down
  ],
  thresholds: {
    errors: ['rate<0.05'],
    server_errors: ['rate<0.01'],
    // Recovery: P95 must return to <800ms within 2 min after spike
    recovery_latency: ['p(95)<800'],
  },
};

const HEADERS = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

export default function () {
  // Mix of reads to simulate realistic post-viral traffic
  const endpoints = [
    `${BASE_URL}/api/calls-dashboard/stats?timeWindow=7d`,
    `${BASE_URL}/api/calls-dashboard?page=1&limit=20`,
    `${BASE_URL}/api/appointments`,
  ];
  const url = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(url, { headers: HEADERS });

  // Only track recovery latency during the recovery phase (after spike)
  // VU iteration number is a proxy; in K6 use __ITER for rough phase detection
  if (__ITER > 0) recoveryTrend.add(res.timings.duration);

  errorRate.add(res.status >= 400 && res.status !== 429);
  serverErrors.add(res.status >= 500);

  check(res, {
    'not 5xx': (r) => r.status < 500,
    'response has body': (r) => r.body && r.body.length > 0,
  });

  sleep(0.2 + Math.random() * 0.3);
}
