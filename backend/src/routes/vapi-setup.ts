/**
 * Vapi Setup Routes
 * Programmatically configure Vapi assistant with RAG webhook
 * Supports multi-tenant configuration via request body/headers
 */

import { Router, Request, Response } from 'express';
import { config } from '../config/index';
import axios from 'axios';
import { log } from '../services/logger';
import { supabase } from '../services/supabase-client';
import { requireAuth } from '../middleware/auth';

const vapiSetupRouter = Router();

// Fallback to env vars if provided (for backwards compatibility/single tenant dev)
const ENV_VAPI_PRIVATE_KEY = config.VAPI_PRIVATE_KEY;
const ENV_VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const ENV_WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/vapi/webhook';

/**
 * POST /api/vapi/setup/configure-webhook
 * Programmatically configure Vapi assistant with RAG webhook
 *
 * Config Hierarchy:
 * 1. Request Body (vapiApiKey, vapiAssistantId)
 * 2. Database (via Organization ID from JWT)
 * 3. Environment Variables (Fallback)
 *
 * SECURITY FIX: Added requireAuth - org_id comes from JWT only
 */
vapiSetupRouter.post('/setup/configure-webhook', requireAuth, async (req: Request, res: Response) => {
  try {
    // Platform Provider Model: Only use system API key
    const vapiApiKey = config.VAPI_PRIVATE_KEY;

    let vapiAssistantId = req.body.vapiAssistantId || ENV_VAPI_ASSISTANT_ID;
    const webhookUrl = req.body.webhookUrl || ENV_WEBHOOK_URL;
    const orgId = req.user?.orgId; // Extract org_id from JWT (set by requireAuth middleware)

    // If orgId provided but no assistant ID, try to fetch from DB
    if (orgId && !vapiAssistantId) {
      // Assistant ID might be in 'agents' table
      const { data: agent } = await supabase
        .from('agents')
        .select('vapi_assistant_id')
        .eq('org_id', orgId)
        .limit(1)
        .single();

      if (agent?.vapi_assistant_id) vapiAssistantId = agent.vapi_assistant_id;
    }

    if (!vapiApiKey) {
      log.error('Vapi-Setup', 'Critical: VAPI_PRIVATE_KEY missing in environment');
      return res.status(500).json({ error: 'System configuration error' });
    }

    if (!vapiAssistantId) {
      return res.status(400).json({ error: 'Vapi Assistant ID required' });
    }

    log.info('Vapi-Setup', 'Starting webhook configuration', { assistantId: vapiAssistantId });

    const vapiClient = axios.create({
      baseURL: 'https://api.vapi.ai',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Get current assistant
    const getResponse = await vapiClient.get(`/assistant/${vapiAssistantId}`);
    const assistant = getResponse.data;

    // Build updated assistant config
    const baseSystemPrompt = assistant.systemPrompt || 'You are a helpful assistant.';

    // Only append KB instructions if not already present
    let enhancedSystemPrompt = baseSystemPrompt;
    if (!baseSystemPrompt.includes('KNOWLEDGE BASE INSTRUCTIONS')) {
      enhancedSystemPrompt = `${baseSystemPrompt}

---
KNOWLEDGE BASE INSTRUCTIONS:
You will receive relevant knowledge base information about our products and services. Use this information to provide accurate, detailed answers.
If knowledge base information is provided in the context, prioritize it in your response.
---`;
    }

    const updatedAssistant = {
      ...assistant,
      systemPrompt: enhancedSystemPrompt,
      serverMessages: [
        {
          type: 'request-start',
          url: webhookUrl,
          method: 'POST',
        },
        {
          type: 'end-of-call-report',
          url: webhookUrl,
          method: 'POST',
        },
        {
          type: 'function-call',
          url: webhookUrl, // Or specific tool URL
          method: 'POST'
        }
      ]
    };

    const updateResponse = await vapiClient.patch(
      `/assistant/${vapiAssistantId}`,
      updatedAssistant
    );

    return res.json({
      success: true,
      message: 'Vapi assistant configured',
      webhookUrl: webhookUrl
    });

  } catch (error: any) {
    log.error('Vapi-Setup', 'Configuration failed', { error: error?.message });
    return res.status(500).json({ error: error?.message });
  }
});

export { vapiSetupRouter };
