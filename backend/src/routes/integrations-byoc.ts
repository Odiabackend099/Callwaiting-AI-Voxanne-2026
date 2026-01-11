/**
 * Integrations API Routes - BYOC Multi-Tenant Edition
 *
 * This file implements the REST API for managing integrations in a multi-tenant environment.
 * All endpoints enforce org isolation and credential encryption.
 *
 * Endpoints:
 * - POST   /api/integrations/vapi           - Store Vapi credentials
 * - POST   /api/integrations/twilio         - Store Twilio credentials
 * - GET    /api/integrations/status         - Get all integration statuses
 * - POST   /api/integrations/:provider/verify - Test specific integration
 * - DELETE /api/integrations/:provider      - Disconnect integration
 */

import express from 'express';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { VapiAssistantManager } from '../services/vapi-assistant-manager';
import { VapiClient } from '../services/vapi-client';
import { log } from '../services/logger';
import { requireAuth } from '../middleware/auth'; // Assumes this middleware exists

export const integrationsRouter = express.Router();

// Require authentication for all endpoints
integrationsRouter.use(requireAuth);

// ============================================
// Type Definitions
// ============================================

interface IntegrationStatus {
  connected: boolean;
  lastVerified?: string;
  error?: string;
}

interface IntegrationResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}

// ============================================
// POST /api/integrations/vapi
// Store Vapi credentials and auto-create assistants
// ============================================

integrationsRouter.post('/vapi', async (req: express.Request, res: express.Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { apiKey, webhookSecret } = req.body;

    // Validate input
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'apiKey is required and must be a non-empty string'
      } as IntegrationResponse);
    }

    log.info('integrations', 'Storing Vapi credentials', { orgId });

    // Step 1: Test Vapi connection
    try {
      const testVapi = new VapiClient(apiKey.trim());
      const isValid = await testVapi.validateConnection();

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Vapi API key. Connection test failed.'
        } as IntegrationResponse);
      }
    } catch (testError: any) {
      log.error('integrations', 'Vapi connection test failed', {
        orgId,
        error: testError?.message
      });
      return res.status(400).json({
        success: false,
        error: `Vapi connection failed: ${testError?.message || 'Unknown error'}`
      } as IntegrationResponse);
    }

    // Step 2: Store credentials (encrypted)
    try {
      await IntegrationDecryptor.storeCredentials(
        orgId,
        'vapi',
        {
          apiKey: apiKey.trim(),
          webhookSecret: webhookSecret?.trim(),
        }
      );
    } catch (storeError: any) {
      log.error('integrations', 'Failed to store Vapi credentials', {
        orgId,
        error: storeError?.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to store credentials'
      } as IntegrationResponse);
    }

    // Step 3: Create/update inbound assistant
    let inboundAssistantId: string | undefined;
    try {
      const inboundConfig = await VapiAssistantManager.getAssistantConfig(orgId, 'inbound');

      const result = await VapiAssistantManager.ensureAssistant(
        orgId,
        'inbound',
        {
          name: 'Inbound Agent',
          systemPrompt: inboundConfig?.systemPrompt || 'You are a helpful assistant.',
          firstMessage: inboundConfig?.firstMessage || 'Hello! How can I help you today?',
          voiceId: inboundConfig?.voiceId || 'Paige',
          language: inboundConfig?.language || 'en',
          maxDurationSeconds: inboundConfig?.maxDurationSeconds || 600,
        }
      );

      inboundAssistantId = result.assistantId;
      log.info('integrations', 'Inbound assistant created/updated', {
        orgId,
        assistantId: inboundAssistantId,
        isNew: result.isNew,
      });
    } catch (assistantError: any) {
      log.warn('integrations', 'Failed to create inbound assistant', {
        orgId,
        error: assistantError?.message,
      });
      // Non-critical - continue without assistant
    }

    // Step 4: Create/update outbound assistant
    let outboundAssistantId: string | undefined;
    try {
      const outboundConfig = await VapiAssistantManager.getAssistantConfig(orgId, 'outbound');

      const result = await VapiAssistantManager.ensureAssistant(
        orgId,
        'outbound',
        {
          name: 'Outbound Agent',
          systemPrompt: outboundConfig?.systemPrompt || 'You are a helpful assistant.',
          firstMessage: outboundConfig?.firstMessage || 'Hello!',
          voiceId: outboundConfig?.voiceId || 'Paige',
          language: outboundConfig?.language || 'en',
          maxDurationSeconds: outboundConfig?.maxDurationSeconds || 600,
        }
      );

      outboundAssistantId = result.assistantId;
      log.info('integrations', 'Outbound assistant created/updated', {
        orgId,
        assistantId: outboundAssistantId,
        isNew: result.isNew,
      });
    } catch (assistantError: any) {
      log.warn('integrations', 'Failed to create outbound assistant', {
        orgId,
        error: assistantError?.message,
      });
      // Non-critical - continue without assistant
    }

    res.json({
      success: true,
      message: 'Vapi credentials stored successfully',
      data: {
        inboundAssistantId,
        outboundAssistantId,
      }
    } as IntegrationResponse);
  } catch (error: any) {
    log.error('integrations', 'Unexpected error storing Vapi credentials', {
      error: error?.message
    });
    res.status(500).json({
      success: false,
      error: 'Unexpected error'
    } as IntegrationResponse);
  }
});

// ============================================
// POST /api/integrations/twilio
// Store Twilio credentials
// ============================================

integrationsRouter.post('/twilio', async (req: express.Request, res: express.Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { accountSid, authToken, phoneNumber, whatsappNumber } = req.body;

    // Validate input
    if (!accountSid || !authToken || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'accountSid, authToken, and phoneNumber are required'
      } as IntegrationResponse);
    }

    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Use E.164 format: +1234567890'
      } as IntegrationResponse);
    }

    if (whatsappNumber && !e164Regex.test(whatsappNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid WhatsApp number format. Use E.164 format: +1234567890'
      } as IntegrationResponse);
    }

    log.info('integrations', 'Testing Twilio credentials', { orgId });

    // Test connection
    try {
      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);
      await client.api.accounts(accountSid).fetch();
    } catch (testError: any) {
      log.error('integrations', 'Twilio connection test failed', {
        orgId,
        error: testError?.message
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid Twilio credentials. Please check your Account SID and Auth Token.'
      } as IntegrationResponse);
    }

    // Store credentials (encrypted)
    try {
      await IntegrationDecryptor.storeCredentials(
        orgId,
        'twilio',
        {
          accountSid: accountSid.trim(),
          authToken: authToken.trim(),
          phoneNumber: phoneNumber.trim(),
          whatsappNumber: whatsappNumber?.trim(),
        }
      );
    } catch (storeError: any) {
      log.error('integrations', 'Failed to store Twilio credentials', {
        orgId,
        error: storeError?.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to store credentials'
      } as IntegrationResponse);
    }

    log.info('integrations', 'Twilio credentials stored', { orgId });

    res.json({
      success: true,
      message: 'Twilio credentials stored successfully',
      data: {
        phoneNumber: phoneNumber.replace(/./g, (c, i) => i < 3 || i >= phoneNumber.length - 2 ? c : '*')
      }
    } as IntegrationResponse);
  } catch (error: any) {
    log.error('integrations', 'Unexpected error storing Twilio credentials', {
      error: error?.message
    });
    res.status(500).json({
      success: false,
      error: 'Unexpected error'
    } as IntegrationResponse);
  }
});

// ============================================
// GET /api/integrations/status
// Get connection status for all integrations
// ============================================

integrationsRouter.get('/status', async (req: express.Request, res: express.Response) => {
  try {
    const orgId = (req as any).user.orgId;

    const { data: credentials } = await (req as any).supabase
      .from('org_credentials')
      .select('provider, is_active, last_verified_at, verification_error')
      .eq('org_id', orgId);

    const status: Record<string, IntegrationStatus> = {
      vapi: { connected: false },
      twilio: { connected: false },
      googleCalendar: { connected: false },
      resend: { connected: false },
      elevenlabs: { connected: false },
    };

    credentials?.forEach((cred: any) => {
      const key = cred.provider === 'google_calendar' ? 'googleCalendar' : cred.provider;
      status[key] = {
        connected: cred.is_active,
        lastVerified: cred.last_verified_at,
        error: cred.verification_error,
      };
    });

    res.json({
      success: true,
      data: status
    } as IntegrationResponse);
  } catch (error: any) {
    log.error('integrations', 'Failed to get integration status', {
      error: error?.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get integration status'
    } as IntegrationResponse);
  }
});

// ============================================
// POST /api/integrations/:provider/verify
// Test connection for specific provider
// ============================================

integrationsRouter.post('/:provider/verify', async (req: express.Request, res: express.Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { provider } = req.params;

    // Validate provider
    const validProviders = ['vapi', 'twilio', 'google_calendar', 'resend', 'elevenlabs'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        error: `Invalid provider. Supported: ${validProviders.join(', ')}`
      } as IntegrationResponse);
    }

    log.info('integrations', 'Verifying credentials', { orgId, provider });

    const result = await IntegrationDecryptor.verifyCredentials(orgId, provider);

    res.json({
      success: result.success,
      data: {
        connected: result.success,
        lastVerified: result.lastVerified,
        error: result.error,
      }
    } as IntegrationResponse);
  } catch (error: any) {
    log.error('integrations', 'Failed to verify credentials', {
      error: error?.message
    });
    res.status(500).json({
      success: false,
      error: 'Verification failed'
    } as IntegrationResponse);
  }
});

// ============================================
// DELETE /api/integrations/:provider
// Disconnect integration (soft delete)
// ============================================

integrationsRouter.delete('/:provider', async (req: express.Request, res: express.Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { provider } = req.params;

    // Validate provider
    const validProviders = ['vapi', 'twilio', 'google_calendar', 'resend', 'elevenlabs'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        error: `Invalid provider. Supported: ${validProviders.join(', ')}`
      } as IntegrationResponse);
    }

    log.info('integrations', 'Disconnecting integration', { orgId, provider });

    // Mark as inactive (soft delete)
    const { error } = await (req as any).supabase
      .from('org_credentials')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('provider', provider);

    if (error) {
      log.error('integrations', 'Failed to disconnect integration', {
        orgId,
        provider,
        error: error.message
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to disconnect integration'
      } as IntegrationResponse);
    }

    // Invalidate cache
    IntegrationDecryptor.invalidateCache(orgId, provider);

    log.info('integrations', 'Integration disconnected', { orgId, provider });

    res.json({
      success: true,
      message: `${provider} integration disconnected`
    } as IntegrationResponse);
  } catch (error: any) {
    log.error('integrations', 'Failed to disconnect integration', {
      error: error?.message
    });
    res.status(500).json({
      success: false,
      error: 'Unexpected error'
    } as IntegrationResponse);
  }
});

export default integrationsRouter;
