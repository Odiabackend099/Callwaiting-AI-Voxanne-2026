#!/usr/bin/env node
/**
 * Database Query Performance Validation
 * Runs each high-traffic query 10x and reports avg / P95 / P99 timing.
 *
 * Usage:
 *   node scripts/performance-validation.js
 *
 * Required env vars (from backend/.env):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   PERF_ORG_ID  — org to query against (defaults to first org found)
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// SLA targets (milliseconds)
const SLA = {
  p95: 400,
  p99: 800,
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function percentile(sortedArr, p) {
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = Math.round(samples.reduce((s, v) => s + v, 0) / samples.length);
  return {
    avg,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

async function time(fn) {
  const start = Date.now();
  await fn();
  return Date.now() - start;
}

async function runN(fn, n = 10) {
  const samples = [];
  for (let i = 0; i < n; i++) {
    samples.push(await time(fn));
  }
  return samples;
}

function pass(label, result) {
  const p95ok = result.p95 <= SLA.p95;
  const p99ok = result.p99 <= SLA.p99;
  const icon = p95ok && p99ok ? '✅' : '❌';
  console.log(
    `  ${icon} ${label.padEnd(45)} avg=${result.avg}ms  p95=${result.p95}ms${p95ok ? '' : ` (SLA: ${SLA.p95}ms)`}  p99=${result.p99}ms${p99ok ? '' : ` (SLA: ${SLA.p99}ms)`}`
  );
  return p95ok && p99ok;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function getOrgId() {
  const orgId = process.env.PERF_ORG_ID;
  if (orgId) return orgId;

  const { data, error } = await supabase.from('organizations').select('id').limit(1).single();
  if (error || !data) {
    console.error('ERROR: Could not find any org. Set PERF_ORG_ID env var.');
    process.exit(1);
  }
  return data.id;
}

async function main() {
  console.log('\n🔬 Database Query Performance Validation');
  console.log(`   SLA targets: P95 < ${SLA.p95}ms  |  P99 < ${SLA.p99}ms\n`);

  const orgId = await getOrgId();
  console.log(`   org_id: ${orgId}\n`);

  const RUNS = 10;
  const results = [];

  // ── 1. calls_with_caller_names view (paginated, org-filtered) ──────────────
  {
    const samples = await runN(async () => {
      await supabase
        .from('calls')
        .select('id, created_at, status, duration_seconds, call_direction, caller_name, phone_number')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .range(0, 19);
    }, RUNS);
    const r = stats(samples);
    results.push(pass('calls list (paginated, org-filtered)', r));
  }

  // ── 2. Dashboard stats RPC ─────────────────────────────────────────────────
  {
    const samples = await runN(async () => {
      await supabase.rpc('get_dashboard_stats_optimized', {
        p_org_id: orgId,
        p_time_window: '7d',
      });
    }, RUNS);
    const r = stats(samples);
    results.push(pass('get_dashboard_stats_optimized RPC (7d)', r));
  }

  // ── 3. Appointments list (org-filtered, date-bounded) ─────────────────────
  {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const samples = await runN(async () => {
      await supabase
        .from('appointments')
        .select('id, scheduled_at, status, contact_id')
        .eq('org_id', orgId)
        .gte('scheduled_at', sevenDaysAgo)
        .order('scheduled_at', { ascending: true })
        .range(0, 49);
    }, RUNS);
    const r = stats(samples);
    results.push(pass('appointments list (org-filtered, 7d window)', r));
  }

  // ── 4. Agent list (cache warm vs cold timing proxy) ────────────────────────
  {
    const samples = await runN(async () => {
      await supabase
        .from('agents')
        .select('id, name, vapi_assistant_id, vapi_phone_number_id')
        .eq('org_id', orgId)
        .limit(20);
    }, RUNS);
    const r = stats(samples);
    results.push(pass('agents list (org-filtered)', r));
  }

  // ── 5. Contact stats GROUP BY query ────────────────────────────────────────
  {
    const samples = await runN(async () => {
      await supabase
        .from('contacts')
        .select('lead_status')
        .eq('org_id', orgId);
    }, RUNS);
    const r = stats(samples);
    results.push(pass('contact stats (lead_status aggregation)', r));
  }

  // ── 6. Analytics summary (90-day window) ───────────────────────────────────
  {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const samples = await runN(async () => {
      await supabase
        .from('calls')
        .select('id, created_at, status, duration_seconds, sentiment_score')
        .eq('org_id', orgId)
        .gte('created_at', ninetyDaysAgo);
    }, RUNS);
    const r = stats(samples);
    results.push(pass('analytics summary (90-day window)', r));
  }

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n  ─────────────────────────────────────────────`);
  console.log(`  Result: ${passed}/${total} queries within SLA\n`);

  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
