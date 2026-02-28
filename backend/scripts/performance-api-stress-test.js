#!/usr/bin/env node
/**
 * API Endpoint Stress Test
 * Fires 50 concurrent requests to each critical endpoint and validates latency
 * distribution against SLA thresholds.
 *
 * Usage:
 *   TEST_AUTH_TOKEN=<jwt> node scripts/performance-api-stress-test.js
 *
 * Optional:
 *   API_BASE_URL   — defaults to http://localhost:3001
 *   CONCURRENCY    — simultaneous requests per batch (default 50)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const https = require('https');
const http = require('http');
const { URL } = require('url');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN;
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '50', 10);

// SLA thresholds (milliseconds)
const SLA = {
  'GET /api/calls-dashboard/stats':       { p95: 400,  p99: 800 },
  'GET /api/calls-dashboard':             { p95: 800,  p99: 1500 },
  'GET /api/appointments':                { p95: 500,  p99: 1000 },
  'GET /api/agents':                      { p95: 300,  p99: 600 },
  'GET /api/health':                      { p95: 100,  p99: 200 },
  'GET /api/monitoring/cache-stats':      { p95: 50,   p99: 100 },
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function percentile(sortedArr, p) {
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    avg: Math.round(samples.reduce((s, v) => s + v, 0) / samples.length),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function request(urlStr, token) {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      timeout: 10000,
    };

    const req = lib.request(options, (res) => {
      // Drain response to release socket
      res.resume();
      res.on('end', () => resolve({ ms: Date.now() - start, status: res.statusCode, ok: res.statusCode < 500 }));
    });

    req.on('error', () => resolve({ ms: Date.now() - start, status: 0, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ms: Date.now() - start, status: 0, ok: false }); });
    req.end();
  });
}

async function batch(urlStr, token, count) {
  const tasks = Array.from({ length: count }, () => request(urlStr, token));
  return Promise.all(tasks);
}

function printResult(label, sla, results) {
  const latencies = results.map((r) => r.ms);
  const errors = results.filter((r) => !r.ok).length;
  const errorRate = ((errors / results.length) * 100).toFixed(1);
  const s = stats(latencies);
  const p95ok = s.p95 <= sla.p95;
  const p99ok = s.p99 <= sla.p99;
  const errOk = errors === 0;
  const icon = p95ok && p99ok && errOk ? '✅' : '❌';
  console.log(`  ${icon} ${label.padEnd(40)} avg=${s.avg}ms  p95=${s.p95}ms${p95ok ? '' : `(>${sla.p95})`}  p99=${s.p99}ms${p99ok ? '' : `(>${sla.p99})`}  errors=${errorRate}%`);
  return p95ok && p99ok && errOk;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!AUTH_TOKEN) {
    console.warn('⚠️  TEST_AUTH_TOKEN not set — authenticated endpoints will return 401 (errors expected)\n');
  }

  console.log('\n🚦 API Endpoint Stress Test');
  console.log(`   Base URL:    ${BASE_URL}`);
  console.log(`   Concurrency: ${CONCURRENCY} simultaneous requests per endpoint`);
  console.log(`   Auth token:  ${AUTH_TOKEN ? 'provided' : 'NOT SET'}\n`);

  const endpoints = [
    { label: 'GET /api/health',                     url: `${BASE_URL}/api/health` },
    { label: 'GET /api/monitoring/cache-stats',     url: `${BASE_URL}/api/monitoring/cache-stats` },
    { label: 'GET /api/calls-dashboard/stats',      url: `${BASE_URL}/api/calls-dashboard/stats?timeWindow=7d` },
    { label: 'GET /api/calls-dashboard',            url: `${BASE_URL}/api/calls-dashboard?page=1&limit=20` },
    { label: 'GET /api/appointments',               url: `${BASE_URL}/api/appointments` },
    { label: 'GET /api/agents',                     url: `${BASE_URL}/api/agents` },
  ];

  const allPassed = [];

  for (const ep of endpoints) {
    const sla = SLA[ep.label] || { p95: 1000, p99: 2000 };
    process.stdout.write(`  ⏳ ${ep.label.padEnd(40)} running ${CONCURRENCY} concurrent requests...`);
    const results = await batch(ep.url, AUTH_TOKEN || '', CONCURRENCY);
    process.stdout.write('\r');
    allPassed.push(printResult(ep.label, sla, results));
  }

  const passed = allPassed.filter(Boolean).length;
  const total = allPassed.length;
  console.log(`\n  ─────────────────────────────────────────────`);
  console.log(`  Result: ${passed}/${total} endpoints within SLA\n`);

  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
