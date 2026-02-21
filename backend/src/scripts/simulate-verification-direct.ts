/**
 * Direct verification test using service role (bypass auth)
 * Simulates the exact flow by calling backend endpoints
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BACKEND_URL = 'http://localhost:3001';
const TEST_PHONE = '+2348141995397';
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

(async () => {
  console.log('🧪 DIRECT VERIFICATION SIMULATION\n');
  console.log('Phone:', TEST_PHONE);
  console.log('Org:', ORG_ID);
  console.log('');

  // STEP 1: Clear database
  console.log('Step 1: Clearing existing verifications...\n');

  await supabase
    .from('verified_caller_ids')
    .delete()
    .eq('org_id', ORG_ID);

  console.log('✅ Database cleared\n');

  // STEP 2: Get a real user JWT from the profiles table
  console.log('Step 2: Getting user JWT...\n');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('org_id', ORG_ID)
    .limit(1)
    .single();

  if (!profile) {
    console.error('❌ No profile found for org');
    process.exit(1);
  }

  // Get auth user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const authUser = users.find(u => u.email === profile.email);

  if (!authUser) {
    console.error('❌ No auth user found');
    process.exit(1);
  }

  // Generate JWT
  const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: authUser.email!
  });

  if (sessionError) {
    console.error('❌ Session error:', sessionError.message);
    process.exit(1);
  }

  // Extract JWT from the verification URL
  const urlParams = new URLSearchParams(new URL(sessionData.properties.action_link).hash.substring(1));
  const accessToken = urlParams.get('access_token');

  if (!accessToken) {
    console.error('❌ Could not extract access token');
    process.exit(1);
  }

  console.log('✅ JWT obtained for:', profile.email, '\n');

  // STEP 3: Call verification endpoint
  console.log('Step 3: Calling verification endpoint...\n');
  console.log('  POST', `${BACKEND_URL}/api/verified-caller-id/verify`);
  console.log('  Phone:', TEST_PHONE);
  console.log('  Country: NG');
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
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ API RESPONSE (HTTP', response.status, ')');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    // Analyze response
    if (response.data.verified === true) {
      console.log('🎉 NUMBER ALREADY VERIFIED!');
      console.log('');
      console.log('✅ No verification call needed');
      console.log('✅ Database updated to "verified"');
      console.log('✅ Outbound calls will show', TEST_PHONE);
      console.log('');
      console.log('Next: Refresh dashboard to see green verified box');

    } else if (response.data.validationCode) {
      console.log('📞 VERIFICATION CALL INITIATED!');
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔑 VALIDATION CODE:', response.data.validationCode);
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('This code should appear in the blue box on your dashboard');
      console.log('');
      console.log('What to do:');
      console.log('1. Wait for Twilio call to', TEST_PHONE);
      console.log('2. Answer the call');
      console.log('3. Enter this code on your phone keypad:', response.data.validationCode);
      console.log('4. Wait 30 seconds after entering code');
      console.log('5. Click "Verify & Complete Setup" in dashboard');
      console.log('');
      console.log('📋 Call should arrive from: +14157234000 (Twilio)');
      console.log('⏱️  Expected time: 1-2 minutes');

    } else {
      console.log('⚠️  Unexpected response format');
    }

  } catch (error: any) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('❌ VERIFICATION FAILED');
    console.log('═══════════════════════════════════════════════════════\n');

    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }

    process.exit(1);
  }

  console.log('');
  console.log('Test complete!');

})();
