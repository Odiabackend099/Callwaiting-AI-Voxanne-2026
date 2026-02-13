/**
 * End-to-End Test: Verified Caller ID API Workflow
 *
 * Tests the complete user experience flow:
 * 1. Initiate verification (POST /api/verified-caller-id/verify)
 * 2. Confirm verification code (POST /api/verified-caller-id/confirm)
 * 3. List verified numbers (GET /api/verified-caller-id/list)
 * 4. Delete verified number (DELETE /api/verified-caller-id/:id)
 *
 * Also tests error scenarios and multi-tenant isolation
 */

import axios, { AxiosInstance } from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as jwt from 'jsonwebtoken';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'http://localhost:3001';
const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';
const ENCRYPTION_KEY = 'bbaf521ae57542c3d879a7ec3d45d6c7b58358e617754974c2c928094c12886b';

// ============================================================================
// TEST DATA
// ============================================================================

let testOrgId: string;
let testUserId: string;
let authToken: string;
let testPhoneNumber = '+15551234567'; // Test US number
let verificationId: string;

// ============================================================================
// HELPERS
// ============================================================================

function createJWT(orgId: string, userId: string): string {
  const payload = {
    iss: 'https://lbjymlodxprzqgtyqtcq.supabase.co/auth/v1',
    sub: userId,
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    iat: Math.floor(Date.now() / 1000),
    email: `test-${orgId}@example.com`,
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      org_id: orgId
    },
    user_metadata: {}
  };

  return jwt.sign(payload, 'test-secret', { algorithm: 'HS256' });
}

async function getOrCreateTestOrg(): Promise<{ orgId: string; userId: string }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Try to find existing test org
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id, created_by')
    .eq('name', 'Test Organization - E2E')
    .limit(1)
    .single();

  if (existingOrg) {
    console.log('✅ Found existing test org:', existingOrg.id);
    return { orgId: existingOrg.id, userId: existingOrg.created_by };
  }

  // Create new test org
  const newOrgId = crypto.randomUUID();
  const newUserId = crypto.randomUUID();

  const { error: orgError } = await supabase.from('organizations').insert({
    id: newOrgId,
    name: 'Test Organization - E2E',
    created_by: newUserId,
    created_at: new Date().toISOString()
  });

  if (orgError) {
    throw new Error(`Failed to create test org: ${orgError.message}`);
  }

  console.log('✅ Created new test org:', newOrgId);
  return { orgId: newOrgId, userId: newUserId };
}

async function getOrCreateTwilioCredentials(orgId: string): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Check if org has Twilio credentials
  const { data: existing } = await supabase
    .from('org_credentials')
    .select('id')
    .eq('org_id', orgId)
    .eq('provider', 'twilio')
    .limit(1)
    .single();

  if (existing) {
    console.log('✅ Org already has Twilio credentials');
    return;
  }

  // Create Twilio credentials (using test account from .env)
  const { error } = await supabase.from('org_credentials').insert({
    id: crypto.randomUUID(),
    org_id: orgId,
    provider: 'twilio',
    // Using test credentials - these will be encrypted by the app
    credentials: {
      accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      authToken: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    },
    is_active: true,
    created_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(`Failed to create Twilio credentials: ${error.message}`);
  }

  console.log('✅ Created Twilio credentials for test org');
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function test(
  name: string,
  fn: () => Promise<any>
): Promise<TestResult> {
  try {
    console.log(`\n📋 Testing: ${name}`);
    const result = await fn();
    console.log(`✅ PASS: ${name}`);
    results.push({ name, status: 'PASS', details: result });
    return { name, status: 'PASS', details: result };
  } catch (error: any) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    results.push({ name, status: 'FAIL', error: error.message });
    return { name, status: 'FAIL', error: error.message };
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

async function runTests() {
  const client = axios.create({
    baseURL: API_BASE_URL,
    validateStatus: () => true // Don't throw on any status code
  });

  console.log('═════════════════════════════════════════════════════════════');
  console.log('VERIFIED CALLER ID - END-TO-END API TEST');
  console.log('═════════════════════════════════════════════════════════════');

  // Step 1: Setup test data
  console.log('\n📦 SETUP: Creating test organization and credentials...');
  const { orgId, userId } = await getOrCreateTestOrg();
  testOrgId = orgId;
  testUserId = userId;
  authToken = createJWT(orgId, userId);
  await getOrCreateTwilioCredentials(orgId);

  console.log(`   Organization ID: ${orgId}`);
  console.log(`   User ID: ${userId}`);
  console.log(`   Auth Token: ${authToken.substring(0, 20)}...`);

  // Step 2: Health check
  await test('Health Check - Backend is running', async () => {
    const response = await client.get('/health');
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    return { status: response.status, backend: response.data };
  });

  // Step 3: Test 1 - Initiate verification WITHOUT token (should fail)
  await test('Verify without auth token - should return 401', async () => {
    const response = await client.post('/api/verified-caller-id/verify', {
      phoneNumber: testPhoneNumber,
      countryCode: 'US'
    });

    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
    return { status: response.status, error: response.data.error };
  });

  // Step 4: Test 2 - Initiate verification WITH token (happy path)
  await test('Verify with auth token - should initiate verification', async () => {
    const response = await client.post(
      '/api/verified-caller-id/verify',
      {
        phoneNumber: testPhoneNumber,
        countryCode: 'US'
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    if (response.status !== 200) {
      throw new Error(
        `Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`
      );
    }

    // Store verification ID for next test
    if (response.data.verificationId) {
      verificationId = response.data.verificationId;
    }

    return {
      status: response.status,
      verificationId: response.data.verificationId,
      message: response.data.message
    };
  });

  // Step 5: Test 3 - Invalid phone format (should fail)
  await test('Verify with invalid phone format - should fail', async () => {
    const response = await client.post(
      '/api/verified-caller-id/verify',
      {
        phoneNumber: '15551234567', // Missing + prefix
        countryCode: 'US'
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    if (response.status >= 200 && response.status < 300) {
      throw new Error(
        `Expected error status, got ${response.status}. Should reject invalid phone format.`
      );
    }

    return { status: response.status, error: response.data.error };
  });

  // Step 6: Test 4 - Empty phone number (should fail)
  await test('Verify with empty phone - should fail', async () => {
    const response = await client.post(
      '/api/verified-caller-id/verify',
      {
        phoneNumber: '',
        countryCode: 'US'
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    if (response.status >= 200 && response.status < 300) {
      throw new Error(`Expected error, got ${response.status}`);
    }

    return { status: response.status, error: response.data.error };
  });

  // Step 7: Test 5 - List verified numbers (should be empty initially or have previous ones)
  await test('List verified numbers - should return array', async () => {
    const response = await client.get('/api/verified-caller-id/list', {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }

    if (!Array.isArray(response.data.verifiedNumbers)) {
      throw new Error('Expected verifiedNumbers to be an array');
    }

    return {
      status: response.status,
      count: response.data.verifiedNumbers.length,
      numbers: response.data.verifiedNumbers
    };
  });

  // Step 8: Test 6 - Confirm verification with dummy code (will fail but tests endpoint exists)
  if (verificationId) {
    await test('Confirm verification - endpoint exists', async () => {
      const response = await client.post(
        '/api/verified-caller-id/confirm',
        {
          verificationId: verificationId,
          code: '123456' // Dummy code
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      // This will likely fail due to invalid code, but endpoint should exist
      if (response.status === 404) {
        throw new Error('Endpoint /api/verified-caller-id/confirm not found');
      }

      return {
        status: response.status,
        message: response.data.message || response.data.error
      };
    });
  }

  // Step 9: Test 7 - Multi-tenant isolation (different org can't access other's numbers)
  await test('Multi-tenant isolation - different org cannot access other org numbers', async () => {
    const otherOrgId = crypto.randomUUID();
    const otherUserId = crypto.randomUUID();
    const otherToken = createJWT(otherOrgId, otherUserId);

    const response = await client.get('/api/verified-caller-id/list', {
      headers: {
        Authorization: `Bearer ${otherToken}`
      }
    );

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }

    const verifiedNumbers = response.data.verifiedNumbers || [];
    // Should be empty or only contain numbers from otherOrgId (not testOrgId)
    const hasTestOrgNumbers = verifiedNumbers.some(
      (num: any) => num.org_id === testOrgId
    );

    if (hasTestOrgNumbers) {
      throw new Error('Multi-tenant isolation failed - can see other org numbers!');
    }

    return {
      status: response.status,
      count: verifiedNumbers.length,
      message: 'Other org can only see their own numbers'
    };
  });

  // Step 10: Test 8 - List numbers WITHOUT token (should fail)
  await test('List without auth token - should return 401', async () => {
    const response = await client.get('/api/verified-caller-id/list');

    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }

    return { status: response.status, error: response.data.error };
  });

  // Step 11: Test 9 - Delete non-existent number (should fail gracefully)
  await test('Delete non-existent number - should handle gracefully', async () => {
    const fakeId = crypto.randomUUID();
    const response = await client.delete(`/api/verified-caller-id/${fakeId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    // Should either return 404 or success (depending on implementation)
    if (response.status >= 500) {
      throw new Error(`Expected 4xx, got ${response.status}`);
    }

    return { status: response.status, message: response.data.message };
  });

  // Step 12: Test 10 - Verify another number (different country)
  await test('Verify number from different country (UK)', async () => {
    const response = await client.post(
      '/api/verified-caller-id/verify',
      {
        phoneNumber: '+441632555321', // UK number
        countryCode: 'GB'
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      }
    );

    if (response.status !== 200) {
      throw new Error(
        `Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`
      );
    }

    return {
      status: response.status,
      verificationId: response.data.verificationId,
      country: 'GB'
    };
  });

  // ============================================================================
  // RESULTS
  // ============================================================================

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('TEST RESULTS SUMMARY');
  console.log('═════════════════════════════════════════════════════════════');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const total = results.length;

  console.log(`\n📊 RESULTS: ${passed}/${total} tests passed\n`);

  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n═════════════════════════════════════════════════════════════');

  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED - API IS FULLY FUNCTIONAL');
  } else {
    console.log(`⚠️  ${failed} test(s) failed - review errors above`);
  }

  console.log('═════════════════════════════════════════════════════════════\n');

  process.exit(failed === 0 ? 0 : 1);
}  // ← FIXED: Added closing brace for runTests() function

// ============================================================================
// RUN
// ============================================================================

runTests().catch((error) => {
  console.error('🔥 Test suite failed:', error);
  process.exit(1);
});
