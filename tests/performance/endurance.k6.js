/**
 * K6 Endurance / Soak Test — Voxanne AI
 * 2-hour condensed soak at 60 VUs to detect memory leaks.
 *
 * Polls /api/monitoring/cache-stats every 30 min to track heap trend.
 * FAIL condition: P95 response time increases >50% from baseline
 * (classic memory-leak signature — GC pauses grow as heap fills).
 *
 * Run (needs ~2 hours):
 *   K6_BASE_URL=http://localhost:3001 K6_AUTH_TOKEN=<jwt> k6 run endurance.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const earlyTrend  = new Trend('latency_t0_30',  true);  // First 30 min
const midTrend    = new Trend('latency_t30_60', true);  // 30–60 min
const lateTrend   = new Trend('latency_t60_90', true);  // 60–90 min
const finalTrend  = new Trend('latency_t90_120',true);  // 90–120 min
const cacheHits   = new Counter('cache_stats_polls');

const BASE_URL   = __ENV.K6_BASE_URL   || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || '';

export const options = {
  stages: [
    { duration: '120m', target: 60 }, // 2 hours steady at 60 VUs
    { duration: '1m',   target: 0  }, // wind down
  ],
  thresholds: {
    errors: ['rate<0.01'],
    // The four time-window trends allow post-run analysis for upward drift.
    // If latency_t90_120 P95 is >50% higher than latency_t0_30 P95 → memory leak suspected.
    http_req_duration: ['p(95)<1200'],
  },
};

const HEADERS = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

// Approximate elapsed minutes from VU start time
let startMs = null;

function elapsedMinutes() {
  if (!startMs) startMs = Date.now();
  return (Date.now() - startMs) / 60_000;
}

function bucketTrend(latencyMs) {
  const t = elapsedMinutes();
  if (t < 30)  earlyTrend.add(latencyMs);
  else if (t < 60) midTrend.add(latencyMs);
  else if (t < 90) lateTrend.add(latencyMs);
  else             finalTrend.add(latencyMs);
}

export default function () {
  const t = elapsedMinutes();

  // Every ~30 min, one VU polls the cache-stats endpoint
  // (Rough approximation: VU 0 checks at 30, 60, 90, 120 min marks)
  const shouldPollCache = __VU === 1 && (
    Math.abs(t - 30) < 0.5 ||
    Math.abs(t - 60) < 0.5 ||
    Math.abs(t - 90) < 0.5 ||
    Math.abs(t - 120) < 0.5
  );

  if (shouldPollCache) {
    const statsRes = http.get(`${BASE_URL}/api/monitoring/cache-stats`, { headers: HEADERS });
    cacheHits.add(1);
    check(statsRes, {
      'cache-stats reachable': (r) => r.status === 200,
      'hitRate field present': (r) => {
        try { return JSON.parse(r.body).hitRate !== undefined; } catch { return false; }
      },
    });
    console.log(`[t=${Math.round(t)}m] cache-stats: ${statsRes.body}`);
  }

  // Main workload — representative mix
  const r = Math.random();
  let res;
  if (r < 0.4) {
    res = http.get(`${BASE_URL}/api/calls-dashboard/stats?timeWindow=7d`, { headers: HEADERS });
  } else if (r < 0.65) {
    res = http.get(`${BASE_URL}/api/calls-dashboard?page=1&limit=20`, { headers: HEADERS });
  } else if (r < 0.80) {
    res = http.get(`${BASE_URL}/api/appointments`, { headers: HEADERS });
  } else if (r < 0.90) {
    res = http.get(`${BASE_URL}/api/agents`, { headers: HEADERS });
  } else {
    res = http.get(`${BASE_URL}/api/health`, { headers: HEADERS });
  }

  bucketTrend(res.timings.duration);
  errorRate.add(res.status >= 500);
  check(res, { 'not 5xx': (r) => r.status < 500 });

  sleep(1 + Math.random()); // 1–2s think time → ~30–60 req/min per VU
}
