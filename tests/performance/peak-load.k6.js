/**
 * K6 Peak Load Test — Voxanne AI
 * Simulates Monday morning call rush (5× normal traffic).
 *
 * Ramp:  0 → 500 VUs over 10 min, hold 20 min, ramp down 5 min
 * Mix:   Same weighted distribution as normal-load but at 5× scale
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3001 K6_AUTH_TOKEN=<jwt> k6 run peak-load.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || '';

export const options = {
  stages: [
    { duration: '10m', target: 500 },  // ramp up (Monday morning surge)
    { duration: '20m', target: 500 },  // hold at peak
    { duration: '5m',  target: 0   },  // ramp down
  ],
  thresholds: {
    // Relaxed SLAs under peak — P95 < 1.5s is acceptable
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    errors: ['rate<0.03'],
  },
};

const HEADERS = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

function pickScenario() {
  const r = Math.random() * 100;
  if (r < 40) return 'calls';
  if (r < 65) return 'leads';
  if (r < 80) return 'appointments';
  if (r < 90) return 'agents';
  return 'billing';
}

export default function () {
  const scenario = pickScenario();

  switch (scenario) {
    case 'calls': {
      const statsRes = http.get(`${BASE_URL}/api/calls-dashboard/stats?timeWindow=7d`, { headers: HEADERS });
      check(statsRes, { 'calls stats ≤200': (r) => r.status <= 200 || r.status === 429 });
      errorRate.add(statsRes.status >= 500);
      sleep(0.2);

      const listRes = http.get(`${BASE_URL}/api/calls-dashboard?page=1&limit=20`, { headers: HEADERS });
      check(listRes, { 'calls list ok': (r) => r.status === 200 || r.status === 429 });
      errorRate.add(listRes.status >= 500);
      break;
    }

    case 'leads': {
      const res = http.get(`${BASE_URL}/api/dashboard/leads?page=1&limit=20`, { headers: HEADERS });
      check(res, { 'leads ok': (r) => r.status === 200 || r.status === 429 });
      errorRate.add(res.status >= 500);
      break;
    }

    case 'appointments': {
      const res = http.get(`${BASE_URL}/api/appointments`, { headers: HEADERS });
      check(res, { 'appointments ok': (r) => r.status === 200 || r.status === 429 });
      errorRate.add(res.status >= 500);
      break;
    }

    case 'agents': {
      const res = http.get(`${BASE_URL}/api/agents`, { headers: HEADERS });
      check(res, { 'agents ok': (r) => r.status === 200 || r.status === 429 });
      errorRate.add(res.status >= 500);
      break;
    }

    case 'billing': {
      const res = http.get(`${BASE_URL}/api/billing/wallet`, { headers: HEADERS });
      check(res, { 'billing ok': (r) => r.status < 500 });
      errorRate.add(res.status >= 500);
      break;
    }
  }

  sleep(0.5 + Math.random() * 0.5); // Tighter think time under peak
}
