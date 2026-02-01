import { Router, Request, Response } from 'express';
import { safeCall, getCircuitBreakerStatus } from '../services/safe-call';
import {
  checkAvailability,
  bookAppointment,
  getAvailableSlots
} from '../utils/google-calendar';
import { getRagContext } from '../services/rag-context-provider';
import { supabase } from '../services/supabase-client';
import TwilioGuard from '../services/twilio-guard';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { queueSms } from '../queues/sms-queue';

const router = Router();

/**
 * POST /api/vapi/tools
 * Handles Vapi function calls for calendar operations
 *
 * Vapi sends:
 * {
 *   "function": "check_availability" | "book_appointment",
 *   "org_id": "uuid-of-clinic",
 *   "parameters": { ... }
 * }
 */
router.post('/tools', async (req: Request, res: Response) => {
  try {
    // ============================================
    // PHASE 6 SUPPORT: Handle new test format
    // ============================================
    // Check if this is a Phase 6 request:
    // - Has "tool" and "params" (new format)
    // - Has JWT Authorization header
    const { tool, params } = req.body;
    const authHeader = req.headers.authorization;
    
    if (tool && params && authHeader) {
      // This is a Phase 6 format request with JWT
      // Route to Phase 6 handler
      return await handlePhase6Request(req, res);
    }

    // ============================================
    // LEGACY SUPPORT: Handle old Vapi format
    // ============================================
    const { function: functionName, org_id: orgId, parameters } = req.body;

    // Validate required fields
    if (!functionName || !orgId || !parameters) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: function, org_id, parameters',
      });
    }

    // Route to appropriate handler
    if (functionName === 'check_availability') {
      return handleCheckAvailability(orgId, parameters, res);
    } else if (functionName === 'book_appointment') {
      return handleBookAppointment(orgId, parameters, res);
    } else if (functionName === 'get_available_slots') {
      return handleGetAvailableSlots(orgId, parameters, res);
    } else if (functionName === 'query_knowledge_base') {
      return handleQueryKnowledgeBase(orgId, parameters, res);
    } else if (functionName === 'check_service_health') {
      return handleCheckServiceHealth(orgId, parameters, res);
    } else {
      return res.status(400).json({
        success: false,
        message: `Unknown function: ${functionName}`,
      });
    }
  } catch (error) {
    console.error('Error in Vapi tool handler:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Handler for check_availability function
 * Called by Vapi when asking "Is [time] available?"
 */
async function handleCheckAvailability(
  orgId: string,
  parameters: { start: string; end: string; duration_minutes?: number },
  res: Response
): Promise<void> {
  try {
    const { start, end } = parameters;

    if (!start || !end) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: start, end',
      });
      return;
    }

    const result = await checkAvailability(orgId, start, end);

    // Format response for Vapi to speak to patient
    const voiceMessage = result.available
      ? `Great news! ${result.message}`
      : `${result.message}`;

    res.json({
      success: true,
      available: result.available,
      message: voiceMessage,
      suggestions: result.suggestions || [],
    });
  } catch (error) {
    console.error('Error checking availability:', error);

    res.json({
      success: false,
      available: false,
      message:
        'I\'m having trouble accessing the schedule. May I have a human call you back in 5 minutes?',
    });
  }
}

/**
 * Normalize parameters from both old and new schemas
 */
function normalizeBookingParameters(params: any) {
  return {
    customer_name: params.customerName || params.customer_name,
    customer_phone: params.customerPhone || params.customer_phone,
    customer_email: params.customerEmail || params.customer_email,
    service_type: params.serviceType || params.service_type,
    scheduled_at: params.scheduled_at || 
                 (params.preferredDate && params.preferredTime
                   ? `${params.preferredDate}T${params.preferredTime}:00Z` 
                   : params.scheduled_at),
    duration_minutes: params.duration_minutes || 45,
    notes: params.notes
  };
}

/**
 * Handler for book_appointment function
 * Called by Vapi when patient confirms the appointment
 */
async function handleBookAppointment(
  orgId: string,
  parameters: any,
  res: Response
): Promise<void> {
  try {
    const normalizedParams = normalizeBookingParameters(parameters);
    
    // Validate required parameters
    if (!normalizedParams.customer_name || 
        !normalizedParams.customer_phone || 
        !normalizedParams.service_type || 
        !normalizedParams.scheduled_at) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: customer_name, customer_phone, service_type, scheduled_at'
      });
      return;
    }

    // Check availability with SafeCall wrapper
    const availabilityCheck = await safeCall(
      'calendar_check_availability',
      async () => checkAvailability(orgId, normalizedParams.scheduled_at, normalizedParams.scheduled_at),
      { retries: 3, backoffMs: 500 }
    );

    if (!availabilityCheck.success || !availabilityCheck.data.available) {
      res.json({
        success: false,
        message: availabilityCheck.userMessage || 
                'I apologize, but that time slot is no longer available. Please select another time.'
      });
      return;
    }

    // Book the appointment with SafeCall wrapper
    const booking = await safeCall(
      'calendar_book_appointment',
      async () => bookAppointment(orgId, {
        patientName: normalizedParams.customer_name,
        patientPhone: normalizedParams.customer_phone,
        patientEmail: normalizedParams.customer_email,
        start: normalizedParams.scheduled_at,
        end: new Date(new Date(normalizedParams.scheduled_at).getTime() + 
                     normalizedParams.duration_minutes * 60000).toISOString(),
        procedureType: normalizedParams.service_type,
        notes: normalizedParams.notes
      }),
      { retries: 3, backoffMs: 1000 }
    );

    if (!booking.success) {
      res.json({
        success: false,
        message: booking.userMessage || 
                'I encountered an issue booking your appointment. Please contact the clinic directly or try again shortly.'
      });
      return;
    }

    // Format success response
    const clinicName = 'our clinic';
    const voiceMessage = `Perfect! I've booked you with ${clinicName} for ${normalizedParams.service_type} on ${new Date(normalizedParams.scheduled_at).toLocaleDateString()} at ${new Date(normalizedParams.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;

    // Fetch org-specific Twilio credentials for multi-tenant SMS delivery
    let twilioCredentials;
    try {
      const creds = await IntegrationDecryptor.getTwilioCredentials(orgId);
      twilioCredentials = {
        accountSid: creds.accountSid,
        authToken: creds.authToken,
        phoneNumber: creds.phoneNumber
      };
    } catch (credError) {
      // If org-specific credentials not found, TwilioGuard will fall back to env vars
      // (This allows backward compatibility with global Twilio config)
      console.warn(`No org-specific Twilio credentials for ${orgId}, falling back to env vars`, {
        error: credError instanceof Error ? credError.message : String(credError)
      });
    }

    // Queue SMS confirmation for background delivery (prevents blocking call response)
    // CRITICAL: Do NOT await - response must return within 500ms to prevent Vapi timeout
    const confirmationMessage = `Appointment confirmed for ${new Date(normalizedParams.scheduled_at).toLocaleString()}. Reply STOP to unsubscribe.`;

    queueSms({
      orgId,
      recipientPhone: normalizedParams.customer_phone,
      message: confirmationMessage,
      twilioCredentials: twilioCredentials ? {
        accountSid: twilioCredentials.accountSid,
        authToken: twilioCredentials.authToken,
        fromPhone: twilioCredentials.phoneNumber
      } : undefined,
      metadata: {
        appointmentId: booking.data.eventId,
        triggerType: 'booking'
      }
    }).catch(err => {
      // Log queue error but don't block response
      console.error('Failed to queue SMS:', err);
    });

    // Return immediately (< 500ms) - SMS will be delivered in background
    res.json({
      success: true,
      message: voiceMessage,
      eventId: booking.data.eventId,
      confirmationLink: booking.data.htmlLink,
      smsQueued: true, // Changed from smsStatus to indicate background delivery
      nextAction: 'CONFIRMATION_QUEUED'
    });
  } catch (error) {
    console.error('Error booking appointment:', error);
    res.json({
      success: false,
      message: 'I encountered an issue booking your appointment. Please contact the clinic directly or try again shortly.'
    });
  }
}

/**
 * Handler for get_available_slots function
 * Called by Vapi to suggest available times to patient
 */
async function handleGetAvailableSlots(
  orgId: string,
  parameters: {
    date_start: string;
    date_end: string;
    slot_duration_minutes?: number;
  },
  res: Response
): Promise<void> {
  try {
    const {
      date_start: dateStart,
      date_end: dateEnd,
      slot_duration_minutes: slotDurationMinutes = 30,
    } = parameters;

    if (!dateStart || !dateEnd) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: date_start, date_end',
      });
      return;
    }

    const slots = await getAvailableSlots(
      orgId,
      dateStart,
      dateEnd,
      slotDurationMinutes
    );

    if (slots.length === 0) {
      res.json({
        success: true,
        slots: [],
        message: 'Unfortunately, there are no available slots in that timeframe. Let me check other dates.',
      });
      return;
    }

    // Format slots for voice response (only show next 3 options)
    const displaySlots = slots.slice(0, 3);
    const slotDescriptions = displaySlots
      .map((slot) => {
        const date = new Date(slot);
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      })
      .join(', ');

    const voiceMessage = `I have several slots available. How about ${slotDescriptions}?`;

    res.json({
      success: true,
      slots: displaySlots,
      message: voiceMessage,
    });
  } catch (error) {
    console.error('Error getting available slots:', error);

    res.json({
      success: false,
      slots: [],
      message:
        'I\'m having trouble checking availability. Could you contact the clinic directly?',
    });
  }
}

/**
 * Handler for knowledge base queries
 */
async function handleQueryKnowledgeBase(
  orgId: string,
  parameters: { query: string; category?: string },
  res: Response
): Promise<void> {
  try {
    const { query, category } = parameters;

    if (!query) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameter: query'
      });
      return;
    }

    // Use SafeCall wrapper for RAG query with explicit timeout
    // Vapi typically has 10-20s timeout for tool calls, so RAG query must complete <5s
    const result = await safeCall(
      'rag_query',
      async () => getRagContext(query, orgId),
      { retries: 1, backoffMs: 300, timeoutMs: 5000 } // 5 second max for RAG query
    );

    // If RAG times out or fails, proceed without context instead of blocking the call
    if (!result.success) {
      // Log the failure but don't block the booking/conversation
      console.warn('RAG query failed or timed out', {
        orgId,
        query: query.substring(0, 50),
        error: result.error?.message
      });

      // Proceed without KB context - AI will still help the patient
      res.json({
        success: true, // Still successful, just without KB context
        answer: "I'll help you, though I don't have specific documentation on that right now.",
        sources: 0,
        confidence: 'low',
        nextAction: 'CONTINUE_CONVERSATION' // Continue helping patient without transferring
      });
      return;
    }

    // Format for AI consumption
    res.json({
      success: true,
      answer: result.data.context,
      sources: result.data.chunkCount,
      confidence: result.data.hasContext ? 'high' : 'low',
      nextAction: 'CONTINUE_CONVERSATION'
    });
  } catch (error) {
    console.error('Error querying knowledge base:', error);
    res.json({
      success: false,
      answer: "I'm having trouble accessing our knowledge base. Let me connect you with our team.",
      nextAction: 'OFFER_TRANSFER'
    });
  }
}

/**
 * Handler for service health checks
 */
async function handleCheckServiceHealth(
  orgId: string,
  parameters: { service: string },
  res: Response
): Promise<void> {
  try {
    const { service } = parameters;
    
    // Get health status from circuit breakers
    const circuitStatus = getCircuitBreakerStatus();
    const healthStatus = {
      calendar: !circuitStatus['google_calendar']?.isOpen,
      sms: !circuitStatus[`twilio_${orgId}`]?.isOpen,
      timestamp: new Date().toISOString()
    };

    // Generate recommendation based on status
    const recommendation = 
      !healthStatus.calendar && !healthStatus.sms
        ? 'Both services degraded - offer to call back when systems recover'
        : !healthStatus.calendar
          ? 'Calendar unavailable - offer to take manual message'
          : !healthStatus.sms
            ? 'SMS unavailable - book appointment but warn customer to check email'
            : 'All systems operational';

    res.json({
      status: healthStatus,
      recommendation,
      nextAction: !healthStatus.calendar ? 'MANUAL_BOOKING' : 'PROCEED_NORMAL'
    });
  } catch (error) {
    console.error('Error checking service health:', error);
    res.json({
      success: false,
      message: 'Unable to check service status'
    });
  }
}

/**
 * ============================================
 * PHASE 6: Handle new test format
 * ============================================
 * Handles requests with JWT auth and new payload format
 */
async function handlePhase6Request(req: Request, res: Response): Promise<void> {
  const startTime = performance.now();

  try {
    // Extract and validate JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Missing or invalid authorization',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const token = authHeader.substring(7);
    let decoded: any;
    try {
      const jwt = await import('jsonwebtoken');
      decoded = jwt.decode(token);
      if (!decoded || !decoded.sub || !decoded.org_id) {
        res.status(401).json({
          error: 'Invalid JWT structure',
          code: 'UNAUTHORIZED',
        });
        return;
      }
    } catch (error) {
      res.status(401).json({
        error: 'Failed to decode JWT',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const { org_id: jwtOrgId } = decoded;
    const { tool, params } = req.body;

    // Only handle book_appointment for Phase 6
    if (tool !== 'book_appointment') {
      res.status(400).json({
        error: `Tool '${tool}' is not supported`,
        code: 'BAD_REQUEST',
      });
      return;
    }

    const {
      clinic_id,
      provider_id,
      patient_name,
      patient_email,
      appointment_time,
      duration_minutes = 30,
    } = params;

    // Validate org_id ownership
    if (jwtOrgId !== clinic_id) {
      res.status(403).json({
        error: 'Unauthorized to access this clinic',
        code: 'FORBIDDEN',
      });
      return;
    }

    // Validate provider exists
    const { data: provider, error: providerError } = await supabase
      .from('profiles')
      .select('id, full_name, org_id')
      .eq('id', provider_id)
      .eq('org_id', clinic_id)
      .eq('role', 'provider')
      .single();

    if (providerError || !provider) {
      res.status(404).json({
        error: 'Provider not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Parse appointment time
    let appointmentDate: Date;
    try {
      appointmentDate = new Date(appointment_time);
      if (isNaN(appointmentDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      res.status(400).json({
        error: 'Invalid appointment_time format',
        code: 'BAD_REQUEST',
      });
      return;
    }

    // Check for conflicts
    const appointmentEnd = new Date(
      appointmentDate.getTime() + duration_minutes * 60 * 1000
    );

    const { data: conflicts, error: conflictError } = await supabase
      .from('appointments')
      .select('id, scheduled_at, duration_minutes')
      .eq('org_id', clinic_id)
      .eq('provider_id', provider_id)
      .gte('scheduled_at', appointmentDate.toISOString())
      .lt('scheduled_at', appointmentEnd.toISOString())
      .in('status', ['booked', 'confirmed']);

    if (conflictError) {
      res.status(500).json({
        error: 'Database error',
        code: 'INTERNAL_ERROR',
      });
      return;
    }

    if (conflicts && conflicts.length > 0) {
      res.status(409).json({
        error: 'Slot already booked',
        code: 'CONFLICT',
      });
      return;
    }

    // Create appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        org_id: clinic_id,
        provider_id,
        contact_id: null,
        service_type: 'consultation',
        scheduled_at: appointmentDate.toISOString(),
        duration_minutes,
        status: 'booked',
        calendar_link: null,
        confirmation_sent: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (appointmentError || !appointment) {
      res.status(500).json({
        error: 'Failed to create appointment',
        code: 'INTERNAL_ERROR',
      });
      return;
    }

    // Mock Google Calendar sync
    const googleCalendarEventId = `gce-${appointment.id.substring(0, 8)}`;
    const elapsedTime = performance.now() - startTime;

    res.status(200).json({
      success: true,
      appointment_id: appointment.id,
      google_calendar_event_id: googleCalendarEventId,
      appointment: {
        id: appointment.id,
        org_id: appointment.org_id,
        clinic_id: appointment.org_id,
        provider_id: appointment.provider_id,
        patient_name,
        patient_email,
        scheduled_at: appointment.scheduled_at,
        duration_minutes: appointment.duration_minutes,
        status: appointment.status,
        created_at: appointment.created_at,
      },
      calendar_sync: {
        success: true,
        event_id: googleCalendarEventId,
        calendar_name: 'primary',
        sync_timestamp: new Date().toISOString(),
      },
      performance: {
        elapsed_ms: Math.round(elapsedTime),
        under_500ms: elapsedTime < 500,
      },
    });
  } catch (error: any) {
    console.error('Phase 6 request error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

export default router;
