/**
 * Vapi Discovery Routes
 * Auto-discover assistants and phone numbers from Vapi using API key
 * Users only provide API key - we fetch everything else
 */

import express, { Request, Response } from 'express';
import axios from 'axios';
import { log } from '../services/logger';
import { sanitizeError } from '../utils/error-sanitizer';
import { configureVapiWebhook } from '../services/vapi-webhook-configurator';

const router = express.Router();

interface VapiAssistant {
  id: string;
  name: string;
  model?: string;
  voice?: string;
  createdAt?: string;
}

interface VapiPhoneNumber {
  id: string;
  number: string;
  name?: string;
  assistantId?: string;
  createdAt?: string;
}

/**
 * POST /api/vapi/discover/assistants
 * Fetch all assistants from Vapi using provided API key
 */
router.post('/discover/assistants', async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      res.status(400).json({ error: 'API key is required' });
      return;
    }

    log.info('VapiDiscovery', 'Fetching assistants from Vapi');

    const response = await axios.get('https://api.vapi.ai/assistant', {
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const assistants: VapiAssistant[] = (response.data || []).map((a: any) => ({
      id: a.id,
      name: a.name || 'Unnamed Assistant',
      model: a.model?.model || a.model?.provider || 'Unknown',
      voice: a.voice?.voiceId || a.voice?.provider || 'Unknown',
      createdAt: a.createdAt
    }));

    log.info('VapiDiscovery', 'Assistants fetched', { count: assistants.length });

    res.status(200).json({ success: true, assistants });
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || error?.message;

    log.error('VapiDiscovery', 'Failed to fetch assistants', { status, message });

    if (status === 401 || status === 403) {
      res.status(401).json({ error: 'Invalid API key. Please check your Vapi private key.' });
      return;
    }

    const userMessage = sanitizeError(error, 'VapiDiscovery - GET assistants', 'Failed to fetch assistants');
    res.status(500).json({ error: userMessage });
  }
});

/**
 * POST /api/vapi/discover/phone-numbers
 * Fetch all phone numbers from Vapi using provided API key
 */
router.post('/discover/phone-numbers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      res.status(400).json({ error: 'API key is required' });
      return;
    }

    log.info('VapiDiscovery', 'Fetching phone numbers from Vapi');

    const response = await axios.get('https://api.vapi.ai/phone-number', {
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const phoneNumbers: VapiPhoneNumber[] = (response.data || []).map((p: any) => ({
      id: p.id,
      number: p.number || p.twilioPhoneNumber || p.vonagePhoneNumber || 'Unknown',
      name: p.name || '',
      assistantId: p.assistantId || null,
      createdAt: p.createdAt
    }));

    log.info('VapiDiscovery', 'Phone numbers fetched', { count: phoneNumbers.length });

    res.status(200).json({ success: true, phoneNumbers });
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || error?.message;

    log.error('VapiDiscovery', 'Failed to fetch phone numbers', { status, message });

    if (status === 401 || status === 403) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    const userMessage = sanitizeError(error, 'VapiDiscovery - GET phone numbers', 'Failed to fetch phone numbers');
    res.status(500).json({ error: userMessage });
  }
});

/**
 * POST /api/vapi/discover/all
 * Fetch assistants + phone numbers in one call, then auto-configure webhook
 * This is the main endpoint for the settings page
 */
router.post('/discover/all', async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      res.status(400).json({ error: 'API key is required' });
      return;
    }

    const trimmedKey = apiKey.trim();
    const headers = {
      'Authorization': `Bearer ${trimmedKey}`,
      'Content-Type': 'application/json'
    };

    log.info('VapiDiscovery', 'Fetching all Vapi resources');

    // Fetch assistants and phone numbers in parallel
    const [assistantsRes, phoneNumbersRes] = await Promise.all([
      axios.get('https://api.vapi.ai/assistant', { headers, timeout: 15000 }),
      axios.get('https://api.vapi.ai/phone-number', { headers, timeout: 15000 })
    ]);

    const assistants: VapiAssistant[] = (assistantsRes.data || []).map((a: any) => ({
      id: a.id,
      name: a.name || 'Unnamed Assistant',
      model: a.model?.model || a.model?.provider || 'Unknown',
      voice: a.voice?.voiceId || a.voice?.provider || 'Unknown',
      createdAt: a.createdAt
    }));

    const phoneNumbers: VapiPhoneNumber[] = (phoneNumbersRes.data || []).map((p: any) => ({
      id: p.id,
      number: p.number || p.twilioPhoneNumber || p.vonagePhoneNumber || 'Unknown',
      name: p.name || '',
      assistantId: p.assistantId || null,
      createdAt: p.createdAt
    }));

    log.info('VapiDiscovery', 'All resources fetched', { 
      assistants: assistants.length, 
      phoneNumbers: phoneNumbers.length 
    });

    res.status(200).json({ 
      success: true, 
      assistants, 
      phoneNumbers 
    });
  } catch (error: any) {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || error?.message;

    log.error('VapiDiscovery', 'Failed to fetch resources', { status, message });

    if (status === 401 || status === 403) {
      res.status(401).json({ error: 'Invalid API key. Please check your Vapi private key.' });
      return;
    }

    const userMessage = sanitizeError(error, 'VapiDiscovery - GET all resources', 'Failed to fetch Vapi resources');
    res.status(500).json({ error: userMessage });
  }
});

/**
 * POST /api/vapi/discover/configure
 * Configure webhook for selected assistant
 */
router.post('/discover/configure', async (req: Request, res: Response): Promise<void> => {
  try {
    const { apiKey, assistantId } = req.body;

    if (!apiKey || !assistantId) {
      res.status(400).json({ error: 'API key and assistant ID are required' });
      return;
    }

    log.info('VapiDiscovery', 'Configuring webhook for assistant', { assistantId });

    const result = await configureVapiWebhook(apiKey.trim(), assistantId.trim());

    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: result.message,
        assistantId: result.assistantId
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.message 
      });
    }
  } catch (error: any) {
    log.error('VapiDiscovery', 'Configure failed', { error: error?.message });
    return res.status(500).json({ error: 'Configuration failed. Please try again.' });
  }
});

export default router;
