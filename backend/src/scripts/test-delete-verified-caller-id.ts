/**
 * Test script for DELETE /api/verified-caller-id endpoint
 * Tests the ability to unverify/delete a verified caller ID
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment
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
  console.log('🧪 Testing DELETE /api/verified-caller-id\n');
  console.log('Phone:', TEST_PHONE);
  console.log('Org ID:', ORG_ID);
  console.log('');

  try {
    // Step 1: Get a JWT token for testing
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('org_id', ORG_ID)
      .limit(1)
      .single();

    if (!profile) {
      console.error('❌ Could not find profile for org');
      process.exit(1);
    }

    const { data: { session }, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@demo.com',
      password: 'test123456',
      email_confirm: true
    });

    if (authError && !authError.message.includes('already registered')) {
      console.error('❌ Auth error:', authError);
      process.exit(1);
    }

    // Get existing session or create new one
    const { data: signInData } = await supabase.auth.signInWithPassword({
      email: 'test@demo.com',
      password: 'test123456'
    });

    const token = signInData?.session?.access_token;
    if (!token) {
      console.error('❌ Could not get auth token');
      process.exit(1);
    }

    console.log('✅ Got auth token\n');

    // Step 2: Check current verification status
    const { data: existing } = await supabase
      .from('verified_caller_ids')
      .select('*')
      .eq('phone_number', TEST_PHONE)
      .eq('org_id', ORG_ID)
      .maybeSingle();

    if (existing) {
      console.log('📋 Existing verification found:');
      console.log('  - Status:', existing.status);
      console.log('  - Created:', new Date(existing.created_at).toLocaleString());
      console.log('');
    } else {
      console.log('ℹ️  No existing verification record\n');
      console.log('⚠️  Create a verification first before testing delete');
      process.exit(0);
    }

    // Step 3: Call DELETE endpoint
    console.log('🗑️  Calling DELETE /api/verified-caller-id...\n');

    const response = await axios.delete(`${BACKEND_URL}/api/verified-caller-id`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      data: {
        phoneNumber: TEST_PHONE
      }
    });

    console.log('✅ DELETE Response:', response.status);
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    // Step 4: Verify deletion in database
    const { data: afterDelete } = await supabase
      .from('verified_caller_ids')
      .select('*')
      .eq('phone_number', TEST_PHONE)
      .eq('org_id', ORG_ID)
      .maybeSingle();

    if (afterDelete) {
      console.log('❌ FAIL: Record still exists after delete');
      console.log(afterDelete);
      process.exit(1);
    }

    console.log('✅ SUCCESS: Record deleted from database');
    console.log('');
    console.log('🎉 Delete endpoint working correctly!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Go to http://localhost:3000/dashboard/phone-settings');
    console.log('2. The "Remove Verification" button should now be functional');
    console.log('3. Click it to test the full user flow');

  } catch (error: any) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
})();
