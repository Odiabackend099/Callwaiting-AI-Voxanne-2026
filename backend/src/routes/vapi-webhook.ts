/**
 * Vapi Webhook Handler
 * Intercepts Vapi messages for RAG context AND handles end-of-call reports for analytics
 */

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase } from '../services/supabase-client';
import { generateEmbedding } from '../services/embeddings';
import { log } from '../services/logger';
import { verifyVapiSignature } from '../utils/vapi-webhook-signature';
import { AnalyticsService } from '../services/analytics-service';
import { OutcomeSummaryService } from '../services/outcome-summary';
import { RAG_CONFIG } from '../config/rag-config';
import { hasEnoughBalance, checkBalance, reserveCallCredits, commitReservedCredits, getActiveReservation } from '../services/wallet-service';
import { processCallBilling } from '../services/billing-manager';

const vapiWebhookRouter = Router();

// Use centralized RAG config for consistency
const SIMILARITY_THRESHOLD = RAG_CONFIG.SIMILARITY_THRESHOLD;
const MAX_CHUNKS = RAG_CONFIG.MAX_CHUNKS;
const MAX_CONTEXT_LENGTH = RAG_CONFIG.MAX_CONTEXT_LENGTH;

// Rate limiting: 100 requests per minute per IP
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Check if webhook event was already processed (idempotency)
 * Returns { isDuplicate: true } if already processed
 * Automatically marks as processed if first time
 */
async function checkAndMarkWebhookProcessed(
  orgId: string,
  eventId: string,
  eventType: string,
  payload: any
): Promise<{ isDuplicate: boolean; error?: any }> {
  try {
    // Check if already processed
    const { data: alreadyProcessed, error: checkError } = await supabase
      .rpc('is_vapi_event_processed', {
        p_org_id: orgId,
        p_event_id: eventId
      });

    if (checkError) {
      log.error('Vapi-Webhook', 'Idempotency check failed', { error: checkError.message });
      // Fail-open: if check fails, process anyway (prevents data loss)
      return { isDuplicate: false, error: checkError };
    }

    if (alreadyProcessed) {
      log.info('Vapi-Webhook', 'Duplicate webhook detected', { eventId, eventType });
      return { isDuplicate: true };
    }

    // Mark as processed
    const { error: markError } = await supabase
      .rpc('mark_vapi_event_processed', {
        p_org_id: orgId,
        p_event_id: eventId,
        p_event_type: eventType,
        p_payload: payload
      });

    if (markError) {
      log.error('Vapi-Webhook', 'Failed to mark webhook processed', { error: markError.message });
      // Continue processing even if marking fails (fail-open)
    }

    return { isDuplicate: false };
  } catch (err: any) {
    log.error('Vapi-Webhook', 'Idempotency error', { error: err.message });
    return { isDuplicate: false, error: err };
  }
}

/**
 * Extract service keywords from call transcript
 * Used to populate lead service_interests from inbound calls
 */
function extractServiceKeywords(transcript: string): string[] {
  if (!transcript) return [];

  const keywords = {
    botox: ['botox', 'botulinum', 'wrinkle reduction', 'anti-aging', 'expression lines'],
    filler: ['filler', 'dermal filler', 'juvederm', 'restylane', 'volume loss'],
    laser: ['laser', 'laser treatment', 'laser hair removal', 'photofacial', 'ipl'],
    facial: ['facial', 'hydrafacial', 'chemical peel', 'microneedling', 'skin resurfacing'],
    consultation: ['consultation', 'consult', 'appointment', 'schedule', 'book']
  };

  const found: string[] = [];
  const lowerTranscript = transcript.toLowerCase();

  for (const [service, terms] of Object.entries(keywords)) {
    if (terms.some(term => lowerTranscript.includes(term))) {
      found.push(service);
    }
  }

  return found;
}

/**
 * POST /api/vapi/webhook
 * Handles:
 * 1. 'assistant-request' (RAG Context Injection)
 * 2. 'end-of-call-report' (Analytics Trigger)
 */
vapiWebhookRouter.post('/webhook', webhookLimiter, async (req: Request, res: Response) => {
  const requestStart = Date.now();
  try {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    const body = req.body;

    // DEBUG - Log COMPLETE webhook payload BEFORE signature verification
    // This ensures we see all incoming webhooks, even if signature verification fails
    const billingTraceId = `billing_${Date.now()}_${(body?.message?.call?.id || body?.event?.id || 'unknown').slice(0, 8)}`;
    log.info('Vapi-Webhook', '📨 RAW WEBHOOK RECEIVED', {
      billingTraceId,
      hasBody: !!body,
      bodyKeys: Object.keys(body || {}),
      callId: body?.message?.call?.id || body?.event?.id || 'unknown',
      messageType: body?.message?.type || body?.messageType || 'unknown',
      assistantId: body?.message?.call?.assistantId || body?.assistantId || 'unknown',
      timestamp: new Date().toISOString()
    });
    log.info('Vapi-Webhook', '🔍 BILLING TRACE START', { billingTraceId, eventType: body?.message?.type || body?.messageType || 'unknown' });

    // 1. Signature Verification
    if (!secret) {
      if (nodeEnv === 'production') {
        log.error('Vapi-Webhook', 'Missing VAPI_WEBHOOK_SECRET in production');
        return res.status(500).json({ success: false, error: 'Webhook not configured' });
      }
    } else {
      const signature = req.headers['x-vapi-signature'] as string;
      const timestamp = req.headers['x-vapi-timestamp'] as string;
      const rawBody = typeof (req as any).rawBody === 'string' ? (req as any).rawBody : JSON.stringify(req.body);

      const ok = verifyVapiSignature({ secret, signature, timestamp, rawBody });
      if (!ok) {
        log.warn('Vapi-Webhook', 'Invalid signature');
        return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      }
    }

    const message = body.message;

    // DEBUG - Log COMPLETE webhook payload (verbose details)
    log.info('Vapi-Webhook', 'RAW WEBHOOK PAYLOAD:', JSON.stringify(body, null, 2));

    // DEBUG - Log ALL webhook types
    log.info('Vapi-Webhook', 'Received webhook', {
      bodyMessageType: body.messageType,
      messageType: message?.type,
      hasMessage: !!message,
      hasToolCall: !!body.toolCall,
      toolName: body.toolCall?.function?.name,
      callId: message?.call?.id,
      webhookKeys: Object.keys(body)
    });

    // 2. Idempotency Check (prevent duplicate processing)
    // Extract event ID from various possible locations
    const eventId = message?.call?.id || message?.id || body.event?.id || body.id;
    const eventType = message?.type || body.messageType || body.type || 'unknown';

    if (eventId) {
      // Try to resolve org_id for idempotency check
      let orgId: string | null = null;

      // Option 1: From assistant ID
      const assistantId = message?.call?.assistantId || body.assistantId;
      if (assistantId) {
        const { data: agent } = await supabase
          .from('agents')
          .select('org_id')
          .eq('vapi_assistant_id', assistantId)
          .maybeSingle();
        orgId = (agent as any)?.org_id ?? null;
      }

      // Option 2: From call metadata
      if (!orgId && message?.call?.metadata?.org_id) {
        orgId = message.call.metadata.org_id;
      }

      // If we have org_id, check for duplicates
      if (orgId) {
        const { isDuplicate } = await checkAndMarkWebhookProcessed(
          orgId,
          eventId,
          eventType,
          body
        );

        if (isDuplicate) {
          log.info('Vapi-Webhook', 'Duplicate webhook ignored', { eventId, eventType, orgId });
          // Return 200 to prevent Vapi from retrying
          return res.status(200).json({
            success: true,
            message: 'Duplicate webhook ignored',
            eventId
          });
        }
      } else {
        log.warn('Vapi-Webhook', 'Unable to resolve org_id for idempotency check', { eventId });
        // Continue processing (fail-open if we can't determine org)
      }
    }

    // 2a. Handle Tool Calls (bookClinicAppointment)
    if (body.messageType === 'tool-calls' && body.toolCall) {
      const { function: toolFunction } = body.toolCall;
      const toolName = toolFunction?.name;

      // Track tool usage in calls table (Change 3: persists tool names for end-of-call linkage)
      const toolCallVapiId = body.message?.call?.id || body.call?.id;
      if (toolName && toolCallVapiId) {
        try {
          const { data: existingCall } = await supabase
            .from('calls')
            .select('tools_used')
            .eq('vapi_call_id', toolCallVapiId)
            .maybeSingle();

          const currentTools: string[] = existingCall?.tools_used || [];
          if (!currentTools.includes(toolName)) {
            await supabase
              .from('calls')
              .update({ tools_used: [...currentTools, toolName] })
              .eq('vapi_call_id', toolCallVapiId);
            log.info('Vapi-Webhook', 'Tool usage tracked', { callId: toolCallVapiId, toolName, totalTools: currentTools.length + 1 });
          }
        } catch (trackError: any) {
          log.warn('Vapi-Webhook', 'Failed to track tool usage (non-blocking)', { error: trackError?.message, toolName });
        }
      }

      if (toolName === 'bookClinicAppointment') {
        log.info('Vapi-Webhook', 'Processing bookClinicAppointment tool call', {
          arguments: toolFunction?.arguments
        });

        const args = toolFunction?.arguments || {};

        // Resolve org_id dynamically (multi-tenant support)
        let orgId: string | null = null;

        // Option 1: Get from assistantId lookup
        const assistantId = body.assistantId || body.assistant?.id;
        if (assistantId) {
          const { data: agent } = await supabase
            .from('agents')
            .select('org_id')
            .eq('vapi_assistant_id', assistantId)
            .maybeSingle();
          orgId = (agent as any)?.org_id ?? null;
        }

        // Option 2: Get from call metadata
        if (!orgId && body.message?.call?.metadata?.org_id) {
          orgId = body.message.call.metadata.org_id;
        }

        // Option 3: Get from tenantId in arguments
        if (!orgId && args.tenantId) {
          orgId = args.tenantId;
        }

        if (!orgId) {
          log.error('Vapi-Webhook', 'Unable to resolve org_id for booking', { assistantId });
          return res.status(400).json({ error: 'Unable to resolve organization for booking' });
        }

        log.info('Vapi-Webhook', 'Resolved org_id for booking', { orgId, assistantId });

        const { appointmentDate, appointmentTime, patientEmail, patientPhone, patientName, serviceType } = args;

        if (!appointmentDate || !appointmentTime || !patientEmail) {
          return res.status(400).json({ error: 'Missing booking parameters' });
        }

        try {
          const crypto = require('crypto');

          // Use the system contact for Vapi bookings (created for each org)
          const systemContactId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

          // Create appointment
          const appointmentId = crypto.randomUUID();
          const now = new Date();
          const scheduledTime = new Date(`${appointmentDate}T${appointmentTime}`);

          const { error: dbError, data: appointmentData } = await supabase
            .from('appointments')
            .insert({
              id: appointmentId,
              org_id: orgId,
              vapi_call_id: body.message?.call?.id || null,  // Golden Record: Link to call
              service_type: serviceType || 'consultation',
              scheduled_at: scheduledTime.toISOString(),
              status: 'confirmed',
              confirmation_sent: false,
              created_at: now.toISOString(),
              updated_at: now.toISOString()
            });

          log.info('Vapi-Webhook', 'Appointment insertion result', {
            appointmentId,
            dbError: dbError?.message,
            appointmentData,
            patientEmail,
            patientPhone,
            patientName,
            serviceType
          });

          if (dbError) throw new Error(`DB Error: ${dbError.message}`);

          // Step 3: Try to create Google Calendar event (optional - don't fail if Calendar not set up)
          let calendarEventId = null;
          try {
            const { createCalendarEvent } = await import('../services/calendar-integration');
            const endDate = new Date(scheduledTime);
            endDate.setMinutes(endDate.getMinutes() + 30);

            const calendarResult = await createCalendarEvent(orgId, {
              title: `Appointment - ${patientName || patientEmail}`,
              description: `Clinic appointment for patient: ${patientEmail}\nService: ${serviceType || 'consultation'}`,
              startTime: scheduledTime.toISOString(),
              endTime: endDate.toISOString(),
              attendeeEmail: patientEmail
            });

            calendarEventId = calendarResult?.eventId || null;
            log.info('Vapi-Webhook', 'Google Calendar event created', { appointmentId, calendarEventId });
          } catch (calendarError: any) {
            // Log but don't fail the booking
            log.warn('Vapi-Webhook', 'Calendar sync skipped', {
              appointmentId,
              reason: calendarError?.message || 'Calendar not connected'
            });
          }

          log.info('Vapi-Webhook', 'Appointment booked successfully', {
            appointmentId,
            contactId,
            calendarEventId
          });

          return res.status(200).json({
            result: {
              success: true,
              appointmentId,
              calendarEventId,
              message: `Appointment confirmed for ${appointmentDate} at ${appointmentTime}`
            }
          });
        } catch (error: any) {
          log.error('Vapi-Webhook', 'Booking failed', { error: error.message });
          return res.status(500).json({
            result: { success: false, error: error.message }
          });
        }
      }
    }

    // 1.5. Handle Call Started (Early Dashboard Population)
    // Purpose: Populate calls table immediately when call begins, not just when it ends
    // This ensures ALL initiated calls appear in dashboard, even if webhook fails later
    if (message && message.type === 'call.started') {
      const call = message.call;

      log.info('Vapi-Webhook', '🚀 CALL STARTED', {
        callId: call?.id,
        type: call?.type,
        customer: call?.customer?.number,
        startedAt: call?.startedAt
      });

      // Resolve org_id from assistant
      let orgId: string | null = null;
      const assistantId = call?.assistantId || body.assistantId;

      if (assistantId) {
        const { data: agent } = await supabase
          .from('agents')
          .select('org_id')
          .eq('vapi_assistant_id', assistantId)
          .maybeSingle();
        orgId = (agent as any)?.org_id ?? null;
      }

      // Fallback to metadata
      if (!orgId && call?.metadata?.org_id) {
        orgId = call.metadata.org_id;
      }

      if (!orgId) {
        log.warn('Vapi-Webhook', 'Unable to resolve org_id for call.started', { assistantId, callId: call?.id });
        // Still return 200 per Vapi docs
        return res.status(200).json({ success: true });
      }

      // Validate call.id exists (prevents NULL vapi_call_id bypass)
      if (!call?.id) {
        log.error('Vapi-Webhook', 'Missing call.id in call.started, skipping upsert');
        return res.status(200).json({ success: true, error: 'Missing call.id' });
      }

      // Determine call direction from call.type
      const callDirection = call.type === 'outboundPhoneCall' ? 'outbound' : 'inbound';
      const phoneNumber = call.customer?.number || null;

      // Enrich caller name from contacts table, fall back to Vapi caller ID or phone number
      // Don't store phone number as caller_name - it's already in phone_number/from_number columns.
      // The Golden Record view resolves display names via: contact name → phone_number → "Unknown"
      let callerName = call.customer?.name || 'Unknown Caller';
      if (phoneNumber && orgId) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('name')
          .eq('org_id', orgId)
          .eq('phone', phoneNumber)
          .maybeSingle();
        if (contact?.name && contact.name !== 'Unknown Caller') {
          callerName = contact.name;
        }
      }

      // Insert call record immediately (status: in-progress)
      const { error: insertError } = await supabase
        .from('calls')
        .upsert({
          org_id: orgId,
          vapi_call_id: call.id,
          phone_number: phoneNumber,
          from_number: phoneNumber,
          caller_name: callerName,
          call_direction: callDirection,
          status: 'in-progress',
          start_time: call.startedAt ? new Date(call.startedAt) : new Date(),
          created_at: call.startedAt ? new Date(call.startedAt) : new Date(),
          updated_at: new Date(),
          is_test_call: call.type === 'webCall' || !!(call.metadata?.is_test_call) || false,
          metadata: {
            source: 'call.started webhook',
            vapi_type: call.type,
            ...call.metadata
          }
        }, {
          onConflict: 'vapi_call_id',
          defaultToNull: false  // Don't NULL out columns from end-of-call-report
        });

      if (insertError) {
        log.error('Vapi-Webhook', 'Failed to insert call.started record', {
          error: insertError.message,
          callId: call?.id,
          orgId
        });
      } else {
        log.info('Vapi-Webhook', '✅ Call record created from call.started', {
          callId: call?.id,
          orgId,
          direction: callDirection,
          status: 'in-progress'
        });
      }

      // Return 200 per Vapi docs (they ignore non-200 responses)
      return res.status(200).json({ success: true });
    }

    // Helper: Extract tool names used during a call from Vapi messages
    // Golden Record: Surfaces which tools were invoked for analytics
    function extractToolsUsed(messages: any[]): string[] {
      if (!messages || !Array.isArray(messages)) return [];
      const toolNames = new Set<string>();
      for (const msg of messages) {
        // Tool call results have the tool name directly
        if (msg.role === 'tool_call_result' && msg.name) {
          toolNames.add(msg.name);
        }
        // Assistant messages may have toolCalls array
        if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
          for (const tc of msg.toolCalls) {
            if (tc.function?.name) {
              toolNames.add(tc.function.name);
            }
          }
        }
      }
      return Array.from(toolNames);
    }

    // Helper: Map Vapi's 52+ endedReason codes to dashboard-friendly status values
    // Source: https://docs.vapi.ai/calls/call-ended-reason
    function mapEndedReasonToStatus(endedReason: string | undefined): string {
      if (!endedReason) return 'completed';

      // Successful completions
      if (['assistant-ended-call', 'assistant-ended-call-after-message-spoken',
        'assistant-ended-call-with-hangup-task', 'customer-ended-call',
        'exceeded-max-duration', 'silence-timed-out'].includes(endedReason)) {
        return 'completed';
      }

      // Customer unavailable
      if (['customer-busy', 'customer-did-not-answer',
        'customer-did-not-give-microphone-permission'].includes(endedReason)) {
        return 'no-answer';
      }

      // Voicemail (Vapi-specific — Twilio reports this as 'completed')
      if (endedReason === 'voicemail') return 'voicemail';

      // Transfers
      if (['assistant-forwarded-call',
        'assistant-request-returned-forwarding-phone-number'].includes(endedReason)) {
        return 'transferred';
      }

      // System/provider errors (wildcard patterns per Vapi docs)
      if (endedReason.startsWith('call.in-progress.error-') ||
        endedReason.startsWith('pipeline-error-') ||
        endedReason.startsWith('call.start.error-') ||
        ['assistant-error', 'database-error', 'twilio-failed-to-connect-call',
          'vonage-failed-to-connect-call', 'phone-call-provider-closed-websocket',
          'unknown-error', 'worker-shutdown'].includes(endedReason)) {
        return 'failed';
      }

      // Manual cancellation
      if (endedReason === 'manually-canceled') return 'cancelled';

      return 'completed'; // Safe default for unknown reasons
    }

    // 2. Handle End-of-Call Report (Analytics)
    if (message && message.type === 'end-of-call-report') {
      const call = message.call;
      const artifact = message.artifact;
      const analysis = message.analysis;

      log.info('Vapi-Webhook', '📞 END-OF-CALL RECEIVED', {
        callId: call?.id,
        customer: call?.customer?.number,
        duration: call?.duration,
        hasSummary: !!analysis?.summary,
        hasTranscript: !!artifact?.transcript,
        hasRecording: !!artifact?.recording
      });

      // 1. Resolve org_id from assistant
      let orgId: string | null = null;
      const assistantId = call?.assistantId || body.assistantId;

      log.info('Vapi-Webhook', 'Looking up agent', {
        assistantId,
        hasCallAssistantId: !!call?.assistantId,
        hasBodyAssistantId: !!body.assistantId
      });

      if (assistantId) {
        const { data: agent, error: agentError } = await supabase
          .from('agents')
          .select('org_id')
          .eq('vapi_assistant_id', assistantId)
          .maybeSingle();

        if (agentError) {
          log.error('Vapi-Webhook', 'Agent lookup error', {
            error: agentError.message,
            assistantId
          });
        }

        log.info('Vapi-Webhook', 'Agent lookup result', {
          foundAgent: !!agent,
          orgId: agent?.org_id
        });

        orgId = agent?.org_id || null;
      }

      if (!orgId) {
        log.error('Vapi-Webhook', '❌ BILLING BLOCKED: Cannot resolve org_id for call', {
          billingTraceId,
          callId: call?.id,
          assistantId,
          availableFields: {
            hasCallMetadata: !!call?.metadata,
            callMetadata: call?.metadata,
            bodyKeys: Object.keys(body || {})
          }
        });

        // FALLBACK: Try to extract org_id from call metadata or body
        // This prevents silent failures when agent lookup fails
        const fallbackOrgId =
          call?.metadata?.org_id ||
          call?.metadata?.organizationId ||
          body.org_id ||
          body.organizationId ||
          null;

        if (fallbackOrgId) {
          log.info('Vapi-Webhook', '✅ Resolved org_id via fallback', {
            callId: call?.id,
            fallbackOrgId,
            source: call?.metadata?.org_id ? 'call.metadata.org_id' :
              call?.metadata?.organizationId ? 'call.metadata.organizationId' :
                body.org_id ? 'body.org_id' :
                  body.organizationId ? 'body.organizationId' : 'unknown'
          });
          orgId = fallbackOrgId;
        } else {
          // LAST RESORT: Return 200 to prevent Vapi retry, but log error for debugging
          log.error('Vapi-Webhook', '❌ WEBHOOK DROPPED: No org_id found in any location', {
            callId: call?.id,
            assistantId,
            checkedLocations: [
              'assistant lookup (agents table)',
              'call.metadata.org_id',
              'call.metadata.organizationId',
              'body.org_id',
              'body.organizationId'
            ],
            recommendation: 'Include org_id in call.metadata when creating Vapi assistant or in webhook body'
          });
          return res.json({ success: true, received: true });
        }
      } else {
        log.info('Vapi-Webhook', '✅ org_id resolved successfully', {
          billingTraceId,
          orgId,
          callId: call?.id,
          source: 'agent lookup or fallback'
        });
      }

      // 2. Detect call direction (inbound vs outbound)
      // Must match call.started handler logic (line 397) exactly.
      // Vapi call.type values: 'inboundPhoneCall', 'outboundPhoneCall', 'webCall'
      // - 'outboundPhoneCall' = outbound (phone calls initiated by our system)
      // - 'webCall' with assistantOverrides = outbound (browser-initiated test calls)
      // - Everything else (inboundPhoneCall, webCall without overrides) = inbound
      const callDirection: 'inbound' | 'outbound' =
        call?.type === 'outboundPhoneCall'
          ? 'outbound'
          : (call?.type === 'webCall' && call?.assistantOverrides)
            ? 'outbound'
            : 'inbound';

      log.info('Vapi-Webhook', 'Call direction detected', {
        callId: call?.id,
        direction: callDirection,
        callType: call?.type,
        hasAssistantOverrides: !!call?.assistantOverrides,
        orgId
      });

      // 3. Extract sentiment + outcome from Vapi's NATIVE analysis (PRIMARY source)
      // UPDATE 2026-02-16: Vapi native analysis is PRIMARY. GPT-4o is optional fallback only.
      // Vapi's analysisPlan (configured in agent-sync.ts) provides: summary, sentiment, structuredData
      let sentimentLabel: string | null = analysis?.sentiment || null;
      let sentimentScore: number | null = analysis?.structuredData?.sentimentScore ?? null;
      let sentimentSummary: string | null = analysis?.summary || null;
      let sentimentUrgency: string | null = analysis?.structuredData?.sentimentUrgency || null;
      let outcomeShort: string = analysis?.structuredData?.shortOutcome || 'Call Completed';
      let outcomeDetailed: string = analysis?.summary || 'Call completed successfully.';
      const appointmentBookedByVapi: boolean = analysis?.structuredData?.appointmentBooked === true;
      const successEvaluation: string | null = analysis?.successEvaluation || null;

      // Map Vapi sentiment label to numeric score if structuredData didn't provide one
      if (sentimentScore === null && sentimentLabel) {
        sentimentScore = sentimentLabel === 'positive' ? 0.8 :
                         sentimentLabel === 'negative' ? 0.2 : 0.5;
      }

      // Ensure all fields have values (SSOT compliance — no NULLs in critical fields)
      if (!sentimentLabel) sentimentLabel = 'neutral';
      if (sentimentScore === null) sentimentScore = 0.5;
      if (!sentimentSummary) sentimentSummary = outcomeDetailed;
      if (!sentimentUrgency) sentimentUrgency = 'low';

      log.info('Vapi-Webhook', 'Vapi native analysis extracted', {
        callId: call?.id,
        sentimentLabel,
        sentimentScore,
        outcomeShort,
        hasSummary: !!analysis?.summary,
        hasStructuredData: !!analysis?.structuredData,
        successEvaluation,
        appointmentBookedByVapi,
        source: 'vapi-native'
      });

      // OPTIONAL: Enhance with GPT-4o ONLY if Vapi summary is missing and OpenAI key is available
      // This is a FALLBACK — Vapi native analysis is the primary source
      if (!analysis?.summary && process.env.OPENAI_API_KEY) {
        try {
          let transcriptForAnalysis = artifact?.transcript || null;

          if (!transcriptForAnalysis) {
            const messagesSource = artifact?.messages || call?.messages || [];
            if (Array.isArray(messagesSource) && messagesSource.length > 0) {
              const transcriptParts: string[] = [];
              for (const msg of messagesSource) {
                if (msg.role === 'user' && msg.message) {
                  transcriptParts.push(`Caller: ${msg.message}`);
                } else if (msg.role === 'assistant' && msg.message) {
                  transcriptParts.push(`Assistant: ${msg.message}`);
                } else if (msg.content && typeof msg.content === 'string') {
                  const speaker = msg.role === 'user' ? 'Caller' : 'Assistant';
                  transcriptParts.push(`${speaker}: ${msg.content}`);
                }
              }
              if (transcriptParts.length > 0) transcriptForAnalysis = transcriptParts.join('\n');
            }
          }

          if (transcriptForAnalysis && transcriptForAnalysis.trim().length >= 10) {
            const outcomeSummary = await OutcomeSummaryService.generateOutcomeSummary(
              transcriptForAnalysis,
              sentimentLabel || undefined
            );
            outcomeShort = outcomeSummary.shortOutcome;
            outcomeDetailed = outcomeSummary.detailedSummary;
            sentimentLabel = outcomeSummary.sentimentLabel;
            sentimentScore = outcomeSummary.sentimentScore;
            sentimentSummary = outcomeSummary.sentimentSummary;
            sentimentUrgency = outcomeSummary.sentimentUrgency;

            log.info('Vapi-Webhook', 'GPT-4o enhancement applied (Vapi summary was missing)', {
              callId: call?.id, source: 'gpt-4o-enhancement'
            });
          }
        } catch (summaryError: any) {
          // GPT-4o failed — that's fine, we already have Vapi native analysis values
          log.warn('Vapi-Webhook', 'GPT-4o enhancement failed (using Vapi native — no data loss)', {
            error: summaryError.message,
            callId: call?.id
          });
        }
      }

      // ========== CONTACT LOOKUP/AUTO-CREATION (Strategic SSOT Fix 2026-02-09) ==========
      // This happens BEFORE upsert so we have contact_id ready for foreign key
      // Key change: Auto-create contacts for ALL inbound calls (guarantees 100% contact_id coverage)
      let contactIdForCall: string | null = null;

      if (call?.customer?.number) {
        const phoneNumber = call.customer.number;

        try {
          // Step 1: Lookup existing contact
          const { data: existingContact, error: contactError } = await supabase
            .from('contacts')
            .select('id, name')
            .eq('org_id', orgId)
            .eq('phone', phoneNumber)
            .maybeSingle();

          if (contactError) {
            log.error('Vapi-Webhook', 'Contact lookup failed', {
              orgId,
              phoneNumber,
              error: contactError.message
            });
          }

          if (existingContact) {
            // Contact exists - use its ID
            contactIdForCall = existingContact.id;

            log.info('Vapi-Webhook', 'Contact found for call', {
              contactId: existingContact.id,
              contactName: existingContact.name,
              phone: phoneNumber,
              callDirection,
              orgId
            });

          } else if (callDirection === 'inbound') {
            // Step 2: Auto-create contact for inbound calls (USER APPROVED - Phase 1)
            // This guarantees 100% contact_id coverage for inbound calls

            // Generate fallback name (phone number if Vapi doesn't provide)
            const fallbackName = call?.customer?.name || phoneNumber;

            // Run lead scoring for new contact
            const { scoreLead } = await import('../services/lead-scoring');
            const leadScoring = await scoreLead(
              orgId,
              artifact?.transcript || '',
              (sentimentLabel as 'positive' | 'neutral' | 'negative') || 'neutral'
            );

            // Extract service keywords
            const serviceKeywords = extractServiceKeywords(artifact?.transcript || '');

            const { data: newContact, error: createError } = await supabase
              .from('contacts')
              .insert({
                org_id: orgId,
                phone: phoneNumber,
                name: fallbackName,
                lead_score: leadScoring.score,
                lead_status: leadScoring.tier,
                service_interests: serviceKeywords,
                source: 'inbound-call-auto',
                last_contacted_at: call?.endedAt || new Date().toISOString(),
                notes: `Auto-created from inbound call ${call?.id} on ${new Date().toISOString()}. Lead score: ${leadScoring.score}/100 (${leadScoring.tier})`
              })
              .select('id, name')
              .single();

            if (createError) {
              log.error('Vapi-Webhook', 'Failed to auto-create contact', {
                error: createError.message,
                phone: phoneNumber,
                orgId
              });
              contactIdForCall = null;
            } else {
              contactIdForCall = newContact.id;

              log.info('Vapi-Webhook', '✅ Contact auto-created from inbound call', {
                contactId: newContact.id,
                phone: phoneNumber,
                name: fallbackName,
                vapiProvidedName: !!call?.customer?.name,
                leadScore: leadScoring.score,
                leadTier: leadScoring.tier,
                orgId
              });
            }
          }
        } catch (contactError: any) {
          log.error('Vapi-Webhook', 'Contact lookup/creation exception', {
            error: contactError.message,
            phone: phoneNumber,
            callDirection,
            orgId
          });
          // Continue without contact_id (will use phone_number fallback in view)
        }
      }

      // 4. Validate vapi_call_id before upsert
      // Per Supabase docs: NULL in UNIQUE conflict column bypasses uniqueness, creating duplicate rows
      if (!call?.id) {
        log.error('Vapi-Webhook', 'Missing call.id in end-of-call-report, skipping upsert', {
          assistantId,
          orgId,
          endedReason: message.endedReason
        });
        // Always return 200 per Vapi docs — they ignore non-200 responses
        return res.status(200).json({ success: true, error: 'Missing call.id' });
      }

      // ========== GOLDEN RECORD EXTRACTION & LOGGING ==========
      // FIXED (2026-02-14): Check multiple locations for cost (message.cost, call.cost, call.costs.total)
      const rawCost = message.cost ?? call?.cost ?? call?.costs?.total ?? 0;
      const costCents = Math.ceil(rawCost * 100);

      // FIXED: endedReason is in call object, not at message level
      const endedReason = call?.endedReason || null;

      // FIXED (2026-02-14): Collect tools from multiple sources (messages, artifact.messages, analysis.toolCalls)
      // The end-of-call-report often puts messages in artifact.messages instead of call.messages
      const allMessages = [
        ...(call?.messages || []),
        ...(artifact?.messages || [])
      ];

      let toolsUsed = extractToolsUsed(allMessages);

      // Also check analysis.toolCalls summary if available (Vapi sometimes sends this)
      if (analysis?.toolCalls && Array.isArray(analysis.toolCalls)) {
        for (const tc of analysis.toolCalls) {
          if (tc.function?.name) toolsUsed.push(tc.function.name);
        }
      }

      // Deduplicate tools
      toolsUsed = Array.from(new Set(toolsUsed));

      // Change 5: Also read tools tracked during the call by the function-call handler (Change 3)
      if (call?.id) {
        try {
          const { data: existingCallData } = await supabase
            .from('calls')
            .select('tools_used')
            .eq('vapi_call_id', call.id)
            .maybeSingle();

          if (existingCallData?.tools_used?.length) {
            toolsUsed = Array.from(new Set([...toolsUsed, ...existingCallData.tools_used]));
            log.info('Vapi-Webhook', 'Merged tools from DB (tracked during call)', {
              callId: call.id,
              dbTools: existingCallData.tools_used,
              mergedTools: toolsUsed
            });
          }
        } catch (toolReadError: any) {
          log.warn('Vapi-Webhook', 'Failed to read DB tools (non-blocking)', { error: toolReadError?.message });
        }
      }

      // DEBUG: Log all Golden Record field extraction
      const debugLog = {
        timestamp: new Date().toISOString(),
        callId: call?.id,
        extractedCostCents: costCents,
        extractedEndedReason: endedReason,
        extractedToolsUsed: toolsUsed,
        // Actual sources (FIXED):
        callEndedReason: call?.endedReason,
        messageCost: message.cost,
        messageHasMessages: !!call?.messages,
        messageCount: call?.messages?.length || 0,
        // Note: tools_used is empty because end-of-call-report doesn't include messages
        // Messages would need to be collected from message events during the call
        note: 'tools_used requires during-call message events, not end-of-call-report'
      };

      log.info('Vapi-Webhook', '🔍 GOLDEN RECORD EXTRACTION DEBUG', debugLog);

      // Also write to file for debugging when logs aren't visible
      try {
        const fs = require('fs');
        const path = require('path');
        const debugPath = path.join(__dirname, '../../golden-record-debug.log');
        fs.appendFileSync(debugPath, JSON.stringify(debugLog) + '\n');
      } catch (e) {
        // Silently ignore file write errors (logging system takes priority)
      }

      // 5. Upsert to unified calls table (creates if not exists, updates if exists)
      const { error: upsertError } = await supabase
        .from('calls')  // ← Changed from 'call_logs' to unified 'calls' table
        .upsert({
          vapi_call_id: call?.id,
          org_id: orgId,

          // Direction & type
          call_direction: callDirection,  // NEW: 'inbound' or 'outbound'
          call_type: callDirection,  // For backward compatibility

          // ✅ UNIFIED CONTACT LINKING: Set for BOTH inbound + outbound (Strategic SSOT Fix)
          contact_id: contactIdForCall || call?.customer?.contactId || null,

          // ✅ KEEP: phone_number as nullable fallback for orphaned calls
          phone_number: call?.customer?.number || null,

          // ❌ DEPRECATED COLUMNS REMOVED (2026-02-09 Strategic SSOT Fix):
          // - from_number: Duplicate of phone_number, removed
          // - caller_name: Frozen snapshot, replaced with calls_with_caller_names view
          // These columns are marked deprecated in migration, will be dropped Phase 3 (March 2026)

          // Call metadata
          call_sid: call?.phoneCallProviderId || `vapi-${call?.id}`,
          created_at: call?.createdAt || message.startedAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          duration_seconds: Math.round(message.durationSeconds || 0),
          status: mapEndedReasonToStatus(message.endedReason), // Map Vapi's 52+ endedReason codes

          // Golden Record: Store cost as integer cents (avoids floating point issues)
          cost_cents: costCents,

          // Golden Record: Store raw ended_reason for detailed analytics
          ended_reason: endedReason,

          // Golden Record: Store tools used during the call
          tools_used: toolsUsed,

          // Recording & transcript - check multiple Vapi payload locations
          recording_url: (typeof artifact?.recordingUrl === 'string' ? artifact.recordingUrl : null)
            || (typeof artifact?.recording === 'string' ? artifact.recording : null)
            || (typeof message?.recordingUrl === 'string' ? message.recordingUrl : null),
          recording_storage_path: null,  // Will be populated if uploaded to Supabase
          transcript: artifact?.transcript || null,

          // Analytics - Populate individual sentiment columns (schema migration already applied)
          sentiment_label: sentimentLabel,
          sentiment_score: sentimentScore,
          sentiment_summary: sentimentSummary,
          sentiment_urgency: sentimentUrgency,

          // Keep legacy sentiment field for backward compatibility
          sentiment: sentimentLabel
            ? `${sentimentLabel}${sentimentScore ? ':' + sentimentScore : ''}${sentimentSummary ? ':' + sentimentSummary : ''}`
            : null,

          // Outcomes - Use generated summaries
          outcome: outcomeShort,
          outcome_summary: outcomeDetailed,
          notes: null,

          // Test call detection — per Vapi docs, call.type === 'webCall' for browser calls
          is_test_call: call?.type === 'webCall' ||
            !!(call?.metadata?.is_test_call) || false,

          // Metadata
          metadata: {
            source: 'vapi-webhook-handler',
            vapi_call_type: call?.type,
            ended_reason: message.endedReason,
            cost: message.cost || 0,
            cost_breakdown: call?.costs || {},
            success_evaluation: analysis?.successEvaluation,
            has_assistant_overrides: !!call?.assistantOverrides,
            messages: call?.messages || [],
            // Store all sentiment details in metadata for later retrieval
            sentiment_analysis: {
              label: sentimentLabel,
              score: sentimentScore,
              summary: sentimentSummary,
              urgency: sentimentUrgency
            },
            // Note: Caller name now resolved from contacts table via view (Strategic SSOT Fix)
            caller_phone: call?.customer?.number,
            caller_name_from_vapi: call?.customer?.name || null
          }
        }, { onConflict: 'vapi_call_id', defaultToNull: false });

      if (upsertError) {
        log.error('Vapi-Webhook', 'Failed to upsert to calls table', {
          error: upsertError.message,
          callId: call?.id,
          direction: callDirection,
          orgId
        });
      } else {
        log.info('Vapi-Webhook', '✅ Call logged to unified calls table', {
          callId: call?.id,
          direction: callDirection,
          orgId
        });

        // ========== RECORDING URL DIAGNOSTICS ==========
        const resolvedRecordingUrl =
          (typeof artifact?.recordingUrl === 'string' ? artifact.recordingUrl : null)
          || (typeof artifact?.recording === 'string' ? artifact.recording : null)
          || (typeof message?.recordingUrl === 'string' ? message.recordingUrl : null);

        if (!resolvedRecordingUrl) {
          log.warn('Vapi-Webhook', '🎙️ No recording URL found in webhook payload', {
            callId: call?.id,
            orgId,
            direction: callDirection,
            duration: Math.round(message.durationSeconds || 0),
            checkedLocations: {
              'artifact.recordingUrl': typeof artifact?.recordingUrl,
              'artifact.recording': typeof artifact?.recording,
              'message.recordingUrl': typeof message?.recordingUrl
            },
            endedReason: message.endedReason
          });
        } else {
          log.info('Vapi-Webhook', '🎙️ Recording URL found', {
            callId: call?.id,
            orgId,
            urlSource: artifact?.recordingUrl ? 'artifact.recordingUrl' :
              artifact?.recording ? 'artifact.recording' : 'message.recordingUrl',
            urlLength: resolvedRecordingUrl.length
          });
        }

        // ========== GOLDEN RECORD: Link appointments to calls ==========
        // ALWAYS search for unlinked appointments created during this call's timeframe
        // Change 4: Removed tool detection gate — toolsUsed was always empty in end-of-call-report.
        // The time-window + org_id + unlinked constraints are sufficient for correct linkage.
        // Also uses appointmentBookedByVapi from Vapi's native structuredData as additional signal.
        if (orgId && call?.id) {
          try {
            const callStartTime = call?.createdAt || call?.startedAt;
            const callEndTime = call?.endedAt || message.endedAt || new Date().toISOString();

            const { data: linkedAppointment, error: linkError } = await supabase
              .from('appointments')
              .select('id')
              .eq('org_id', orgId)
              .is('call_id', null)  // Not yet linked
              .gte('created_at', callStartTime)
              .lte('created_at', callEndTime)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (linkedAppointment && !linkError) {
              // Fetch the call's database ID for bidirectional linking
              const { data: callRecord } = await supabase
                .from('calls')
                .select('id')
                .eq('vapi_call_id', call.id)
                .maybeSingle();

              if (callRecord) {
                // Bidirectional link: calls.appointment_id AND appointments.call_id
                const [callUpdate, appointmentUpdate] = await Promise.all([
                  supabase
                    .from('calls')
                    .update({ appointment_id: linkedAppointment.id })
                    .eq('vapi_call_id', call.id)
                    .eq('org_id', orgId),
                  supabase
                    .from('appointments')
                    .update({
                      call_id: callRecord.id,
                      vapi_call_id: call.id
                    })
                    .eq('id', linkedAppointment.id)
                ]);

                if (callUpdate.error || appointmentUpdate.error) {
                  log.error('Vapi-Webhook', 'Failed to link appointment to call', {
                    callId: call.id,
                    appointmentId: linkedAppointment.id,
                    callError: callUpdate.error?.message,
                    appointmentError: appointmentUpdate.error?.message
                  });
                } else {
                  log.info('Vapi-Webhook', 'Appointment linked to call (Golden Record)', {
                    callId: call.id,
                    appointmentId: linkedAppointment.id,
                    orgId,
                    appointmentBookedByVapi
                  });
                }
              }
            } else {
              log.info('Vapi-Webhook', 'No unlinked appointment found during call timeframe', {
                callId: call.id, orgId, callStartTime, callEndTime, appointmentBookedByVapi
              });
            }
          } catch (linkError: any) {
            // Non-blocking: appointment linking failure doesn't fail webhook processing
            log.error('Vapi-Webhook', 'Appointment linking failed (non-blocking)', {
              error: linkError?.message,
              callId: call?.id,
              orgId
            });
          }
        }

        // FIX 1.5: Queue recording for upload to Supabase Storage (enables playback)
        const recordingUrl = (typeof artifact?.recordingUrl === 'string' ? artifact.recordingUrl : null)
          || (typeof artifact?.recording === 'string' ? artifact.recording : null)
          || (typeof message?.recordingUrl === 'string' ? message.recordingUrl : null);

        if (recordingUrl && call?.id) {
          try {
            const { error: queueError } = await supabase
              .from('recording_upload_queue')
              .insert({
                call_id: call.id,
                vapi_call_id: call.id,
                org_id: orgId,
                recording_url: recordingUrl,
                call_type: callDirection || 'inbound',
                priority: 'normal',
                status: 'pending',
                attempt_count: 0,
                max_attempts: 3
              });

            if (queueError) {
              log.error('Vapi-Webhook', 'Failed to queue recording upload', {
                callId: call.id,
                orgId,
                error: queueError.message
              });
            } else {
              log.info('Vapi-Webhook', '🎵 Recording upload queued', {
                callId: call.id,
                orgId,
                url: recordingUrl
              });
            }
          } catch (recordingQueueError: any) {
            log.error('Vapi-Webhook', 'Recording queue insertion exception', {
              error: recordingQueueError.message,
              callId: call?.id
            });
          }
        }

        // Broadcast to dashboard via WebSocket
        try {
          const { wsBroadcast } = await import('../services/websocket');
          wsBroadcast(orgId, { type: 'call_ended', callId: call?.id });
        } catch (e) { /* non-critical */ }

        // ❌ DELETED (2026-02-09 Strategic SSOT Fix):
        // - Contact creation logic moved BEFORE upsert (lines 504-570)
        // - Contact_id linking logic removed (now set directly in upsert)
        // This eliminates race conditions and redundant database queries

        // ========== CREATE HOT LEAD ALERT IF LEAD SCORE IS HIGH ==========
        // FIXED: Create alerts for ALL calls (not just new contacts)
        // This populates the hot_lead_alerts table for dashboard "Recent Activity"
        const alertPhoneNumber = call?.customer?.number;
        const alertCallerName = call?.customer?.name || alertPhoneNumber || 'Unknown';

        if (alertPhoneNumber) {
          try {
            // Calculate lead scoring for this call
            const { scoreLead } = await import('../services/lead-scoring');
            const leadScoring = await scoreLead(
              orgId,
              artifact?.transcript || '',
              (sentimentLabel as 'positive' | 'neutral' | 'negative') || 'neutral'
            );
            const serviceKeywords = extractServiceKeywords(artifact?.transcript || '');

            // FIXED: Lowered threshold from 70 to 60, added 3-tier urgency
            if (leadScoring.score >= 60) {
              const { error: alertError } = await supabase
                .from('hot_lead_alerts')
                .insert({
                  org_id: orgId,
                  call_id: call?.id,
                  lead_name: alertCallerName,
                  lead_phone: alertPhoneNumber,
                  service_interest: serviceKeywords.length > 0 ? serviceKeywords.join(', ') : null,
                  urgency_level: leadScoring.score >= 80 ? 'high' : (leadScoring.score >= 70 ? 'medium' : 'low'),
                  summary: `Lead scored ${leadScoring.score}/100 from call. Interests: ${serviceKeywords.join(', ') || 'General inquiry'}`,
                  lead_score: leadScoring.score,
                  created_at: call?.endedAt || new Date().toISOString()
                });

              if (alertError) {
                log.error('Vapi-Webhook', 'Failed to create hot lead alert', {
                  error: alertError.message,
                  phone: alertPhoneNumber,
                  leadScore: leadScoring.score,
                  orgId
                });
              } else {
                log.info('Vapi-Webhook', '🔥 Hot lead alert created', {
                  phone: alertPhoneNumber,
                  leadScore: leadScoring.score,
                  urgency: leadScoring.score >= 80 ? 'high' : (leadScoring.score >= 70 ? 'medium' : 'low'),
                  orgId
                });
              }
            }
          } catch (alertCreationError: any) {
            log.error('Vapi-Webhook', 'Hot lead alert creation failed with exception', {
              error: alertCreationError?.message || String(alertCreationError),
              phone: alertPhoneNumber,
              orgId
            });
            // Don't fail webhook processing if alert creation fails
          }
        }
      }

      // Also run analytics (existing behavior)
      AnalyticsService.processEndOfCall(message);

      // ===== PHASE 2: COMMIT RESERVED CREDITS (Authorize-then-Capture) =====
      // Try to commit the reservation first; fall back to direct billing if no reservation exists
      if (orgId && call?.id) {
        try {
          const duration = Math.round(message.durationSeconds || call?.duration || 0);
          log.info('Vapi-Webhook', '📊 Call duration extracted for billing', {
            billingTraceId,
            duration,
            source: message.durationSeconds ? 'message.durationSeconds' : (call?.duration ? 'call.duration' : 'default_zero'),
            callId: call.id,
            orgId
          });

          if (duration <= 0) {
            log.warn('Vapi-Webhook', '⚠️ BILLING SKIPPED: Zero duration detected', {
              billingTraceId,
              orgId,
              callId: call.id,
              durationSeconds: duration,
              reason: 'Duration is zero or negative'
            });
          }

          const commitResult = await commitReservedCredits(call.id, duration);

          if (commitResult.success) {
            log.info('Vapi-Webhook', '💰 CREDITS DEDUCTED via reservation commit', {
              billingTraceId,
              callId: call.id,
              orgId,
              reservedPence: commitResult.reservedPence,
              actualCostPence: commitResult.actualCostPence,
              releasedPence: commitResult.releasedPence,
              balanceBefore: commitResult.balanceBefore,
              balanceAfter: commitResult.balanceAfter,
              duration
            });
          } else if (commitResult.fallbackToDirectBilling) {
            // No reservation found — fall back to legacy direct billing
            log.info('Vapi-Webhook', '🔄 FALLBACK: Direct billing triggered', {
              billingTraceId,
              callId: call.id,
              orgId,
              reason: 'no_reservation_found',
              duration
            });
            await processCallBilling(
              orgId,
              call.id,
              call.id,
              duration,
              message.cost || null,
              call?.costs || null
            );
            log.info('Vapi-Webhook', '💰 CREDITS DEDUCTED via direct billing (fallback)', {
              billingTraceId,
              callId: call.id,
              orgId,
              duration
            });
          } else {
            log.error('Vapi-Webhook', 'Commit failed unexpectedly', {
              callId: call.id, orgId, error: commitResult.error,
            });
          }
        } catch (billingErr: any) {
          // CRITICAL: Billing failure must NOT block webhook processing
          log.error('Vapi-Webhook', '❌ BILLING FAILED (non-blocking)', {
            billingTraceId,
            error: billingErr?.message,
            stack: billingErr?.stack,
            callId: call.id,
            orgId,
            duration,
            vapiCallId: message.call?.id,
            failureContext: {
              hadOrgId: !!orgId,
              hadCallId: !!call?.id,
              duration: duration,
              commitResultAvailable: false
            }
          });
          // TODO: Send alert to monitoring system (Sentry, Slack, etc.)
          // await sendBillingFailureAlert({ orgId, callId: call.id, error: billingErr });
        }
      }

      return res.json({ success: true, received: true });
    }

    // 3. Handle Assistant Request (RAG)
    // Legacy support: if message is a string, it's the user query
    // Modern support: if message is object with type 'assistant-request' OR no type but has 'role'

    // ===== PHASE 2: BILLING GATE + CREDIT RESERVATION =====
    // Reserve credits for estimated call duration (authorize phase).
    // If reservation fails, fall back to simple balance check.
    if (message && message.type === 'assistant-request') {
      const gateAssistantId = body.assistantId || message.call?.assistantId;
      const gateCallId = message.call?.id || body.call?.id;
      if (gateAssistantId) {
        try {
          const { data: gateAgent } = await supabase
            .from('agents')
            .select('org_id')
            .eq('vapi_assistant_id', gateAssistantId)
            .maybeSingle();

          if (gateAgent?.org_id) {
            // Try to reserve credits (Phase 2: authorize-then-capture)
            if (gateCallId) {
              const reservation = await reserveCallCredits(
                gateAgent.org_id,
                gateCallId,
                gateCallId,
                5 // Estimate 5 minutes
              );

              if (!reservation.success) {
                log.warn('Vapi-Webhook', 'Call blocked - credit reservation failed', {
                  orgId: gateAgent.org_id,
                  assistantId: gateAssistantId,
                  callId: gateCallId,
                  error: reservation.error,
                  effectiveBalance: reservation.effectiveBalancePence,
                });

                return res.status(402).json({
                  error: 'Insufficient credits to authorize call',
                  message: 'Please top up your account at your Voxanne dashboard to make calls.',
                  currentBalance: reservation.balancePence || 0,
                  effectiveBalance: reservation.effectiveBalancePence || 0,
                });
              }

              log.info('Vapi-Webhook', 'Call authorized - credits reserved', {
                orgId: gateAgent.org_id,
                assistantId: gateAssistantId,
                callId: gateCallId,
                reservedPence: reservation.reservedPence,
                effectiveBalance: reservation.effectiveBalancePence,
              });
            } else {
              // No callId available — fall back to simple balance check
              const balance = await checkBalance(gateAgent.org_id);
              const MIN_BALANCE_FOR_CALL = 79;

              if (!balance || balance.balancePence < MIN_BALANCE_FOR_CALL) {
                log.warn('Vapi-Webhook', 'Call blocked - insufficient balance (fallback check)', {
                  orgId: gateAgent.org_id,
                  assistantId: gateAssistantId,
                  currentBalance: balance?.balancePence || 0,
                });

                return res.status(402).json({
                  error: 'Insufficient credits to authorize call',
                  message: 'Please top up your account at your Voxanne dashboard to make calls.',
                  currentBalance: balance?.balancePence || 0,
                  requiredBalance: MIN_BALANCE_FOR_CALL,
                });
              }

              log.info('Vapi-Webhook', 'Call authorized - balance check (no reservation)', {
                orgId: gateAgent.org_id,
                balancePence: balance.balancePence,
              });
            }
          }
        } catch (gateErr: any) {
          // Don't block calls if reservation fails - fail open (availability over consistency)
          log.error('Vapi-Webhook', 'Billing gate error (failing open)', {
            error: gateErr?.message,
            assistantId: gateAssistantId,
          });
        }
      }
    }
    // ===== END BILLING GATE =====

    let userQuery = '';

    if (typeof message === 'string') {
      userQuery = message;
    } else if (message && (message.role === 'user' || message.type === 'conversation-update' || message.type === 'assistant-request')) {
      // Extract the actual text from the message architecture
      // Vapi payload varies, but usually for RAG it sends the latest user message
      userQuery = message.content || (message.messages ? message.messages[message.messages.length - 1]?.content : '') || '';
    }

    if (!userQuery || userQuery.trim().length === 0) {
      // If we can't find a query, just return empty context
      return res.json({ success: true, context: '', chunks: [] });
    }

    const assistantId = body.assistantId;
    log.info('Vapi-Webhook', 'Processing RAG Request', { assistantId, queryLength: userQuery.length });

    // ... (Existing RAG Logic) ...

    // OPTIMIZATION: Parallel execute
    const [retrievalOrgId, embedding] = await Promise.all([
      (async () => {
        if (!assistantId) return null;
        const { data: agent } = await supabase.from('agents').select('org_id').eq('vapi_assistant_id', assistantId).maybeSingle();
        return (agent as any)?.org_id ?? null;
      })(),
      generateEmbedding(userQuery)
    ]);

    if (!retrievalOrgId) {
      return res.json({ success: true, context: '', chunks: [] });
    }

    // Search Chunks
    const { data: similarChunks } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: embedding,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: MAX_CHUNKS,
      p_org_id: retrievalOrgId
    });

    // Format Context
    let contextStr = '';
    if (similarChunks && similarChunks.length > 0) {
      contextStr = 'RELEVANT KNOWLEDGE BASE INFORMATION:\n\n' +
        similarChunks.map((c: any) => c.content).join('\n\n');

      // Truncate to limit
      if (contextStr.length > MAX_CONTEXT_LENGTH) {
        contextStr = contextStr.substring(0, MAX_CONTEXT_LENGTH) + '...';
      }
    }

    return res.json({
      success: true,
      context: contextStr,
      chunks: similarChunks || []
    });

  } catch (error: any) {
    log.error('Vapi-Webhook', 'Error processing webhook', { error: error.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ============================================
// Phase 3: Kill Switch - Status Check Endpoint
// ============================================
// Vapi calls this endpoint periodically (every 60s via serverMessages)
// to check if the call should be terminated due to depleted balance.

vapiWebhookRouter.post('/webhook/status-check', webhookLimiter, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    const callId = message?.call?.id || req.body.call?.id;

    if (!callId) {
      return res.json({ endCall: false });
    }

    // Get active reservation for this call
    const reservation = await getActiveReservation(callId);
    if (!reservation) {
      // No reservation = no kill switch enforcement
      return res.json({ endCall: false });
    }

    // Get current balance
    const balance = await checkBalance(reservation.org_id);
    if (!balance) {
      return res.json({ endCall: false });
    }

    // Calculate effective balance (wallet - all active reservations)
    const { data: activeReservations } = await supabase
      .from('credit_reservations')
      .select('reserved_pence')
      .eq('org_id', reservation.org_id)
      .eq('status', 'active');

    const totalReserved = (activeReservations || []).reduce(
      (sum: number, r: any) => sum + (r.reserved_pence || 0), 0
    );

    const effectiveBalance = balance.balancePence - totalReserved;
    const KILL_THRESHOLD = 0; // Terminate at zero

    if (effectiveBalance <= KILL_THRESHOLD) {
      log.warn('Vapi-Webhook', '🔴 KILL SWITCH ACTIVATED - terminating call', {
        callId,
        orgId: reservation.org_id,
        effectiveBalance,
        walletBalance: balance.balancePence,
        totalReserved,
      });

      return res.json({
        endCall: true,
        message: 'Your account balance has been depleted. This call will now end. Please top up your account.',
      });
    }

    // Warning threshold: less than 1 minute remaining (49 pence)
    const WARNING_THRESHOLD = 49;
    if (effectiveBalance <= WARNING_THRESHOLD) {
      log.info('Vapi-Webhook', '⚠️ Low balance warning during call', {
        callId,
        orgId: reservation.org_id,
        effectiveBalance,
        estimatedRemainingSeconds: Math.floor((effectiveBalance / 49) * 60),
      });

      return res.json({
        endCall: false,
        message: 'Warning: Your account balance is running low. This call may end soon.',
      });
    }

    return res.json({ endCall: false });

  } catch (error: any) {
    log.error('Vapi-Webhook', 'Status check error', { error: error.message });
    return res.json({ endCall: false }); // Fail open
  }
});

vapiWebhookRouter.get('/webhook/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'vapi-webhook' });
});

export { vapiWebhookRouter };
