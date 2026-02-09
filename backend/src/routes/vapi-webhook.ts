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
import { hasEnoughBalance } from '../services/wallet-service';
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

    const body = req.body;
    const message = body.message;

    // DEBUG - Log COMPLETE webhook payload
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

    // 2a. Handle Tool Calls (bookClinicAppointment)
    if (body.messageType === 'tool-calls' && body.toolCall) {
      const { function: toolFunction } = body.toolCall;
      const toolName = toolFunction?.name;

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
      let callerName = call.customer?.name || phoneNumber || 'Unknown Caller';
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
        log.error('Vapi-Webhook', 'Cannot resolve org_id for call', {
          callId: call?.id,
          assistantId
        });
        return res.json({ success: true, received: true });
      }

      // 2. Detect call direction (inbound vs outbound)
      // Inbound: call.type === 'inboundPhoneCall' OR no assistant overrides
      // Outbound: call.type === 'webCall' AND assistantOverrides present
      const callDirection: 'inbound' | 'outbound' =
        call?.type === 'webCall' && call?.assistantOverrides
          ? 'outbound'
          : 'inbound';

      log.info('Vapi-Webhook', 'Call direction detected', {
        callId: call?.id,
        direction: callDirection,
        callType: call?.type,
        hasAssistantOverrides: !!call?.assistantOverrides,
        orgId
      });

      // 3. Generate outcome + sentiment via GPT-4o (single API call)
      // Vapi does NOT provide sentiment fields in standard end-of-call-report.
      // We generate both outcome and sentiment from the transcript using OutcomeSummaryService.
      let sentimentLabel: string | null = analysis?.structuredData?.sentiment || null;
      let sentimentScore: number | null = null;
      let sentimentSummary: string | null = null;
      let sentimentUrgency: string | null = null;
      let outcomeShort = analysis?.structuredData?.outcome || 'Call Completed';
      let outcomeDetailed = analysis?.summary || 'Call completed successfully.';

      try {
        if (artifact?.transcript) {
          const outcomeSummary = await OutcomeSummaryService.generateOutcomeSummary(
            artifact.transcript,
            sentimentLabel || undefined
          );
          outcomeShort = outcomeSummary.shortOutcome;
          outcomeDetailed = outcomeSummary.detailedSummary;
          sentimentLabel = outcomeSummary.sentimentLabel;
          sentimentScore = outcomeSummary.sentimentScore;
          sentimentSummary = outcomeSummary.sentimentSummary;
          sentimentUrgency = outcomeSummary.sentimentUrgency;

          log.info('Vapi-Webhook', 'Outcome + sentiment generated', {
            callId: call?.id,
            shortOutcome: outcomeShort,
            sentimentLabel,
            sentimentScore,
            summaryLength: outcomeDetailed.length
          });
        }
      } catch (summaryError: any) {
        log.error('Vapi-Webhook', 'Failed to generate outcome/sentiment', {
          error: summaryError.message,
          callId: call?.id
        });
      }

      // 3.75. Enrich caller name from contacts table (for ALL calls - both inbound and outbound)
      let enrichedCallerName: string | null = null;

      // FIX 1.1 & 1.2: Removed inbound-only condition, fixed schema bug (first_name/last_name don't exist)
      if (call?.customer?.number) {
        try {
          const { data: existingContact, error: contactError } = await supabase
            .from('contacts')
            .select('name')  // ← FIXED: Only query existing column (contacts table has no first_name/last_name)
            .eq('org_id', orgId)
            .eq('phone', call.customer.number)
            .maybeSingle();

          if (contactError) {
            log.error('Vapi-Webhook', 'Contact lookup failed during enrichment', {
              orgId,
              phoneNumber: call.customer.number,
              error: contactError.message
            });
          }

          // Use contact name if available and not "Unknown Caller"
          if (existingContact?.name && existingContact.name !== 'Unknown Caller') {
            enrichedCallerName = existingContact.name;

            log.info('Vapi-Webhook', '✅ Caller name enriched from contacts', {
              phone: call.customer.number,
              originalName: call?.customer?.name || 'Unknown',
              enrichedName: enrichedCallerName,
              orgId,
              callDirection
            });
          } else {
            log.warn('Vapi-Webhook', '⚠️ No contact match for enrichment', {
              orgId,
              phoneNumber: call.customer.number,
              vapiCallerName: call?.customer?.name || 'not provided',
              callDirection
            });
          }
        } catch (enrichmentError: any) {
          log.error('Vapi-Webhook', 'Caller name enrichment exception', {
            error: enrichmentError.message,
            phone: call.customer.number,
            orgId
          });
          // Continue without enrichment
        }
      }

      // Fallback to Vapi caller ID if enrichment failed
      const finalCallerName = enrichedCallerName
        || call?.customer?.name
        || 'Unknown Caller';

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

      // 5. Upsert to unified calls table (creates if not exists, updates if exists)
      const { error: upsertError } = await supabase
        .from('calls')  // ← Changed from 'call_logs' to unified 'calls' table
        .upsert({
          vapi_call_id: call?.id,
          org_id: orgId,

          // Direction & type
          call_direction: callDirection,  // NEW: 'inbound' or 'outbound'
          call_type: callDirection,  // For backward compatibility

          // Contact linking (outbound only)
          contact_id: callDirection === 'outbound'
            ? (call?.customer?.contactId || null)
            : null,

          // Caller info - Enriched from contacts table
          // Write BOTH columns to keep legacy dashboard queries working until fully migrated
          from_number: call?.customer?.number || null,  // Legacy column (dashboard reads this)
          phone_number: call?.customer?.number || null,  // SSOT column
          caller_name: finalCallerName, // Use enriched name for BOTH inbound and outbound

          // Call metadata
          call_sid: call?.phoneCallProviderId || `vapi-${call?.id}`,
          created_at: call?.createdAt || message.startedAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          duration_seconds: Math.round(message.durationSeconds || 0),
          status: mapEndedReasonToStatus(message.endedReason), // Map Vapi's 52+ endedReason codes

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
            caller_name: finalCallerName
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

        // ========== AUTOMATIC CONTACT CREATION FROM INBOUND CALL ==========
        const phoneNumber = call?.customer?.number;
        const callerName = call?.customer?.name;

        if (phoneNumber && orgId) {
          try {
            // 1. Check if contact already exists
            const { data: existingContact } = await supabase
              .from('contacts')
              .select('id')
              .eq('org_id', orgId)
              .eq('phone', phoneNumber)
              .maybeSingle();

            if (!existingContact) {
              // 2. Import and use lead scoring service
              const { scoreLead } = await import('../services/lead-scoring');
              const leadScoring = await scoreLead(
                orgId,
                artifact?.transcript || '',
                (sentimentLabel as 'positive' | 'neutral' | 'negative') || 'neutral'
              );

              // 3. Extract service keywords from transcript
              const serviceKeywords = extractServiceKeywords(artifact?.transcript || '');

              // FIX 1.4 (PERMANENT): ALWAYS create contact with phone number as identifier
              // This solves the circular dependency problem:
              // - First call: Creates contact even if Vapi doesn't send a name
              // - Uses phone number as fallback identifier: "Caller +15551234567"
              // - Future calls: Enrichment will find this contact and update with real name
              // - Works for ALL organizations (new and existing) automatically

              // Generate fallback name from phone number if Vapi didn't provide one
              const contactName = (finalCallerName && finalCallerName !== 'Unknown Caller')
                ? finalCallerName
                : `Caller ${phoneNumber}`;  // Fallback: "Caller +15551234567"

              // 4. Create new contact with intelligent name handling
              // FIXED (2026-02-03): Use leadScoring.score (number 0-100) instead of tier (string)
              // FIXED (2026-02-09): Always create contact (use phone number as fallback name)
              const { error: contactError } = await supabase
                .from('contacts')
                .insert({
                  org_id: orgId,
                  name: contactName,  // FIXED: Uses phone number as fallback instead of blocking
                  phone: phoneNumber,
                  lead_score: leadScoring.score,  // FIXED: Was leadScoring.tier (string), now leadScoring.score (number)
                  lead_status: leadScoring.tier,   // ADDED: Store tier in lead_status for filtering
                  service_interests: serviceKeywords,
                  last_contacted_at: call?.endedAt || new Date().toISOString(),
                  notes: contactName.startsWith('Caller +')
                    ? `Auto-created from call ${call?.id}. Name not provided by Vapi - will be enriched on next call. Lead score: ${leadScoring.score}/100 (${leadScoring.tier})`
                    : `Auto-created from inbound call ${call?.id}. Lead score: ${leadScoring.score}/100 (${leadScoring.tier})`
                });

              if (contactError) {
                log.error('Vapi-Webhook', 'Failed to auto-create contact', {
                  error: contactError.message,
                  phone: phoneNumber,
                  orgId
                });
              } else {
                log.info('Vapi-Webhook', '✅ Contact auto-created from inbound call', {
                  phone: phoneNumber,
                  name: contactName,
                  vapiProvidedName: finalCallerName !== 'Unknown Caller',
                  leadScore: leadScoring.tier,
                  leadScoreValue: leadScoring.score,
                  orgId
                });
              }
            } else {
              // 5. Update existing contact's last_contact_at AND enrich name if needed
              // SELF-HEALING: If contact was created with "Caller +15551234567" and we now have a real name, update it
              const shouldEnrichName = (finalCallerName && finalCallerName !== 'Unknown Caller');

              // Get current contact to check if name needs enrichment
              const { data: currentContact } = await supabase
                .from('contacts')
                .select('name')
                .eq('id', existingContact.id)
                .single();

              const nameNeedsEnrichment = currentContact?.name?.startsWith('Caller +');

              const updatePayload: any = {
                last_contacted_at: call?.endedAt || new Date().toISOString()
              };

              // PERMANENT FIX: Enrich contact name if it's still phone-number-based and we now have a real name
              if (shouldEnrichName && nameNeedsEnrichment) {
                updatePayload.name = finalCallerName;
                updatePayload.notes = `Name enriched from "${currentContact?.name}" to "${finalCallerName}" on ${new Date().toISOString()}`;
              }

              const { error: updateError } = await supabase
                .from('contacts')
                .update(updatePayload)
                .eq('id', existingContact.id);

              if (updateError) {
                log.error('Vapi-Webhook', 'Failed to update contact', {
                  error: updateError.message,
                  contactId: existingContact.id,
                  orgId
                });
              } else {
                log.info('Vapi-Webhook', '✅ Contact updated', {
                  contactId: existingContact.id,
                  phone: phoneNumber,
                  nameEnriched: shouldEnrichName && nameNeedsEnrichment,
                  oldName: nameNeedsEnrichment ? currentContact?.name : undefined,
                  newName: shouldEnrichName && nameNeedsEnrichment ? finalCallerName : undefined
                });
              }
            }
          } catch (contactCreationError: any) {
            log.error('Vapi-Webhook', 'Contact creation/update failed with exception', {
              error: contactCreationError?.message || String(contactCreationError),
              phone: phoneNumber,
              orgId
            });
            // Don't fail webhook processing if contact creation fails
          }
        }

        // ========== LINK CONTACT_ID TO CALL RECORD (FIX: was always NULL for inbound) ==========
        if (phoneNumber && orgId && call?.id) {
          try {
            const { data: linkedContact } = await supabase
              .from('contacts')
              .select('id')
              .eq('org_id', orgId)
              .eq('phone', phoneNumber)
              .maybeSingle();

            if (linkedContact?.id) {
              await supabase.from('calls')
                .update({ contact_id: linkedContact.id })
                .eq('vapi_call_id', call.id);
            }
          } catch (linkError: any) {
            log.error('Vapi-Webhook', 'Failed to link contact_id to call', {
              error: linkError?.message,
              callId: call?.id
            });
            // Non-critical — don't fail webhook
          }
        }

        // ========== CREATE HOT LEAD ALERT IF LEAD SCORE IS HIGH ==========
        // FIXED: Create alerts for ALL calls (not just new contacts)
        // This populates the hot_lead_alerts table for dashboard "Recent Activity"
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
                lead_name: finalCallerName,
                lead_phone: phoneNumber,
                service_interest: serviceKeywords.length > 0 ? serviceKeywords.join(', ') : null,
                urgency_level: leadScoring.score >= 80 ? 'high' : (leadScoring.score >= 70 ? 'medium' : 'low'),
                summary: `Lead scored ${leadScoring.score}/100 from call. Interests: ${serviceKeywords.join(', ') || 'General inquiry'}`,
                lead_score: leadScoring.score,
                created_at: call?.endedAt || new Date().toISOString()
              });

            if (alertError) {
              log.error('Vapi-Webhook', 'Failed to create hot lead alert', {
                error: alertError.message,
                phone: phoneNumber,
                leadScore: leadScoring.score,
                orgId
              });
            } else {
              log.info('Vapi-Webhook', '🔥 Hot lead alert created', {
                phone: phoneNumber,
                leadScore: leadScoring.score,
                urgency: leadScoring.score >= 80 ? 'high' : (leadScoring.score >= 70 ? 'medium' : 'low'),
                orgId
              });
            }
          }
        } catch (alertCreationError: any) {
          log.error('Vapi-Webhook', 'Hot lead alert creation failed with exception', {
            error: alertCreationError?.message || String(alertCreationError),
            phone: phoneNumber,
            orgId
          });
          // Don't fail webhook processing if alert creation fails
        }
      }

      // Also run analytics (existing behavior)
      AnalyticsService.processEndOfCall(message);

      // ===== PREPAID BILLING: Deduct credits after call =====
      if (orgId && call?.id) {
        try {
          await processCallBilling(
            orgId,
            call.id,
            call.id,
            Math.round(message.durationSeconds || call?.duration || 0),
            message.cost || null,
            call?.costs || null
          );
        } catch (billingErr: any) {
          // CRITICAL: Billing failure must NOT block webhook processing
          log.error('Vapi-Webhook', 'Prepaid billing failed (non-blocking)', {
            error: billingErr?.message,
            callId: call.id,
            orgId,
          });
        }
      }

      return res.json({ success: true, received: true });
    }

    // 3. Handle Assistant Request (RAG)
    // Legacy support: if message is a string, it's the user query
    // Modern support: if message is object with type 'assistant-request' OR no type but has 'role'

    // ===== PREPAID BALANCE GATE: Block calls if insufficient credits =====
    if (message && message.type === 'assistant-request') {
      const gateAssistantId = body.assistantId || message.call?.assistantId;
      if (gateAssistantId) {
        try {
          const { data: gateAgent } = await supabase
            .from('agents')
            .select('org_id')
            .eq('vapi_assistant_id', gateAssistantId)
            .maybeSingle();

          if (gateAgent?.org_id) {
            const hasFunds = await hasEnoughBalance(gateAgent.org_id);
            if (!hasFunds) {
              log.warn('Vapi-Webhook', 'Call blocked - insufficient credits', {
                orgId: gateAgent.org_id,
                assistantId: gateAssistantId,
              });
              return res.json({
                error: 'Insufficient credits. Please top up your account at your Voxanne dashboard.',
              });
            }
          }
        } catch (gateErr: any) {
          // Don't block calls if balance check fails - fail open
          log.error('Vapi-Webhook', 'Balance gate error (failing open)', {
            error: gateErr?.message,
            assistantId: gateAssistantId,
          });
        }
      }
    }

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

vapiWebhookRouter.get('/webhook/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'vapi-webhook' });
});

export { vapiWebhookRouter };
