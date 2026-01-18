import { supabase } from '../src/services/supabase-client';
import { config } from '../src/config/index';import { log } from '../src/services/logger';
import { VAPI_TOOLS } from '../src/config/vapi-tools';
import axios from 'axios';

async function updateVapiAssistant(orgId: string) {
  try {
    // Get all tools from vapi-tools.ts
    const tools = Object.values(VAPI_TOOLS).map(tool => ({
      type: 'function',
      function: tool.function
    }));

    // Check for existing assistant
    let { data: assistant } = await supabase
      .from('agents')
      .select('id, vapi_assistant_id')
      .eq('org_id', orgId)
      .eq('role', 'inbound')
      .single();

    // Create new assistant if none exists
    if (!assistant || !assistant.vapi_assistant_id) {
      log.info('Creating new assistant record for organization', { orgId });
      
      // First create assistant in VAPI
      const vapiResponse = await axios.post(
        'https://api.vapi.ai/assistant',
        {
          name: `VoxAnne Inbound - ${orgId}`,
          model: {
            provider: 'openai',
            model: 'gpt-4'
          },
          voice: {
            provider: 'vapi',
            voiceId: 'Paige'
          },
          firstMessage: 'Hello! How can I help you today?',
          tools
        },
        {
          headers: {
            'Authorization': `Bearer ${config.VAPI_PRIVATE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Then save to database
      const { data: newAssistant } = await supabase
        .from('agents')
        .insert([{
          org_id: orgId,
          role: 'inbound',
          system_prompt: 'Default prompt',
          first_message: 'Hello! How can I help you today?',
          voice: 'Paige',
          language: 'en',
          max_call_duration: 1800,
          vapi_assistant_id: vapiResponse.data.id
        }])
        .select()
        .single();
      
      assistant = newAssistant;
    }

    // Update assistant tools via VAPI API
    const response = await axios.patch(
      `https://api.vapi.ai/assistant/${assistant.vapi_assistant_id}`,
      { tools },
      {
        headers: {
          'Authorization': `Bearer ${config.VAPI_PRIVATE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    log.info('Successfully updated VAPI assistant tools', {
      orgId,
      assistantId: assistant.vapi_assistant_id,
      status: response.status
    });
  } catch (error) {
    log.error('Failed to update VAPI assistant', { orgId, error });
    throw error;
  }
}

// Run for Voxanne@demo.com (orgId = 'voxanne-demo')
updateVapiAssistant('voxanne-demo').catch(console.error);
