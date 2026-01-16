#!/usr/bin/env node

/**
 * Phase 6: Unified Performance Test Suite Runner
 * 
 * Orchestrates both database-level and HTTP API-level performance tests
 * Generates comprehensive combined report
 * 
 * Usage:
 *   node scripts/run-performance-suite.js [--quick] [--api-only] [--db-only]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logHeader(title) {
  log('\n╔═══════════════════════════════════════════════════════╗', 'bright');
  log(`║${title.padStart((title.length + 57) / 2).padEnd(57)}║`, 'bright');
  log('╚═══════════════════════════════════════════════════════╝', 'bright');
}

/**
 * Run database performance tests
 */
function runDatabaseTests() {
  logHeader('DATABASE PERFORMANCE TESTS');

  try {
    log('\n▶️  Running database-level performance tests...', 'cyan');
    const dbScript = path.join(__dirname, 'performance-validation.js');

    execSync(`node ${dbScript}`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });

    log('\n✅ Database tests completed', 'green');
    return true;
  } catch (err) {
    log(`\n❌ Database tests failed: ${err.message}`, 'red');
    return false;
  }
}

/**
 * Run HTTP API performance tests
 */
function runAPITests() {
  logHeader('HTTP API PERFORMANCE TESTS');

  try {
    log('\n▶️  Running HTTP API performance tests...', 'cyan');
    const apiScript = path.join(__dirname, 'performance-api-stress-test.js');

    execSync(`node ${apiScript}`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });

    log('\n✅ API tests completed', 'green');
    return true;
  } catch (err) {
    log(`\n❌ API tests failed: ${err.message}`, 'red');
    return false;
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  return {
    quick: args.includes('--quick'),
    apiOnly: args.includes('--api-only'),
    dbOnly: args.includes('--db-only'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

/**
 * Show help
 */
function showHelp() {
  log('\n╔═══════════════════════════════════════════════════════╗', 'bright');
  log('║   Phase 6: Performance Test Suite Runner               ║', 'bright');
  log('╚═══════════════════════════════════════════════════════╝', 'bright');

  log('\nUsage: node scripts/run-performance-suite.js [OPTIONS]', 'cyan');
  log('\nOptions:', 'blue');
  log('  --help          Show this help message', 'gray');
  log('  --api-only      Run only HTTP API tests', 'gray');
  log('  --db-only       Run only database-level tests', 'gray');
  log('  --quick         Quick test run (optional)', 'gray');

  log('\nExamples:', 'blue');
  log('  npm run perf:test              # Run all tests', 'gray');
  log('  npm run perf:test -- --api-only  # API tests only', 'gray');
  log('  npm run perf:test -- --db-only   # Database tests only', 'gray');

  log('\nSuccess Criteria:', 'cyan');
  log('  ✅ Response latency p95 < 500ms', 'green');
  log('  ✅ Zero unhandled errors', 'green');
  log('  ✅ Handles 5-10 concurrent requests', 'green');
  log('  ✅ No database deadlocks', 'green');

  log('\n');
}

/**
 * Main execution
 */
function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  logHeader('PHASE 6: PERFORMANCE TEST SUITE');

  log('\nStarting comprehensive performance tests...', 'cyan');
  log(`Timestamp: ${new Date().toISOString()}`, 'gray');

  const results = {
    database: null,
    api: null,
    startTime: Date.now(),
    endTime: null,
  };

  // Run tests based on arguments
  if (!args.apiOnly) {
    log('\n[1/2] Database Tests', 'blue');
    results.database = runDatabaseTests();
  }

  if (!args.dbOnly) {
    log('\n[2/2] API Tests', 'blue');
    results.api = runAPITests();
  }

  results.endTime = Date.now();

  // Generate summary
  logHeader('PERFORMANCE TEST SUMMARY');

  const totalTime = ((results.endTime - results.startTime) / 1000).toFixed(1);

  if (!args.apiOnly && results.database !== null) {
    log(
      `Database Tests: ${results.database ? '✅ PASSED' : '❌ FAILED'}`,
      results.database ? 'green' : 'red'
    );
  }

  if (!args.dbOnly && results.api !== null) {
    log(
      `API Tests: ${results.api ? '✅ PASSED' : '❌ FAILED'}`,
      results.api ? 'green' : 'red'
    );
  }

  log(`Total Time: ${totalTime}s`, 'blue');

  // Overall result
  const allPassed = results.database !== false && results.api !== false;

  log('\n╔═══════════════════════════════════════════════════════╗', 'bright');
  if (allPassed) {
    log('║     ✅ ALL PERFORMANCE TESTS PASSED ✅               ║', 'green');
    log('║                                                       ║', 'bright');
    log('║  System is ready for production deployment            ║', 'green');
  } else {
    log('║   ⚠️  PERFORMANCE TESTS REQUIRE ATTENTION ⚠️         ║', 'yellow');
    log('║                                                       ║', 'bright');
    log('║  Review failed tests and optimize before deployment   ║', 'yellow');
  }
  log('╚═══════════════════════════════════════════════════════╝', 'bright');

  log('\nNext Steps:', 'cyan');
  log('  1. Review test results above', 'gray');
  log('  2. Check logs for any warnings or issues', 'gray');
  log('  3. Optimize if needed', 'gray');
  log('  4. Re-run tests to confirm improvements', 'gray');

  log('\nDocumentation:', 'cyan');
  log('  • PHASE_6_PERFORMANCE_TESTING_PLAN.md', 'gray');
  log('  • PHASE_6_PERFORMANCE_TEST_RESULTS.md', 'gray');

  log('\n');
  process.exit(allPassed ? 0 : 1);
}

main();
