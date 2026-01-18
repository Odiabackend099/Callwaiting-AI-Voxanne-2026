/**
 * Complete Tool Registration Script
 *
 * Registers the bookClinicAppointment tool with a Vapi assistant.
 * This is the critical step that enables live voice agent booking.
 *
 * Usage:
 *   npx ts-node scripts/register-booking-tool-complete.ts <org_id> [vapi_api_key]
 *
 * Example:
 *   npx ts-node scripts/register-booking-tool-complete.ts 46cf2995-2bee-44e3-838b-24151486fe4e
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/index';import axios from 'axios';
import { log } from '../src/services/logger';
import { getUnifiedBookingTool } from '../src/config/unified-booking-tool';

interface RegistrationResult {
  success: boolean;
  assistantId: string;
  toolId: string;
  message: string;
}

/**
 * Main registration function
 */
async function registerBookingTool(
  orgId: string,
  vapiApiKey: string,
  backendUrl: string = process.env.BACKEND_URL || 'http://localhost:3001'
): Promise<RegistrationResult> {
  const startTime = Date.now();

  try {
    log.info('RegisterBookingTool', '🚀 Starting tool registration', {
      orgId,
      backendUrl,
      timestamp: new Date().toISOString()
    });

    // ============================================
    // STEP 1: Initialize Supabase
    // ============================================
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    log.info('RegisterBookingTool', '✅ Supabase initialized');

    // ============================================
    // STEP 2: Get or create Vapi assistant
    // ============================================
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, vapi_assistant_id, name, system_prompt')
      .eq('org_id', orgId)
      .eq('role', 'inbound')
      .maybeSingle();

    if (agentError) {
      throw new Error(`Failed to query agents: ${agentError.message}`);
    }

    if (!agent) {
      throw new Error(`No inbound agent found for org ${orgId}`);
    }

    log.info('RegisterBookingTool', '✅ Found agent record', {
      agentId: agent.id,
      hasVapiId: !!agent.vapi_assistant_id,
      agentName: agent.name
    });

    let assistantId = agent.vapi_assistant_id;

    // If no Vapi assistant, create one
    if (!assistantId) {
      log.info('RegisterBookingTool', '📝 Creating new Vapi assistant...');

      const createResponse = await axios.post(
        'https://api.vapi.ai/assistant',
        {
          name: `${agent.name} - ${orgId.substring(0, 8)}`,
          model: {
            provider: 'openai',
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: agent.system_prompt || 'You are a helpful assistant.'
              }
            ]
          },
          voice: {
            provider: 'vapi',
            voiceId: 'Paige'
          },
          firstMessage: 'Hello! How can I help you today?',
          maxDurationSeconds: 600
        },
        {
          headers: {
            'Authorization': `Bearer ${vapiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      assistantId = createResponse.data.id;

      log.info('RegisterBookingTool', '✅ Created Vapi assistant', {
        assistantId,
        name: createResponse.data.name
      });

      // Save assistant ID to database
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          vapi_assistant_id: assistantId,
          updated_at: new Date().toISOString()
        })
        .eq('id', agent.id);

      if (updateError) {
        throw new Error(`Failed to save assistant ID: ${updateError.message}`);
      }

      log.info('RegisterBookingTool', '✅ Saved assistant ID to database');
    }

    // ============================================
    // STEP 3: Register the booking tool
    // ============================================
    log.info('RegisterBookingTool', '📝 Registering bookClinicAppointment tool...');

    const toolDefinition = getUnifiedBookingTool(backendUrl);

    const toolResponse = await axios.post(
      'https://api.vapi.ai/tool',
      toolDefinition,
      {
        headers: {
          'Authorization': `Bearer ${vapiApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const toolId = toolResponse.data.id;

    log.info('RegisterBookingTool', '✅ Tool registered with Vapi', {
      toolId,
      toolName: toolResponse.data.function?.name
    });

    // ============================================
    // STEP 4: Tool is now registered with Vapi
    // ============================================
    log.info('RegisterBookingTool', '✅ Tool successfully registered with Vapi', {
      toolId,
      webhookUrl: `${backendUrl}/api/vapi/tools/bookClinicAppointment`
    });

    log.info('RegisterBookingTool', '📝 Next step: Link tool to assistant in Vapi Dashboard', {
      instructions: [
        '1. Go to https://vapi.ai/dashboard',
        '2. Find your assistant',
        `3. Add tool with ID: ${toolId}`,
        `4. OR use the Vapi API to link via PATCH /assistant/${assistantId}`
      ]
    });

    // ============================================
    // SUCCESS
    // ============================================
    const executionTime = Date.now() - startTime;

    log.info('RegisterBookingTool', '🎉 TOOL REGISTRATION COMPLETE', {
      assistantId,
      toolId,
      orgId,
      executionTimeMs: executionTime
    });

    return {
      success: true,
      assistantId,
      toolId,
      message: `✅ Tool registered successfully in ${executionTime}ms`
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    log.error('RegisterBookingTool', '❌ REGISTRATION FAILED', {
      error: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      executionTimeMs: executionTime
    });

    throw error;
  }
}

/**
 * CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const orgId = args[0];
  const vapiApiKey = args[1] || config.VAPI_PRIVATE_KEY;

  if (!orgId) {
    console.error('Usage: npx ts-node register-booking-tool-complete.ts <org_id> [vapi_api_key]');
    console.error('Example: npx ts-node register-booking-tool-complete.ts 46cf2995-2bee-44e3-838b-24151486fe4e');
    process.exit(1);
  }

  if (!vapiApiKey) {
    console.error('Error: VAPI_PRIVATE_KEY not provided and not in environment');
    process.exit(1);
  }

  try {
    const result = await registerBookingTool(orgId, vapiApiKey);
    console.log('\n' + '='.repeat(60));
    console.log(result.message);
    console.log('='.repeat(60));
    console.log(`Assistant ID: ${result.assistantId}`);
    console.log(`Tool ID: ${result.toolId}`);
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Registration failed');
    console.error('='.repeat(60));
    console.error(error?.message || error);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

main();
