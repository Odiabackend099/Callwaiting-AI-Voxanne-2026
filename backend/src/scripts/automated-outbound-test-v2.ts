/**
 * Automated Outbound Agent Configuration & Test v2
 *
 * This script automatically:
 * 1. Uses service role to configure the outbound agent directly
 * 2. Assigns a phone number to the outbound agent
 * 3. Triggers a test call using the configured agent
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;

// Phone number to call
const TEST_PHONE_NUMBER = process.argv[2] || '+2348141995397';

async function main() {
  try {
    console.log('🚀 Starting automated outbound agent configuration and test...\n');

    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    if (!VAPI_PRIVATE_KEY) {
      throw new Error('Missing VAPI_PRIVATE_KEY environment variable');
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ========== Step 1: Get Organization ==========
    console.log('🏢 Step 1: Fetching organization...');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .limit(1);

    if (orgError || !orgs || orgs.length === 0) {
      throw new Error(`Failed to get organization: ${orgError?.message || 'No organization found'}`);
    }

    const orgId = orgs[0].id;
    console.log(`✅ Organization: ${orgs[0].name} (${orgId})\n`);

    // ========== Step 2: Get or Create Outbound Agent ==========
    console.log('📋 Step 2: Checking outbound agent...');
    let { data: outboundAgent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('org_id', orgId)
      .eq('role', 'outbound')
      .maybeSingle();

    if (agentError && agentError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch outbound agent: ${agentError.message}`);
    }

    if (!outboundAgent) {
      console.log('   Creating new outbound agent...');
      const { data: newAgent, error: createError } = await supabase
        .from('agents')
        .insert({
          org_id: orgId,
          role: 'outbound',
          system_prompt: 'You are Voxanne, a professional AI assistant making outbound calls for a medical clinic. Be friendly, professional, and helpful.',
          first_message: 'Hello! This is Voxanne calling from the clinic. I wanted to reach out to you today.',
          voice: 'Paige',
          language: 'en-US',
          max_call_duration: 600
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create outbound agent: ${createError.message}`);
      }

      outboundAgent = newAgent;
      console.log('✅ Outbound agent created');
    } else {
      console.log('✅ Outbound agent found');
    }

    console.log('   Agent Details:', {
      id: outboundAgent.id,
      hasSystemPrompt: Boolean(outboundAgent.system_prompt),
      hasAssistantId: Boolean(outboundAgent.vapi_assistant_id),
      hasPhoneNumber: Boolean(outboundAgent.vapi_phone_number_id)
    });
    console.log('');

    // ========== Step 3: Ensure Assistant ID Exists ==========
    if (!outboundAgent.vapi_assistant_id) {
      console.log('🤖 Step 3: Creating VAPI assistant...');

      const assistantPayload = {
        name: `Outbound Agent - ${orgs[0].name}`,
        model: {
          provider: 'openai',
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: outboundAgent.system_prompt || 'You are a helpful AI assistant.'
            }
          ]
        },
        voice: {
          provider: 'cartesia',
          voiceId: outboundAgent.voice || 'Paige'
        },
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: outboundAgent.language || 'en-US'
        },
        firstMessage: outboundAgent.first_message || 'Hello!',
        serverUrl: `${BACKEND_URL}/api/webhooks/vapi`,
        serverMessages: ['conversation-update', 'end-of-call-report', 'function-call']
      };

      const vapiResponse = await fetch('https://api.vapi.ai/assistant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(assistantPayload)
      });

      if (!vapiResponse.ok) {
        const errorData = await vapiResponse.text();
        throw new Error(`Failed to create VAPI assistant: ${vapiResponse.status} ${errorData}`);
      }

      const assistant = await vapiResponse.json();
      console.log(`✅ VAPI assistant created: ${assistant.id}`);

      // Update agent with assistant ID
      const { error: updateError } = await supabase
        .from('agents')
        .update({ vapi_assistant_id: assistant.id })
        .eq('id', outboundAgent.id);

      if (updateError) {
        throw new Error(`Failed to update agent with assistant ID: ${updateError.message}`);
      }

      outboundAgent.vapi_assistant_id = assistant.id;
      console.log('');
    } else {
      console.log('✅ Step 3: VAPI assistant already configured\n');
    }

    // ========== Step 4: Get Available Phone Numbers ==========
    console.log('📞 Step 4: Fetching available phone numbers...');
    const phoneResponse = await fetch('https://api.vapi.ai/phone-number', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!phoneResponse.ok) {
      throw new Error(`Failed to fetch phone numbers: ${phoneResponse.status}`);
    }

    const phoneNumbers = await phoneResponse.json();

    if (!phoneNumbers || phoneNumbers.length === 0) {
      throw new Error('No phone numbers available. Please configure VAPI phone numbers first.');
    }

    const availableNumber = phoneNumbers[0];
    console.log(`✅ Found ${phoneNumbers.length} phone numbers`);
    console.log(`   Using: ${availableNumber.number} (ID: ${availableNumber.id})\n`);

    // ========== Step 5: Assign Phone Number to Outbound Agent ==========
    console.log('📱 Step 5: Assigning phone number to outbound agent...');

    // Try to update agent in database (may fail if column doesn't exist yet)
    const { error: phoneUpdateError } = await supabase
      .from('agents')
      .update({ vapi_phone_number_id: availableNumber.id })
      .eq('id', outboundAgent.id);

    if (phoneUpdateError) {
      if (phoneUpdateError.message.includes('schema cache') || phoneUpdateError.message.includes('column')) {
        console.warn('⚠️ Warning: vapi_phone_number_id column not found in agents table');
        console.warn('   Skipping database update, but will still assign in VAPI...\n');
        console.warn('📝 To fix this, run the migration:');
        console.warn('   backend/migrations/20260126_add_vapi_phone_number_id_to_agents.sql\n');
      } else {
        throw new Error(`Failed to assign phone number: ${phoneUpdateError.message}`);
      }
    } else {
      console.log('✅ Phone number assigned in database');
    }

    // Assign assistant to phone number in VAPI
    const assignResponse = await fetch(`https://api.vapi.ai/phone-number/${availableNumber.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assistantId: outboundAgent.vapi_assistant_id
      })
    });

    if (!assignResponse.ok) {
      const errorData = await assignResponse.text();
      console.warn(`⚠️ Warning: Failed to assign assistant to phone number in VAPI: ${errorData}`);
    } else {
      console.log('✅ Phone number assigned in VAPI');
    }

    console.log('');

    // ========== Step 6: Verify Configuration ==========
    console.log('🔍 Step 6: Verifying configuration...');
    const { data: verifiedAgent } = await supabase
      .from('agents')
      .select('id, vapi_assistant_id, system_prompt, role, org_id')
      .eq('id', outboundAgent.id)
      .single();

    if (!verifiedAgent) {
      throw new Error('Failed to verify agent configuration');
    }

    const missingFields = [];
    if (!verifiedAgent.vapi_assistant_id) missingFields.push('VAPI Assistant ID');
    if (!verifiedAgent.system_prompt) missingFields.push('System Prompt');

    if (missingFields.length > 0) {
      throw new Error(`Outbound agent configuration incomplete. Missing: ${missingFields.join(', ')}`);
    }

    console.log('✅ Configuration verified:', {
      assistantId: verifiedAgent.vapi_assistant_id.slice(0, 20) + '...',
      phoneNumberId: availableNumber.id.slice(0, 20) + '... (from VAPI)',
      systemPrompt: outboundAgent.system_prompt.slice(0, 50) + '...'
    });
    console.log('');

    // ========== Step 7: Trigger Test Call ==========
    console.log('☎️ Step 7: Triggering outbound test call...');
    console.log(`   Calling: ${TEST_PHONE_NUMBER}`);
    console.log(`   Caller ID: ${availableNumber.number}\n`);

    // Create outbound call via VAPI
    const callPayload = {
      assistantId: verifiedAgent.vapi_assistant_id,
      phoneNumberId: availableNumber.id,
      customer: {
        number: TEST_PHONE_NUMBER
      }
    };

    const callResponse = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(callPayload)
    });

    if (!callResponse.ok) {
      const errorData = await callResponse.text();
      throw new Error(`Failed to initiate call: ${callResponse.status} ${errorData}`);
    }

    const call = await callResponse.json();

    console.log('✅ Call initiated successfully!\n');
    console.log('📊 Call Details:');
    console.log(`   - Vapi Call ID: ${call.id}`);
    console.log(`   - Status: ${call.status}`);
    console.log(`   - Customer Number: ${call.customer?.number}`);

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
