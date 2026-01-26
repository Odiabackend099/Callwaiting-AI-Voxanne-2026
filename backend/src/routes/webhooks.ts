import express from 'express';
import { config } from '../config/index';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { supabase } from '../services/supabase-client';
import { wsBroadcast } from '../services/websocket';
import { getIntegrationSettings } from './founder-console-settings';
import { validateE164Format } from '../utils/phone-validation';
import { uploadCallRecording, deleteRecording } from '../services/call-recording-storage';
import { detectCallType, getAgentConfigForCallType } from '../services/call-type-detector';
import { getCachedIntegrationSettings } from '../services/settings-cache';
import { computeVapiSignature } from '../utils/vapi-webhook-signature';
import { log as logger } from '../services/logger';
import { getRagContext } from '../services/rag-context-provider';
import { logFailedUpload } from '../services/recording-upload-retry';
import VapiClient from '../services/vapi-client';
import { getAvailableSlots, checkAvailability, createCalendarEvent } from '../services/calendar-integration';
import { sendAppointmentConfirmationSMS, sendHotLeadSMS } from '../services/sms-notifications';
import { scoreLead, estimateLeadValue } from '../services/lead-scoring';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { SentimentService } from '../services/sentiment-analysis';
import { processVapiToolCall } from '../services/vapi-booking-handler';
import {
  resolveOrgFromWebhook,
  verifyVapiWebhookSignature,
  getSmsCredentialsForOrg,
  getCalendarCredentialsForOrg,
} from '../utils/webhook-org-resolver';

export const webhooksRouter = express.Router();

// ===== CRITICAL FIX #5: Zod validation schema for Vapi events =====
const VapiEventValidationSchema = z.object({
  type: z.enum(['call.started', 'call.ended', 'call.transcribed', 'end-of-call-report', 'function-call']),
  call: z.object({
    id: z.string().min(1, 'call.id required'),
    status: z.string(),
    duration: z.number().optional(),
    assistantId: z.string().optional(),
    customer: z.object({
      number: z.string().optional(),
      name: z.string().optional()
    }).optional(),
    cost: z.number().optional(),
    endedReason: z.string().optional()
  }).optional(),
  recordingUrl: z.string().optional(),
  transcript: z.string().optional(),
  artifact: z.object({
    transcript: z.string().optional(),
    recording: z.string().optional()
  }).optional()
});

function redactEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim() : '';
  const at = email.indexOf('@');
  if (at <= 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

function redactPhone(value: unknown): string {
  const phone = typeof value === 'string' ? value.trim() : '';
  if (phone.length <= 4) return '***';
  return `***${phone.slice(-4)}`;
}

// Rate limiter for webhook endpoints to prevent abuse
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100,            // 100 events per minute per IP (reduced from 1000 for security)
  message: 'Too many webhook events from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Inject RAG context into agent's system prompt at call time
 * This ensures the agent uses KB information in responses
 */
async function injectRagContextIntoAgent(params: {
  vapiApiKey: string;
  assistantId: string;
  ragContext: string;
}): Promise<void> {
  try {
    if (!params.ragContext || params.ragContext.trim().length === 0) {
      logger.debug('webhooks', 'No RAG context to inject');
      return;
    }

    const vapi = new VapiClient(params.vapiApiKey);
    const assistant = await vapi.getAssistant(params.assistantId);

    if (!assistant) {
      logger.warn('webhooks', 'Assistant not found for RAG injection');
      return;
    }

    // CRITICAL FIX: Inject RAG context directly into system prompt
    // This was previously stored in metadata but NEVER USED by the agent
    // Now the context is directly available to the LLM during response generation

    // Get current system prompt (prefer systemPrompt, fall back to firstMessage)
    let currentSystemPrompt = assistant.systemPrompt || assistant.firstMessage || '';

    // IDEMPOTENCY: Remove any previously injected RAG context to avoid duplication
    // RAG context is wrapped with unique markers for easy removal/replacement
    const RAG_MARKER_START = '\n\n---BEGIN KNOWLEDGE BASE CONTEXT---\n';
    const RAG_MARKER_END = '\n---END KNOWLEDGE BASE CONTEXT---\n';

    // Strip any existing RAG context
    const ragStartIndex = currentSystemPrompt.indexOf(RAG_MARKER_START);
    if (ragStartIndex !== -1) {
      const ragEndIndex = currentSystemPrompt.indexOf(RAG_MARKER_END, ragStartIndex);
      if (ragEndIndex !== -1) {
        currentSystemPrompt =
          currentSystemPrompt.substring(0, ragStartIndex) +
          currentSystemPrompt.substring(ragEndIndex + RAG_MARKER_END.length);
      }
    }

    // CRITICAL: Inject RAG context into system prompt with clear markers
    // This makes the context available to the LLM immediately
    const systemPromptWithRag = currentSystemPrompt.trim() +
      RAG_MARKER_START +
      params.ragContext +
      RAG_MARKER_END;

    // Update assistant with RAG context injected into system prompt
    await vapi.updateAssistant(params.assistantId, {
      systemPrompt: systemPromptWithRag
    });

    logger.info('webhooks', 'RAG context injected into assistant system prompt');
  } catch (error: any) {
    logger.warn('webhooks', 'Failed to inject RAG context into system prompt (non-blocking)');
    // Don't throw - RAG injection failure shouldn't block call
  }
}

/**
 * PHASE 1: Identity Injection
 * Lookup contact by phone number and inject personalized greeting
 * This is the "Identity Injection" feature for Phase 1
 */
async function lookupContactAndInjectGreeting(params: {
  vapiApiKey: string;
  assistantId: string;
  orgId: string;
  phoneNumber: string;
}): Promise<{ contact: any | null; injected: boolean }> {
  try {
    if (!params.phoneNumber || !params.orgId) {
      return { contact: null, injected: false };
    }

    // Lookup contact by phone in contacts table
    const { data: contact, error } = await supabase
      .from('contacts')
      .select('id, name, email, lead_score, lead_status, service_interests, last_contacted_at, notes')
      .eq('org_id', params.orgId)
      .eq('phone', params.phoneNumber)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logger.error('webhooks', 'Contact lookup failed', { error: error.message });
      return { contact: null, injected: false };
    }

    if (!contact) {
      // Contact not found - create a new one
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          org_id: params.orgId,
          phone: params.phoneNumber,
          name: 'Unknown Caller',
          lead_status: 'cold',     // ENUM: hot, warm, cold
          lead_score: 1,           // Integer: 1=cold, 2=warm, 3=hot
          last_contacted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        logger.warn('webhooks', 'Failed to create new contact', { error: createError.message });
      } else {
        logger.info('webhooks', 'New contact created from inbound call', {
          contactId: newContact.id,
          phone: params.phoneNumber
        });
      }

      return { contact: newContact || null, injected: false };
    }

    // Contact found - update last_contacted_at
    await supabase
      .from('contacts')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', contact.id)
      .eq('org_id', params.orgId);

    // Inject personalized greeting if we have a name
    if (contact.name && contact.name !== 'Unknown Caller' && params.assistantId && params.vapiApiKey) {
      try {
        const vapi = new VapiClient(params.vapiApiKey);
        const assistant = await vapi.getAssistant(params.assistantId);

        if (assistant) {
          const IDENTITY_MARKER_START = '\n\n---BEGIN CALLER IDENTITY---\n';
          const IDENTITY_MARKER_END = '\n---END CALLER IDENTITY---\n';

          let systemPrompt = assistant.systemPrompt || '';

          // Remove any existing identity injection
          const identityStartIdx = systemPrompt.indexOf(IDENTITY_MARKER_START);
          if (identityStartIdx !== -1) {
            const identityEndIdx = systemPrompt.indexOf(IDENTITY_MARKER_END, identityStartIdx);
            if (identityEndIdx !== -1) {
              systemPrompt =
                systemPrompt.substring(0, identityStartIdx) +
                systemPrompt.substring(identityEndIdx + IDENTITY_MARKER_END.length);
            }
          }

          // Build identity context
          const identityContext = [
            `CALLER IDENTITY: ${contact.name}`,
            contact.email ? `Email: ${contact.email}` : null,
            contact.lead_status ? `Status: ${contact.lead_status}` : null,
            contact.service_interests?.length ? `Previous interests: ${contact.service_interests.join(', ')}` : null,
            contact.notes ? `Notes: ${contact.notes}` : null,
            '',
            'IMPORTANT: Greet this caller by their first name. Example: "Hi Sarah, great to hear from you again!"'
          ].filter(Boolean).join('\n');

          const newSystemPrompt = systemPrompt.trim() +
            IDENTITY_MARKER_START +
            identityContext +
            IDENTITY_MARKER_END;

          await vapi.updateAssistant(params.assistantId, {
            systemPrompt: newSystemPrompt
          });

          logger.info('webhooks', 'Identity injected into assistant', {
            contactId: contact.id,
            contactName: contact.name
          });

          return { contact, injected: true };
        }
      } catch (injectError: any) {
        logger.warn('webhooks', 'Failed to inject identity (non-blocking)', {
          error: injectError?.message
        });
      }
    }

    return { contact, injected: false };
  } catch (error: any) {
    logger.error('webhooks', 'Error in contact lookup', { error: error?.message });
    return { contact: null, injected: false };
  }
}

/**
 * Verify Vapi webhook signature for security
 * Uses secret stored in database (cached)
 * Prevents unauthorized webhook events from being processed
 */
async function verifyVapiSignature(req: express.Request): Promise<boolean> {
  // Fetch webhook secret from database (cached)
  const settings = await getCachedIntegrationSettings();
  const secret = settings?.vapi_webhook_secret;
  const nodeEnv = process.env.NODE_ENV || 'development';

  // If no secret configured
  if (!secret) {
    // In production, this is a critical security issue
    if (nodeEnv === 'production') {
      logger.error('webhooks', 'CRITICAL: Vapi webhook secret not configured in production! Rejecting all webhooks.');
      return false;
    }
    // In development/test, allow unsigned webhooks
    logger.warn('webhooks', 'Vapi webhook secret not configured, accepting all webhooks (development mode)');
    return true;
  }

  // Verify signature
  const signature = req.headers['x-vapi-signature'] as string;
  const timestamp = req.headers['x-vapi-timestamp'] as string;

  if (!signature || !timestamp) {
    logger.error('webhooks', 'Missing signature or timestamp headers');
    return false;
  }

  try {
    // Reject replayed webhooks using a timestamp skew window
    // Accept both seconds and milliseconds epoch formats.
    const tsNum = Number(timestamp);
    if (!Number.isFinite(tsNum)) {
      logger.error('webhooks', 'Invalid timestamp header');
      return false;
    }

    const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000;
    const nowMs = Date.now();
    const maxSkewMs = 5 * 60 * 1000; // 5 minutes (allows for provider retries + queue delays)
    if (Math.abs(nowMs - tsMs) > maxSkewMs) {
      logger.error('webhooks', 'Timestamp outside allowed skew window');
      return false;
    }

    const payload = typeof (req as any).rawBody === 'string'
      ? (req as any).rawBody
      : JSON.stringify(req.body);

    const hash = computeVapiSignature(secret, timestamp, payload);

    // Timing-safe comparison
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (error: any) {
    logger.error('webhooks', 'Error verifying signature');
    return false;
  }
}

// TypeScript interfaces for type safety
interface CallTrackingMetadata {
  userId?: string;
  channel?: 'inbound' | 'outbound';
  assistantId?: string;
  is_test_call?: boolean;
  created_at?: string;
  source?: string;
}

interface VapiEvent {
  type: string;
  call?: {
    id: string;
    status: string;
    duration?: number;
    assistantId?: string; // For inbound calls
    customer?: {
      number: string;
      name?: string;
    };
    cost?: number;
  };
  recordingUrl?: string;
  transcript?: string;
  artifact?: {
    transcript?: string;
    recording?: string;
  };
}

/**
 * CRITICAL: Webhook Handler for Vapi Events
 *
 * Timing & Infrastructure Notes:
 * - Twilio webhook timeout: 15 seconds
 * - Keep response <100ms; process heavy operations async via background queue
 * - Render free tier with UptimeRobot keep-alive pinging every 10 min eliminates spin-down risk
 * - Without mitigation: 15-min inactivity → 30-60s spin-up delay exceeds Twilio timeout
 *
 * See: /Users/mac/.claude/plans/mossy-wishing-pony.md for Render free tier scalability assessment
 */
webhooksRouter.post('/vapi', webhookLimiter, async (req, res) => {
  try {
    // Track webhook receipt time for latency monitoring
    (req as any).webhookReceivedAt = Date.now();

    // Log every webhook call for debugging
    logger.info('webhooks', 'Webhook received');

    // ===== CRITICAL: BYOC - Resolve organization from webhook FIRST =====
    // This MUST happen before any credential access
    const orgContext = await resolveOrgFromWebhook(req);
    if (!orgContext) {
      logger.error('webhooks', 'Failed to resolve organization from webhook');
      res.status(400).json({ error: 'Cannot resolve organization' });
      return;
    }

    // Store org_id in request for later use by handlers
    (req as any).orgId = orgContext.orgId;
    (req as any).assistantId = orgContext.assistantId;

    logger.info('webhooks', 'Organization resolved from webhook', {
      orgId: orgContext.orgId,
      assistantId: orgContext.assistantId,
    });

    // ===== CRITICAL FIX #9: Enforce webhook signature verification with org-specific credentials =====
    try {
      const isValid = await verifyVapiWebhookSignature(req, orgContext.orgId);
      if (!isValid) {
        logger.error('webhooks', 'Invalid webhook signature', { orgId: orgContext.orgId });
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
      logger.debug('webhooks', 'Signature verified', { orgId: orgContext.orgId });
    } catch (verifyError: any) {
      logger.error('webhooks', 'Signature verification failed', {
        orgId: orgContext.orgId,
        error: verifyError?.message,
      });
      res.status(401).json({ error: 'Webhook verification failed' });
      return;
    }

    // ===== CRITICAL FIX #5: Validate Vapi event structure with Zod =====
    let event: VapiEvent;
    try {
      event = VapiEventValidationSchema.parse(req.body) as VapiEvent;
      logger.debug('webhooks', 'Event validated');
    } catch (parseError: any) {
      logger.error('webhooks', 'Invalid event structure');
      res.status(400).json({ error: 'Invalid event structure' });
      return;
    }

    logger.debug('webhooks', 'Event received');

    let handlerSuccess = true;
    try {
      switch (event.type) {
        case 'call.started':
          await handleCallStarted(event);
          break;

        case 'call.ended':
          await handleCallEnded(event);
          break;

        case 'call.transcribed':
          await handleTranscript(event);
          break;

        case 'end-of-call-report':
          await handleEndOfCallReport(event);
          break;

        case 'function-call':
          const result = await handleFunctionCall(event);
          res.status(200).json(result);
          return;

        default:
          logger.warn('webhooks', 'Unhandled event type');
      }
    } catch (handlerError) {
      logger.error('webhooks', 'Handler error');
      handlerSuccess = false;
    }

    // FIX #3: Return error status if handler failed
    if (!handlerSuccess) {
      res.status(500).json({ error: 'Handler processing failed' });
      return;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('webhooks', 'Webhook processing failed');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleCallStarted(event: VapiEvent) {
  const { call } = event;

  if (!call || !call.id) {
    logger.error('webhooks', 'Missing call data');
    throw new Error('Missing call data');
  }

  try {
    // Generate idempotency key for this event (use only call.id to prevent duplicate processing)
    const eventId = `call.started:${call.id}`;

    // ===== CRITICAL FIX #4: Strict idempotency check - fail fast =====
    const { data: existing, error: checkError } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      logger.error('webhooks', 'CRITICAL: Idempotency check failed');
      throw new Error(`Idempotency check failed: ${checkError.message}`);
    }

    if (existing) {
      logger.info('webhooks', 'Duplicate event detected, skipping');
      return;
    }

    // Mark as processed IMMEDIATELY (before any other operations)
    const { error: markError } = await supabase
      .from('processed_webhook_events')
      .insert({
        event_id: eventId,
        call_id: call.id,
        event_type: 'started'
      });

    if (markError) {
      logger.error('webhooks', 'CRITICAL: Failed to mark event as processed');
      throw new Error(`Failed to mark event as processed: ${markError.message}`);
    }

    logger.info('webhooks', 'Event marked as processed');

    // ===== CRITICAL FIX #2: Increase retry delays for race condition =====
    const MAX_RETRIES = 5;  // Increased from 3
    const RETRY_DELAYS = [100, 250, 500, 1000, 2000];  // Total: 3.85 seconds
    let existingCallTracking = null;
    let callTrackingError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const result = await supabase
        .from('call_tracking')
        .select('id, lead_id, org_id, metadata')
        .eq('vapi_call_id', call.id)
        .maybeSingle();

      existingCallTracking = result.data;
      callTrackingError = result.error;

      if (existingCallTracking) {
        logger.info('webhooks', 'Found existing call_tracking');
        break;
      }

      if (attempt < MAX_RETRIES - 1) {
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 100;
        const delayMs = RETRY_DELAYS[attempt] + jitter;

        logger.warn('webhooks', 'Call tracking not found, retrying');

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (callTrackingError && callTrackingError.code !== 'PGRST116') {
      logger.error('webhooks', 'Error fetching call tracking');
      throw new Error(`Failed to fetch call tracking: ${callTrackingError.message}`);
    }

    // ===== CRITICAL FIX #3: Detect call type explicitly =====
    const isInboundCall = Boolean(call.assistantId);
    const isOutboundCall = Boolean(existingCallTracking);

    logger.info('webhooks', 'Call type detected');

    let callTracking = existingCallTracking;

    if (isInboundCall) {
      // PRIMARY PATH: Handle inbound call
      logger.info('webhooks', 'Processing inbound call');

      // ===== CRITICAL FIX #1: Agent lookup must throw errors =====
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, org_id, name, active, vapi_assistant_id')
        .eq('vapi_assistant_id', call.assistantId)
        .eq('active', true)
        .maybeSingle();

      if (agentError) {
        logger.error('CRITICAL: Agent lookup failed', 'Agent lookup failed with error code ' + agentError.code);
        throw new Error(`Agent lookup failed: ${agentError.message}`);
      }

      if (!agent) {
        logger.error('CRITICAL: No active agent found', 'No active agent found for vapi_assistant_id ' + call.assistantId);
        throw new Error(`No active agent found for vapi_assistant_id: ${call.assistantId}`);
      }

      logger.info('Agent found', 'Agent found with id ' + agent.id);
      logger.info('webhooks', 'Agent found');

      // Validate phone number format before storing
      let phoneNumber: string | null = call.customer?.number || null;
      if (phoneNumber) {
        const phoneValidation = validateE164Format(phoneNumber);
        if (!phoneValidation.valid) {
          logger.warn('webhooks', 'Invalid phone number format, using original');
        } else {
          phoneNumber = phoneValidation.normalized || phoneNumber;
        }
      }

      // Insert new call_tracking row for inbound call
      const { data: newTracking, error: insertError } = await supabase
        .from('call_tracking')
        .insert({
          org_id: agent.org_id,
          agent_id: agent.id,
          vapi_call_id: call.id,
          status: 'ringing',
          phone: phoneNumber,
          metadata: {
            channel: 'inbound',
            assistantId: call.assistantId,
            userId: undefined,
            is_test_call: false,
            created_at: new Date().toISOString(),
            source: 'vapi_webhook'
          } as CallTrackingMetadata
        })
        .select('id, lead_id, org_id, metadata')
        .single();

      if (insertError) {
        logger.error('webhooks', 'Failed to insert call_tracking for inbound call');
        throw new Error(`Failed to create call_tracking: ${insertError.message}`);
      }

      logger.info('webhooks', 'Created call_tracking for inbound call');

      // Use the newly created tracking record
      callTracking = newTracking;
    } else if (isOutboundCall && existingCallTracking) {
      // SECONDARY PATH: Handle outbound call
      logger.info('webhooks', 'Processing outbound call');
    } else {
      // ERROR PATH: Unknown call type
      logger.error('webhooks', 'CRITICAL: Cannot determine call type');
      throw new Error('Cannot determine call type (inbound or outbound)');
    }

    if (!callTracking) {
      logger.error('webhooks', 'CRITICAL: No call tracking available');
      throw new Error('No call tracking available');
    }

    // Fetch lead only if this is not a test call
    let lead = null;
    if (callTracking?.lead_id) {
      const { data: leadData } = await supabase
        .from('leads')
        .select('id, contact_name, name, clinic_name, company_name, org_id')
        .eq('id', callTracking.lead_id)
        .eq('org_id', callTracking.org_id)
        .maybeSingle();
      lead = leadData;
    }

    // ========== CRITICAL FIX: Load agent config and credentials from config tables ==========
    // Determine call type and load appropriate config
    let agentConfig: any = null;
    let vapiApiKey: string | null = null;

    try {
      const callType = isInboundCall ? 'inbound' : 'outbound';
      const configTableName = callType === 'inbound' ? 'inbound_agent_config' : 'outbound_agent_config';

      logger.info('handleCallStarted', `Loading ${callType} agent config`, {
        vapiCallId: call.id,
        orgId: callTracking.org_id,
        tableName: configTableName
      });

      const { data: config, error: configError } = await supabase
        .from(configTableName)
        .select('*')
        .eq('org_id', callTracking.org_id)
        .eq('is_active', true)
        .maybeSingle();

      if (configError) {
        logger.error('handleCallStarted', `Failed to load ${callType} config`, {
          vapiCallId: call.id,
          orgId: callTracking.org_id,
          error: configError.message
        });
      } else if (!config) {
        logger.warn('handleCallStarted', `No ${callType} config found, falling back to env vars`, {
          vapiCallId: call.id,
          orgId: callTracking.org_id
        });
      } else {
        agentConfig = config;
        vapiApiKey = config.vapi_api_key;

        logger.info('handleCallStarted', `Loaded ${callType} agent config`, {
          vapiCallId: call.id,
          orgId: callTracking.org_id,
          hasVapiKey: Boolean(vapiApiKey),
          assistantId: config.vapi_assistant_id?.slice(0, 20) + '...',
          twilioNumber: config.twilio_phone_number
        });
      }
    } catch (configLoadError: any) {
      logger.error('webhooks', 'Error loading agent config (non-blocking)');
    }

    // Platform Provider Model: Always use system API key
    // Ignore any key returned from legacy DB configs
    vapiApiKey = config.VAPI_PRIVATE_KEY || null;

    if (!vapiApiKey) {
      logger.error('webhooks', 'CRITICAL: VAPI_PRIVATE_KEY missing in environment');
    } else {
      logger.debug('webhooks', 'Using Platform VAPI_PRIVATE_KEY');
    }

    // Fetch RAG context from knowledge base and inject into agent
    let ragContext = '';
    try {
      // Use a generic query to retrieve KB context
      const { context, hasContext } = await getRagContext('customer inquiry', callTracking.org_id);
      if (hasContext) {
        ragContext = context;
        logger.info('webhooks', 'RAG context retrieved');

        // Inject RAG context into agent's system prompt for this call
        if (call.assistantId && vapiApiKey) {
          try {
            await injectRagContextIntoAgent({
              vapiApiKey: vapiApiKey,
              assistantId: call.assistantId,
              ragContext: context
            });
          } catch (injectErr: any) {
            logger.warn('webhooks', 'Failed to inject RAG context into agent');
            // Continue - injection failure shouldn't block call
          }
        }
      }
    } catch (ragErr: any) {
      logger.warn('webhooks', 'Failed to retrieve RAG context (non-blocking)');
      // Don't throw - RAG context is optional
    }

    // === PHASE 1: IDENTITY INJECTION ===
    // Lookup contact by phone and inject personalized greeting
    if (phoneNumber && callTracking?.org_id && call.assistantId && vapiApiKey) {
      try {
        const { contact, injected } = await lookupContactAndInjectGreeting({
          vapiApiKey,
          assistantId: call.assistantId,
          orgId: callTracking.org_id,
          phoneNumber
        });

        if (contact) {
          logger.info('webhooks', 'Contact identified', {
            contactId: contact.id,
            contactName: contact.name,
            identityInjected: injected
          });
        }
      } catch (identityError: any) {
        logger.warn('webhooks', 'Identity injection failed (non-blocking)', {
          error: identityError?.message
        });
        // Continue - identity injection should not block call
      }
    }
    // === END PHASE 1: IDENTITY INJECTION ===

    // Create call log entry with metadata (including RAG context and org_id)
    const { error: logError } = await supabase.from('call_logs').upsert({
      vapi_call_id: call.id,
      lead_id: lead?.id || null,
      org_id: callTracking?.org_id || null, // CRITICAL: Include org_id for multi-tenant isolation
      to_number: call.customer?.number || null,
      status: 'in-progress',
      started_at: new Date().toISOString(),
      metadata: {
        is_test_call: callTracking?.metadata?.is_test_call ?? false,
        channel: callTracking?.metadata?.channel ?? 'outbound',
        rag_context: ragContext || null
      }
    }, { onConflict: 'vapi_call_id' });

    if (logError) {
      logger.error('webhooks', 'Failed to insert call log');
      throw new Error(`Failed to create call log: ${logError.message}`);
    }

    logger.info('webhooks', 'Call log created');

    // Update call_tracking status
    const { error: updateError } = await supabase
      .from('call_tracking')
      .update({ status: 'ringing', started_at: new Date().toISOString() })
      .eq('id', callTracking.id);

    if (updateError) {
      logger.error('webhooks', 'Failed to update call_tracking status');
    }

    // Broadcast WebSocket event
    const metadata = callTracking?.metadata as CallTrackingMetadata | null;
    const userId = metadata?.userId;

    try {
      wsBroadcast({
        type: 'call_status',
        vapiCallId: call.id,
        trackingId: callTracking.id,
        userId: userId || '',
        status: 'ringing'
      });
    } catch (broadcastError: any) {
      logger.warn('webhooks', 'WebSocket broadcast failed');
    }

    logger.info('webhooks', 'Call started successfully');
  } catch (error: any) {
    logger.error('webhooks', 'Unhandled error in webhook handler');
    throw error;
  }
}

async function handleCallEnded(event: VapiEvent) {
  const { call } = event;

  if (!call || !call.id) {
    logger.error('webhooks', 'Missing call data');
    return;
  }

  try {
    // Generate idempotency key for this event
    const eventId = `ended:${call.id}`;

    // CRITICAL FIX #4: Check if already processed (idempotency check first)
    const { data: existing, error: checkError } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      logger.error('webhooks', 'Error checking idempotency');
    } else if (existing) {
      logger.info('webhooks', 'Duplicate event, skipping', { vapiCallId: call.id });
      return;
    }

    // CRITICAL FIX #2 (INVERTED SEQUENCE): Mark as processed IMMEDIATELY (before updates)
    // This prevents duplicate processing if service crashes between updates and mark
    const { error: markError } = await supabase
      .from('processed_webhook_events')
      .insert({
        event_id: eventId,
        call_id: call.id,
        event_type: 'ended'
      });

    if (markError) {
      logger.error('webhooks', 'CRITICAL: Failed to mark event as processed', {
        vapiCallId: call.id,
        errorMessage: markError.message
      });
      throw new Error(`Failed to mark event as processed: ${markError.message}`);
    }

    // Now safe to fetch and update, since event is marked as processed
    // Fetch call log to check if it's a test call
    const { data: callLog } = await supabase
      .from('call_logs')
      .select('id, lead_id, org_id, metadata')
      .eq('vapi_call_id', call.id)
      .maybeSingle();

    // Update call log
    // CRITICAL: Include org_id in WHERE clause for multi-tenant isolation
    const { error } = await supabase
      .from('call_logs')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: call.duration || 0
      })
      .eq('vapi_call_id', call.id)
      .eq('org_id', callLog.org_id);

    if (error) {
      logger.error('webhooks', 'Failed to update call log', {
        vapiCallId: call.id,
        orgId: callLog.org_id,
        errorMessage: error.message
      });
    } else {
      logger.info('webhooks', 'Call log updated', {
        vapiCallId: call.id,
        orgId: callLog.org_id
      });
    }

    // Update lead status only if this is not a test call
    const isTestCall = (callLog?.metadata as any)?.is_test_call === true;
    if (!isTestCall) {
      // Prefer lead_id + org_id (multi-tenant safe)
      if (callLog?.lead_id && callLog?.org_id) {
        const { error: leadError } = await supabase
          .from('leads')
          .update({
            status: 'called_1',
            last_contacted_at: new Date().toISOString()
          })
          .eq('id', callLog.lead_id)
          .eq('org_id', callLog.org_id);

        if (leadError) {
          logger.error('webhooks', `Failed to update lead: ${leadError.message}`);
        }
      } else if (call.customer?.number && callLog?.org_id) {
        // Fallback: scope by org_id + phone
        const { error: leadError } = await supabase
          .from('leads')
          .update({
            status: 'called_1',
            last_contacted_at: new Date().toISOString()
          })
          .eq('phone', call.customer.number)
          .eq('org_id', callLog.org_id);

        if (leadError) {
          logger.error('webhooks', `Failed to update lead (fallback): ${leadError.message}`);
        }
      }
    }

    // Also update call_tracking if exists
    const { data: callTracking, error: callTrackingError } = await supabase
      .from('call_tracking')
      .select('id, metadata')
      .eq('vapi_call_id', call.id)
      .maybeSingle();

    if (callTrackingError && callTrackingError.code !== 'PGRST116') {
      logger.error('webhooks', 'Failed to fetch call_tracking');
    }

    if (callTracking) {
      const { error: trackingError } = await supabase
        .from('call_tracking')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: call.duration || 0,
          answered: true
        })
        .eq('id', callTracking.id);

      if (trackingError) {
        logger.error('webhooks', 'Failed to update call_tracking', {
          vapiCallId: call.id,
          errorMessage: trackingError.message
        });
      }
      // NOTE: Event was already marked as processed at beginning of handler
      // (line 665-681), so no need to mark again

      // Broadcast WebSocket event with userId filter
      wsBroadcast({
        type: 'call_ended',
        vapiCallId: call.id,
        trackingId: callTracking.id,
        userId: (callTracking as any)?.metadata?.userId,
        durationSeconds: call.duration,
        // FIX: Send actual end reason from Vapi (e.g. 'customer-busy', 'transcriber-error')
        reason: (call as any).endedReason || call.status || 'completed'
      });
    }
  } catch (error) {
    logger.error('webhooks', 'Error handling call ended event');
  }
}

async function handleTranscript(event: any) {
  const { call, transcript, message } = event;

  if (!call || !call.id) {
    logger.error('webhooks', 'Missing call data');
    return;
  }

  try {
    // Validate transcript
    const cleanTranscript = (transcript || '').trim();
    if (!cleanTranscript) {
      logger.info('webhooks', 'Empty transcript, skipping');
      return;
    }

    // Generate idempotency key: hash of (callId, speaker, transcript, timestamp bucket)
    // Bucket timestamp to 1-second granularity to handle near-duplicate events
    const speaker: 'agent' | 'customer' = message?.role === 'assistant' ? 'agent' : 'customer';
    const timestampBucket = Math.floor(Date.now() / 1000);
    const eventId = `transcript:${call.id}:${speaker}:${cleanTranscript.substring(0, 50)}:${timestampBucket}`;

    // Check if this event was already processed
    const { data: existing, error: checkError } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (checkError) {
      logger.error('webhooks', `Error checking idempotency: ${checkError.message}`);
      // Continue anyway (idempotency is best-effort)
    } else if (existing) {
      logger.info('webhooks', 'Duplicate event, skipping');
      return;
    }

    // Retry lookup for call_tracking (webhook may arrive before tracking row update)
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [250, 500, 1000];
    let callTracking: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const { data } = await supabase
        .from('call_tracking')
        .select('id, metadata')
        .eq('vapi_call_id', call.id)
        .maybeSingle();

      if (data) {
        callTracking = data;
        break;
      }

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      }
    }

    if (callTracking) {
      // Insert transcript into call_transcripts (source of truth)
      const { error: insertError } = await supabase.from('call_transcripts').insert({
        call_id: callTracking.id,
        vapi_call_id: call.id,
        speaker: speaker,
        text: cleanTranscript,
        created_at: new Date().toISOString()
      });

      if (insertError) {
        logger.error('webhooks', `Failed to insert transcript: ${insertError.message}`);
        return;
      }

      // Mark event as processed (idempotency)
      const { error: markError } = await supabase
        .from('processed_webhook_events')
        .insert({
          event_id: eventId,
          call_id: call.id,
          event_type: 'transcript'
        });

      if (markError) {
        logger.warn('webhooks', `Failed to mark event as processed: ${markError.message}`);
        // Continue anyway (transcript was inserted)
      }

      // Broadcast transcript to connected voice session clients (real-time display)
      const userId = callTracking?.metadata?.userId;

      // Allow broadcasting for inbound calls (which have no userId)
      // The frontend subscribes to the call ID room, so this is safe for dashboard viewing
      // We use empty string as fallback if userId is missing/invalid type
      const safeUserId = (userId && typeof userId === 'string') ? userId : '';

      // Track timing for monitoring latency
      const broadcastTime = Date.now();

      // Broadcast transcript with timing metadata
      wsBroadcast({
        type: 'transcript',
        vapiCallId: call.id,
        trackingId: callTracking.id,
        userId: safeUserId,
        speaker: speaker,  // 'agent' | 'customer' for database compatibility
        text: cleanTranscript,
        is_final: true,
        confidence: 0.95,
        ts: broadcastTime
      });

      logger.info('webhooks', `Broadcast transcript to UI for call ${call.id}`);
    } else {
      logger.warn('webhooks', 'Call tracking not found after retries');
    }
  } catch (error) {
    logger.error('webhooks', 'Error processing transcript');
  }
}

// Pre-compile regex patterns to avoid re-creation on every call
const CLAIM_PATTERNS = [
  /costs?\s+\$?([\d,]+)/gi,                          // "costs $100"
  /prices?\s+\$?([\d,]+)/gi,                         // "price $50"
  /hours?\s+(\d{1,2}:\d{2})/gi,                      // "hours 9:00"
  /(?:founded|established)\s+(\d{4})/gi,            // "established 2020"
  /(?:location|address)[:\s]+([^.!?\n]+)/gi         // "location: 123 Main St"
];

/**
 * Detect potential hallucinations in AI responses
 * Flags claims that don't appear to be grounded in knowledge base
 *
 * NOTE: Uses simplified regex patterns to avoid ReDoS (Regular Expression Denial of Service)
 * and limits transcript size to prevent performance issues
 */
async function detectHallucinations(
  transcript: string,
  agentId: string,
  orgId: string,
  callId: string
): Promise<void> {
  try {
    const MAX_TRANSCRIPT_FOR_DETECTION = 2000; // Reduced from 10000 to prevent DoS
    if (transcript.length > MAX_TRANSCRIPT_FOR_DETECTION) {
      logger.warn('webhooks', 'Transcript too long for hallucination detection, skipping');
      return;
    }

    const flaggedClaims = new Set<string>();

    for (const pattern of CLAIM_PATTERNS) {
      let match;
      let iterations = 0;
      const MAX_ITERATIONS = 20; // Reduced iterations

      // Reset lastIndex for global regex
      pattern.lastIndex = 0;

      while ((match = pattern.exec(transcript)) !== null && iterations < MAX_ITERATIONS) {
        flaggedClaims.add(match[0].substring(0, 100)); // Limit claim length
        iterations++;
      }
    }

    if (flaggedClaims.size === 0) {
      return; // No factual claims detected
    }

    // OPTIMIZATION: Do NOT load full KB content.
    // This is a placeholder for a proper vector similarity check.
    // Loading all KBs into memory is too dangerous for production.
    logger.warn('webhooks', 'Skipping deep check to prevent OOM. Implement Vector Check here.');

    /*
    // Original dangerous logic commented out for production safety:
    // const { data: kbs } = await supabase
    //   .from('knowledge_base')
    //   .select('content, category')
    //   .eq('org_id', orgId)
    //   .eq('active', true);

    // const kbContent = kbs?.map(kb => kb.content).join('\n') || '';

    // // Check if claims are grounded in knowledge base
    // for (const claim of flaggedClaims) {
    //   // Simple check: does the knowledge base contain significant parts of the claim?
    //   const claimWords = claim
    //     .toLowerCase()
    //     .split(/\s+/)
    //     .filter(w => w.length > 3);

    //   const matchedWords = claimWords.filter(word =>
    //     kbContent.toLowerCase().includes(word)
    //   );

    //   const confidenceScore = matchedWords.length / Math.max(claimWords.length, 1);

    //   // Flag if confidence is below 0.5 (less than 50% of claim words found)
    //   if (confidenceScore < 0.5 && claimWords.length > 2) {
    //     await supabase
    //       .from('hallucination_flags')
    //       .insert([
    //         {
    //           org_id: orgId,
    //           agent_id: agentId,
    //           call_id: callId,
    //           transcript: transcript.substring(0, 500), // Store truncated transcript
    //           flagged_claim: claim,
    //           confidence_score: confidenceScore,
    //           knowledge_base_search_result: `Matched ${matchedWords.length}/${claimWords.length} words`,
    //           status: 'pending'
    //         }
    //       ]);

    //     console.log(`[Hallucination Detected] "${claim}" - Confidence: ${(confidenceScore * 100).toFixed(1)}%`);
    //   }
    // }
    */

  } catch (error) {
    logger.error('webhooks', 'Error detecting hallucinations');
    // Don't throw - hallucination detection shouldn't break webhook processing
  }
}

async function handleEndOfCallReport(event: VapiEvent) {
  const { call, artifact } = event;

  if (!call || !call.id) {
    logger.error('webhooks', 'Missing call data in end-of-call-report');
    return;
  }

  try {
    const eventId = `end-of-call-report:${call.id}`;

    const { data: existing, error: checkError } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (checkError) {
      logger.error('webhooks', 'Error checking idempotency');
    } else if (existing) {
      logger.info('webhooks', 'Duplicate event, skipping');
      return;
    }

    // Get agent and org info from call log
    const { data: callLog } = await supabase
      .from('call_logs')
      .select('agent_id, org_id, lead_id, to_number')
      .eq('vapi_call_id', call.id)
      .single();

    if (!callLog) {
      logger.error('webhooks', 'Call log not found');
      return;
    }

    // Detect call type (inbound vs outbound) based on Twilio numbers
    const callTypeResult = await detectCallType(
      callLog.org_id,
      callLog.to_number,
      call.customer?.number
    );

    const callType = callTypeResult?.callType || 'outbound';

    logger.info('webhooks', 'Call type detected');

    // Handle recording upload via background queue (non-blocking)
    // Instead of waiting for upload (can take 180+ seconds), queue it for async processing
    let recordingStoragePath: string | null = null;
    let recordingSignedUrl: string | null = null;
    let recordingUploadedAt: string | null = null;

    if (artifact?.recording) {
      logger.info('webhooks', 'Queueing recording for async upload');

      // Queue the recording for background processing (non-blocking)
      try {
        const { error: queueError } = await supabase
          .from('recording_upload_queue')
          .insert({
            call_id: call.id,
            vapi_call_id: call.id,
            org_id: callLog.org_id,
            recording_url: typeof artifact.recording === 'string'
              ? artifact.recording
              : JSON.stringify(artifact.recording),
            call_type: callType,
            priority: 'normal',
            status: 'pending',
            created_at: new Date().toISOString()
          });

        if (queueError) {
          logger.error('webhooks', 'Failed to queue recording for upload');

          // Fallback: Log to failed_upload table for manual retry
          await logFailedUpload({
            callId: call.id,
            vapiRecordingUrl: artifact.recording as string,
            errorMessage: `Queue error: ${queueError.message}`
          });
        } else {
          logger.info('webhooks', 'Recording queued for async upload');
          // Mark in call_logs that recording is "processing"
          recordingStoragePath = 'processing'; // Placeholder - will be updated by background worker
        }
      } catch (queueError: any) {
        logger.error('webhooks', 'Exception while queueing recording');
      }
    } else {
      logger.warn('webhooks', 'No recording available for call');
    }

    // Analyze Sentiment (Phase 2)
    let sentimentResult: { score: number; label: string; summary: string; urgency: string } = {
      score: 0.5,
      label: 'Neutral',
      summary: 'Analysis pending',
      urgency: 'Low'
    };

    if (artifact?.transcript) {
      try {
        // cast label to string to satisfy type, knowing it's safe
        const result = await SentimentService.analyzeCall(artifact.transcript);
        sentimentResult = result;
        logger.info('webhooks', 'Sentiment analysis completed', {
          score: sentimentResult.score,
          label: sentimentResult.label
        });
      } catch (e: any) {
        logger.error('webhooks', 'Sentiment analysis failed', { error: e.message });
      }
    }

    // ===== DETECT BOOKING CONFIRMATION (Phase 2) =====
    // Check if appointment was successfully booked during this call
    let isBooked = false;

    // Check Vapi tool calls for successful booking
    if (call.toolCalls && Array.isArray(call.toolCalls)) {
      const bookingTool = call.toolCalls.find((t: any) => {
        const toolName = t.function?.name || t.name || '';
        return toolName === 'book_appointment' || toolName === 'bookClinicAppointment';
      });

      if (bookingTool && bookingTool.status === 'success') {
        isBooked = true;
        logger.info('webhooks', 'Booking tool called successfully', {
          callId: call.id,
          toolName: bookingTool.function?.name
        });
      }
    }

    // Also check if appointment was created after this call started
    if (!isBooked && callLog) {
      try {
        const callStartTime = new Date(call.startedAt || call.createdAt);
        const { data: appointments } = await supabase
          .from('appointments')
          .select('id')
          .eq('org_id', callLog.org_id)
          .eq('contact_phone', call.customer?.number)
          .gte('created_at', callStartTime.toISOString())
          .limit(1)
          .maybeSingle();

        if (appointments) {
          isBooked = true;
          logger.info('webhooks', 'Appointment found for contact', {
            callId: call.id,
            appointmentId: appointments.id
          });
        }
      } catch (appointmentError: any) {
        logger.warn('webhooks', 'Error checking for created appointments', {
          error: appointmentError?.message
        });
      }
    }
    // ===== END BOOKING DETECTION =====

    // ===== ESTIMATE FINANCIAL VALUE (Phase 3) =====
    let financialValue = 0;
    if (artifact?.transcript) {
      try {
        financialValue = await estimateLeadValue(artifact.transcript, callLog.org_id);
        logger.info('webhooks', 'Financial value estimated', {
          callId: call.id,
          value: financialValue
        });
      } catch (valueError: any) {
        logger.warn('webhooks', 'Failed to estimate financial value', {
          error: valueError?.message
        });
      }
    }
    // ===== END FINANCIAL VALUE ESTIMATION =====

    // Determine recording status based on current state
    let recordingStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
    if (recordingStoragePath === 'processing') {
      recordingStatus = 'processing';
    } else if (recordingStoragePath && recordingStoragePath !== 'processing') {
      recordingStatus = 'completed';
    } else if (!artifact?.recording) {
      recordingStatus = 'failed';
    }

    // Update call_logs with final data including recording metadata
    // CRITICAL: Include org_id in WHERE clause for multi-tenant isolation
    const { error: callLogsError } = await supabase
      .from('call_logs')
      .update({
        outcome: 'completed',
        recording_url: recordingSignedUrl || null,
        recording_storage_path: recordingStoragePath || null,
        recording_signed_url_expires_at: recordingSignedUrl ? new Date(Date.now() + 3600000).toISOString() : null,
        recording_uploaded_at: recordingUploadedAt,
        recording_status: recordingStatus,
        transcript: artifact?.transcript || null,
        transcript_only_fallback: !recordingStoragePath && !!artifact?.transcript,
        cost: call.cost || 0,
        sentiment_score: sentimentResult.score,
        sentiment_label: sentimentResult.label,
        sentiment_summary: sentimentResult.summary,
        sentiment_urgency: sentimentResult.urgency,
        metadata: {
          booking_confirmed: isBooked
        }
      })
      .eq('vapi_call_id', call.id)
      .eq('org_id', callLog.org_id);

    if (callLogsError) {
      logger.error('webhooks', 'Failed to update call log', {
        vapiCallId: call.id,
        orgId: callLog.org_id,
        errorMessage: callLogsError.message
      });
      // CRITICAL: Throw to prevent cascading errors - both tables must update together
      throw new Error(`Failed to update call_logs: ${callLogsError.message}`);
    }

    // Also update calls table with call_type, recording_storage_path, recording_status, and financial_value
    // CRITICAL: Include org_id in WHERE clause for multi-tenant isolation
    const { error: callsError } = await supabase
      .from('calls')
      .update({
        call_type: callType,
        recording_storage_path: recordingStoragePath,
        recording_status: recordingStatus,
        status: 'completed',
        sentiment_score: sentimentResult.score,
        sentiment_label: sentimentResult.label,
        sentiment_summary: sentimentResult.summary,
        sentiment_urgency: sentimentResult.urgency,
        direction: callType,
        financial_value: financialValue
      })
      .eq('vapi_call_id', call.id)
      .eq('org_id', callLog.org_id);

    if (callsError) {
      logger.error('webhooks', 'Failed to update calls table', {
        vapiCallId: call.id,
        orgId: callLog.org_id,
        errorMessage: callsError.message
      });

      // CRITICAL: If calls table update fails, clean up orphaned recording
      if (recordingStoragePath) {
        logger.warn('webhooks', 'Cleaning up orphaned recording due to DB error');

        try {
          await deleteRecording(recordingStoragePath);
          logger.info('webhooks', 'Orphaned recording deleted successfully');
        } catch (deleteError: any) {
          logger.error('webhooks', 'Failed to delete orphaned recording');
          // Log but don't throw - we already have a DB error to report
        }
      }

      // Throw error to indicate webhook processing failed
      throw new Error(`Failed to update calls table: ${callsError.message}`);
    } else {
      logger.info('webhooks', 'Call report saved');

      // Broadcast recording ready event to dashboard via WebSocket
      if (recordingStoragePath && recordingSignedUrl) {
        try {
          await wsBroadcast({
            type: 'recording_ready',
            callId: call.id,
            recordingUrl: recordingSignedUrl,
            storagePath: recordingStoragePath,
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
            timestamp: new Date().toISOString()
          });

          logger.info('webhooks', 'Recording ready event broadcasted');
        } catch (broadcastError: any) {
          logger.warn('webhooks', 'Failed to broadcast recording ready event (non-blocking)');
        }
      }
    }

    // Detect hallucinations in transcript
    if (artifact?.transcript && callLog?.agent_id && callLog?.org_id) {
      await detectHallucinations(
        artifact.transcript,
        callLog.agent_id,
        callLog.org_id,
        call.id
      );
    }

    // ===== AUTOMATIC HOT LEAD DETECTION (Phase 2) =====
    // Score the lead and send SMS alert if score >= 70
    if (artifact?.transcript && callLog?.org_id) {
      try {
        // Score the lead based on full transcript
        const leadScore = await scoreLead(
          callLog.org_id,
          artifact.transcript,
          sentimentResult.label as 'positive' | 'neutral' | 'negative', // AI-Audited Sentiment
          { serviceType: 'unknown' }
        );


        // Update lead with score AND value (financialValue already calculated earlier)
        if (financialValue > 0 || leadScore.score > 0) {
          await supabase.from('leads')
            .update({
              last_score: leadScore.score,
              status: leadScore.tier === 'hot' ? 'qualified' : 'called_1',
              metadata: { // Merge with existing metadata ideally, but for now simple update
                potential_value: financialValue,
                lead_score_details: leadScore.details
              }
            })
            .eq('id', callLog.lead_id) // We must have lead_id linked
            .eq('org_id', callLog.org_id);
        }

        // If hot lead (score >= 70), send SMS alert
        if (leadScore.tier === 'hot') {
          // Get clinic manager alert phone
          const { data: settings } = await supabase
            .from('integration_settings')
            .select('hot_lead_alert_phone')
            .eq('org_id', callLog.org_id)
            .maybeSingle();

          if (settings?.hot_lead_alert_phone) {
            // Check if alert already sent for this call (prevent duplicates)
            const { data: existingAlert } = await supabase
              .from('hot_lead_alerts')
              .select('id')
              .eq('call_id', call.id)
              .eq('org_id', callLog.org_id)
              .maybeSingle();

            if (!existingAlert) {
              // Extract customer info from call
              const customerName = call.customer?.name || 'Unknown Customer';
              const customerPhone = call.customer?.number || 'Not provided';

              try {
                const messageId = await sendHotLeadSMS(settings.hot_lead_alert_phone, {
                  name: customerName,
                  phone: customerPhone,
                  service: 'Multiple services discussed',
                  summary: `Lead score: ${leadScore.score}/100. ${leadScore.details}`
                });

                // Record alert
                await supabase
                  .from('hot_lead_alerts')
                  .insert({
                    org_id: callLog.org_id,
                    call_id: call.id,
                    lead_name: customerName,
                    lead_phone: customerPhone,
                    service_interest: 'Auto-detected from call',
                    urgency_level: 'high',
                    summary: leadScore.details,
                    lead_score: leadScore.score,
                    sms_message_id: messageId,
                    alert_sent_at: new Date().toISOString(),
                    created_at: new Date().toISOString()
                  });

                // Create dashboard notification
                await supabase
                  .from('notifications')
                  .insert({
                    org_id: callLog.org_id,
                    type: 'hot_lead',
                    title: `🔥 Hot Lead Detected: ${customerName}`,
                    message: `Score: ${leadScore.score}/100. ${leadScore.details}`,
                    metadata: {
                      lead_phone: customerPhone,
                      call_id: call.id,
                      lead_score: leadScore.score
                    },
                    is_read: false,
                    created_at: new Date().toISOString()
                  });

                logger.info('webhooks', 'Auto hot lead SMS sent', {
                  callId: call.id,
                  score: leadScore.score,
                  messageId
                });
              } catch (smsError: any) {
                logger.error('webhooks', 'Failed to send auto hot lead SMS', {
                  error: smsError?.message
                });
              }
            }
          }
        }
      } catch (scoringError: any) {
        logger.error('webhooks', 'Error in auto hot lead detection', {
          error: scoringError?.message
        });
        // Continue - scoring failure shouldn't block other operations
      }
    }
    // ===== END AUTOMATIC HOT LEAD DETECTION =====

    // ===== UPDATE CONTACT LEAD STATUS (Phase 2) =====
    // Automatically update contact's lead_status based on call outcome
    if (call.customer?.number && callLog?.org_id) {
      try {
        // Get or create contact for this phone number
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id, lead_status')
          .eq('org_id', callLog.org_id)
          .eq('phone', call.customer.number)
          .maybeSingle();

        if (existingContact) {
          // Update existing contact
          let newStatus = existingContact.lead_status;

          if (isBooked) {
            newStatus = 'booked';
          } else if (existingContact.lead_status === 'new' || existingContact.lead_status === 'contacted') {
            // Only mark as lost if it's a completed inbound call without booking
            if (callType === 'inbound') {
              newStatus = 'lost';
            } else {
              newStatus = 'contacted';
            }
          }

          if (newStatus !== existingContact.lead_status) {
            await supabase
              .from('contacts')
              .update({
                lead_status: newStatus,
                last_contacted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', existingContact.id)
              .eq('org_id', callLog.org_id);

            logger.info('webhooks', 'Contact lead_status updated', {
              contactId: existingContact.id,
              previousStatus: existingContact.lead_status,
              newStatus,
              isBooked
            });
          }
        } else if (callType === 'inbound') {
          // Create new contact for inbound calls
          const { error: createError } = await supabase
            .from('contacts')
            .insert({
              org_id: callLog.org_id,
              name: call.customer?.name || 'Unknown',
              phone: call.customer.number,
              lead_status: isBooked ? 'booked' : 'lost',
              last_contacted_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (createError) {
            logger.warn('webhooks', 'Failed to create contact from inbound call', {
              error: createError.message
            });
          } else {
            logger.info('webhooks', 'New contact created from inbound call', {
              phone: call.customer.number,
              status: isBooked ? 'booked' : 'lost'
            });
          }
        }
      } catch (contactError: any) {
        logger.error('webhooks', 'Error updating contact lead_status', {
          error: contactError?.message
        });
      }
    }
    // ===== END CONTACT STATUS UPDATE =====

    // Lead/campaign follow-up automation intentionally disabled for this project.
  } catch (error) {
    logger.error('webhooks', 'Error in handleEndOfCallReport');
  }
}

/**
 * Route function calls from VAPI to appropriate handlers
 * CRITICAL: Org context is resolved server-side from assistantId
 */
async function handleFunctionCall(event: any) {
  const { call, functionCall } = event;

  if (!call || !call.id) {
    logger.error('webhooks', 'Missing call data in function call');
    return { error: 'Missing call data' };
  }

  try {
    logger.info('webhooks', 'Function call received', {
      callId: call.id,
      functionName: functionCall?.name
    });

    // CRITICAL: Resolve org_id from assistantId (NEVER trust request body)
    const orgId = await resolveOrgIdFromAssistant(call.assistantId);
    if (!orgId) {
      logger.error('webhooks', 'Failed to resolve org_id from assistantId', {
        assistantId: call.assistantId
      });
      return { error: 'Unable to identify organization. Please contact support.' };
    }

    const { name, parameters } = functionCall || {};

    // Route to appropriate handler
    switch (name) {
      case 'book_appointment':
        return await handleBookAppointment(orgId, call, parameters);

      case 'check_availability':
        return await handleCheckAvailability(orgId, parameters);

      case 'notify_hot_lead':
        return await handleNotifyHotLead(orgId, call, parameters);

      default:
        logger.warn('webhooks', 'Unknown function called', { functionName: name });
        return {
          error: `Function ${name} is not supported. Available functions: book_appointment, check_availability, notify_hot_lead`
        };
    }
  } catch (error: any) {
    logger.error('webhooks', 'Error executing function', {
      callId: call.id,
      functionName: functionCall?.name,
      error: error?.message,
      stack: error?.stack
    });
    return {
      error: 'Sorry, I encountered an error processing your request. Please try again or ask to speak with a representative.'
    };
  }
}

/**
 * Resolve organization ID from VAPI assistant ID
 * CRITICAL for multi-tenant security - prevents org_id spoofing
 */
async function resolveOrgIdFromAssistant(assistantId: string): Promise<string | null> {
  if (!assistantId) return null;

  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select('org_id')
      .eq('vapi_assistant_id', assistantId)
      .eq('active', true)
      .maybeSingle();

    if (error || !agent) {
      logger.error('webhooks', 'Agent lookup failed for assistantId', {
        assistantId,
        error: error?.message
      });
      return null;
    }

    return agent.org_id;
  } catch (error: any) {
    logger.error('webhooks', 'Error resolving org_id from assistantId', {
      assistantId,
      error: error?.message
    });
    return null;
  }
}

/**
 * Handle book_appointment function call from VAPI
 * Checks Google Calendar availability and creates appointment
 */
async function handleBookAppointment(
  orgId: string,
  call: any,
  parameters: any
): Promise<{ result?: string; error?: string }> {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      serviceType,
      preferredDate,
      preferredTime,
      durationMinutes = 45,
      notes
    } = parameters;

    logger.info('webhooks', 'Processing appointment booking', {
      orgId,
      callId: call.id,
      serviceType,
      date: preferredDate,
      time: preferredTime
    });

    // Validate date/time format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
      return { error: 'Invalid date format. Please provide date as YYYY-MM-DD.' };
    }

    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(preferredTime)) {
      return { error: 'Invalid time format. Please provide time as HH:MM in 24-hour format.' };
    }

    // Construct ISO datetime
    const scheduledAt = new Date(`${preferredDate}T${preferredTime}:00`);

    // Validate not in past
    if (scheduledAt < new Date()) {
      return { error: 'Cannot book appointments in the past. Please choose a future date and time.' };
    }

    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

    // CRITICAL: Check Google Calendar availability (if connected)
    let calendarAvailable = false;
    let calendarCheckPerformed = false;

    try {
      const available = await checkAvailability(
        orgId,
        scheduledAt.toISOString(),
        endTime.toISOString()
      );
      calendarAvailable = available;
      calendarCheckPerformed = true;

      if (!available) {
        logger.warn('webhooks', 'Requested time slot not available', {
          orgId,
          scheduledAt: scheduledAt.toISOString()
        });
        return {
          error: `Unfortunately, ${preferredTime} on ${preferredDate} is not available. Let me check other available times. Please ask me to check availability for that date.`
        };
      }
    } catch (calendarError: any) {
      // Calendar not connected - proceed with "pending" appointment
      logger.warn('webhooks', 'Google Calendar not connected, booking as pending', {
        orgId,
        error: calendarError?.message
      });
      calendarCheckPerformed = false;
      // Continue with booking
    }

    // Find or create contact
    let contactId: string | null = null;

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('phone', customerPhone)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      // Create new contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          org_id: orgId,
          name: customerName,
          phone: customerPhone,
          email: customerEmail || null,
          lead_status: 'cold',
          lead_score: 1,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (contactError) {
        logger.error('webhooks', 'Failed to create contact', {
          error: contactError.message
        });
      } else {
        contactId = newContact.id;
      }
    }

    // Create appointment in database
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        org_id: orgId,
        contact_id: contactId,
        service_type: serviceType,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: durationMinutes,
        contact_phone: customerPhone,
        customer_name: customerName,
        notes: notes || null,
        status: calendarCheckPerformed && calendarAvailable ? 'scheduled' : 'pending',
        confirmation_sent: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (appointmentError) {
      logger.error('webhooks', 'Failed to create appointment', {
        error: appointmentError.message
      });
      return { error: 'Sorry, I was unable to create the appointment. Please try again or contact us directly.' };
    }

    logger.info('webhooks', 'Appointment created', {
      appointmentId: appointment.id,
      status: appointment.status
    });

    // Create Google Calendar event (if calendar connected and available)
    let calendarEventUrl: string | null = null;

    if (calendarCheckPerformed && calendarAvailable) {
      try {
        const { eventUrl } = await createCalendarEvent(orgId, {
          title: `${serviceType} - ${customerName}`,
          description: `Customer: ${customerName}\nPhone: ${customerPhone}\nEmail: ${customerEmail || 'Not provided'}\nNotes: ${notes || 'None'}`,
          startTime: scheduledAt.toISOString(),
          endTime: endTime.toISOString(),
          attendeeEmail: customerEmail || ''
        });

        calendarEventUrl = eventUrl;

        // Update appointment with calendar link
        await supabase
          .from('appointments')
          .update({ calendar_link: eventUrl })
          .eq('id', appointment.id);

        logger.info('webhooks', 'Google Calendar event created', {
          appointmentId: appointment.id,
          eventUrl
        });
      } catch (calendarError: any) {
        logger.error('webhooks', 'Failed to create calendar event', {
          error: calendarError?.message
        });
        // Continue - appointment is still created
      }
    }

    // Send SMS confirmation
    try {
      await sendAppointmentConfirmationSMS(customerPhone, {
        serviceType,
        scheduledAt,
        confirmationUrl: calendarEventUrl || undefined
      });

      // Mark confirmation sent
      await supabase
        .from('appointments')
        .update({ confirmation_sent: true })
        .eq('id', appointment.id);

      logger.info('webhooks', 'Confirmation SMS sent', {
        appointmentId: appointment.id,
        phone: customerPhone
      });
    } catch (smsError: any) {
      logger.error('webhooks', 'Failed to send confirmation SMS', {
        error: smsError?.message
      });
      // Continue - appointment is still valid
    }

    // Return success message to VAPI (spoken to customer)
    const confirmationMessage = calendarCheckPerformed && calendarAvailable
      ? `Great! I've confirmed your ${serviceType} appointment for ${preferredDate} at ${preferredTime}. You'll receive a text message confirmation shortly with all the details.`
      : `I've scheduled your ${serviceType} appointment for ${preferredDate} at ${preferredTime}. Our team will call you within 24 hours to confirm the final time. You'll also receive a text message confirmation.`;

    return { result: confirmationMessage };
  } catch (error: any) {
    logger.error('webhooks', 'Error in handleBookAppointment', {
      error: error?.message,
      stack: error?.stack
    });
    return { error: 'Sorry, I encountered an error while booking your appointment. Please try again.' };
  }
}

/**
 * Handle check_availability function call from VAPI
 * Returns available time slots for a given date
 */
async function handleCheckAvailability(
  orgId: string,
  parameters: any
): Promise<{ result?: string; error?: string }> {
  try {
    const { date } = parameters;

    logger.info('webhooks', 'Checking availability', { orgId, date });

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: 'Invalid date format. Please provide date as YYYY-MM-DD.' };
    }

    // Validate not in past
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (requestedDate < today) {
      return { error: 'Cannot check availability for past dates. Please choose a future date.' };
    }

    let availableSlots: string[];

    try {
      // Try Google Calendar API
      availableSlots = await getAvailableSlots(orgId, date);
      logger.info('webhooks', 'Retrieved availability from Google Calendar', {
        orgId,
        date,
        slotsCount: availableSlots.length
      });
    } catch (calendarError: any) {
      logger.warn('webhooks', 'Google Calendar not connected, using database fallback', {
        orgId,
        error: calendarError?.message
      });

      // Fallback: Check database appointments
      const dateStart = `${date}T00:00:00Z`;
      const dateEnd = `${date}T23:59:59Z`;

      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('scheduled_at, duration_minutes')
        .eq('org_id', orgId)
        .gte('scheduled_at', dateStart)
        .lte('scheduled_at', dateEnd)
        .eq('status', 'scheduled');

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Generate available slots (9 AM - 6 PM, 45-min intervals)
      const bookedTimes = new Set<string>();

      if (appointments) {
        for (const appt of appointments) {
          const start = new Date(appt.scheduled_at);
          const end = new Date(start.getTime() + (appt.duration_minutes || 45) * 60 * 1000);

          let current = new Date(start);
          while (current < end) {
            const hour = String(current.getHours()).padStart(2, '0');
            const minute = String(current.getMinutes()).padStart(2, '0');
            bookedTimes.add(`${hour}:${minute}`);
            current.setMinutes(current.getMinutes() + 15);
          }
        }
      }

      availableSlots = [];
      for (let hour = 9; hour < 18; hour++) {
        for (let minute = 0; minute < 60; minute += 45) {
          const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          if (!bookedTimes.has(timeStr)) {
            availableSlots.push(timeStr);
          }
        }
      }
    }

    if (availableSlots.length === 0) {
      return {
        result: `Unfortunately, ${date} is fully booked. Would you like to check another date?`
      };
    }

    // Format slots for natural speech
    const formattedSlots = availableSlots.slice(0, 5).map(slot => {
      const [hour, minute] = slot.split(':');
      const hourNum = parseInt(hour);
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const displayHour = hourNum > 12 ? hourNum - 12 : (hourNum === 0 ? 12 : hourNum);
      return `${displayHour}:${minute} ${ampm}`;
    });

    const slotsMessage = formattedSlots.length === availableSlots.length
      ? formattedSlots.join(', ')
      : `${formattedSlots.join(', ')}, and ${availableSlots.length - formattedSlots.length} more times`;

    return {
      result: `For ${date}, I have availability at: ${slotsMessage}. Which time works best for you?`
    };
  } catch (error: any) {
    logger.error('webhooks', 'Error in handleCheckAvailability', {
      error: error?.message,
      stack: error?.stack
    });
    return { error: 'Sorry, I encountered an error checking availability. Please try again.' };
  }
}

/**
 * Handle notify_hot_lead function call from VAPI
 * Triggered manually by AI when customer shows high buying intent
 */
async function handleNotifyHotLead(
  orgId: string,
  call: any,
  parameters: any
): Promise<{ result?: string; error?: string }> {
  try {
    const { leadName, leadPhone, serviceInterest, urgency, summary } = parameters;

    logger.info('webhooks', 'Hot lead notification triggered', {
      orgId,
      callId: call.id,
      leadName,
      serviceInterest
    });

    // Get clinic manager alert phone from settings
    const { data: settings, error: settingsError } = await supabase
      .from('integration_settings')
      .select('hot_lead_alert_phone')
      .eq('org_id', orgId)
      .maybeSingle();

    if (settingsError || !settings?.hot_lead_alert_phone) {
      logger.warn('webhooks', 'No hot lead alert phone configured', { orgId });
      return {
        result: 'I\'ve noted your interest and our team will follow up with you shortly.'
      };
    }

    const alertPhone = settings.hot_lead_alert_phone;

    // Check if we already sent alert for this call (prevent duplicates)
    const { data: existingAlert, error: alertCheckError } = await supabase
      .from('hot_lead_alerts')
      .select('id')
      .eq('call_id', call.id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (existingAlert) {
      logger.info('webhooks', 'Hot lead alert already sent for this call', {
        callId: call.id
      });
      return {
        result: 'Thank you! Our team has been notified and will prioritize your request.'
      };
    }

    // Send SMS alert
    try {
      const messageId = await sendHotLeadSMS(alertPhone, {
        name: leadName,
        phone: leadPhone,
        service: serviceInterest,
        summary: summary || 'High-value lead detected during call'
      });

      logger.info('webhooks', 'Hot lead SMS sent', {
        messageId,
        alertPhone,
        leadName
      });

      // Record alert in database
      await supabase
        .from('hot_lead_alerts')
        .insert({
          org_id: orgId,
          call_id: call.id,
          lead_name: leadName,
          lead_phone: leadPhone,
          service_interest: serviceInterest,
          urgency_level: urgency || 'high',
          summary: summary || null,
          sms_message_id: messageId,
          alert_sent_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          org_id: orgId,
          type: 'hot_lead',
          title: `🔥 Hot Lead: ${leadName}`,
          message: `${leadName} is interested in ${serviceInterest}. ${summary || 'Contact immediately!'}`,
          metadata: {
            lead_phone: leadPhone,
            service_interest: serviceInterest,
            call_id: call.id,
            urgency
          },
          is_read: false,
          created_at: new Date().toISOString()
        });

      return {
        result: 'Perfect! I\'ve notified our team about your interest and someone will reach out to you very soon to discuss next steps.'
      };
    } catch (smsError: any) {
      logger.error('webhooks', 'Failed to send hot lead SMS', {
        error: smsError?.message
      });
      return {
        result: 'Thank you for your interest! Our team will contact you soon to discuss your needs.'
      };
    }
  } catch (error: any) {
    logger.error('webhooks', 'Error in handleNotifyHotLead', {
      error: error?.message,
      stack: error?.stack
    });
    return {
      result: 'Thank you! We\'ve noted your interest and will follow up with you shortly.'
    };
  }
}

/**
 * PHASE 6C: Vapi Booking Tool Integration Endpoint
 * Handles tool-calls from Vapi voice agent: book_appointment
 * 
 * Flow:
 * 1. Extract org_id from JWT
 * 2. Validate provider credentials
 * 3. Check for appointment conflicts
 * 4. Execute atomic INSERT
 * 5. Return confirmation to voice agent
 */
webhooksRouter.post('/api/vapi/booking', webhookLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization || null;
    const { tool_name, tool_input } = req.body;

    logger.info('webhooks', 'Vapi booking tool-call received', {
      tool: tool_name,
      provider_id: tool_input?.provider_id
    });

    // Process the booking request
    const result = await processVapiToolCall(authHeader, tool_name, tool_input);

    // Log the booking attempt
    if (result.success) {
      logger.info('webhooks', 'Appointment created', {
        appointment_id: result.appointment_id,
        latency_ms: result.latency_ms
      });
    } else {
      logger.warn('webhooks', 'Booking failed', {
        error: result.error,
        conflict: result.conflict
      });
    }

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    logger.error('webhooks', 'Vapi booking endpoint error', {
      error: error?.message,
      stack: error?.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error processing booking'
    });
  }
});

export default webhooksRouter;
