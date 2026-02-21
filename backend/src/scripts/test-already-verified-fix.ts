/**
 * Test script to verify the "already verified" fix
 * Tests that we handle numbers already verified in Twilio
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
  console.log('🧪 Testing "Already Verified" Fix\n');
  console.log('Phone:', TEST_PHONE);
  console.log('Expected: Should detect number is already verified in Twilio');
  console.log('Expected: Should mark as verified in our database\n');

  try {
    // Get auth token
    const { data: signInData } = await supabase.auth.signInWithPassword({
      email: 'test@demo.com',
      password: 'test123456'
    });

    const token = signInData?.session?.access_token;
    if (!token) {
      console.error('❌ Could not get auth token');
      process.exit(1);
    }

    // Clear database first
    await supabase
      .from('verified_caller_ids')
      .delete()
      .eq('org_id', ORG_ID);

    console.log('✅ Database cleared\n');

    // Call verify endpoint
    console.log('📞 Calling POST /api/verified-caller-id/verify...\n');

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

    console.log('✅ Response Status:', response.status);
    console.log('📋 Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    // Check what happened
    if (response.data.verified === true) {
      console.log('✅ SUCCESS: Number was already verified in Twilio');
      console.log('✅ Backend correctly detected this and marked it as verified');
      console.log('');

      // Verify database record
      const { data: dbRecord } = await supabase
        .from('verified_caller_ids')
        .select('*')
        .eq('org_id', ORG_ID)
        .eq('phone_number', TEST_PHONE)
        .maybeSingle();

      if (dbRecord && dbRecord.status === 'verified') {
        console.log('✅ Database record created correctly:');
        console.log('  - Status:', dbRecord.status);
        console.log('  - Verified at:', new Date(dbRecord.verified_at).toLocaleString());
        console.log('');
        console.log('🎉 FIX WORKING CORRECTLY!');
        console.log('');
        console.log('Next steps:');
        console.log('1. Refresh http://localhost:3000/dashboard/phone-settings');
        console.log('2. You should see the green verified number box');
        console.log('3. Outbound calls will show', TEST_PHONE, 'as caller ID');
      } else {
        console.error('❌ Database record not created or wrong status');
      }
    } else {
      console.log('⚠️  Number not verified in Twilio - verification call initiated');
      console.log('   This is expected if number was deleted from Twilio Console');
      if (response.data.validationCode) {
        console.log('   Validation code:', response.data.validationCode);
      }
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('');

    if (error.response?.data?.error?.includes('already verified')) {
      console.error('⚠️  ERROR STILL OCCURRING: "already verified" error not fixed');
      console.error('');
      console.error('Possible causes:');
      console.error('1. Backend not restarted with new code');
      console.error('2. Old build being used');
      console.error('3. Twilio returning different error format');
    }

    process.exit(1);
  }
})();
