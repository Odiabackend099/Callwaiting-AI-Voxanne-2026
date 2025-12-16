/**
 * Founder Console Settings Routes
 * 
 * Manages Vapi/Twilio integration credentials and configuration.
 * Keys are stored encrypted in the database, never exposed to frontend.
 * 
 * Single-tenant founder console: you are the only user.
 */

import express, { Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { configureVapiWebhook, verifyWebhookConfiguration } from '../services/vapi-webhook-configurator';
import { log } from '../services/logger';

const router = express.Router();

// Constants
const ORG_ID = 'founder-console'; // Legacy single-tenant org id used by integration_settings

interface IntegrationSettings {
  vapi_api_key?: string;
  vapi_webhook_secret?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_from_number?: string;
  test_destination_number?: string;
}

/**
 * GET /api/founder-console/settings
 * Retrieve integration settings (without exposing raw keys)
 * 
 * Returns: { vapiConfigured, twilioConfigured, testDestination, lastVerified }
 */
router.get('/settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: settings, error } = await supabase
      .from('integration_settings')
      .select('vapi_api_key, twilio_account_sid, test_destination_number, last_verified_at')
      .eq('org_id', ORG_ID)
      .maybeSingle();

    if (error) {
      console.error('[Settings] Error fetching integration settings', error);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // Return only non-sensitive info
    res.status(200).json({
      vapiConfigured: !!settings?.vapi_api_key,
      twilioConfigured: !!settings?.twilio_account_sid,
      testDestination: settings?.test_destination_number || null,
      lastVerified: settings?.last_verified_at || null
    });
  } catch (error: any) {
    console.error('[Settings] Error in GET /settings', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/founder-console/settings
 * Save integration settings (Vapi/Twilio keys)
 * 
 * Request: {
 *   vapi_api_key?: string,
 *   vapi_webhook_secret?: string,
 *   twilio_account_sid?: string,
 *   twilio_auth_token?: string,
 *   twilio_from_number?: string,
 *   test_destination_number?: string
 * }
 * 
 * Response: { success: true }
 */
router.post('/settings', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      vapi_api_key,
      vapi_assistant_id,
      vapi_webhook_secret,
      twilio_account_sid,
      twilio_auth_token,
      twilio_from_number,
      test_destination_number
    } = req.body;

    // Resolve the actual org UUID used by call/web-test flows.
    // This keeps the "save in frontend" workflow functional for all call routes.
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .single();

    const orgUuid = org?.id;
    if (!orgUuid) {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // Validate E.164 format if provided
    const validateE164 = (number: string | undefined): boolean => {
      if (!number) return true;
      return /^\+[1-9]\d{1,14}$/.test(number);
    };

    if (!validateE164(twilio_from_number)) {
      res.status(400).json({ error: 'Twilio number must be E.164 format (e.g., +234...)' });
      return;
    }

    if (!validateE164(test_destination_number)) {
      res.status(400).json({ error: 'Test destination must be E.164 format (e.g., +234...)' });
      return;
    }

    // Check if settings already exist
    const { data: existing } = await supabase
      .from('integration_settings')
      .select('id')
      .eq('org_id', ORG_ID)
      .maybeSingle();

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Only include fields that were provided
    if (vapi_api_key !== undefined) updateData.vapi_api_key = vapi_api_key;
    if (vapi_webhook_secret !== undefined) updateData.vapi_webhook_secret = vapi_webhook_secret;
    if (twilio_account_sid !== undefined) updateData.twilio_account_sid = twilio_account_sid;
    if (twilio_auth_token !== undefined) updateData.twilio_auth_token = twilio_auth_token;
    if (twilio_from_number !== undefined) updateData.twilio_from_number = twilio_from_number;
    if (test_destination_number !== undefined) updateData.test_destination_number = test_destination_number;

    let error;

    if (existing) {
      // Update existing settings
      const result = await supabase
        .from('integration_settings')
        .update(updateData)
        .eq('org_id', ORG_ID);
      error = result.error;
    } else {
      // Create new settings
      const result = await supabase
        .from('integration_settings')
        .insert({
          org_id: ORG_ID,
          ...updateData
        });
      error = result.error;
    }

    if (error) {
      log.error('Settings', 'Error saving integration settings', { error: error.message });
      res.status(500).json({ error: 'Failed to save settings' });
      return;
    }

    // CRITICAL: When the UI saves a Vapi API key, also upsert into integrations.
    // The web-test and call flows read Vapi credentials from public.integrations.
    if (typeof vapi_api_key === 'string') {
      const { data: existingVapiIntegration, error: existingVapiIntegrationError } = await supabase
        .from('integrations')
        .select('config')
        .eq('provider', 'vapi')
        .eq('org_id', orgUuid)
        .maybeSingle();

      if (existingVapiIntegrationError) {
        log.error('Settings', 'Failed to read existing Vapi integration', { error: existingVapiIntegrationError.message });
      }

      const existingConfig = (existingVapiIntegration as any)?.config || {};
      const newConfig = {
        ...existingConfig,
        // keep both keys in sync for backward compatibility
        vapi_api_key,
        vapi_secret_key: vapi_api_key
      };

      const { error: upsertError } = await supabase
        .from('integrations')
        .upsert(
          {
            org_id: orgUuid,
            provider: 'vapi',
            connected: true,
            last_checked_at: new Date().toISOString(),
            config: newConfig
          },
          { onConflict: 'org_id,provider' }
        );

      if (upsertError) {
        log.error('Settings', 'Failed to upsert Vapi integration from settings save', { error: upsertError.message });
      } else {
        log.info('Settings', 'Vapi integration updated from settings save', { orgId: orgUuid });
      }
    }

    log.info('Settings', 'Integration settings saved', {
      vapiConfigured: !!vapi_api_key,
      twilioConfigured: !!twilio_account_sid,
      testDestination: test_destination_number
    });

    // Auto-configure Vapi webhook if API key and assistant ID were provided
    let webhookConfigResult = null;
    if (vapi_api_key && vapi_assistant_id) {
      log.info('Settings', 'Auto-configuring Vapi webhook', { assistantId: vapi_assistant_id });
      webhookConfigResult = await configureVapiWebhook(vapi_api_key, vapi_assistant_id);
      
      if (webhookConfigResult.success) {
        log.info('Settings', 'Webhook configured automatically', { assistantId: vapi_assistant_id });
      } else {
        log.warn('Settings', 'Webhook configuration failed', { 
          error: webhookConfigResult.message 
        });
      }
    } else if (vapi_api_key && !vapi_assistant_id) {
      log.warn('Settings', 'Vapi API key provided but no assistant ID, skipping webhook configuration');
    }

    res.status(200).json({ 
      success: true,
      webhookConfigured: webhookConfigResult?.success || false,
      webhookMessage: webhookConfigResult?.message
    });
  } catch (error: any) {
    console.error('[Settings] Error in POST /settings', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Internal helper: Get integration settings for backend use
 * This is NOT exposed via HTTP; used by other backend routes
 */
export async function getIntegrationSettings(): Promise<IntegrationSettings | null> {
  try {
    const { data, error } = await supabase
      .from('integration_settings')
      .select('vapi_api_key, vapi_webhook_secret, twilio_account_sid, twilio_auth_token, twilio_from_number, test_destination_number')
      .eq('org_id', ORG_ID)
      .maybeSingle();

    if (error) {
      console.error('[Settings] Error fetching integration settings', error);
      return null;
    }

    return data || null;
  } catch (error: any) {
    console.error('[Settings] Error in getIntegrationSettings', error);
    return null;
  }
}

export default router;
