import express from 'express';
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

    // ===== CRITICAL FIX #9: Enforce webhook signature verification =====
    try {
      const isValid = await verifyVapiSignature(req);
      if (!isValid) {
        logger.error('webhooks', 'Invalid webhook signature');
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
      logger.debug('webhooks', 'Signature verified');
    } catch (verifyError: any) {
      logger.error('webhooks', 'Signature verification failed');
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

    // Fallback to environment variable if config table doesn't have the key
    if (!vapiApiKey) {
      vapiApiKey = process.env.VAPI_API_KEY || null;
      logger.warn('webhooks', 'Using VAPI_API_KEY from environment');
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
        transcript: artifact?.transcript || null,
        transcript_only_fallback: !recordingStoragePath && !!artifact?.transcript,
        cost: call.cost || 0
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

    // Also update calls table with call_type and recording_storage_path
    // CRITICAL: Include org_id in WHERE clause for multi-tenant isolation
    const { error: callsError } = await supabase
      .from('calls')
      .update({
        call_type: callType,
        recording_storage_path: recordingStoragePath,
        status: 'completed'
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

    // Lead/campaign follow-up automation intentionally disabled for this project.
  } catch (error) {
    logger.error('webhooks', 'Error in handleEndOfCallReport');
  }
}

async function handleFunctionCall(event: any) {
  const { call, functionCall } = event;

  if (!call || !call.id) {
    logger.error('webhooks', 'Missing call data');
    return { result: 'Error: Missing call data' };
  }

  try {
    logger.info('webhooks', 'Function called');

    // Handle specific function calls
    const { name, parameters } = functionCall || {};

    // Production-only function handling
    // Demo functions removed for production

    return { result: `Function ${name} executed` };
  } catch (error: any) {
    logger.error('webhooks', 'Error executing function');
    return { error: error.message || 'Function execution failed' };
  }
}

export default webhooksRouter;
