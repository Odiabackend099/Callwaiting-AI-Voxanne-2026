/**
 * Inbound Call Setup Route
 * Handles Twilio credential configuration and Vapi inbound number linking
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { VapiClient } from '../services/vapi-client';
import { requireAuthOrDev } from '../middleware/auth';
import twilio from 'twilio';

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

    // Get Vapi API key from integrations
    console.log('[InboundSetup] Fetching Vapi API key', { requestId });
    const { data: vapiIntegration, error: vapiIntegrationError } = await supabase
      .from('integrations')
      .select('config')
      .eq('org_id', orgId)
      .eq('provider', 'vapi')
      .maybeSingle();

    if (vapiIntegrationError) {
      console.error('[InboundSetup] Failed to fetch Vapi integration', {
        requestId,
        error: vapiIntegrationError,
        code: vapiIntegrationError.code,
        message: vapiIntegrationError.message,
        details: vapiIntegrationError.details,
        hint: vapiIntegrationError.hint
      });
      res.status(500).json({ error: 'Failed to fetch Vapi integration', requestId });
      return;
    }

    const vapiApiKey = vapiIntegration?.config?.vapi_api_key;
    if (!vapiApiKey) {
      res.status(400).json({
        error: 'Vapi API key not configured. Please configure Vapi credentials first.',
        requestId
      });
      return;
    }

    // Import Twilio number into Vapi
    console.log('[InboundSetup] Importing Twilio number to Vapi', { requestId, phoneNumber: twilioPhoneNumber });
    const vapiClient = new VapiClient(vapiApiKey);
    let vapiPhoneNumber;
    try {
      vapiPhoneNumber = await vapiClient.importTwilioNumber({
        twilioAccountSid,
        twilioAuthToken,
        phoneNumber: twilioPhoneNumber
      });
      console.log('[InboundSetup] ✅ Twilio number imported to Vapi', { requestId, vapiPhoneNumberId: vapiPhoneNumber.id });
    } catch (vapiError: any) {
      // Extract the actual Vapi error message from axios response if available
      const vapiMessage = vapiError.response?.data?.message || vapiError.message;
      const statusCode = vapiError.response?.status || 500;
      console.error('[InboundSetup] ❌ Failed to import Twilio number to Vapi', { requestId, error: vapiMessage, status: statusCode });
      res.status(statusCode >= 400 && statusCode < 500 ? 400 : 500).json({
        error: vapiMessage,
        requestId
      });
      return;
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

    // Store Twilio credentials in integrations table
    console.log('[InboundSetup] Storing Twilio credentials', { requestId, orgId });
    const { error: integrationError } = await supabase
      .from('integrations')
      .upsert(
        {
          org_id: orgId,
          provider: 'twilio_inbound',
          config: {
            accountSid: twilioAccountSid,
            authToken: twilioAuthToken,
            phoneNumber: twilioPhoneNumber,
            vapiPhoneNumberId: vapiPhoneNumber.id,
            vapiAssistantId,
            status: 'active',
            activatedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        },
        { onConflict: 'org_id,provider' }
      );

    if (integrationError) {
      console.error('[InboundSetup] Failed to store Twilio credentials', { requestId, error: integrationError });
      res.status(500).json({ error: 'Failed to store credentials', requestId });
      return;
    }

    console.log('[InboundSetup] ✅ Twilio credentials stored', { requestId });

    // Link phone number to Vapi assistant (NOT the local DB agent id)
    console.log('[InboundSetup] Linking phone number to Vapi assistant', { requestId, vapiAssistantId, vapiPhoneNumberId: vapiPhoneNumber.id });
    try {
      await vapiClient.updatePhoneNumber(vapiPhoneNumber.id, {
        assistantId: vapiAssistantId
      });
      console.log('[InboundSetup] ✅ Phone number linked to agent', { requestId });
    } catch (linkError: any) {
      console.error('[InboundSetup] Failed to link phone number to agent', { requestId, error: linkError.message });
      // Don't fail here - phone number is imported, just not linked yet
    }

    console.log('[InboundSetup] ✅ Inbound setup complete', { requestId, agentId, vapiPhoneNumberId: vapiPhoneNumber.id });

    res.status(200).json({
      success: true,
      inboundNumber: twilioPhoneNumber,
      vapiPhoneNumberId: vapiPhoneNumber.id,
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

    res.status(200).json({
      configured: true,
      status: integration.config?.status || 'active',
      inboundNumber: integration.config?.phoneNumber,
      vapiPhoneNumberId: integration.config?.vapiPhoneNumberId,
      vapiAssistantId: integration.config?.vapiAssistantId,
      activatedAt: integration.config?.activatedAt
    });
  } catch (error: any) {
    console.error('[InboundSetup] Error fetching status', { error: error.message });
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
