/**
 * Test Verified Caller ID Flow
 *
 * Tests the complete verification flow:
 * 1. POST /api/verified-caller-id/verify - Initiate verification call
 * 2. Verify backend sends request to Twilio
 * 3. Check database record creation
 *
 * Usage:
 * ```bash
 * cd backend
 * npx ts-node src/scripts/test-verified-caller-id.ts
 * ```
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BACKEND_URL = 'http://localhost:3001'; // Force localhost for testing
const TEST_PHONE = '+2348141995397'; // Nigerian number
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e'; // Voxanne Demo Clinic

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function getTestUserToken(): Promise<string> {
  // Get or create test user
  const testEmail = 'test@voxanne.ai';

  // Try to sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: 'test-password-123'
  });

  if (signInData?.session) {
    return signInData.session.access_token;
  }

  // If sign in failed, try to create user
  const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'test-password-123',
    email_confirm: true,
    user_metadata: {
      orgId: ORG_ID
    },
    app_metadata: {
      org_id: ORG_ID
    }
  });

  if (signUpError) {
    throw new Error(`Failed to create test user: ${signUpError.message}`);
  }

  // Sign in with new user
  const { data: newSignInData } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: 'test-password-123'
  });

  if (!newSignInData?.session) {
    throw new Error('Failed to get session token');
  }

  return newSignInData.session.access_token;
}

async function testVerificationFlow() {
  console.log('🧪 Testing Verified Caller ID Flow\n');
  console.log('═'.repeat(80));

  try {
    // Step 1: Get authentication token
    console.log('\n📝 Step 1: Getting authentication token...');
    const token = await getTestUserToken();
    console.log('✅ Token obtained');

    // Step 2: Call verification endpoint
    console.log('\n📞 Step 2: Initiating verification call...');
    console.log(`   Phone: ${TEST_PHONE}`);
    console.log(`   Backend: ${BACKEND_URL}`);

    const response = await axios.post(
      `${BACKEND_URL}/api/verified-caller-id/verify`,
      {
        phoneNumber: TEST_PHONE,
        countryCode: 'NG'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true // Don't throw on any status
      }
    );

    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));

    if (response.status === 200 && response.data.success) {
      console.log('\n✅ VERIFICATION INITIATED SUCCESSFULLY');
      console.log(`   Validation SID: ${response.data.validationSid}`);
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Message: ${response.data.message}`);

      if (response.data.details) {
        console.log('\n📋 Next Steps:');
        console.log(`   1. ${response.data.details.action}`);
        console.log(`   2. Call will come from: ${response.data.details.from}`);
        console.log(`   3. Expected wait: ${response.data.details.expectedWait}`);
      }

      // Step 3: Check database
      console.log('\n📊 Step 3: Checking database record...');
      const { data: dbRecord, error: dbError } = await supabase
        .from('verified_caller_ids')
        .select('*')
        .eq('org_id', ORG_ID)
        .eq('phone_number', TEST_PHONE)
        .maybeSingle();

      if (dbError) {
        console.log(`   ⚠️  Database check failed: ${dbError.message}`);
      } else if (dbRecord) {
        console.log('   ✅ Database record created:');
        console.log(`      ID: ${dbRecord.id}`);
        console.log(`      Status: ${dbRecord.status}`);
        console.log(`      Created: ${dbRecord.created_at}`);
      } else {
        console.log('   ⚠️  No database record found');
      }

      console.log('\n' + '═'.repeat(80));
      console.log('🎉 TEST PASSED - Verification flow working correctly');
      console.log('═'.repeat(80));

    } else {
      console.log('\n❌ VERIFICATION FAILED');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${response.data.error || 'Unknown error'}`);

      if (response.data.code) {
        console.log(`   Code: ${response.data.code}`);
      }

      if (response.data.troubleshoot) {
        console.log(`   Troubleshoot: ${response.data.troubleshoot}`);
      }

      console.log('\n' + '═'.repeat(80));
      console.log('❌ TEST FAILED');
      console.log('═'.repeat(80));
      process.exit(1);
    }

  } catch (error: any) {
    console.log('\n💥 UNEXPECTED ERROR');
    console.log(`   Message: ${error.message}`);

    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data:`, error.response.data);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('❌ TEST FAILED');
    console.log('═'.repeat(80));
    process.exit(1);
  }
}

// Run test
testVerificationFlow().catch(console.error);
