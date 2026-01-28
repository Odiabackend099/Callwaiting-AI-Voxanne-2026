/**
 * Trigger Outbound Test Call
 *
 * This script triggers an outbound test call to a specified phone number
 * using the web-test-outbound endpoint.
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Test credentials - replace with your actual credentials
const TEST_EMAIL = process.env.TEST_EMAIL || 'voxanne@demo.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'your-password-here';

// Phone number to call
const PHONE_NUMBER = process.argv[2] || '+2348141995397';

async function triggerOutboundCall() {
  try {
    console.log('🚀 Starting outbound test call...\n');

    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Sign in to get auth token
    console.log(`🔐 Authenticating as ${TEST_EMAIL}...`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (authError || !authData.session) {
      throw new Error(`Authentication failed: ${authError?.message || 'No session returned'}`);
    }

    const accessToken = authData.session.access_token;
    console.log('✅ Authenticated successfully');
    console.log(`📱 Calling: ${PHONE_NUMBER}\n`);

    // Trigger outbound call
    const response = await fetch(`${BACKEND_URL}/api/founder-console/agent/web-test-outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        phoneNumber: PHONE_NUMBER,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('❌ Call failed:', responseData);
      throw new Error(`HTTP ${response.status}: ${responseData.error || 'Unknown error'}`);
    }

    console.log('✅ Call initiated successfully!\n');
    console.log('📊 Call Details:');
    console.log(`   - Vapi Call ID: ${responseData.vapiCallId}`);
    console.log(`   - Tracking ID: ${responseData.trackingId}`);
    console.log(`   - User ID: ${responseData.userId}`);
    console.log(`   - Request ID: ${responseData.requestId}`);

    if (responseData.bridgeWebsocketUrl) {
      console.log(`   - WebSocket URL: ${responseData.bridgeWebsocketUrl}`);
    }

    console.log('\n📞 The phone should ring shortly at', PHONE_NUMBER);
    console.log('🎯 Answer the call to test the AI agent!\n');

    return responseData;
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
triggerOutboundCall()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
