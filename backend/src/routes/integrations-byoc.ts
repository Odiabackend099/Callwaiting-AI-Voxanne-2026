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
import { EncryptionService } from '../services/encryption';
import { log } from '../services/logger';
import { requireAuthOrDev } from '../middleware/auth';
import { sanitizeError } from '../utils/error-sanitizer';
import { supabase } from '../services/supabase-client';
import { supabaseAdmin } from '../config/supabase';

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
// GET /api/integrations/twilio
// Get Twilio credentials (org_credentials)
// ============================================

// ============================================
// GET /api/integrations/twilio
// Get Twilio credentials (org_credentials)
// ============================================

integrationsRouter.get('/twilio', async (req: express.Request, res: express.Response) => {
  try {
    // Authentication guard
    if (!(req as any).user || !(req as any).user.orgId) {
      log.error('integrations', 'Missing authentication or orgId', {
        hasUser: !!(req as any).user
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as IntegrationResponse);
    }

    const orgId = (req as any).user.orgId;

    const { data: creds, error } = await supabase
      .from('org_credentials')
      .select('metadata, encrypted_config')
      .eq('org_id', orgId)
      .eq('provider', 'twilio')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      log.error('integrations', 'Database error fetching Twilio creds', { error: error.message });
      return res.status(500).json({ success: false, error: 'Database error' } as IntegrationResponse);
    }

    if (!creds) {
      return res.status(404).json({
        success: false,
        error: 'Twilio not configured'
      } as IntegrationResponse);
    }

    const config = {
      accountSid: creds.metadata?.accountSid,
      phoneNumber: creds.metadata?.phoneNumber,
      authToken: '••••••••' // Masked
    };

    res.json({
      success: true,
      config
    } as IntegrationResponse);
  } catch (error: any) {
    log.error('integrations', 'Failed to get Twilio credentials', {
      error: error?.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get credentials'
    } as IntegrationResponse);
  }
});

// ============================================
// POST /api/integrations/twilio
// Store Twilio credentials (org_credentials + Vapi Sync)
// ============================================

integrationsRouter.post('/twilio', async (req: express.Request, res: express.Response) => {
  try {
    // Authentication guard
    if (!(req as any).user || !(req as any).user.orgId) {
      log.error('integrations', 'Missing authentication or orgId', {
        hasUser: !!(req as any).user
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as IntegrationResponse);
    }

    const orgId = (req as any).user.orgId;
    const { accountSid, authToken, phoneNumber } = req.body;

    // Validate input
    if (!accountSid || !authToken) {
      return res.status(400).json({
        success: false,
        error: 'accountSid and authToken are required'
      } as IntegrationResponse);
    }

    log.info('integrations', 'Processing Twilio credentials', { orgId });

    // 1. Test connection with Twilio
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

    // 2. Save via single-slot gate (UPSERT + mutual exclusion + Vapi sync)
    const { vapiCredentialId } = await IntegrationDecryptor.saveTwilioCredential(orgId, {
      accountSid,
      authToken,
      phoneNumber: phoneNumber || '',
      source: 'byoc',
    });

    log.info('integrations', 'Twilio credentials saved via single-slot gate', {
      orgId,
      vapiCredentialId,
    });

    // 3. Cleanup Legacy Table (Optional but good for hygiene)
    await supabase.from('customer_twilio_keys').delete().eq('org_id', orgId);

    res.json({
      success: true,
      message: 'Twilio credentials saved and synced successfully'
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
    // Authentication guard
    if (!(req as any).user || !(req as any).user.orgId) {
      log.error('integrations', 'Missing authentication or orgId', {
        hasUser: !!(req as any).user
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as IntegrationResponse);
    }

    const orgId = (req as any).user.orgId;

    // MULTI-NUMBER SSOT: For managed orgs, read from managed_phone_numbers.
    // This table supports multiple numbers per org with routing_direction ('inbound'|'outbound').
    // org_credentials is single-slot (UNIQUE on org_id+provider) and cannot represent
    // multiple numbers — it only stores subaccount-level credentials for the first number.
    const { data: managedNumbers, error: mnErr } = await supabaseAdmin
      .from('managed_phone_numbers')
      .select('phone_number, vapi_phone_id, routing_direction')
      .eq('org_id', orgId)
      .eq('status', 'active');

    if (mnErr) {
      log.warn('integrations', 'managed_phone_numbers query error — falling back to org_credentials', {
        orgId,
        error: mnErr.message,
      });
    } else if (managedNumbers && managedNumbers.length > 0) {
      // Managed org: return all active managed numbers with their routing direction.
      // Filter to only rows where vapi_phone_id is populated (Vapi import completed).
      const numbers = managedNumbers
        .filter((n: any) => n.vapi_phone_id)
        .map((n: any) => ({
          id: n.vapi_phone_id,
          number: n.phone_number,
          name: `Managed (${n.routing_direction || 'unassigned'})`,
          type: 'managed' as const,
          routingDirection: n.routing_direction,
        }));

      if (numbers.length < managedNumbers.length) {
        log.warn('integrations', 'Some managed numbers have no vapi_phone_id — excluded from response', {
          orgId,
          total: managedNumbers.length,
          withVapiId: numbers.length,
        });
      }

      // If all managed rows are missing vapi_phone_id (e.g., all Vapi imports failed),
      // fall through to the BYOC path rather than returning an empty list silently.
      if (numbers.length > 0) {
        log.info('integrations', 'Returning managed numbers from managed_phone_numbers', {
          orgId,
          count: numbers.length,
        });
        return res.json({ success: true, numbers });
      }

      log.warn('integrations', 'All managed numbers lack vapi_phone_id — falling back to org_credentials', { orgId });
    }

    // BYOC fallback: org has no managed numbers (or all are missing vapi_phone_id) — read from org_credentials
    const { data: credentials, error: credErr } = await supabase
      .from('org_credentials')
      .select('encrypted_config, is_managed')
      .eq('org_id', orgId)
      .eq('provider', 'twilio')
      .eq('is_active', true);

    if (credErr) {
      log.error('integrations', 'Failed to read org credentials from DB', {
        orgId,
        error: credErr.message,
      });
      return res.status(500).json({ success: false, error: 'Failed to load phone numbers' } as IntegrationResponse);
    }

    // Decrypt and format BYOC credentials
    const numbers = [];
    for (const cred of credentials || []) {
      try {
        const decrypted = EncryptionService.decryptObject(cred.encrypted_config);

        // Only include numbers with vapiPhoneId
        if (decrypted.phoneNumber && decrypted.vapiPhoneId) {
          numbers.push({
            id: decrypted.vapiPhoneId,
            number: decrypted.phoneNumber,
            name: 'Your Twilio',
            type: 'byoc' as const,
            routingDirection: undefined,
          });
        }
      } catch (decryptErr: any) {
        log.warn('integrations', 'Failed to decrypt credential config', {
          orgId,
          error: decryptErr.message,
        });
        // Skip this credential and continue
      }
    }

    // De-duplicate by id (in case duplicates exist)
    const deduped = Array.from(new Map(numbers.map((n: any) => [n.id, n])).values());

    return res.json({ success: true, numbers: deduped });

  } catch (error: any) {
    log.error('integrations', 'Failed to list Vapi numbers', { error: error.message });
    const userMessage = sanitizeError(error, 'Integrations - GET /vapi-phone-numbers', 'Failed to list phone numbers');
    return res.status(500).json({ success: false, error: userMessage });
  }
});


// ============================================
// POST /api/integrations/vapi/assign-number
// Assign a Vapi Phone Number to the Inbound Agent
// ============================================
integrationsRouter.post('/vapi/assign-number', async (req: express.Request, res: express.Response) => {
  try {
    // Authentication guard
    if (!(req as any).user || !(req as any).user.orgId) {
      log.error('integrations', 'Missing authentication or orgId', {
        hasUser: !!(req as any).user
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as IntegrationResponse);
    }

    const orgId = (req as any).user.orgId;
    const { vapiPhoneId, phoneNumber, phoneNumberId, role = 'inbound' } = req.body;

    // Support both old format (vapiPhoneId) and new format (phoneNumberId)
    const phoneId = phoneNumberId || vapiPhoneId;

    if (!phoneId) {
      return res.status(400).json({ success: false, error: 'phoneNumberId or vapiPhoneId is required' });
    }

    // Validate role
    if (role !== 'inbound' && role !== 'outbound') {
      return res.status(400).json({ success: false, error: 'role must be either "inbound" or "outbound"' });
    }

    // 1. Get Agent (inbound or outbound based on role)
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, vapi_assistant_id')
      .eq('org_id', orgId)
      .eq('role', role)
      .single();

    if (agentError || !agent || !agent.vapi_assistant_id) {
      return res.status(400).json({
        success: false,
        error: `${role.charAt(0).toUpperCase() + role.slice(1)} agent not configured or synced to Vapi`
      });
    }

    const VAPI_PRIVATE_KEY = config.VAPI_PRIVATE_KEY;
    if (!VAPI_PRIVATE_KEY) throw new Error('VAPI_PRIVATE_KEY missing');

    // 2. Assign Assistant in Vapi
    const updateRes = await fetch(`https://api.vapi.ai/phone-number/${phoneId}`, {
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

    // 3. Update Database
    if (role === 'inbound') {
      // Update integrations table so /api/inbound/status reads the assigned number
      if (phoneNumber) {
        const { error: dbUpdateError } = await supabase
          .from('integrations')
          .upsert({
            org_id: orgId,
            provider: 'twilio_inbound',
            config: {
              phoneNumber,
              vapiPhoneNumberId: phoneId,
              assignedAgentId: agent.id,
              status: 'active',
              activatedAt: new Date().toISOString(),
              vapiApiKeyLast4Used: config.VAPI_PRIVATE_KEY?.slice(-4) || null
            },
            updated_at: new Date().toISOString()
          }, { onConflict: 'org_id,provider' });

        if (dbUpdateError) {
          log.warn('integrations', 'DB update failed after Vapi sync', { error: dbUpdateError.message });
        }
      }
    } else if (role === 'outbound') {
      // Update agents table with phone number ID (single source of truth)
      const { error: dbUpdateError } = await supabase
        .from('agents')
        .update({
          vapi_phone_number_id: phoneId,
          updated_at: new Date().toISOString()
        })
        .eq('role', 'outbound')
        .eq('org_id', orgId);

      if (dbUpdateError) {
        log.warn('integrations', 'Failed to update outbound agent phone number', { error: dbUpdateError.message });
      }
    }

    res.json({ success: true, message: `${role.charAt(0).toUpperCase() + role.slice(1)} agent assigned to number` });

  } catch (error: any) {
    log.error('integrations', 'Assign error', { error: error.message });
    const userMessage = sanitizeError(error, 'Integrations - PATCH /assign-agent', 'Failed to assign agent');
    return res.status(500).json({ success: false, error: userMessage });
  }
});

// ============================================
// GET /api/integrations/status
// Get connection status for all integrations
// ============================================

integrationsRouter.get('/status', async (req: express.Request, res: express.Response) => {
  try {
    // Authentication guard
    if (!(req as any).user || !(req as any).user.orgId) {
      log.error('integrations', 'Missing authentication or orgId', {
        hasUser: !!(req as any).user
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as IntegrationResponse);
    }

    const orgId = (req as any).user.orgId;

    // Check Twilio status from org_credentials (SSOT)
    const { data: twilioCreds } = await supabase
      .from('org_credentials')
      .select('metadata, updated_at')
      .eq('org_id', orgId)
      .eq('provider', 'twilio')
      .eq('is_active', true)
      .maybeSingle();

    const status: Record<string, IntegrationStatus> = {
      vapi: { connected: false }, // Vapi status logic remains separate or assumes connected via env
      twilio: {
        connected: !!twilioCreds,
        lastVerified: twilioCreds?.updated_at
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
    // Authentication guard
    if (!(req as any).user || !(req as any).user.orgId) {
      log.error('integrations', 'Missing authentication or orgId', {
        hasUser: !!(req as any).user
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as IntegrationResponse);
    }

    const orgId = (req as any).user.orgId;
    const { provider } = req.params;

    if (provider === 'twilio') {
      // Verify using org_credentials (SSOT)
      const { data: creds } = await supabase
        .from('org_credentials')
        .select('encrypted_config')
        .eq('org_id', orgId)
        .eq('provider', 'twilio')
        .eq('is_active', true)
        .maybeSingle();

      if (!creds || !creds.encrypted_config) {
        return res.json({ success: false, error: 'Not configured' });
      }

      try {
        const { EncryptionService } = require('../services/encryption');
        const config = EncryptionService.decryptObject(creds.encrypted_config);

        const twilio = require('twilio');
        const client = twilio(config.accountSid, config.authToken);
        await client.api.accounts(config.accountSid).fetch();
        return res.json({ success: true, data: { connected: true } });
      } catch (e: any) {
        const userMessage = sanitizeError(e, 'Integrations - Test Twilio', 'Failed to verify Twilio credentials');
        return res.json({ success: false, error: userMessage });
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
  try {
    // Authentication guard
    if (!(req as any).user || !(req as any).user.orgId) {
      log.error('integrations', 'Missing authentication or orgId', {
        hasUser: !!(req as any).user
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as IntegrationResponse);
    }

    // Implement delete for Twilio
    const orgId = (req as any).user.orgId;
    const { provider } = req.params;

    if (provider === 'twilio') {
      // SSOT: org_credentials is the canonical store.
      // Deactivate any active Twilio credential rows.
      const { error: credErr } = await supabase
        .from('org_credentials')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('provider', 'twilio')
        .eq('is_active', true);

      if (credErr) {
        log.error('integrations', 'Failed to deactivate Twilio org_credentials', {
          orgId,
          error: credErr.message,
        });
        return res.status(500).json({ success: false, error: 'Failed to disconnect Twilio' } as IntegrationResponse);
      }

      // Best-effort cleanup: legacy table (no longer SSOT)
      await supabase
        .from('customer_twilio_keys')
        .delete()
        .eq('org_id', orgId);

      // Invalidate in-memory decryptor cache so the change is reflected immediately
      try {
        IntegrationDecryptor.invalidateCache(orgId, 'twilio');
      } catch {
        // non-critical
      }

      return res.json({ success: true, message: 'Twilio disconnected' } as IntegrationResponse);
    }

    res.json({ success: false, error: 'Not implemented' });
  } catch (error: any) {
    log.error('integrations', 'Failed to disconnect provider', {
      error: error?.message
    });
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect provider'
    } as IntegrationResponse);
  }
});

// ============================================
// GET /api/integrations/telephony-mode
// Returns the org's current telephony mode + whether credentials exist
// Used by frontend to show mode-conflict warnings
// ============================================

integrationsRouter.get('/telephony-mode', async (req: express.Request, res: express.Response) => {
  try {
    const orgId = (req as any).user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get telephony mode
    const { data: org } = await supabase
      .from('organizations')
      .select('telephony_mode, vapi_credential_id')
      .eq('id', orgId)
      .single();

    const mode = org?.telephony_mode || 'none';

    // Check if credentials exist
    const { data: cred } = await supabase
      .from('org_credentials')
      .select('id, metadata')
      .eq('org_id', orgId)
      .eq('provider', 'twilio')
      .eq('is_active', true)
      .maybeSingle();

    const phoneNumber = (cred?.metadata as any)?.phoneNumber || undefined;

    res.json({
      mode,
      hasExistingCredential: !!cred,
      phoneNumber,
      vapiCredentialId: org?.vapi_credential_id || null,
    });
  } catch (error: any) {
    log.error('integrations', 'Failed to get telephony mode', { error: error?.message });
    res.status(500).json({ error: 'Failed to get telephony mode' });
  }
});

export default integrationsRouter;
