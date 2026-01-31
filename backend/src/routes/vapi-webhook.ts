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
import { RAG_CONFIG } from '../config/rag-config';

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

      // 2. Upsert call_logs entry (creates if not exists, updates if exists)
      const { error: upsertError } = await supabase
        .from('call_logs')
        .upsert({
          vapi_call_id: call?.id,
          call_sid: `vapi-${call?.id}`, // Placeholder for Vapi calls (no Twilio SID)
          org_id: orgId,
          from_number: call?.customer?.number || null,
          duration_seconds: Math.round(message.durationSeconds || 0),
          status: 'completed',
          outcome: 'completed',
          outcome_summary: analysis?.summary || null,
          transcript: artifact?.transcript || null,
          recording_url: typeof artifact?.recordingUrl === 'string'
            ? artifact.recordingUrl
            : null,
          call_type: 'inbound',
          total_cost: message.cost || 0,
          started_at: message.startedAt || new Date().toISOString(),
          ended_at: message.endedAt || new Date().toISOString(),
          sentiment: analysis?.sentiment || null,
          metadata: {
            source: 'vapi-webhook-handler',
            endedReason: message.endedReason,
            successEvaluation: analysis?.successEvaluation
          }
        }, { onConflict: 'vapi_call_id' });

      if (upsertError) {
        log.error('Vapi-Webhook', 'Failed to upsert call_logs', {
          error: upsertError.message,
          callId: call?.id
        });
      } else {
        log.info('Vapi-Webhook', '✅ Call logged to call_logs', {
          callId: call?.id,
          orgId
        });

        // Broadcast to dashboard via WebSocket
        try {
          const { wsBroadcast } = await import('../services/websocket');
          wsBroadcast(orgId, { type: 'call_ended', callId: call?.id });
        } catch (e) { /* non-critical */ }
      }

      // Also run analytics (existing behavior)
      AnalyticsService.processEndOfCall(message);

      return res.json({ success: true, received: true });
    }

    // 3. Handle Assistant Request (RAG)
    // Legacy support: if message is a string, it's the user query
    // Modern support: if message is object with type 'assistant-request' OR no type but has 'role'
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
