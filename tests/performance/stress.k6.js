/**
 * K6 Stress Test — Voxanne AI
 * Finds the breaking point by incrementally increasing load.
 *
 * Stages:  100 → 250 → 500 → 750 → 1000 VUs (5 min each)
 *
 * Records:
 *   - First degradation point: P95 > 2 000ms
 *   - First critical point: error rate > 5%
 *   - Validates graceful 429 responses from rate limiter (not 500/502)
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3001 K6_AUTH_TOKEN=<jwt> k6 run stress.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const serverErrors = new Rate('server_errors');  // 5xx only — distinct from 429
const responseDuration = new Trend('response_duration', true);

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || '';

export const options = {
  stages: [
    { duration: '5m', target: 100  },
    { duration: '5m', target: 250  },
    { duration: '5m', target: 500  },
    { duration: '5m', target: 750  },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 0    },  // cool-down
  ],
  thresholds: {
    // These will fail by design — the purpose is finding WHEN they fail
    // Keep as documentation; CI should not gate on this test
    server_errors: ['rate<0.05'],  // >5% 5xx = critical failure
  },
};

const HEADERS = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

export default function () {
  // Hit the highest-traffic endpoint — calls dashboard stats
  const res = http.get(`${BASE_URL}/api/calls-dashboard/stats?timeWindow=7d`, { headers: HEADERS });

  responseDuration.add(res.timings.duration);
  errorRate.add(res.status >= 400 && res.status !== 429);
  serverErrors.add(res.status >= 500);

  check(res, {
    'not a 5xx error': (r) => r.status < 500,
    '429 rate limited (not 500)': (r) => r.status !== 500 && r.status !== 502,
  });

  sleep(0.1); // Minimal think time to maximize pressure
}
