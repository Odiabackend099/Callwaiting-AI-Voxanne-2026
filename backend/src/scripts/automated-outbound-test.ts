/**
 * Automated Outbound Agent Configuration & Test
 *
 * This script automatically:
 * 1. Configures the outbound agent
 * 2. Assigns a phone number to the outbound agent
 * 3. Triggers a test call to the specified number
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Test credentials
const TEST_EMAIL = process.env.TEST_EMAIL || 'voxanne@demo.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'your-password-here';

// Phone number to call
const TEST_PHONE_NUMBER = process.argv[2] || '+2348141995397';

interface AgentConfig {
  id: string;
  role: string;
  system_prompt?: string;
  first_message?: string;
  voice?: string;
  language?: string;
  vapi_assistant_id?: string;
  vapi_phone_number_id?: string;
}

interface PhoneNumber {
  id: string;
  number: string;
  provider: string;
}

async function authedBackendFetch(accessToken: string, path: string, options: any = {}) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  try {
    console.log('🚀 Starting automated outbound agent configuration and test...\n');

    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ========== Step 1: Authenticate ==========
    console.log('🔐 Step 1: Authenticating...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (authError || !authData.session) {
      throw new Error(`Authentication failed: ${authError?.message || 'No session returned'}`);
    }

    const accessToken = authData.session.access_token;
    console.log('✅ Authenticated successfully\n');

    // ========== Step 2: Get Current Agent Configuration ==========
    console.log('📋 Step 2: Fetching current agent configuration...');
    const agentConfig: any = await authedBackendFetch(accessToken, '/api/founder-console/agent/config');

    const outboundAgent = agentConfig.agents?.find((a: AgentConfig) => a.role === 'outbound');

    if (!outboundAgent) {
      throw new Error('No outbound agent found. Please create an outbound agent first.');
    }

    console.log('✅ Found outbound agent:', {
      id: outboundAgent.id,
      hasSystemPrompt: Boolean(outboundAgent.system_prompt),
      hasAssistantId: Boolean(outboundAgent.vapi_assistant_id),
      hasPhoneNumber: Boolean(outboundAgent.vapi_phone_number_id)
    });
    console.log('');

    // ========== Step 3: Check if agent needs configuration ==========
    const needsConfiguration = !outboundAgent.system_prompt ||
                              !outboundAgent.vapi_assistant_id ||
                              !outboundAgent.first_message;

    if (needsConfiguration) {
      console.log('⚙️ Step 3: Configuring outbound agent...');

      const behaviorPayload = {
        agentRole: 'outbound',
        config: {
          systemPrompt: outboundAgent.system_prompt || 'You are Voxanne, a professional AI assistant making outbound calls for a medical clinic. Be friendly, professional, and helpful.',
          firstMessage: outboundAgent.first_message || 'Hello! This is Voxanne calling from the clinic. I wanted to reach out to you today.',
          voice: outboundAgent.voice || 'Paige',
          language: outboundAgent.language || 'en-US',
          maxCallDuration: outboundAgent.max_call_duration || 600
        }
      };

      await authedBackendFetch(accessToken, '/api/founder-console/agent/behavior', {
        method: 'POST',
        body: JSON.stringify(behaviorPayload)
      });

      console.log('✅ Outbound agent configured successfully\n');
    } else {
      console.log('✅ Step 3: Outbound agent already configured\n');
    }

    // ========== Step 4: Get Available Phone Numbers ==========
    console.log('📞 Step 4: Fetching available phone numbers...');
    const phoneNumbers: any = await authedBackendFetch(accessToken, '/api/integrations/vapi/phone-numbers');

    if (!phoneNumbers.phoneNumbers || phoneNumbers.phoneNumbers.length === 0) {
      throw new Error('No phone numbers available. Please configure VAPI phone numbers first.');
    }

    const availableNumber = phoneNumbers.phoneNumbers[0];
    console.log(`✅ Found ${phoneNumbers.phoneNumbers.length} phone numbers`);
    console.log(`   Using: ${availableNumber.number} (ID: ${availableNumber.id})\n`);

    // ========== Step 5: Assign Phone Number to Outbound Agent ==========
    if (!outboundAgent.vapi_phone_number_id || outboundAgent.vapi_phone_number_id !== availableNumber.id) {
      console.log('📱 Step 5: Assigning phone number to outbound agent...');

      await authedBackendFetch(accessToken, '/api/integrations/vapi/assign-number', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumberId: availableNumber.id,
          role: 'outbound'
        })
      });

      console.log('✅ Phone number assigned successfully\n');
    } else {
      console.log('✅ Step 5: Phone number already assigned\n');
    }

    // ========== Step 6: Re-fetch Configuration to Verify ==========
    console.log('🔍 Step 6: Verifying configuration...');
    const updatedConfig: any = await authedBackendFetch(accessToken, '/api/founder-console/agent/config');
    const updatedOutboundAgent = updatedConfig.agents?.find((a: AgentConfig) => a.role === 'outbound');

    if (!updatedOutboundAgent) {
      throw new Error('Failed to verify outbound agent configuration');
    }

    const missingFields = [];
    if (!updatedOutboundAgent.vapi_assistant_id) missingFields.push('VAPI Assistant ID');
    if (!updatedOutboundAgent.system_prompt) missingFields.push('System Prompt');
    if (!updatedOutboundAgent.vapi_phone_number_id) missingFields.push('Caller ID Phone Number');

    if (missingFields.length > 0) {
      throw new Error(`Outbound agent configuration incomplete. Missing: ${missingFields.join(', ')}`);
    }

    console.log('✅ Configuration verified:', {
      assistantId: updatedOutboundAgent.vapi_assistant_id?.slice(0, 20) + '...',
      phoneNumberId: updatedOutboundAgent.vapi_phone_number_id?.slice(0, 20) + '...',
      systemPrompt: updatedOutboundAgent.system_prompt?.slice(0, 50) + '...'
    });
    console.log('');

    // ========== Step 7: Trigger Test Call ==========
    console.log('☎️ Step 7: Triggering outbound test call...');
    console.log(`   Calling: ${TEST_PHONE_NUMBER}`);
    console.log(`   Caller ID: ${availableNumber.number}\n`);

    const callResponse: any = await authedBackendFetch(accessToken, '/api/founder-console/agent/web-test-outbound', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: TEST_PHONE_NUMBER
      }),
      timeout: 30000
    });

    console.log('✅ Call initiated successfully!\n');
    console.log('📊 Call Details:');
    console.log(`   - Vapi Call ID: ${callResponse.vapiCallId}`);
    console.log(`   - Tracking ID: ${callResponse.trackingId}`);
    console.log(`   - User ID: ${callResponse.userId}`);
    console.log(`   - Request ID: ${callResponse.requestId}`);

    if (callResponse.bridgeWebsocketUrl) {
      console.log(`   - WebSocket URL: ${callResponse.bridgeWebsocketUrl}`);
    }

    console.log('\n📞 The phone should ring shortly at', TEST_PHONE_NUMBER);
    console.log('🎯 Answer the call to test the AI agent!\n');
    console.log('✅ Automated test completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
