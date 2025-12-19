/**
 * Fix webhook URL for existing Vapi assistants
 * Run this to reconfigure webhooks with the correct URL path
 */

import axios from 'axios';
import { supabase } from '../services/supabase-client';

async function fixWebhookUrl() {
  try {
    // Get the inbound agent config
    const { data: inboundConfig, error: configError } = await supabase
      .from('inbound_agent_config')
      .select('vapi_api_key, vapi_assistant_id')
      .limit(1)
      .maybeSingle();

    if (configError || !inboundConfig) {
      console.error('Failed to fetch inbound config:', configError?.message);
      return;
    }

    const { vapi_api_key, vapi_assistant_id } = inboundConfig;

    if (!vapi_api_key || !vapi_assistant_id) {
      console.error('Missing Vapi API key or assistant ID');
      return;
    }

    // Create Vapi client
    const vapiClient = axios.create({
      baseURL: 'https://api.vapi.ai',
      headers: {
        'Authorization': `Bearer ${vapi_api_key}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Fetch current assistant
    console.log('Fetching current assistant configuration...');
    const getResponse = await vapiClient.get(`/assistant/${vapi_assistant_id}`);
    const assistant = getResponse.data;

    console.log('Current webhook URL:', assistant.server?.url);

    // Update with correct webhook URL
    const correctWebhookUrl = 'http://localhost:3001/api/webhooks/vapi';
    
    console.log('Updating webhook URL to:', correctWebhookUrl);
    const updatePayload = {
      server: {
        url: correctWebhookUrl
      },
      recordingEnabled: true
    };

    await vapiClient.patch(`/assistant/${vapi_assistant_id}`, updatePayload);

    console.log('✅ Webhook URL updated successfully!');
    console.log('Assistant ID:', vapi_assistant_id);
    console.log('New webhook URL:', correctWebhookUrl);

  } catch (error: any) {
    console.error('Error updating webhook URL:', error?.response?.data?.message || error?.message);
  }
}

fixWebhookUrl();
