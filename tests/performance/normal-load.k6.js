/**
 * K6 Normal Load Test — Voxanne AI
 * Simulates typical clinic business hours traffic.
 *
 * Ramp:  0 → 100 VUs over 3 min, hold 20 min, ramp down 2 min
 * Mix:   40% calls dashboard  |  25% leads  |  15% appointments
 *         10% agent config    |  10% billing
 *
 * Run:
 *   K6_BASE_URL=http://localhost:3001 K6_AUTH_TOKEN=<jwt> k6 run normal-load.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const callsDashTrend = new Trend('calls_dashboard_duration', true);
const appointmentsTrend = new Trend('appointments_duration', true);

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || '';

export const options = {
  stages: [
    { duration: '3m',  target: 100 },  // ramp up
    { duration: '20m', target: 100 },  // hold
    { duration: '2m',  target: 0   },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    errors: ['rate<0.01'],
    calls_dashboard_duration: ['p(95)<800'],
    appointments_duration: ['p(95)<500'],
  },
};

const HEADERS = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

// Weighted scenarios — rolled on each VU iteration
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
      // 40% — calls dashboard (stats + log list)
      const statsRes = http.get(`${BASE_URL}/api/calls-dashboard/stats?timeWindow=7d`, { headers: HEADERS });
      callsDashTrend.add(statsRes.timings.duration);
      check(statsRes, { 'calls stats 200': (r) => r.status === 200 });
      errorRate.add(statsRes.status >= 500);

      sleep(0.5);

      const listRes = http.get(`${BASE_URL}/api/calls-dashboard?page=1&limit=20`, { headers: HEADERS });
      callsDashTrend.add(listRes.timings.duration);
      check(listRes, { 'calls list 200': (r) => r.status === 200 });
      errorRate.add(listRes.status >= 500);
      break;
    }

    case 'leads': {
      // 25% — leads list
      const res = http.get(`${BASE_URL}/api/dashboard/leads?page=1&limit=20`, { headers: HEADERS });
      check(res, { 'leads 200': (r) => r.status === 200 });
      errorRate.add(res.status >= 500);
      break;
    }

    case 'appointments': {
      // 15% — appointments list
      const res = http.get(`${BASE_URL}/api/appointments`, { headers: HEADERS });
      appointmentsTrend.add(res.timings.duration);
      check(res, { 'appointments 200': (r) => r.status === 200 });
      errorRate.add(res.status >= 500);
      break;
    }

    case 'agents': {
      // 10% — agent config
      const res = http.get(`${BASE_URL}/api/agents`, { headers: HEADERS });
      check(res, { 'agents 200': (r) => r.status === 200 });
      errorRate.add(res.status >= 500);
      break;
    }

    case 'billing': {
      // 10% — billing wallet
      const res = http.get(`${BASE_URL}/api/billing/wallet`, { headers: HEADERS });
      check(res, { 'billing 200 or 404': (r) => r.status === 200 || r.status === 404 });
      errorRate.add(res.status >= 500);
      break;
    }
  }

  sleep(1 + Math.random()); // 1–2s think time between requests
}
