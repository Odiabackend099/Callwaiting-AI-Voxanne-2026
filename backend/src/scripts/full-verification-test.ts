/**
 * Complete end-to-end caller ID verification test
 * Simulates the exact flow a user would experience
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BACKEND_URL = 'http://localhost:3001';
const TEST_PHONE = '+2348141995397';
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

(async () => {
  console.log('🧪 COMPLETE VERIFICATION TEST\n');
  console.log('Phone:', TEST_PHONE);
  console.log('Org:', ORG_ID);
  console.log('');

  // STEP 1: Clean database
  console.log('Step 1: Clearing existing verifications...\n');

  const { error: deleteError } = await supabase
    .from('verified_caller_ids')
    .delete()
    .eq('org_id', ORG_ID);

  if (deleteError) {
    console.error('❌ Error clearing database:', deleteError.message);
  } else {
    console.log('✅ Database cleared - ready for fresh verification\n');
  }

  // STEP 2: Get auth token
  console.log('Step 2: Getting auth token...\n');

  const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@demo.com',
    password: 'test123456'
  });

  if (authError || !signInData?.session?.access_token) {
    console.error('❌ Auth failed:', authError?.message);
    process.exit(1);
  }

  const token = signInData.session.access_token;
  console.log('✅ Auth token obtained\n');

  // STEP 3: Call verification endpoint
  console.log('Step 3: Calling POST /api/verified-caller-id/verify...\n');
  console.log('Request:');
  console.log('  URL:', `${BACKEND_URL}/api/verified-caller-id/verify`);
  console.log('  Phone:', TEST_PHONE);
  console.log('  Country Code: NG');
  console.log('');

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/verified-caller-id/verify`,
      {
        phoneNumber: TEST_PHONE,
        countryCode: 'NG'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    console.log('✅ API Response (Status:', response.status, ')\n');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    // STEP 4: Analyze response
    if (response.data.verified === true) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ NUMBER ALREADY VERIFIED IN TWILIO');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log('What happened:');
      console.log('1. Backend checked Twilio\'s outgoingCallerIds list');
      console.log('2. Found', TEST_PHONE, 'already verified');
      console.log('3. Marked as verified in our database (no call needed)');
      console.log('');
      console.log('🎉 SUCCESS - Verification complete instantly!\n');
      console.log('Next steps:');
      console.log('1. Refresh http://localhost:3000/dashboard/phone-settings');
      console.log('2. You should see a green verified number box');
      console.log('3. Outbound calls will show', TEST_PHONE, 'as caller ID');

    } else if (response.data.validationCode) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('📞 VERIFICATION CALL INITIATED');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log('🔑 VALIDATION CODE:', response.data.validationCode);
      console.log('');
      console.log('What happens next:');
      console.log('1. Twilio will call', TEST_PHONE);
      console.log('2. Automated voice will ask you to enter a code');
      console.log('3. Enter this code on your phone keypad:', response.data.validationCode);
      console.log('4. After entering the code, wait 30 seconds');
      console.log('5. Click "Verify & Complete Setup" in the dashboard');
      console.log('');
      console.log('📋 This code should also appear in the blue box on the dashboard');
      console.log('');
      console.log('⏱️  Call should arrive within 1-2 minutes from +14157234000 (Twilio)');

    } else {
      console.log('⚠️  Unexpected response - no validation code or verified status');
    }

  } catch (error: any) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('❌ VERIFICATION FAILED');
    console.log('═══════════════════════════════════════════════════════\n');

    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
      console.log('');

      // Diagnose common errors
      const errorMsg = error.response.data.error || '';

      if (errorMsg.includes('credentials not configured')) {
        console.log('DIAGNOSIS: Twilio credentials issue');
        console.log('');
        console.log('Possible causes:');
        console.log('1. getEffectiveTwilioCredentials() failing');
        console.log('2. No active managed phone number');
        console.log('3. Encrypted credentials decryption failing');
        console.log('');
        console.log('Check:');
        console.log('  npx ts-node src/scripts/check-managed-phone-numbers.ts');
        console.log('  npx ts-node src/scripts/check-subaccount-details.ts');

      } else if (errorMsg.includes('already verified')) {
        console.log('DIAGNOSIS: Number already verified in Twilio');
        console.log('');
        console.log('This should have been handled by the pre-check!');
        console.log('Check backend logs for why pre-check failed');

      } else if (errorMsg.includes('Trial')) {
        console.log('DIAGNOSIS: Trial Twilio account limitation');
        console.log('');
        console.log('Trial accounts cannot verify international numbers');
        console.log('Must upgrade Twilio account or verify in console first');
      }

    } else {
      console.log('Error:', error.message);
    }

    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════');

})();
