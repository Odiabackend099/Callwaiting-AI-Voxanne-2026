#!/usr/bin/env npx ts-node

/**
 * OAuth Configuration Test Script
 * Validates environment variables are correctly set for Google Calendar OAuth
 *
 * Run: npx ts-node src/scripts/test-oauth-config.ts
 *
 * Purpose: Catches OAuth configuration errors at startup before they cause user-facing failures
 */

import dotenv from 'dotenv';
import { URL } from 'url';
import path from 'path';

// Load environment variables from .env file
// Handle both running from project root and from backend directory
const envPath = process.cwd().includes('backend')
  ? path.join(process.cwd(), '.env')
  : path.join(process.cwd(), 'backend', '.env');
dotenv.config({ path: envPath });

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

const results: TestResult[] = [];

function test(
  name: string,
  condition: boolean,
  message: string,
  severity: 'error' | 'warning' | 'info' = 'error'
) {
  results.push({ name, passed: condition, message, severity });

  const icon = condition ? '✅' : severity === 'error' ? '❌' : '⚠️';
  console.log(`${icon} ${name}${message ? ': ' + message : ''}`);
}

console.log('🧪 Google OAuth Configuration Validation\n');

// Test 1: Required variables exist
console.log('📋 Checking Required Variables:');
test(
  'GOOGLE_CLIENT_ID exists',
  !!process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_ID ? 'Found' : 'Missing GOOGLE_CLIENT_ID',
);

test(
  'GOOGLE_CLIENT_SECRET exists',
  !!process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CLIENT_SECRET ? 'Found' : 'Missing GOOGLE_CLIENT_SECRET',
);

test(
  'BACKEND_URL exists',
  !!process.env.BACKEND_URL,
  process.env.BACKEND_URL ? `${process.env.BACKEND_URL}` : 'Missing BACKEND_URL',
);

test(
  'FRONTEND_URL exists',
  !!process.env.FRONTEND_URL,
  process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}` : 'Missing FRONTEND_URL',
);

// Test 2: URL validation
console.log('\n🔗 Validating URL Formats:');

if (process.env.BACKEND_URL) {
  try {
    const url = new URL(process.env.BACKEND_URL);
    test('BACKEND_URL is valid', true, `${process.env.BACKEND_URL}`);
  } catch (e) {
    test('BACKEND_URL is valid', false, `Invalid URL format: ${process.env.BACKEND_URL}`);
  }
}

if (process.env.FRONTEND_URL) {
  try {
    const url = new URL(process.env.FRONTEND_URL);
    test('FRONTEND_URL is valid', true, `${process.env.FRONTEND_URL}`);
  } catch (e) {
    test('FRONTEND_URL is valid', false, `Invalid URL format: ${process.env.FRONTEND_URL}`);
  }
}

// Test 3: CRITICAL - Domain matching
console.log('\n🔑 Checking Domain Alignment (Critical for OAuth):');

if (process.env.GOOGLE_REDIRECT_URI && process.env.BACKEND_URL) {
  try {
    const redirectDomain = new URL(process.env.GOOGLE_REDIRECT_URI).origin;
    const backendDomain = new URL(process.env.BACKEND_URL).origin;

    const domainsMatch = redirectDomain === backendDomain;
    test(
      'GOOGLE_REDIRECT_URI matches BACKEND_URL',
      domainsMatch,
      domainsMatch
        ? `Both use: ${backendDomain}`
        : `Mismatch! Redirect: ${redirectDomain}, Backend: ${backendDomain}`,
      domainsMatch ? 'info' : 'error'
    );
  } catch (e) {
    test('GOOGLE_REDIRECT_URI domain comparison', false, 'Failed to parse URLs');
  }
}

// Test 4: Production-specific validation
console.log('\n🏭 Production Environment Checks:');

if (process.env.NODE_ENV === 'production') {
  test(
    'Production: BACKEND_URL not localhost',
    !process.env.BACKEND_URL?.includes('localhost'),
    process.env.BACKEND_URL?.includes('localhost')
      ? 'BACKEND_URL points to localhost in production!'
      : `Using ${process.env.BACKEND_URL}`,
    process.env.BACKEND_URL?.includes('localhost') ? 'error' : 'info'
  );

  test(
    'Production: FRONTEND_URL not localhost',
    !process.env.FRONTEND_URL?.includes('localhost'),
    process.env.FRONTEND_URL?.includes('localhost')
      ? 'FRONTEND_URL points to localhost in production!'
      : `Using ${process.env.FRONTEND_URL}`,
    process.env.FRONTEND_URL?.includes('localhost') ? 'error' : 'info'
  );

  test(
    'Production: Uses HTTPS',
    process.env.BACKEND_URL?.startsWith('https://') ?? false,
    process.env.BACKEND_URL?.startsWith('https://')
      ? 'Using HTTPS ✓'
      : `Protocol: ${process.env.BACKEND_URL?.split('://')[0]}`,
    process.env.BACKEND_URL?.startsWith('https://') ? 'info' : 'error'
  );
} else {
  console.log('ℹ️  Skipping production checks (NODE_ENV=' + process.env.NODE_ENV + ')');
}

// Test 5: Redirect URI format
console.log('\n📍 Validating Redirect URI:');

const redirectUri =
  process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL}/api/google-oauth/callback`;

test(
  'Redirect URI ends with /api/google-oauth/callback',
  redirectUri.endsWith('/api/google-oauth/callback'),
  redirectUri.endsWith('/api/google-oauth/callback')
    ? '✓ Correct path'
    : `Incorrect path: ${redirectUri}`,
);

test(
  'Uses HTTPS protocol',
  redirectUri.startsWith('https://'),
  redirectUri.startsWith('https://') ? 'HTTPS ✓' : `Protocol: ${redirectUri.split('://')[0]}`,
);

// Summary
console.log('\n' + '='.repeat(60));

const passed = results.filter((r) => r.passed).length;
const errors = results.filter((r) => !r.passed && r.severity === 'error').length;
const warnings = results.filter((r) => !r.passed && r.severity === 'warning').length;
const total = results.length;

console.log(`Results: ${passed}/${total} passed`);
if (errors > 0) console.log(`         ${errors} critical errors`);
if (warnings > 0) console.log(`         ${warnings} warnings`);

console.log('\n' + '='.repeat(60));

if (errors === 0) {
  console.log('✅ All critical OAuth configuration checks PASSED!');
  console.log('\n✨ Your OAuth setup is ready for deployment.');
  process.exit(0);
} else {
  console.log('❌ Critical OAuth configuration errors found.');
  console.log('\n🔧 Fix the errors above before deploying to production.');
  console.log('\n💡 Most common issue: BACKEND_URL and GOOGLE_REDIRECT_URI use different domains');
  console.log('   They MUST use the same domain to prevent redirect_uri_mismatch errors.');
  process.exit(1);
}
