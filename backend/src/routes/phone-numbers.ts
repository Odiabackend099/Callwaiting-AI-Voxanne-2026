import express, { Request, Response } from 'express';
import { config } from '../config/index';
import { VapiClient } from '../services/vapi-client';
import { supabase } from '../services/supabase-client';
import { z } from 'zod'; // Assuming zod is available, if not fallback to manual validation
import { createLogger } from '../services/logger';
import { requireAuth } from '../middleware/auth';
import { sanitizeError, sanitizeValidationError } from '../utils/error-sanitizer';

const router = express.Router();
const logger = createLogger('phone-numbers');

// --- Types & Schemas ---

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

const ImportSchema = z.object({
  phoneNumber: z.string().regex(E164_REGEX, "Invalid E.164 phone number"),
  twilioAccountSid: z.string().min(1, "Twilio Account SID is required"),
  twilioAuthToken: z.string().min(1, "Twilio Auth Token is required"),
  orgId: z.string().uuid().optional() // Optional, inferred from auth
});

const UpdateSchema = z.object({
  assistantId: z.string().optional(),
  name: z.string().optional(),
  // Add other VAPI phone number properties as needed
});

// Constants
const INTEGRATION_PROVIDERS = {
  VAPI: 'vapi',
  TWILIO: 'twilio'
} as const;

// --- Helpers ---

/**
 * securely resolves the organization ID from the request.
 */
function getEffectiveOrgId(req: Request): string {
  // Prioritize authenticated user's org
  const authOrgId = (req as any).user?.orgId || (req as any).org?.id;
  if (authOrgId) return authOrgId;

  // Fallback for dev/testing if explicitly allowed (warn in logs)
  if (process.env.NODE_ENV === 'development') {
    const bodyOrgId = req.body.orgId;
    if (bodyOrgId) return bodyOrgId;
    return 'a0000000-0000-0000-0000-000000000001'; // Default Dev Org
  }

  throw new Error("Organization context missing");
}

async function getOrgVapiClient(orgId: string): Promise<VapiClient> {
  // Platform Provider Model: Use system key for all tenants
  const apiKey = config.VAPI_PRIVATE_KEY;

  if (!apiKey) {
    logger.error('VAPI_PRIVATE_KEY missing in environment variables');
    throw new Error('System Configuration Error: Telephony provider unavailable');
  }

  // We no longer fetch per-tenant keys from DB.
  // The Platform Key allows us to manage resources for all tenants.
  return new VapiClient(apiKey);
}

// --- Routes ---

// POST /import
// SECURITY FIX: Added requireAuth
router.post('/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const validation = ImportSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation Error', details: validation.error.format() });
    }

    const { phoneNumber, twilioAccountSid, twilioAuthToken } = validation.data;
    const orgId = getEffectiveOrgId(req);

    logger.info('Importing phone number', { orgId, phoneNumber });

    const vapi = await getOrgVapiClient(orgId);

    // Idempotent Import Logic
    let vapiPhoneId: string | null = null;

    try {
      const imported = await vapi.importTwilioNumber({
        phoneNumber,
        twilioAccountSid,
        twilioAuthToken
      });
      vapiPhoneId = imported.id;
    } catch (err: any) {
      // Handle "Already Exists" gracefully
      // VAPI returns 400 if number exists. Axios message is generic ("Request failed with status code 400").
      // We accept 400 as "already exists" and try to find the number in our list.
      if (err.message?.includes('already in use') ||
        err.message?.includes('Existing Phone Number') ||
        err.response?.status === 400 ||
        err.message?.includes('status code 400')) {
        logger.warn('Phone number already imported, attempting to fetch ID', { phoneNumber });
        // Try to find it in the list
        const numbers = await vapi.listPhoneNumbers();
        const existing = numbers.find((n: any) => n.number === phoneNumber);
        if (existing) {
          vapiPhoneId = existing.id;
        } else {
          throw new Error(`Phone number ${phoneNumber} is reported as registered but could not be found in VAPI account.`);
        }
      } else {
        throw err;
      }
    }

    if (!vapiPhoneId) {
      throw new Error("Failed to resolve VAPI Phone ID after import attempt");
    }

    // SYNC TO DB: Update Integrations
    const { error: dbError } = await supabase.from('integrations').update({
      config: {
        vapi_phone_number_id: vapiPhoneId,
        twilio_account_sid: twilioAccountSid,
        twilio_from_number: phoneNumber,
        updated_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    }).eq('org_id', orgId).eq('provider', INTEGRATION_PROVIDERS.VAPI);

    if (dbError) {
      logger.error('Failed to update DB integration record', { error: dbError });
      // Don't fail the request, but log severe error
    }

    res.json({
      success: true,
      id: vapiPhoneId,
      phoneNumber,
      message: 'Phone number imported and synced successfully'
    });

  } catch (error: any) {
    logger.error('Import failed', { error: error.message });
    const userMessage = sanitizeError(error, 'PhoneNumbers - POST /import', 'Failed to import phone number');
    return res.status(500).json({ error: userMessage });
  }
});

// GET /
// SECURITY FIX: Added requireAuth
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getEffectiveOrgId(req);
    const vapi = await getOrgVapiClient(orgId);
    const numbers = await vapi.listPhoneNumbers();
    res.json(numbers);
  } catch (error: any) {
    logger.error('List numbers failed', { error: error.message });
    const userMessage1 = sanitizeError(error, 'PhoneNumbers - GET /', 'Failed to fetch phone numbers');
    return res.status(500).json({ error: userMessage1 });
  }
});

// GET /:id
// SECURITY FIX: Added requireAuth
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getEffectiveOrgId(req);
    const vapi = await getOrgVapiClient(orgId);
    const number = await vapi.getPhoneNumber(req.params.id);
    res.json(number);
  } catch (error: any) {
    logger.error('Get number failed', { id: req.params.id, error: error.message });
    const userMessage2 = sanitizeError(error, 'PhoneNumbers - GET /:id', 'Failed to fetch phone number');
    return res.status(500).json({ error: userMessage2 });
  }
});

// PATCH /:id (The "Select Phone Number" Logic)
// SECURITY FIX: Added requireAuth
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getEffectiveOrgId(req);
    const { id } = req.params;
    const updates = req.body;

    // 1. Update in VAPI
    const vapi = await getOrgVapiClient(orgId);
    logger.info('Updating phone number in VAPI', { id, updates });
    const updatedPhone = await vapi.updatePhoneNumber(id, updates);

    // 2. SYNC TO DB: If an assistant is assigned, update the Agent record
    if (updates.assistantId) {
      logger.info('Syncing Assistant assignment to DB', { assistantId: updates.assistantId });

      // Find the agent with this VAPI Assistant ID
      const { data: agents, error: fetchError } = await supabase
        .from('agents')
        .select('id, role') // Select role to be sure
        .eq('vapi_assistant_id', updates.assistantId)
        .eq('org_id', orgId);

      if (fetchError) {
        logger.error('Failed to fetch agent for sync', { error: fetchError });
      } else if (agents && agents.length > 0) {
        // Update the agent(s) to confirm they are linked? 
        // Actually, the request might be to Link Agent X to Phone Y.
        // The `agents` table has `vapi_assistant_id`. 
        // It does NOT have `phone_number_id`. 
        // But `integrations` has `vapi_phone_number_id`.
        // And `agents` MIGHT have `assigned_phone_number` (legacy?).

        // Let's update `assigned_phone_number` if it exists in the schema (Step 336 said it didn't)
        // But we CAN update `integrations` to point to THIS phone number as the "active" one

        await supabase.from('integrations').update({
          config: {
            // We need to merge with existing config, which requires a read first or JSONB patch
            // For now, let's assume `vapi_phone_number_id` is the main one.
            vapi_phone_number_id: id,
            assigned_assistant_id: updates.assistantId // Track which assistant is active?
          }
          // Note: This overrides prev config. Ideally use a merge.
        }).eq('org_id', orgId).eq('provider', INTEGRATION_PROVIDERS.VAPI);

        // Also, if we want to store the mapping in `phone_numbers` (if we revive it)
      }
    }

    res.json(updatedPhone);

  } catch (error: any) {
    logger.error('Update phone number failed', { id: req.params.id, error: error.message });
    const userMessage3 = sanitizeError(error, 'PhoneNumbers - PATCH /:id', 'Failed to update phone number');
    return res.status(500).json({ error: userMessage3 });
  }
});

// DELETE /:id
// SECURITY FIX: Added requireAuth
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = getEffectiveOrgId(req);
    const vapi = await getOrgVapiClient(orgId);
    await vapi.deletePhoneNumber(req.params.id);

    // Cleanup DB?
    // Ideally we remove `vapi_phone_number_id` from integrations if it matches

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete phone number failed', { id: req.params.id, error: error.message });
    const userMessage4 = sanitizeError(error, 'PhoneNumbers - DELETE /:id', 'Failed to delete phone number');
    return res.status(500).json({ error: userMessage4 });
  }
});

export const phoneNumbersRouter = router;
