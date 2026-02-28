#!/usr/bin/env node
/**
 * Performance Test Suite Orchestrator
 * Runs DB validation then API stress tests as child processes.
 * Aggregates results and exits non-zero if any SLA is breached.
 *
 * Usage:
 *   node scripts/run-performance-suite.js          # full suite
 *   node scripts/run-performance-suite.js --api-only  # skip DB tests
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   TEST_AUTH_TOKEN  (for API tests)
 *
 * Optional:
 *   API_BASE_URL  — defaults to http://localhost:3001
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const apiOnly = args.includes('--api-only');

const SCRIPTS_DIR = __dirname;

// ─── helpers ─────────────────────────────────────────────────────────────────

function run(label, scriptPath) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('═'.repeat(60));

  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(SCRIPTS_DIR, '..'),
  });

  if (result.error) {
    console.error(`\n  FATAL: Failed to spawn ${scriptPath}:`, result.error.message);
    return false;
  }

  return result.status === 0;
}

// ─── main ────────────────────────────────────────────────────────────────────

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║        Voxanne AI — Performance Validation Suite         ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`  Mode: ${apiOnly ? 'API stress tests only' : 'DB validation + API stress tests'}`);
console.log(`  Time: ${new Date().toISOString()}`);

const results = {};

if (!apiOnly) {
  results['DB Query Validation'] = run(
    '1/2  Database Query Performance',
    path.join(SCRIPTS_DIR, 'performance-validation.js')
  );
} else {
  console.log('\n  Skipping DB validation (--api-only flag)');
}

results['API Stress Test'] = run(
  `${apiOnly ? '1/1' : '2/2'}  API Endpoint Stress Test`,
  path.join(SCRIPTS_DIR, 'performance-api-stress-test.js')
);

// ─── summary ─────────────────────────────────────────────────────────────────

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║                   SUITE SUMMARY                          ║');
console.log('╚══════════════════════════════════════════════════════════╝');

let allPassed = true;
for (const [name, passed] of Object.entries(results)) {
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon}  ${name}`);
  if (!passed) allPassed = false;
}

if (allPassed) {
  console.log('\n  🎉 All performance tests PASSED — system within SLA\n');
  process.exit(0);
} else {
  console.log('\n  🚨 One or more tests FAILED — review output above\n');
  process.exit(1);
}
