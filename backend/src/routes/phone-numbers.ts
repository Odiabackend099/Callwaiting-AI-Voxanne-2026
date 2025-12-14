import express, { Request, Response } from 'express';
import { VapiClient } from '../services/vapi-client';
import { supabase } from '../services/supabase-client';

export const phoneNumbersRouter = express.Router();

// E.164 phone number validation regex
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

// Provider constants for consistency
const INTEGRATION_PROVIDERS = {
  VAPI: 'vapi',
  TWILIO: 'twilio'
} as const;

// Helper to mask phone numbers for logging (PII protection)
function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  return phone.slice(0, 3) + '****' + phone.slice(-2);
}

// Helper to get organization-specific Vapi client
async function getOrgVapiClient(orgId: string): Promise<VapiClient | null> {
  const { data: vapiIntegration, error: fetchError } = await supabase
    .from('integrations')
    .select('config')
    .eq('provider', INTEGRATION_PROVIDERS.VAPI)
    .eq('org_id', orgId)
    .limit(1)
    .single();

  if (fetchError) {
    console.error('[getOrgVapiClient] Failed to fetch vapi integration:', fetchError);
    return null;
  }

  const rawKey = vapiIntegration?.config?.vapi_api_key || process.env.VAPI_API_KEY;
  if (!rawKey) {
    return null;
  }

  // Sanitize API key: remove all non-printable characters
  const safeKey = rawKey.trim().replace(/[^\x20-\x7E]/g, '');

  // Key type logged only in debug mode
  if (process.env.DEBUG_VAPI) {
    console.log(`[getOrgVapiClient] Using key type: ${safeKey.substring(0, 3)}...`);
  }

  return new VapiClient(safeKey);
}

// Import Twilio number to Vapi
phoneNumbersRouter.post('/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, twilioAccountSid, twilioAuthToken, orgId } = req.body;

    // Determine effective org ID from authenticated request, body, or fallback
    // Fallback to default org for development/single-tenant setups
    const effectiveOrgId = orgId || (req as any).org?.id || 'a0000000-0000-0000-0000-000000000001';

    if (!effectiveOrgId) {
      res.status(400).json({ error: 'Organization ID is required' });
      return;
    }

    // Validate required fields
    if (!phoneNumber || !twilioAccountSid || !twilioAuthToken) {
      res.status(400).json({
        error: 'Missing required fields: phoneNumber, twilioAccountSid, twilioAuthToken'
      });
      return;
    }

    // Validate phone number format (E.164)
    if (!E164_REGEX.test(phoneNumber)) {
      res.status(400).json({
        error: 'Phone number must be in E.164 format (e.g., +14155551234)'
      });
      return;
    }

    // Get organization-specific Vapi client
    const localVapi = await getOrgVapiClient(effectiveOrgId);
    if (!localVapi) {
      res.status(500).json({ error: 'Vapi API Key not configured for this organization' });
      return;
    }

    // Check if phone number already exists in Vapi before importing
    let result: { id: string; phoneNumber?: string };
    try {
      const existingNumbers = await localVapi.listPhoneNumbers();
      const existing = existingNumbers?.find?.((p: any) => p.number === phoneNumber);
      
      if (existing) {
        // Phone already imported - use existing ID (idempotent)
        result = { id: existing.id, phoneNumber: existing.number };
      } else {
        // Import new number to Vapi
        result = await localVapi.importTwilioNumber({
          phoneNumber,
          twilioAccountSid,
          twilioAuthToken
        });
      }
    } catch (importError: any) {
      // Handle "Existing Phone Number" error from Vapi by extracting the ID
      const errorMsg = importError?.response?.data?.message || importError.message || '';
      if (errorMsg.includes('Existing Phone Number')) {
        // Parse the existing phone ID from error if available
        const match = errorMsg.match(/([a-f0-9-]{36})/i);
        if (match) {
          result = { id: match[1], phoneNumber };
        } else {
          // Try to list and find it
          const existingNumbers = await localVapi.listPhoneNumbers();
          const existing = existingNumbers?.find?.((p: any) => p.number === phoneNumber);
          if (existing) {
            result = { id: existing.id, phoneNumber: existing.number };
          } else {
            throw importError; // Re-throw if we can't find it
          }
        }
      } else {
        throw importError;
      }
    }

    // Save imported phone ID to integrations (parallel for performance)
    if (result.id) {
      const { data: currentVapiIntegration } = await supabase
        .from('integrations')
        .select('config')
        .eq('provider', INTEGRATION_PROVIDERS.VAPI)
        .eq('org_id', effectiveOrgId)
        .single();

      const now = new Date().toISOString();

      // Parallel DB updates for performance
      const [vapiUpdateResult, twilioUpdateResult] = await Promise.all([
        // Update Vapi integration with phone ID
        supabase
          .from('integrations')
          .update({
            config: {
              ...currentVapiIntegration?.config,
              vapi_phone_number_id: result.id,
              twilio_account_sid: twilioAccountSid,
              // TODO: Use secrets manager in production
              twilio_auth_token: twilioAuthToken,
              twilio_from_number: phoneNumber
            },
            updated_at: now
          })
          .eq('provider', INTEGRATION_PROVIDERS.VAPI)
          .eq('org_id', effectiveOrgId),
        // Update Twilio integration for record keeping
        supabase
          .from('integrations')
          .update({
            config: {
              twilio_account_sid: twilioAccountSid,
              twilio_auth_token: twilioAuthToken,
              twilio_from_number: phoneNumber
            },
            connected: true,
            updated_at: now
          })
          .eq('provider', INTEGRATION_PROVIDERS.TWILIO)
          .eq('org_id', effectiveOrgId)
      ]);

      if (vapiUpdateResult.error) {
        console.error('[phone-numbers/import] Vapi integration update failed:', vapiUpdateResult.error.message);
      }
      if (twilioUpdateResult.error) {
        console.error('[phone-numbers/import] Twilio integration update failed:', twilioUpdateResult.error.message);
      }
    }

    res.json({
      success: true,
      id: result.id,
      phoneNumber: result.phoneNumber || phoneNumber,
      message: `Phone number imported! ID: ${result.id}`
    });

  } catch (error: any) {
    const errorDetails = error?.response?.data || error.message;
    console.error('[POST /phone-numbers/import] Error:', JSON.stringify(errorDetails, null, 2));
    res.status(500).json({
      error: error?.response?.data?.message || error.message || 'Failed to import phone number'
    });
  }
});

// Get phone number details
phoneNumbersRouter.get('/:phoneNumberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumberId } = req.params;
    const orgId = (req as any).org?.id;

    if (!orgId) {
      res.status(400).json({ error: 'Organization ID is required' });
      return;
    }

    const vapi = await getOrgVapiClient(orgId);
    if (!vapi) {
      res.status(500).json({ error: 'Vapi API Key not configured' });
      return;
    }

    const phoneNumber = await vapi.getPhoneNumber(phoneNumberId);
    res.json(phoneNumber);
  } catch (error: any) {
    console.error('[GET /phone-numbers/:id] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch phone number'
    });
  }
});

// List phone numbers
phoneNumbersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = (req as any).org?.id;

    if (!orgId) {
      res.status(400).json({ error: 'Organization ID is required' });
      return;
    }

    const vapi = await getOrgVapiClient(orgId);
    if (!vapi) {
      res.status(500).json({ error: 'Vapi API Key not configured' });
      return;
    }

    const phoneNumbers = await vapi.listPhoneNumbers();
    res.json(phoneNumbers);
  } catch (error: any) {
    console.error('[GET /phone-numbers] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to list phone numbers'
    });
  }
});

// Update phone number (e.g., assign assistant)
phoneNumbersRouter.patch('/:phoneNumberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumberId } = req.params;
    const updates = req.body;
    const orgId = (req as any).org?.id;

    if (!orgId) {
      res.status(400).json({ error: 'Organization ID is required' });
      return;
    }

    const vapi = await getOrgVapiClient(orgId);
    if (!vapi) {
      res.status(500).json({ error: 'Vapi API Key not configured' });
      return;
    }

    const phoneNumber = await vapi.updatePhoneNumber(phoneNumberId, updates);
    res.json(phoneNumber);
  } catch (error: any) {
    console.error('[PATCH /phone-numbers/:id] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to update phone number'
    });
  }
});

// Delete phone number
phoneNumbersRouter.delete('/:phoneNumberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumberId } = req.params;
    const orgId = (req as any).org?.id;

    if (!orgId) {
      res.status(400).json({ error: 'Organization ID is required' });
      return;
    }

    const vapi = await getOrgVapiClient(orgId);
    if (!vapi) {
      res.status(500).json({ error: 'Vapi API Key not configured' });
      return;
    }

    const result = await vapi.deletePhoneNumber(phoneNumberId);
    res.json({
      success: true,
      message: 'Phone number deleted successfully'
    });
  } catch (error: any) {
    console.error('[DELETE /phone-numbers/:id] Error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to delete phone number'
    });
  }
});

export default phoneNumbersRouter;
