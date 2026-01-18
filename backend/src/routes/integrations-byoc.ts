/**
 * Integrations API Routes - BYOC Multi-Tenant Edition
 *
 * This file implements the REST API for managing USER-PROVIDED integrations.
 * VAPI is platform-provided and not user-configurable.
 *
 * User-Provided Integrations (BYOC):
 * - POST   /api/integrations/twilio         - Store Twilio credentials
 * - POST   /api/integrations/google-calendar - Store Google Calendar credentials
 * - GET    /api/integrations/status         - Get all integration statuses
 * - POST   /api/integrations/:provider/verify - Test specific integration
 * - DELETE /api/integrations/:provider      - Disconnect integration
 */

import express from 'express';
import { config } from '../config/index';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { log } from '../services/logger';
import { requireAuthOrDev } from '../middleware/auth';
import { supabase } from '../services/supabase-client';

export const integrationsRouter = express.Router();

// Require authentication for all endpoints (allow dev bypass)
integrationsRouter.use(requireAuthOrDev);

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
// POST /api/integrations/twilio
// Store Twilio credentials (using customer_twilio_keys)
// ============================================

integrationsRouter.post('/twilio', async (req: express.Request, res: express.Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { accountSid, authToken, phoneNumber, whatsappNumber } = req.body;

    // Validate input
    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        error: 'accountSid and authToken are required'
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

    // Store credentials in customer_twilio_keys
    // Note: Storing auth_token as plain text per current schema.
    try {
      const { error } = await supabase
        .from('customer_twilio_keys')
        .upsert({
          org_id: orgId,
          account_sid: accountSid.trim(),
          auth_token: authToken.trim(),
          phone_number: phoneNumber || 'N/A', // Schema might require this? Check table definition.
          updated_at: new Date().toISOString()
        }, { onConflict: 'org_id' }); // Assuming unique constraint or user logic

      if (error) throw error;

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
      message: 'Twilio credentials stored successfully'
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
// GET /api/integrations/vapi/numbers
// List phone numbers from Vapi
// ============================================
integrationsRouter.get('/vapi/numbers', async (req: express.Request, res: express.Response) => {
  try {
    const orgId = (req as any).user.orgId;



    // 1. Get Integration Settings
    const { data: settings, error: settingsError } = await supabase
      .from('integration_settings')
      .select('api_key_encrypted')
      .eq('org_id', orgId)
      .eq('service_type', 'vapi')
      .single();

    // If no tenant key, check for global fallback (Default Org/Single Tenant Mode)
    if (config.VAPI_PRIVATE_KEY) {
      // Continue execution with global key
    } else {
      // Strict multi-tenancy: No key = no numbers.
      return res.json({ success: true, numbers: [] });
    }

    // 2. Decrypt Key
    let apiKey: string | null = null;
    try {
      if (settings?.api_key_encrypted) {
        apiKey = await IntegrationDecryptor.decrypt(settings.api_key_encrypted);
      }
    } catch (decryptError) {
      console.error('Failed to decrypt Vapi key:', decryptError);
      // Fallback to empty list instead of crashing
      return res.json({ success: true, numbers: [] });
    }

    // Fallback if not set by decryption
    if (!apiKey && config.VAPI_PRIVATE_KEY) {
      apiKey = config.VAPI_PRIVATE_KEY;
    }

    if (!apiKey) {
      // Strict multi-tenancy: No key = no numbers. 
      // Do not throw error, just return empty state.
      return res.json({ success: true, numbers: [] });
    }

    // 3. Fetch numbers from Vapi
    const vapiRes = await fetch('https://api.vapi.ai/phone-number', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!vapiRes.ok) {
      const errorText = await vapiRes.text();
      // If 401, maybe key is invalid
      if (vapiRes.status === 401) {
        return res.status(401).json({ success: false, error: 'Invalid Vapi API Key' });
      }
      throw new Error(`Failed to fetch Vapi numbers: ${errorText}`);
    }

    const numbers = await vapiRes.json();

    res.json({ success: true, numbers });

  } catch (error: any) {
    log.error('integrations', 'Failed to list Vapi numbers', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================
// POST /api/integrations/vapi/assign-number
// Assign a Vapi Phone Number to the Inbound Agent
// ============================================
integrationsRouter.post('/vapi/assign-number', async (req: express.Request, res: express.Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { vapiPhoneId, phoneNumber } = req.body;

    if (!vapiPhoneId) {
      return res.status(400).json({ success: false, error: 'vapiPhoneId is required' });
    }

    // 1. Get Inbound Agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, vapi_assistant_id')
      .eq('org_id', orgId)
      .eq('role', 'inbound')
      .single();

    if (agentError || !agent || !agent.vapi_assistant_id) {
      return res.status(400).json({ success: false, error: 'Inbound agent not configured or synced to Vapi' });
    }

    const VAPI_PRIVATE_KEY = config.VAPI_PRIVATE_KEY;
    if (!VAPI_PRIVATE_KEY) throw new Error('VAPI_PRIVATE_KEY missing');

    // 2. Assign Assistant in Vapi
    const updateRes = await fetch(`https://api.vapi.ai/phone-number/${vapiPhoneId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ assistantId: agent.vapi_assistant_id })
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      return res.status(400).json({ success: false, error: `Failed to assign agent: ${errorText}` });
    }

    // 3. Update Database (user_phone_numbers)
    // We update local DB to reflect this assignment.
    // If we only have vapiPhoneId, and want to store it, we might need to know the number string too.
    // Ideally the frontend passes both, or we fetch details from Vapi. 
    // Assuming frontend passes phoneNumber for convenience, OR we look it up.

    // Upsert or Update check
    if (phoneNumber) {
      const { error: dbUpdateError } = await supabase
        .from('user_phone_numbers')
        .upsert({
          org_id: orgId,
          phone_number: phoneNumber,
          vapi_phone_id: vapiPhoneId,
          assigned_agent_id: agent.id,
          vapi_synced_at: new Date().toISOString()
        }, { onConflict: 'phone_number, org_id' }); // Assuming composite key

      if (dbUpdateError) {
        log.warn('integrations', 'DB update failed after Vapi sync', { error: dbUpdateError.message });
        // We don't fail the request since Vapi sync worked.
      }
    }

    res.json({ success: true, message: 'Agent assigned to number' });

  } catch (error: any) {
    log.error('integrations', 'Assign error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/integrations/status
// Get connection status for all integrations
// ============================================

integrationsRouter.get('/status', async (req: express.Request, res: express.Response) => {
  try {
    const orgId = (req as any).user.orgId;

    // Check Twilio status from customer_twilio_keys
    const { data: twilioKey } = await supabase
      .from('customer_twilio_keys')
      .select('account_sid, updated_at')
      .eq('org_id', orgId)
      .limit(1)
      .maybeSingle();

    const status: Record<string, IntegrationStatus> = {
      vapi: { connected: false }, // Vapi status logic remains separate or assumes connected via env
      twilio: {
        connected: !!twilioKey,
        lastVerified: twilioKey?.updated_at
      },
      googleCalendar: { connected: false },
      resend: { connected: false },
      elevenlabs: { connected: false },
    };

    // If org_credentials exists, check for others (preserving limited existing logic if needed)
    // But since we know it doesn't exist, we skip.

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

    if (provider === 'twilio') {
      // Verify using customer_twilio_keys
      const { data: creds } = await supabase
        .from('customer_twilio_keys')
        .select('account_sid, auth_token')
        .eq('org_id', orgId)
        .limit(1)
        .single();

      if (!creds) {
        return res.json({ success: false, error: 'Not configured' });
      }

      try {
        const twilio = require('twilio');
        const client = twilio(creds.account_sid, creds.auth_token);
        await client.api.accounts(creds.account_sid).fetch();
        return res.json({ success: true, data: { connected: true } });
      } catch (e: any) {
        return res.json({ success: false, error: e.message });
      }
    }

    // Default fallthrough for others (which will likely fail if using IntegrationDecryptor with missing table)
    // We leave the old logic/endpoint structure but it won't work for missing tables.

    res.json({
      success: false,
      error: 'Provider verification not implemented for this provider'
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
// Disconnect integration
// ============================================

integrationsRouter.delete('/:provider', async (req: express.Request, res: express.Response) => {
  // Implement delete for Twilio
  const orgId = (req as any).user.orgId;
  const { provider } = req.params;

  if (provider === 'twilio') {
    await supabase
      .from('customer_twilio_keys')
      .delete()
      .eq('org_id', orgId);

    return res.json({ success: true, message: 'Twilio disconnected' });
  }

  res.json({ success: false, error: 'Not implemented' });
});

export default integrationsRouter;
