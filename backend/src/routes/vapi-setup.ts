/**
 * Vapi Setup Routes
 * Programmatically configure Vapi assistant with RAG webhook
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { log } from '../services/logger';

const vapiSetupRouter = Router();

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/vapi/webhook';

/**
 * POST /api/vapi/setup/configure-webhook
 * Programmatically configure Vapi assistant with RAG webhook
 */
vapiSetupRouter.post('/setup/configure-webhook', async (req: Request, res: Response) => {
  try {
    if (!VAPI_API_KEY) {
      return res.status(400).json({ 
        error: 'VAPI_API_KEY environment variable not set' 
      });
    }

    if (!VAPI_ASSISTANT_ID) {
      return res.status(400).json({ 
        error: 'VAPI_ASSISTANT_ID environment variable not set' 
      });
    }

    log.info('Vapi-Setup', 'Starting webhook configuration', { 
      assistantId: VAPI_ASSISTANT_ID 
    });

    const vapiClient = axios.create({
      baseURL: 'https://api.vapi.ai',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Get current assistant
    log.info('Vapi-Setup', 'Fetching current assistant configuration');
    const getResponse = await vapiClient.get(`/assistant/${VAPI_ASSISTANT_ID}`);
    const assistant = getResponse.data;

    log.info('Vapi-Setup', 'Assistant fetched', { 
      name: assistant.name,
      model: assistant.model?.provider 
    });

    // Build updated assistant config
    const baseSystemPrompt = assistant.systemPrompt || 'You are a helpful assistant for CallWaiting AI.';
    
    const enhancedSystemPrompt = `${baseSystemPrompt}

---
KNOWLEDGE BASE INSTRUCTIONS:
You will receive relevant knowledge base information about our products and services. Use this information to provide accurate, detailed answers.

If knowledge base information is provided in the context, prioritize it in your response. If the user asks something not covered in the knowledge base, say so honestly.

Always be helpful, professional, and focused on helping the user understand our products and services.
---`;

    const updatedAssistant = {
      ...assistant,
      systemPrompt: enhancedSystemPrompt,
      // Add webhook configuration
      serverMessages: [
        {
          type: 'request-start',
          url: WEBHOOK_URL,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      ]
    };

    // Update assistant
    log.info('Vapi-Setup', 'Updating assistant with webhook configuration');
    const updateResponse = await vapiClient.patch(
      `/assistant/${VAPI_ASSISTANT_ID}`,
      updatedAssistant
    );

    log.info('Vapi-Setup', 'Assistant updated successfully', { 
      webhookUrl: WEBHOOK_URL 
    });

    return res.json({
      success: true,
      message: 'Vapi assistant configured with RAG webhook',
      assistant: {
        id: updateResponse.data.id,
        name: updateResponse.data.name,
        webhookUrl: WEBHOOK_URL,
        systemPromptUpdated: true
      }
    });
  } catch (error: any) {
    log.error('Vapi-Setup', 'Configuration failed', { 
      error: error?.response?.data?.message || error?.message 
    });

    return res.status(500).json({
      error: 'Failed to configure Vapi webhook',
      details: error?.response?.data?.message || error?.message
    });
  }
});

/**
 * GET /api/vapi/setup/status
 * Check if Vapi webhook is configured
 */
vapiSetupRouter.get('/setup/status', async (req: Request, res: Response) => {
  try {
    if (!VAPI_API_KEY || !VAPI_ASSISTANT_ID) {
      return res.json({
        configured: false,
        reason: 'Missing VAPI_API_KEY or VAPI_ASSISTANT_ID environment variables'
      });
    }

    const vapiClient = axios.create({
      baseURL: 'https://api.vapi.ai',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const response = await vapiClient.get(`/assistant/${VAPI_ASSISTANT_ID}`);
    const assistant = response.data;

    const hasWebhook = assistant.serverMessages && 
                       assistant.serverMessages.some((msg: any) => msg.url === WEBHOOK_URL);

    return res.json({
      configured: hasWebhook,
      assistantId: VAPI_ASSISTANT_ID,
      assistantName: assistant.name,
      webhookUrl: WEBHOOK_URL,
      systemPromptUpdated: assistant.systemPrompt?.includes('KNOWLEDGE BASE INSTRUCTIONS')
    });
  } catch (error: any) {
    log.error('Vapi-Setup', 'Status check failed', { 
      error: error?.message 
    });

    return res.status(500).json({
      error: 'Failed to check Vapi configuration status',
      details: error?.message
    });
  }
});

export { vapiSetupRouter };
