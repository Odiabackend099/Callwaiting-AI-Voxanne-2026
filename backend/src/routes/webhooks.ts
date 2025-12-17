import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { supabase } from '../services/supabase-client';
import { sendDemoEmail, sendDemoSms, sendDemoWhatsApp, DemoRecipient, DemoContext } from '../services/demo-service';
import { wsBroadcast } from '../services/websocket';
import { getIntegrationSettings } from './founder-console-settings';
import { validateE164Format } from '../utils/phone-validation';
import { uploadCallRecording, deleteRecording } from '../services/call-recording-storage';
import { detectCallType, getAgentConfigForCallType } from '../services/call-type-detector';
import { getCachedIntegrationSettings } from '../services/settings-cache';
import { computeVapiSignature } from '../utils/vapi-webhook-signature';

export const webhooksRouter = express.Router();

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
      console.error('[Webhook] CRITICAL: Vapi webhook secret not configured in production! Rejecting all webhooks.');
      return false;
    }
    // In development/test, allow unsigned webhooks
    console.warn('[Webhook] Vapi webhook secret not configured, accepting all webhooks (development mode)');
    return true;
  }

  // Verify signature
  const signature = req.headers['x-vapi-signature'] as string;
  const timestamp = req.headers['x-vapi-timestamp'] as string;

  if (!signature || !timestamp) {
    console.error('[Webhook] Missing signature or timestamp headers');
    return false;
  }

  try {
    // Reject replayed webhooks using a timestamp skew window
    // Accept both seconds and milliseconds epoch formats.
    const tsNum = Number(timestamp);
    if (!Number.isFinite(tsNum)) {
      console.error('[Webhook] Invalid timestamp header');
      return false;
    }

    const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000;
    const nowMs = Date.now();
    const maxSkewMs = 5 * 60 * 1000; // 5 minutes (allows for provider retries + queue delays)
    if (Math.abs(nowMs - tsMs) > maxSkewMs) {
      console.error('[Webhook] Timestamp outside allowed skew window');
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
    console.error('[Webhook] Error verifying signature:', error.message);
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

webhooksRouter.post('/vapi', webhookLimiter, async (req, res) => {
  try {
    // Verify webhook signature for security
    const isValid = await verifyVapiSignature(req);
    if (!isValid) {
      console.error('[Vapi Webhook] Invalid signature, rejecting webhook');
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    const event: VapiEvent = req.body;

    console.log('[Vapi Webhook]', {
      type: event.type,
      callId: event.call?.id,
      timestamp: new Date().toISOString()
    });

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
          console.log('[Vapi Webhook] Unhandled event type:', event.type);
      }
    } catch (handlerError) {
      console.error('[Vapi Webhook] Handler error:', handlerError);
      handlerSuccess = false;
    }

    // FIX #3: Return error status if handler failed
    if (!handlerSuccess) {
      res.status(500).json({ error: 'Handler processing failed' });
      return;
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Webhook Error]', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleCallStarted(event: VapiEvent) {
  const { call } = event;

  if (!call || !call.id) {
    console.error('[handleCallStarted] Missing call data');
    return;
  }

  try {
    // Generate idempotency key for this event (use only call.id to prevent duplicate processing)
    const eventId = `call.started:${call.id}`;

    // Check if already processed
    const { data: existing, error: checkError } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (checkError) {
      console.error('[handleCallStarted] Error checking idempotency:', checkError);
    } else if (existing) {
      console.log('[handleCallStarted] Duplicate event, skipping', { eventId, vapiCallId: call.id });
      return;
    }

    // Retry logic for race condition: webhook may arrive before call_tracking is inserted
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [250, 500, 1000]; // exponential backoff in ms
    let callTracking = null;
    let trackingError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const result = await supabase
        .from('call_tracking')
        .select('id, lead_id, org_id, metadata')
        .eq('vapi_call_id', call.id)
        .maybeSingle();

      callTracking = result.data;
      trackingError = result.error;

      if (callTracking) {
        break; // Found it, exit retry loop
      }

      // If not found and we have retries left, wait and retry
      if (attempt < MAX_RETRIES - 1) {
        console.warn('[handleCallStarted] Call tracking not found, retrying', {
          vapiCallId: call.id,
          attempt: attempt + 1,
          nextRetryMs: RETRY_DELAYS[attempt]
        });
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      }
    }

    if (trackingError && trackingError.code !== 'PGRST116') {
      console.error('[handleCallStarted] Error fetching call tracking:', trackingError.message);
      return;
    }

    if (!callTracking) {
      // Call tracking not found - this might be an INBOUND call
      console.log('[handleCallStarted] Call tracking not found, checking for inbound call', {
        vapiCallId: call.id,
        assistantId: call.assistantId
      });

      // Check if this is an inbound call by looking for assistantId
      if (call.assistantId) {
        // Look up the agent by vapi_assistant_id (only active agents)
        const { data: agent, error: agentError } = await supabase
          .from('agents')
          .select('id, org_id, name, active')
          .eq('vapi_assistant_id', call.assistantId)
          .eq('active', true)
          .maybeSingle();

        if (agentError) {
          console.error('[handleCallStarted] Error looking up agent:', agentError);
          return;
        }

        if (!agent) {
          console.error('[handleCallStarted] No active agent found with vapi_assistant_id:', call.assistantId);
          return;
        }

        console.log('[handleCallStarted] Found agent for inbound call', {
          agentId: agent.id,
          agentName: agent.name,
          orgId: agent.org_id
        });

        // FIX #5: Validate phone number format before storing
        let phoneNumber = call.customer?.number || null;
        if (phoneNumber) {
          const phoneValidation = validateE164Format(phoneNumber);
          if (!phoneValidation.valid) {
            console.error('[handleCallStarted] Invalid phone number format:', phoneValidation.error);
            return;
          }
          phoneNumber = phoneValidation.normalized || phoneNumber;
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
              userId: undefined,  // Inbound calls don't have a userId initially
              is_test_call: false,
              created_at: new Date().toISOString(),
              source: 'vapi_webhook'
            } as CallTrackingMetadata
          })
          .select('id, lead_id, org_id, metadata')
          .single();

        if (insertError) {
          console.error('[handleCallStarted] Failed to insert call_tracking for inbound call:', insertError);
          return;
        }

        console.log('[handleCallStarted] Created call_tracking for inbound call', {
          trackingId: newTracking.id,
          vapiCallId: call.id
        });

        // Use the newly created tracking record
        callTracking = newTracking;
      } else {
        console.error('[handleCallStarted] Call tracking not found and no assistantId provided for vapi_call_id:', call.id);
        return;
      }
    }

    // Fetch lead only if this is not a test call
    let lead = null;
    if (callTracking.lead_id) {
      const { data: leadData } = await supabase
        .from('leads')
        .select('id, contact_name, name, clinic_name, company_name, org_id')
        .eq('id', callTracking.lead_id)
        .eq('org_id', callTracking.org_id)
        .maybeSingle();
      lead = leadData;
    }

    // Check if call_logs row already exists (prevent duplicates on retry)
    const { data: existingLog } = await supabase
      .from('call_logs')
      .select('id')
      .eq('vapi_call_id', call.id)
      .maybeSingle();

    if (!existingLog) {
      // Create call log entry with metadata for test call detection
      const { error } = await supabase.from('call_logs').insert({
        vapi_call_id: call.id,
        lead_id: lead?.id || null,
        to_number: call.customer?.number || null,
        status: 'in-progress',
        started_at: new Date().toISOString(),
        metadata: {
          is_test_call: callTracking?.metadata?.is_test_call ?? false,
          channel: callTracking?.metadata?.channel ?? 'outbound'  // FIX #1: Propagate channel
        }
      });

      if (error) {
        console.error('[handleCallStarted] Failed to insert call log:', error);
      } else {
        console.log('[handleCallStarted] Call log created:', call.id);
      }
    } else {
      console.log('[handleCallStarted] Call log already exists, skipping insert:', call.id);
    }


    // Update call_tracking status
    await supabase
      .from('call_tracking')
      .update({ status: 'ringing', started_at: new Date().toISOString() })
      .eq('id', callTracking.id);

    // Mark event as processed (idempotency)
    const { error: markError } = await supabase
      .from('processed_webhook_events')
      .insert({
        event_id: eventId,
        call_id: call.id,
        event_type: 'started'
      });

    if (markError) {
      console.warn('[handleCallStarted] Failed to mark event as processed:', markError);
      // Continue anyway (state was updated)
    }

    // Broadcast WebSocket event with userId filter (type-safe metadata access)
    const metadata = callTracking.metadata as CallTrackingMetadata | null;
    const userId = metadata?.userId;

    // Only include userId in broadcast if it exists (inbound calls may not have userId initially)
    wsBroadcast({
      type: 'call_status',
      vapiCallId: call.id,
      trackingId: callTracking.id,
      userId: userId || '',  // Use empty string as fallback for type safety
      status: 'ringing',
    });
  } catch (error) {
    console.error('[handleCallStarted] Error:', error);
  }
}

async function handleCallEnded(event: VapiEvent) {
  const { call } = event;

  if (!call || !call.id) {
    console.error('[handleCallEnded] Missing call data');
    return;
  }

  try {
    // Generate idempotency key for this event (FIX #6: duration not part of key)
    const eventId = `ended:${call.id}`;

    // Check if already processed
    const { data: existing, error: checkError } = await supabase
      .from('processed_webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (checkError) {
      console.error('[handleCallEnded] Error checking idempotency:', checkError);
    } else if (existing) {
      console.log('[handleCallEnded] Duplicate event, skipping', { eventId, vapiCallId: call.id });
      return;
    }
    // Fetch call log to check if it's a test call
    const { data: callLog } = await supabase
      .from('call_logs')
      .select('id, lead_id, org_id, metadata')
      .eq('vapi_call_id', call.id)
      .maybeSingle();

    // Update call log
    const { error } = await supabase
      .from('call_logs')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: call.duration || 0
      })
      .eq('vapi_call_id', call.id);

    if (error) {
      console.error('[handleCallEnded] Failed to update call log:', error);
    } else {
      console.log('[handleCallEnded] Call log updated:', call.id);
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
          console.error('[handleCallEnded] Failed to update lead:', leadError);
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
          console.error('[handleCallEnded] Failed to update lead:', leadError);
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
      console.error('[handleCallEnded] Failed to fetch call_tracking:', callTrackingError);
    }

    if (callTracking) {
      await supabase
        .from('call_tracking')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: call.duration || 0,
          answered: true
        })
        .eq('id', callTracking.id);

      // Mark event as processed (idempotency)
      const { error: markError } = await supabase
        .from('processed_webhook_events')
        .insert({
          event_id: eventId,
          call_id: call.id,
          event_type: 'ended'
        });

      if (markError) {
        console.warn('[handleCallEnded] Failed to mark event as processed:', markError);
        // Continue anyway (state was updated)
      }

      // Broadcast WebSocket event with userId filter
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
    console.error('[handleCallEnded] Error:', error);
  }
}

async function handleTranscript(event: any) {
  const { call, transcript, message } = event;

  if (!call || !call.id) {
    console.error('[handleTranscript] Missing call data');
    return;
  }

  try {
    // Validate transcript
    const cleanTranscript = (transcript || '').trim();
    if (!cleanTranscript) {
      console.log('[handleTranscript] Empty transcript, skipping', { vapiCallId: call.id });
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
      console.error('[handleTranscript] Error checking idempotency:', checkError);
      // Continue anyway (idempotency is best-effort)
    } else if (existing) {
      console.log('[handleTranscript] Duplicate event, skipping', { eventId, vapiCallId: call.id });
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
        speaker,
        text: cleanTranscript,
        timestamp: new Date().toISOString()
      });

      if (insertError) {
        console.error('[handleTranscript] Failed to insert transcript:', insertError);
        // Don't mark as processed if insert failed
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
        console.warn('[handleTranscript] Failed to mark event as processed:', markError);
        // Continue anyway (transcript was inserted)
      }

      // Broadcast transcript to connected voice session clients (real-time display)
      const userId = callTracking?.metadata?.userId;

      // Allow broadcasting for inbound calls (which have no userId)
      // The frontend subscribes to the call ID room, so this is safe for dashboard viewing
      // We use empty string as fallback if userId is missing/invalid type
      const safeUserId = (userId && typeof userId === 'string') ? userId : '';

      // Broadcast transcript
      wsBroadcast({
        type: 'transcript',
        vapiCallId: call.id,
        trackingId: callTracking.id,
        userId: safeUserId,
        speaker: speaker,  // 'agent' | 'customer' for database compatibility
        text: cleanTranscript,
        is_final: true,
        confidence: 0.95,
        ts: Date.now()
      });

      console.log('[handleTranscript] Broadcast transcript to UI', {
        vapiCallId: call.id,
        trackingId: callTracking.id,
        userId: userId,
        speaker,
        textLength: cleanTranscript.length
      });
    } else {
      console.warn('[handleTranscript] Call tracking not found after retries', { vapiCallId: call.id });
    }
  } catch (error) {
    console.error('[handleTranscript] Error:', error);
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
      console.warn('[detectHallucinations] Transcript too long for hallucination detection, skipping', {
        callId,
        transcriptLength: transcript.length,
        maxLength: MAX_TRANSCRIPT_FOR_DETECTION
      });
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
    console.warn('[detectHallucinations] Skipping deep check to prevent OOM. Implement Vector Check here.');

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
    console.error('[detectHallucinations] Error:', error);
    // Don't throw - hallucination detection shouldn't break webhook processing
  }
}

async function handleEndOfCallReport(event: VapiEvent) {
  const { call, artifact } = event;

  if (!call || !call.id) {
    console.error('[handleEndOfCallReport] Missing call data');
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
      console.error('[handleEndOfCallReport] Error checking idempotency:', checkError);
    } else if (existing) {
      console.log('[handleEndOfCallReport] Duplicate event, skipping', { eventId, vapiCallId: call.id });
      return;
    }

    // Get agent and org info from call log
    const { data: callLog } = await supabase
      .from('call_logs')
      .select('agent_id, org_id, lead_id, to_number')
      .eq('vapi_call_id', call.id)
      .single();

    if (!callLog) {
      console.error('[handleEndOfCallReport] Call log not found:', call.id);
      return;
    }

    // Detect call type (inbound vs outbound) based on Twilio numbers
    const callTypeResult = await detectCallType(
      callLog.org_id,
      callLog.to_number,
      call.customer?.number
    );

    const callType = callTypeResult?.callType || 'outbound';

    console.log('[handleEndOfCallReport] Call type detected:', {
      callId: call.id,
      callType,
      reason: callTypeResult?.reason
    });

    // Handle recording upload to Supabase Storage
    let recordingStoragePath: string | null = null;
    let recordingSignedUrl: string | null = null;

    if (artifact?.recording) {
      console.log('[handleEndOfCallReport] Uploading recording to storage:', call.id);

      const uploadResult = await uploadCallRecording({
        orgId: callLog.org_id,
        callId: call.id,
        callType: callType as 'inbound' | 'outbound',
        recordingUrl: artifact.recording,
        vapiCallId: call.id
      });

      if (uploadResult.success) {
        recordingStoragePath = uploadResult.storagePath || null;
        recordingSignedUrl = uploadResult.signedUrl || null;

        console.log('[handleEndOfCallReport] Recording uploaded successfully:', {
          callId: call.id,
          storagePath: recordingStoragePath
        });
      } else {
        console.error('[handleEndOfCallReport] Recording upload failed:', {
          callId: call.id,
          error: uploadResult.error
        });
      }
    }

    // Update call_logs with final data
    const { error: callLogsError } = await supabase
      .from('call_logs')
      .update({
        outcome: 'completed',
        recording_url: artifact?.recording || null,
        transcript: artifact?.transcript || null,
        cost: call.cost || 0
      })
      .eq('vapi_call_id', call.id);

    if (callLogsError) {
      console.error('[handleEndOfCallReport] Failed to update call log:', callLogsError);
    }

    // Also update calls table with call_type and recording_storage_path
    const { error: callsError } = await supabase
      .from('calls')
      .update({
        call_type: callType,
        recording_storage_path: recordingStoragePath,
        status: 'completed'
      })
      .eq('vapi_call_id', call.id);

    if (callsError) {
      console.error('[handleEndOfCallReport] Failed to update calls table:', callsError);

      // CRITICAL: If calls table update fails, clean up orphaned recording
      if (recordingStoragePath) {
        console.warn('[handleEndOfCallReport] Cleaning up orphaned recording due to DB error:', {
          callId: call.id,
          storagePath: recordingStoragePath
        });

        try {
          await deleteRecording(recordingStoragePath);
          console.log('[handleEndOfCallReport] Orphaned recording deleted successfully');
        } catch (deleteError: any) {
          console.error('[handleEndOfCallReport] Failed to delete orphaned recording:', {
            storagePath: recordingStoragePath,
            error: deleteError.message
          });
          // Log but don't throw - we already have a DB error to report
        }
      }

      // Throw error to indicate webhook processing failed
      throw new Error(`Failed to update calls table: ${callsError.message}`);
    } else {
      console.log('[handleEndOfCallReport] Call report saved:', {
        callId: call.id,
        callType,
        hasRecording: !!recordingStoragePath
      });
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
    console.error('[handleEndOfCallReport] Error:', error);
  }
}

async function handleFunctionCall(event: any) {
  const { call, functionCall } = event;

  if (!call || !call.id) {
    console.error('[handleFunctionCall] Missing call data');
    return { result: 'Error: Missing call data' };
  }

  try {
    console.log('[handleFunctionCall] Function called:', {
      callId: call.id,
      functionName: functionCall?.name
    });

    // Handle specific function calls (e.g., create_lead, book_demo_call)
    const { name, parameters } = functionCall || {};

    if (name === 'send_demo_email') {
      console.log('[handleFunctionCall] Sending demo email to:', redactEmail(parameters.prospect_email));
      const recipient: DemoRecipient = {
        name: parameters.prospect_name,
        email: parameters.prospect_email,
        clinic_name: parameters.clinic_name
      };
      const context: DemoContext = {
        demo_type: parameters.demo_type,
        agent_id: parameters.agent_id,
        call_id: call.id
      };
      await sendDemoEmail(recipient, context);
      return { result: `Demo email sent to ${redactEmail(parameters.prospect_email)}` };
    } else if (name === 'send_demo_whatsapp') {
      console.log('[handleFunctionCall] Sending demo WhatsApp to:', redactPhone(parameters.prospect_phone));
      const recipient: DemoRecipient = {
        name: parameters.prospect_name,
        phone: parameters.prospect_phone,
        clinic_name: parameters.clinic_name
      };
      const context: DemoContext = {
        demo_type: parameters.demo_type,
        agent_id: parameters.agent_id,
        call_id: call.id
      };
      await sendDemoWhatsApp(recipient, context);
      return { result: `Demo WhatsApp sent to ${redactPhone(parameters.prospect_phone)}` };
    } else if (name === 'send_demo_sms') {
      console.log('[handleFunctionCall] Sending demo SMS to:', redactPhone(parameters.prospect_phone));
      const recipient: DemoRecipient = {
        name: parameters.prospect_name,
        phone: parameters.prospect_phone,
        clinic_name: parameters.clinic_name
      };
      const context: DemoContext = {
        demo_type: parameters.demo_type,
        agent_id: parameters.agent_id,
        call_id: call.id
      };
      await sendDemoSms(recipient, context);
      return { result: `Demo SMS sent to ${redactPhone(parameters.prospect_phone)}` };
    }

    return { result: `Function ${name} executed` };
  } catch (error: any) {
    console.error('[handleFunctionCall] Error:', error);
    return { error: error.message || 'Function execution failed' };
  }
}

export default webhooksRouter;
