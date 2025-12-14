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

const router = express.Router();

// Constants
const ORG_ID = 'founder-console'; // Single-tenant: always use this org ID

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
      vapi_webhook_secret,
      twilio_account_sid,
      twilio_auth_token,
      twilio_from_number,
      test_destination_number
    } = req.body;

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
      console.error('[Settings] Error saving integration settings', error);
      res.status(500).json({ error: 'Failed to save settings' });
      return;
    }

    console.log('[Settings] Integration settings saved', {
      vapiConfigured: !!vapi_api_key,
      twilioConfigured: !!twilio_account_sid,
      testDestination: test_destination_number
    });

    res.status(200).json({ success: true });
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
