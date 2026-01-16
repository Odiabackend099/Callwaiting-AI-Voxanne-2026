#!/usr/bin/env ts-node
/**
 * Full Vapi Diagnostic & Fix Script
 * 
 * This script:
 * 1. Validates all required env vars
 * 2. Lists existing Vapi assistants to verify API key works
 * 3. Creates a fresh assistant
 * 4. Verifies the assistant exists
 * 5. Wires the assistant ID into Supabase for the outbound agent
 * 6. Triggers a test call to Peter
 * 
 * Run: npx ts-node scripts/full-vapi-diagnostic.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const log = {
  step: (n: number, msg: string) => console.log(`\n[STEP ${n}] ${msg}`),
  ok: (msg: string, data?: any) => console.log(`  ✅ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  fail: (msg: string, data?: any) => console.error(`  ❌ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  info: (msg: string, data?: any) => console.log(`  ℹ️  ${msg}`, data ? JSON.stringify(data, null, 2) : '')
};

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║       FULL VAPI DIAGNOSTIC & FIX SCRIPT                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // ========== STEP 1: Validate env vars ==========
  log.step(1, 'Validating environment variables');

  const VAPI_API_KEY = process.env.VAPI_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;

  const missing: string[] = [];
  if (!VAPI_API_KEY) missing.push('VAPI_API_KEY');
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY');

  if (missing.length > 0) {
    log.fail(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  log.ok('All required env vars present');
  log.info('VAPI_API_KEY', { prefix: VAPI_API_KEY?.substring(0, 8) + '...' });
  log.info('VAPI_PHONE_NUMBER_ID', { value: VAPI_PHONE_NUMBER_ID || 'not set in env' });

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
  const vapiHeaders = {
    'Authorization': `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json'
  };

  // ========== STEP 2: List existing Vapi assistants ==========
  log.step(2, 'Listing existing Vapi assistants (verifies API key works)');

  let existingAssistants: any[] = [];
  try {
    const listRes = await axios.get('https://api.vapi.ai/assistant', {
      headers: vapiHeaders,
      timeout: 15000
    });
    existingAssistants = listRes.data || [];
    log.ok(`Found ${existingAssistants.length} existing assistant(s)`);

    if (existingAssistants.length > 0) {
      existingAssistants.slice(0, 5).forEach((a: any) => {
        log.info(`Assistant: ${a.name}`, { id: a.id });
      });
    }
  } catch (err: any) {
    log.fail('Failed to list assistants', {
      status: err.response?.status,
      message: err.response?.data?.message || err.message
    });
    process.exit(1);
  }

  // ========== STEP 3: Create a fresh assistant ==========
  log.step(3, 'Creating a fresh Vapi assistant');

  const assistantPayload = {
    name: 'Voxanne Outbound Agent',
    model: {
      provider: 'openai',
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional outbound calling assistant. Be friendly, concise, and helpful.'
        }
      ]
    },
    voice: {
      provider: 'deepgram',
      voiceId: 'asteria'
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en'
    },
    firstMessage: "Hi, this is Voxanne calling. Do you have a quick moment to chat?"
  };

  let newAssistantId: string;
  try {
    const createRes = await axios.post('https://api.vapi.ai/assistant', assistantPayload, {
      headers: vapiHeaders,
      timeout: 30000
    });
    newAssistantId = createRes.data.id;
    log.ok('Assistant created', { id: newAssistantId, name: createRes.data.name });
  } catch (err: any) {
    log.fail('Failed to create assistant', {
      status: err.response?.status,
      message: err.response?.data?.message || err.message,
      data: err.response?.data
    });
    process.exit(1);
  }

  // ========== STEP 4: Verify the assistant exists ==========
  log.step(4, 'Verifying assistant exists in Vapi');

  try {
    const getRes = await axios.get(`https://api.vapi.ai/assistant/${newAssistantId}`, {
      headers: vapiHeaders,
      timeout: 15000
    });
    log.ok('Assistant verified', { id: getRes.data.id, name: getRes.data.name });
  } catch (err: any) {
    log.fail('Assistant does NOT exist after creation!', {
      status: err.response?.status,
      message: err.response?.data?.message || err.message
    });
    log.info('This indicates a Vapi backend issue. Contact Vapi support.');
    process.exit(1);
  }

  // ========== STEP 5: Get phone number ID ==========
  log.step(5, 'Getting Vapi phone number ID');

  let phoneNumberId = VAPI_PHONE_NUMBER_ID;

  if (!phoneNumberId) {
    try {
      const phoneRes = await axios.get('https://api.vapi.ai/phone-number', {
        headers: vapiHeaders,
        timeout: 15000
      });
      const phones = phoneRes.data || [];
      if (phones.length > 0) {
        phoneNumberId = phones[0].id;
        log.ok('Found phone number', { id: phoneNumberId, number: phones[0].number });
      } else {
        log.fail('No phone numbers found in Vapi. Run setup-vapi-production.ts first.');
        process.exit(1);
      }
    } catch (err: any) {
      log.fail('Failed to list phone numbers', err.response?.data || err.message);
      process.exit(1);
    }
  } else {
    log.ok('Using phone number from env', { id: phoneNumberId });
  }

  // ========== STEP 6: Wire into Supabase ==========
  log.step(6, 'Wiring assistant + phone number into Supabase');

  // Get org
  const { data: orgs, error: orgErr } = await supabase
    .from('organizations')
    .select('id')
    .limit(1);

  if (orgErr || !orgs || orgs.length === 0) {
    log.fail('No organization found', orgErr?.message);
    process.exit(1);
  }
  const orgId = orgs[0].id;
  log.ok('Organization', { id: orgId });

  // Update outbound agent
  const { data: agents, error: agentErr } = await supabase
    .from('agents')
    .select('id, name, role')
    .eq('role', 'outbound')
    .limit(1);

  if (agentErr || !agents || agents.length === 0) {
    log.fail('No outbound agent found', agentErr?.message);
    process.exit(1);
  }

  const agentId = agents[0].id;
  log.info('Outbound agent', { id: agentId, name: agents[0].name });

  const { error: updateErr } = await supabase
    .from('agents')
    .update({ vapi_assistant_id: newAssistantId })
    .eq('id', agentId);

  if (updateErr) {
    log.fail('Failed to update agent', updateErr.message);
    process.exit(1);
  }
  log.ok('Agent updated with new assistant ID');

  // ========== STEP 7: Get Peter's lead ==========
  log.step(7, 'Finding Peter lead');

  const { data: leads, error: leadErr } = await supabase
    .from('leads')
    .select('id, name, contact_name, phone')
    .or('name.ilike.%peter%,contact_name.ilike.%peter%')
    .limit(1);

  if (leadErr || !leads || leads.length === 0) {
    log.fail('Peter lead not found', leadErr?.message);
    process.exit(1);
  }

  const peter = leads[0];
  log.ok('Found Peter', { id: peter.id, name: peter.name || peter.contact_name, phone: peter.phone });

  // ========== STEP 8: Make the call ==========
  log.step(8, 'Triggering outbound call to Peter via Vapi');

  const callPayload = {
    assistantId: newAssistantId,
    phoneNumberId: phoneNumberId,
    customer: {
      number: peter.phone,
      name: peter.name || peter.contact_name
    }
  };

  log.info('Call payload', callPayload);

  try {
    const callRes = await axios.post('https://api.vapi.ai/call/phone', callPayload, {
      headers: vapiHeaders,
      timeout: 30000
    });

    log.ok('CALL INITIATED SUCCESSFULLY!', {
      callId: callRes.data.id,
      status: callRes.data.status
    });

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    🎉 SUCCESS! 🎉                          ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ Call ID:        ${callRes.data.id}`);
    console.log(`║ Assistant ID:   ${newAssistantId}`);
    console.log(`║ Phone Number:   ${phoneNumberId}`);
    console.log(`║ Calling:        ${peter.phone}`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (err: any) {
    log.fail('Failed to initiate call', {
      status: err.response?.status,
      message: err.response?.data?.message || err.message,
      data: err.response?.data
    });
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
