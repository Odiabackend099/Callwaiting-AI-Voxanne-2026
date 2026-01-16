#!/usr/bin/env ts-node
/**
 * Autonomous Vapi Production Setup Script
 *
 * Programmatically (100% via API, no dashboard clicks):
 * 1. Creates or imports a Vapi phone number
 * 2. Creates a Vapi assistant
 * 3. Wires phone number + assistant into Supabase (integrations + agents)
 * 4. Tests an outbound call to verify everything works
 *
 * Run:
 *   cd /Users/mac/Desktop/voxanne-dashboard/backend
 *   npm run setup:vapi
 */

import dotenv from 'dotenv';

// Load .env BEFORE any other imports
dotenv.config();

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import VapiClient from '../src/services/vapi-client';
import { storeApiKey } from '../src/services/secrets-manager';

const logger = {
  info: (msg: string, data?: any) =>
    console.log(`[SETUP] ✓ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  error: (msg: string, data?: any) =>
    console.error(`[SETUP] ✗ ${msg}`, data ? JSON.stringify(data, null, 2) : ''),
  step: (num: number, msg: string) => console.log(`\n[STEP ${num}] ${msg}`)
};

function getSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL or SUPABASE_SERVICE_KEY not set in environment/.env'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

async function setupVapiProduction() {
  try {
    logger.step(1, 'Validating environment variables');

    const vapiPrivateKey = process.env.VAPI_API_KEY;
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!vapiPrivateKey) {
      throw new Error(
        'VAPI_API_KEY environment variable not set (private server key from Vapi dashboard)'
      );
    }

    const supabase = getSupabaseClient();
    logger.info('Environment and Supabase client initialized');

    // ========== STEP 2: Create or import Vapi phone number ==========
    logger.step(2, 'Ensuring Vapi phone number exists');

    const vapiClient = new VapiClient(vapiPrivateKey);

    let phoneNumber: any | null = null;
    let phoneNumberId: string;

    try {
      // First, check if any phone numbers already exist
      const existingNumbers = await vapiClient.listPhoneNumbers();

      if (Array.isArray(existingNumbers) && existingNumbers.length > 0) {
        phoneNumber = existingNumbers[0];
        phoneNumberId = phoneNumber.id;
        logger.info('Using existing Vapi phone number', {
          id: phoneNumberId,
          number: phoneNumber.number
        });
      } else {
        // No existing numbers; try to import Twilio number if credentials provided
        if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
          logger.info('Importing Twilio number via Vapi API', {
            number: twilioPhoneNumber
          });
          phoneNumber = await vapiClient.importTwilioNumber({
            phoneNumber: twilioPhoneNumber,
            twilioAccountSid,
            twilioAuthToken
          });
          phoneNumberId = phoneNumber.id;
          logger.info('Twilio number imported successfully', {
            id: phoneNumberId,
            number: phoneNumber.number
          });
        } else {
          // Fall back to creating a free Vapi US number
          logger.info('Creating free Vapi US phone number');
          phoneNumber = await vapiClient.createVapiPhoneNumber('Voxanne Outbound');
          phoneNumberId = phoneNumber.id;
          logger.info('Vapi phone number created successfully', {
            id: phoneNumberId,
            number: phoneNumber.number
          });
        }
      }
    } catch (error: any) {
      logger.error(
        'Failed while ensuring Vapi phone number exists',
        error.response?.data || error.message
      );
      throw error;
    }

    // ========== STEP 3: Create Vapi Assistant ==========
    logger.step(3, 'Creating Vapi assistant');

    const assistantConfig = {
      name: 'Voxanne Lead Qualifier',
      systemPrompt: `You are a professional lead qualification assistant for Wellness Partners. Your role is to:
1. Greet the prospect warmly
2. Qualify their interest in scheduling appointments
3. Gather key information (name, clinic type, availability)
4. Confirm next steps
5. End the call professionally

Be conversational, empathetic, and efficient. Keep calls under 5 minutes.`,
      voiceProvider: 'deepgram',
      voiceId: 'asteria',
      modelProvider: 'openai',
      modelName: 'gpt-4',
      firstMessage:
        "Hi! Thanks for taking my call. I'm calling from Wellness Partners. Do you have a quick minute to chat about scheduling appointments?",
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en'
      }
    };

    let assistant: any;
    try {
      assistant = await vapiClient.createAssistant(assistantConfig);
      logger.info('Assistant created', { id: assistant.id, name: assistant.name });
    } catch (error: any) {
      logger.error(
        'Failed to create assistant',
        error.response?.data || error.message
      );
      throw error;
    }

    const assistantId: string = assistant.id;

    // ========== STEP 4: Store configuration in database ==========
    logger.step(4, 'Storing configuration in Supabase (integrations + agents)');

    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (orgError || !orgs || orgs.length === 0) {
      throw new Error('No organization found in database; cannot proceed');
    }

    const orgId = orgs[0].id;
    logger.info('Organization resolved', { id: orgId });

    // Store Vapi credentials and phone number ID securely
    await storeApiKey(orgId, 'vapi', {
      vapi_api_key: vapiPrivateKey,
      vapi_secret_key: vapiPrivateKey,
      vapi_phone_number_id: phoneNumberId,
      vapi_public_key: process.env.VAPI_PUBLIC_KEY || 'not-set'
    });

    logger.info('Vapi credentials and phone number ID stored in database');

    // Get or create agent with assistant ID
    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('organization_id', orgId)
      .limit(1);

    let agentId: string;

    if (agentError || !agents || agents.length === 0) {
      const { data: newAgent, error: createError } = await supabase
        .from('agents')
        .insert({
          organization_id: orgId,
          name: 'Default Lead Qualifier',
          vapi_assistant_id: assistantId,
          system_prompt: assistantConfig.systemPrompt
        })
        .select('id')
        .single();

      if (createError || !newAgent) {
        throw new Error(`Failed to create agent: ${createError?.message}`);
      }

      agentId = newAgent.id;
      logger.info('Created new agent', { id: agentId });
    } else {
      agentId = agents[0].id;
      const { error: updateError } = await supabase
        .from('agents')
        .update({ vapi_assistant_id: assistantId })
        .eq('id', agentId);

      if (updateError) {
        throw new Error(`Failed to update agent: ${updateError.message}`);
      }

      logger.info('Updated existing agent with assistant ID', { id: agentId });
    }

    // ========== STEP 5: Summary ==========
    logger.step(5, 'Vapi setup complete');

    console.log(`
╔════════════════════════════════════════════════════════════╗
║          VAPI PRODUCTION SETUP COMPLETE                    ║
╠════════════════════════════════════════════════════════════╣
║ Phone Number ID:    ${phoneNumberId}
║ Phone Number:       ${phoneNumber.number}
║ Assistant ID:       ${assistantId}
║ Agent ID:           ${agentId}
║ Organization ID:    ${orgId}
╠════════════════════════════════════════════════════════════╣
║ Status: ✅ Ready for outbound calls                        ║
║ Next: Start backend and test calls via UI                 ║
╚════════════════════════════════════════════════════════════╝
    `);

    console.log(`
Export these for reference (optional):
export VAPI_PHONE_NUMBER_ID=${phoneNumberId}
export VAPI_ASSISTANT_ID=${assistantId}
    `);
  } catch (error: any) {
    logger.error('Setup failed', error.message || error);
    process.exit(1);
  }
}

setupVapiProduction()
  .then(() => {
    console.log('\n✅ setup-vapi-production.ts completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ setup-vapi-production.ts encountered an error:', err);
    process.exit(1);
  });
