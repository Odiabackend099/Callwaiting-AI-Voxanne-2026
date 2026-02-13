#!/usr/bin/env npx ts-node

/**
 * End-to-End OAuth Flow Test
 * Simulates the Google Calendar OAuth flow from start to callback
 *
 * Run: npx ts-node src/scripts/test-oauth-e2e.ts
 *
 * Purpose: Verify OAuth flow works correctly without manual Google redirect
 */

import dotenv from 'dotenv';
import axios from 'axios';
import path from 'path';

// Load environment variables
// Handle both running from project root and from backend directory
const envPath = process.cwd().includes('backend')
  ? path.join(process.cwd(), '.env')
  : path.join(process.cwd(), 'backend', '.env');
dotenv.config({ path: envPath });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const TEST_ORG_ID = 'a0000000-0000-0000-0000-000000000001'; // Test organization

async function testOAuthFlow() {
  console.log('🧪 End-to-End Google OAuth Flow Test\n');
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Test Org ID: ${TEST_ORG_ID}\n`);

  let passed = 0;
  let failed = 0;

  // Test 1: Generate authorization URL
  console.log('Step 1️⃣ : Generating authorization URL...');
  try {
    const authResponse = await axios.get(
      `${BACKEND_URL}/api/google-oauth/authorize`,
      {
        params: { org_id: TEST_ORG_ID },
        timeout: 10000
      }
    );

    const authUrl = authResponse.data.url;
    console.log('✅ Authorization URL generated');
    console.log(`   URL: ${authUrl.substring(0, 100)}...`);

    // Validate it's a valid URL
    try {
      new URL(authUrl);
      console.log('✅ URL is valid');
    } catch {
      throw new Error('Generated URL is malformed');
    }

    // Validate it points to Google
    const url = new URL(authUrl);
    if (!url.hostname.includes('google.com')) {
      throw new Error('Auth URL does not point to google.com');
    }
    console.log('✅ URL points to google.com');

    // Check for required parameters
    if (!url.searchParams.get('state')) {
      throw new Error('Missing state parameter (CSRF protection)');
    }
    console.log('✅ State parameter present (CSRF protected)');

    const redirectUri = url.searchParams.get('redirect_uri');
    if (!redirectUri) {
      throw new Error('Missing redirect_uri parameter');
    }
    console.log(`✅ Redirect URI configured: ${redirectUri}`);

    // Verify redirect_uri matches expected value
    const expectedRedirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${BACKEND_URL}/api/google-oauth/callback`;

    if (redirectUri !== expectedRedirectUri) {
      console.log(`⚠️  Warning: Redirect URI mismatch!`);
      console.log(`   Expected: ${expectedRedirectUri}`);
      console.log(`   Got:      ${redirectUri}`);
      failed++;
    } else {
      console.log('✅ Redirect URI matches configuration');
      passed++;
    }

    passed++;
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}`);
    if (error.response?.status) {
      console.log(`   HTTP Status: ${error.response.status}`);
      if (error.response?.data) {
        console.log(`   Response: ${JSON.stringify(error.response.data)}`);
      }
    }
    failed++;
    process.exit(1);
  }

  // Test 2: Verify callback endpoint exists
  console.log('\nStep 2️⃣ : Testing callback endpoint...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/google-oauth/callback`, {
      validateStatus: () => true, // Accept any status
      timeout: 5000
    });

    // 400 is expected (missing code/state params) - shows endpoint exists
    if (response.status === 404) {
      throw new Error('Callback endpoint not found (404)');
    }

    console.log('✅ Callback endpoint is reachable');
    console.log(`   Status: ${response.status} (expected: 400 without OAuth params)`);
    passed++;
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}`);
    failed++;
  }

  // Test 3: Check test endpoint
  console.log('\nStep 3️⃣ : Testing OAuth router...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/google-oauth/test`, {
      timeout: 5000
    });

    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    console.log('✅ OAuth router is registered and responding');
    passed++;
  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('✅ OAuth flow validation PASSED!');
    console.log('\n📋 Next Steps for Manual Testing:');
    console.log('1. Copy the generated authorization URL above');
    console.log('2. Visit it in a web browser');
    console.log('3. Sign in with a Google account');
    console.log('4. Approve the calendar permissions');
    console.log('5. You should be redirected back to your dashboard');
    console.log('6. Check that the calendar connection shows "Connected"');
    process.exit(0);
  } else {
    console.log('❌ OAuth flow validation FAILED!');
    console.log('\n🔧 Troubleshooting:');
    console.log('- Check that BACKEND_URL and GOOGLE_REDIRECT_URI match');
    console.log('- Verify backend server is running on configured port');
    console.log('- Check Google Cloud Console for approved redirect URIs');
    process.exit(1);
  }
}

testOAuthFlow();
