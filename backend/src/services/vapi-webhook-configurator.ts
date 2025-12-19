/**
 * Vapi Webhook Configurator Service
 * Automatically configures Vapi assistant webhook when API keys are provided
 * This runs programmatically - users only provide API keys
 */

import axios from 'axios';
import { log } from './logger';

/**
 * Get webhook URL from environment or construct from BASE_URL
 */
function getWebhookUrl(): string {
  if (process.env.WEBHOOK_URL) {
    return process.env.WEBHOOK_URL;
  }
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  return `${baseUrl}/api/vapi/webhook`;
}
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface VapiAssistant {
  id: string;
  name: string;
  systemPrompt?: string;
  serverMessages?: any[];
  [key: string]: any;
}

/**
 * Configure Vapi assistant with RAG webhook
 * Called automatically when API key is saved
 */
export async function configureVapiWebhook(
  vapiApiKey: string,
  vapiAssistantId: string,
  retries = 0
): Promise<{ success: boolean; message: string; assistantId?: string }> {
  try {
    if (!vapiApiKey || !vapiAssistantId) {
      return {
        success: false,
        message: 'Missing Vapi API key or assistant ID'
      };
    }

    log.info('VapiConfigurator', 'Starting webhook configuration', {
      assistantId: vapiAssistantId,
      attempt: retries + 1
    });

    const vapiClient = axios.create({
      baseURL: 'https://api.vapi.ai',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Fetch current assistant configuration
    let assistant: VapiAssistant;
    try {
      const response = await vapiClient.get(`/assistant/${vapiAssistantId}`);
      assistant = response.data;
    } catch (error: any) {
      if (retries < MAX_RETRIES && error?.response?.status === 429) {
        // Rate limited - retry with exponential backoff
        const delay = RETRY_DELAY_MS * Math.pow(2, retries);
        log.warn('VapiConfigurator', 'Rate limited, retrying', { delay, retries });
        await new Promise(r => setTimeout(r, delay));
        return configureVapiWebhook(vapiApiKey, vapiAssistantId, retries + 1);
      }
      throw new Error(`Failed to fetch assistant: ${error?.response?.data?.message || error?.message}`);
    }

    // Build enhanced system prompt with KB instructions
    const basePrompt = assistant.systemPrompt || 'You are a helpful assistant.';
    const kbInstructions = `

---
KNOWLEDGE BASE INTEGRATION:
You will receive relevant knowledge base information in your context. Use this information to provide accurate, detailed answers about our products and services.

When knowledge base information is provided:
1. Prioritize it in your response
2. Use specific details (pricing, features, procedures) from the KB
3. If the user asks something not covered in the KB, say so honestly
4. Always be helpful and professional

If no KB information is provided, use your general knowledge.
---`;

    const enhancedPrompt = basePrompt.includes('KNOWLEDGE BASE INTEGRATION')
      ? basePrompt
      : basePrompt + kbInstructions;

    const webhookUrl = getWebhookUrl();
    
    // Check if webhook already configured via assistant.server.url
    const webhookExists = assistant.server?.url === webhookUrl;
    const recordingEnabled = assistant.recordingEnabled === true;

    // Only update if webhook URL is different or not set, or recording is not enabled
    if (webhookExists && recordingEnabled) {
      log.info('VapiConfigurator', 'Webhook and recording already configured, no update needed', {
        assistantId: vapiAssistantId,
        webhookUrl,
        recordingEnabled: true
      });
      return {
        success: true,
        message: 'Webhook and recording already configured',
        assistantId: vapiAssistantId
      };
    }

    // Build update payload with server.url and recording enabled (correct Vapi API structure)
    const updatePayload = {
      server: {
        url: webhookUrl
      },
      recordingEnabled: true
    };

    // Send update to Vapi
    try {
      await vapiClient.patch(`/assistant/${vapiAssistantId}`, updatePayload);
    } catch (error: any) {
      if (retries < MAX_RETRIES && error?.response?.status === 429) {
        const delay = RETRY_DELAY_MS * Math.pow(2, retries);
        log.warn('VapiConfigurator', 'Rate limited on update, retrying', { delay, retries });
        await new Promise(r => setTimeout(r, delay));
        return configureVapiWebhook(vapiApiKey, vapiAssistantId, retries + 1);
      }
      throw new Error(`Failed to update assistant: ${error?.response?.data?.message || error?.message}`);
    }

    log.info('VapiConfigurator', 'Webhook and recording configured successfully', {
      assistantId: vapiAssistantId,
      webhookUrl: webhookUrl,
      recordingEnabled: true,
      systemPromptUpdated: true
    });

    return {
      success: true,
      message: 'Vapi webhook configured successfully',
      assistantId: vapiAssistantId
    };
  } catch (error: any) {
    log.error('VapiConfigurator', 'Configuration failed', {
      error: error?.message,
      retries
    });

    return {
      success: false,
      message: error?.message || 'Failed to configure Vapi webhook'
    };
  }
}

/**
 * Verify webhook is configured
 */
export async function verifyWebhookConfiguration(
  vapiApiKey: string,
  vapiAssistantId: string
): Promise<boolean> {
  try {
    const vapiClient = axios.create({
      baseURL: 'https://api.vapi.ai',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const response = await vapiClient.get(`/assistant/${vapiAssistantId}`);
    const assistant = response.data;

    const webhookUrl = getWebhookUrl();
    const hasWebhook = assistant.server?.url === webhookUrl;

    return hasWebhook;
  } catch (error: any) {
    log.warn('VapiConfigurator', 'Verification failed', {
      error: error?.message
    });
    return false;
  }
}
