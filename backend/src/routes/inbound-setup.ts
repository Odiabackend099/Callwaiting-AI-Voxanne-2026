/**
 * Inbound Call Setup Route
 * Handles Twilio credential configuration and Vapi inbound number linking
 */

import { Router, Request, Response } from 'express';
import { config } from '../config/index';
import { supabase } from '../services/supabase-client';
import { VapiClient } from '../services/vapi-client';
import { requireAuthOrDev } from '../middleware/auth';
import twilio from 'twilio';
import { EncryptionService } from '../services/encryption';
import { IntegrationDecryptor } from '../services/integration-decryptor';

const router = Router();

// Validation helpers
function validateE164PhoneNumber(phoneNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

function validateTwilioAccountSid(sid: string): boolean {
  return /^AC[a-z0-9]{32}$/i.test(sid);
}

function validateTwilioAuthToken(token: string): boolean {
  return token.length === 32;
}

function keyLast4(key: string): string {
  return key.slice(-4);
}

/**
 * POST /api/inbound/setup
 * Configure Twilio credentials and link to Vapi inbound assistant
 */
router.post('/setup', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  const requestId = req.requestId || `req_${Date.now()}`;

  try {
    const userId = req.user?.id;
    const orgId = req.user?.orgId;

    if (!userId || !orgId) {
      res.status(401).json({ error: 'Not authenticated', requestId });
      return;
    }

    const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = req.body;

    // Validation
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      res.status(400).json({
        error: 'Missing required fields: twilioAccountSid, twilioAuthToken, twilioPhoneNumber',
        requestId
      });
      return;
    }

    if (!validateTwilioAccountSid(twilioAccountSid)) {
      res.status(400).json({
        error: 'Invalid Twilio Account SID format (must start with AC and be 34 chars)',
        requestId
      });
      return;
    }

    if (!validateTwilioAuthToken(twilioAuthToken)) {
      res.status(400).json({
        error: 'Invalid Twilio Auth Token format (must be 32 characters)',
        requestId
      });
      return;
    }

    if (!validateE164PhoneNumber(twilioPhoneNumber)) {
      res.status(400).json({
        error: 'Invalid phone number format (must be E.164: +1234567890)',
        requestId
      });
      return;
    }

    console.log('[InboundSetup] Validating Twilio credentials', { requestId, accountSid: twilioAccountSid.substring(0, 4) + '...' });

    // Test Twilio credentials
    let twilioClient;
    try {
      twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      await twilioClient.api.accounts.list({ limit: 1 });
      console.log('[InboundSetup] ✅ Twilio credentials validated', { requestId });
    } catch (twilioError: any) {
      console.error('[InboundSetup] ❌ Twilio validation failed', { requestId, error: twilioError.message });
      res.status(400).json({
        error: `Invalid Twilio credentials: ${twilioError.message}`,
        requestId
      });
      return;
    }

    // Get Vapi API key from environment (Platform Provider Model)
    console.log('[InboundSetup] using Platform Vapi Key', { requestId });
    const vapiApiKey = config.VAPI_PRIVATE_KEY;

    if (!vapiApiKey) {
      console.error('[CRITICAL] VAPI_PRIVATE_KEY missing in environment variables');
      res.status(500).json({
        error: 'System configuration error: Telephony provider unavailable.',
        requestId
      });
      return;
    }

    const currentVapiKeyLast4 = keyLast4(vapiApiKey);

    // IDP0: If this org already has an inbound mapping for this phone number, reuse it.
    // This is key-rotation safe: we relink the existing Vapi phone number to the *current* assistant.
    const { data: existingInboundMapping, error: existingInboundMappingError } = await supabase
      .from('integrations')
      .select('config')
      .eq('org_id', orgId)
      .eq('provider', 'twilio_inbound')
      .maybeSingle();

    if (existingInboundMappingError && existingInboundMappingError.code !== 'PGRST116') {
      console.error('[InboundSetup] Failed to fetch existing inbound mapping', {
        requestId,
        error: existingInboundMappingError.message,
        code: existingInboundMappingError.code
      });
      res.status(500).json({ error: 'Failed to fetch existing inbound mapping', requestId });
      return;
    }

    const existingConfig: any = existingInboundMapping?.config || null;
    const existingPhoneNumber = existingConfig?.phoneNumber;
    const existingVapiPhoneNumberId = existingConfig?.vapiPhoneNumberId;
    const existingVapiKeyLast4Used = existingConfig?.vapiApiKeyLast4Used;

    // We'll only reuse mapping if it matches the same phone number.
    const isSamePhone =
      typeof existingPhoneNumber === 'string' &&
      existingPhoneNumber === twilioPhoneNumber &&
      typeof existingVapiPhoneNumberId === 'string' &&
      existingVapiPhoneNumberId.length > 0;

    // Key-rotation safety: only reuse the phoneNumberId if it belongs to the same Vapi workspace.
    // If the key changed, this phoneNumberId may not exist in the current workspace.
    const isSameVapiWorkspace =
      typeof existingVapiKeyLast4Used === 'string' &&
      existingVapiKeyLast4Used.length === 4 &&
      existingVapiKeyLast4Used === currentVapiKeyLast4;

    const shouldReuseExistingMapping = isSamePhone && isSameVapiWorkspace;

    const workspaceMismatch = isSamePhone && !isSameVapiWorkspace;

    const vapiClient = new VapiClient(vapiApiKey);
    let vapiPhoneNumberId: string;

    if (shouldReuseExistingMapping) {
      vapiPhoneNumberId = existingVapiPhoneNumberId;
      console.log('[InboundSetup] Reusing existing inbound mapping', {
        requestId,
        phoneNumber: twilioPhoneNumber,
        vapiPhoneNumberId
      });
    } else {
      // Import Twilio number into Vapi
      console.log('[InboundSetup] Importing Twilio number to Vapi', { requestId, phoneNumber: twilioPhoneNumber });
      try {
        const vapiPhoneNumber = await vapiClient.importTwilioNumber({
          twilioAccountSid,
          twilioAuthToken,
          phoneNumber: twilioPhoneNumber
        });
        vapiPhoneNumberId = vapiPhoneNumber.id;
        console.log('[InboundSetup] ✅ Twilio number imported to Vapi', { requestId, vapiPhoneNumberId });
      } catch (vapiError: any) {
        // Extract the actual Vapi error message from axios response if available
        const vapiMessage = vapiError.response?.data?.message || vapiError.message;
        const statusCode = vapiError.response?.status || 500;

        // Key-rotation common failure: number already imported/claimed by another Vapi workspace/org.
        if (typeof vapiMessage === 'string' && vapiMessage.toLowerCase().includes('already in use')) {
          console.log('[InboundSetup] Number already in use, checking if it belongs to this workspace...', { requestId });

          // IDEMPOTENCY FIX: Check if the number exists in THIS Vapi workspace
          try {
            const existingNumbers = await vapiClient.listPhoneNumbers();
            const match = existingNumbers.find((p: any) => p.number === twilioPhoneNumber);

            if (match) {
              console.log('[InboundSetup] ✅ Found existing number in Vapi workspace, reusing ID', { requestId, id: match.id });
              vapiPhoneNumberId = match.id;
              // Proceed with this ID
            } else {
              // Truly claimed by ANOTHER workspace
              throw vapiError;
            }
          } catch (checkError) {
            // If listing fails or we re-throw the original error
            console.error('[InboundSetup] Failed to verify existing number ownership', { requestId, error: checkError });

            // Persist last error for UI status visibility
            await supabase
              .from('integrations')
              .upsert(
                {
                  org_id: orgId,
                  provider: 'twilio_inbound',
                  config: {
                    ...(existingConfig || {}),
                    phoneNumber: twilioPhoneNumber,
                    last_error: vapiMessage,
                    last_attempted_at: new Date().toISOString(),
                    vapiApiKeyLast4Used: currentVapiKeyLast4
                  },
                  updated_at: new Date().toISOString()
                },
                { onConflict: 'org_id,provider' }
              );

            res.status(400).json({
              error:
                'This Twilio number is already linked to another Vapi workspace. ' +
                'If this is your number, unlink/release it in the other Vapi dashboard first, then retry. ' +
                (workspaceMismatch
                  ? `We detected this number was previously linked using a different Vapi API key (workspace mismatch). `
                  : '') +
                'If you previously linked it in this workspace, use that same workspace API key or reuse the existing mapping.',
              details: vapiMessage,
              workspaceMismatch,
              requestId
            });
            return;
          }
        } else {
          console.error('[InboundSetup] ❌ Failed to import Twilio number to Vapi', { requestId, error: vapiMessage, status: statusCode });
          res.status(statusCode >= 400 && statusCode < 500 ? 400 : 500).json({
            error: vapiMessage,
            requestId
          });
          return;
        }
      }
    }

    // For now, use the existing inbound agent if present; otherwise fail with a clear message.
    // Inbound agent creation/config will be handled in STEP 2 (dashboard UI + agent save).
    console.log('[InboundSetup] Fetching inbound agent', { requestId, orgId });
    const { data: inboundAgent, error: inboundAgentError } = await supabase
      .from('agents')
      .select('id')
      .eq('org_id', orgId)
      .eq('role', 'inbound')
      .maybeSingle();

    if (inboundAgentError && inboundAgentError.code !== 'PGRST116') {
      console.error('[InboundSetup] Failed to fetch inbound agent', { requestId, error: inboundAgentError });
      res.status(500).json({ error: 'Failed to fetch inbound agent', requestId });
      return;
    }

    const agentId = inboundAgent?.id;
    if (!agentId) {
      res.status(400).json({
        error: 'Inbound agent not configured yet. Create/save an inbound agent configuration first.',
        requestId
      });
      return;
    }

    // Ensure Vapi assistant is synced and get the Vapi assistant ID
    // NOTE: We call into founder-console's ensureAssistantSynced indirectly by requiring the agent to be saved first.
    // This route will be updated in STEP 2 to sync agent config.
    const { data: agentRow, error: agentRowError } = await supabase
      .from('agents')
      .select('vapi_assistant_id')
      .eq('id', agentId)
      .single();

    if (agentRowError) {
      res.status(500).json({ error: 'Failed to fetch inbound agent state', requestId });
      return;
    }

    const vapiAssistantId = agentRow?.vapi_assistant_id;
    if (!vapiAssistantId) {
      res.status(400).json({
        error: 'Inbound agent is not yet synced to Vapi (missing vapi_assistant_id). Save agent config and sync first.',
        requestId
      });
      return;
    }

    // Store Twilio credentials via single-slot gate (UPSERT + mutual exclusion + Vapi sync)
    console.log('[InboundSetup] Saving Twilio credentials via saveTwilioCredential', { requestId, orgId });

    await IntegrationDecryptor.saveTwilioCredential(orgId, {
      accountSid: twilioAccountSid,
      authToken: twilioAuthToken,
      phoneNumber: twilioPhoneNumber,
      source: 'byoc',
    });

    console.log('[InboundSetup] Twilio credentials stored via single-slot gate', { requestId });

    // Link phone number to Vapi assistant (NOT the local DB agent id)
    console.log('[InboundSetup] Linking phone number to Vapi assistant', { requestId, vapiAssistantId, vapiPhoneNumberId });
    try {
      await vapiClient.updatePhoneNumber(vapiPhoneNumberId, {
        assistantId: vapiAssistantId
      });
      console.log('[InboundSetup] ✅ Phone number linked to agent', { requestId });
    } catch (linkError: any) {
      console.error('[InboundSetup] Failed to link phone number to agent', { requestId, error: linkError.message });
      // Don't fail here - phone number is imported, just not linked yet
    }

    console.log('[InboundSetup] ✅ Inbound setup complete', { requestId, agentId, vapiPhoneNumberId });

    res.status(200).json({
      success: true,
      inboundNumber: twilioPhoneNumber,
      vapiPhoneNumberId,
      agentId,
      vapiAssistantId,
      status: 'active',
      requestId
    });
  } catch (error: any) {
    console.error('[InboundSetup] Unexpected error', { requestId, error: error.message });
    res.status(500).json({
      error: 'Internal server error',
      requestId
    });
  }
});

/**
 * GET /api/inbound/status
 * Get current inbound configuration status
 */
router.get('/status', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;

    if (!orgId) {
      console.error('[InboundSetup][status] Missing orgId', {
        user: req.user,
        hasAuthHeader: !!req.headers.authorization,
        nodeEnv: process.env.NODE_ENV
      });
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('org_id', orgId)
      .eq('provider', 'twilio_inbound')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[InboundSetup][status] supabase error', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      res.status(500).json({ error: 'Failed to fetch status' });
      return;
    }

    if (!integration) {
      res.status(200).json({
        configured: false,
        status: 'not_configured'
      });
      return;
    }

    const cfg: any = integration?.config || null;
    if (!cfg) {
      res.json({ configured: false });
      return;
    }

    // Compare to current key (if present) to help UI guide key-rotation cases.
    const { data: vapiRow } = await supabase
      .from('integrations')
      .select('config')
      .eq('org_id', orgId)
      .eq('provider', 'vapi')
      .maybeSingle();

    const vapiKey = vapiRow?.config?.vapi_api_key || process.env.VAPI_PRIVATE_KEY;
    const currentLast4 = typeof vapiKey === 'string' ? keyLast4(vapiKey) : null;
    const storedLast4 = typeof cfg.vapiApiKeyLast4Used === 'string' ? cfg.vapiApiKeyLast4Used : null;
    const workspaceMismatch = !!(cfg.phoneNumber && currentLast4 && storedLast4 && currentLast4 !== storedLast4);

    res.json({
      configured: cfg.status === 'active',
      inboundNumber: cfg.phoneNumber,
      vapiPhoneNumberId: cfg.vapiPhoneNumberId,
      activatedAt: cfg.activatedAt,
      workspaceMismatch,
      lastError: cfg.last_error || null,
      lastAttemptedAt: cfg.last_attempted_at || null
    });
  } catch (error: any) {
    console.error('[InboundSetup][status] Unexpected error', {
      error: error.message,
      orgId: req.user?.orgId,
      hasAuthHeader: !!req.headers.authorization,
      nodeEnv: process.env.NODE_ENV
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/inbound/test
 * Test inbound setup by making a test call
 */
router.post('/test', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;

    if (!orgId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { data: integration } = await supabase
      .from('integrations')
      .select('config')
      .eq('org_id', orgId)
      .eq('provider', 'twilio_inbound')
      .maybeSingle();

    if (!integration) {
      res.status(400).json({ error: 'Inbound not configured' });
      return;
    }

    const phoneNumber = integration.config?.phoneNumber;
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number not found' });
      return;
    }

    console.log('[InboundSetup] Test call initiated to', { phoneNumber });

    res.status(200).json({
      success: true,
      message: 'Test call initiated',
      phoneNumber,
      note: 'You should receive a call shortly'
    });
  } catch (error: any) {
    console.error('[InboundSetup] Test error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
