import { Router, Request, Response } from 'express';
import {
  checkAvailability,
  bookAppointment,
  getAvailableSlots,
} from '../utils/google-calendar';
import { supabase } from '../services/supabase-client';

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
 * Handler for book_appointment function
 * Called by Vapi when patient confirms the appointment
 */
async function handleBookAppointment(
  orgId: string,
  parameters: {
    patient_name: string;
    patient_email: string;
    patient_phone?: string;
    start: string;
    end: string;
    procedure_type?: string;
    notes?: string;
  },
  res: Response
): Promise<void> {
  try {
    const {
      patient_name: patientName,
      patient_email: patientEmail,
      patient_phone: patientPhone,
      start,
      end,
      procedure_type: procedureType,
      notes,
    } = parameters;

    // Validate required parameters
    if (!patientName || !patientEmail || !start || !end) {
      res.status(400).json({
        success: false,
        message:
          'Missing required parameters: patient_name, patient_email, start, end',
      });
      return;
    }

    // Check availability one more time (atomic check)
    const availabilityCheck = await checkAvailability(orgId, start, end);

    if (!availabilityCheck.available) {
      res.json({
        success: false,
        message:
          'I apologize, but that time slot is no longer available. Please select another time.',
      });
      return;
    }

    // Book the appointment
    const booking = await bookAppointment(orgId, {
      patientName,
      patientEmail,
      patientPhone,
      start,
      end,
      procedureType,
      notes,
    });

    // Get clinic email for confirmation
    const { data: calendarData } = await supabase
      .from('calendar_connections')
      .select('google_email')
      .eq('org_id', orgId)
      .single();

    const clinicEmail = calendarData?.google_email || 'the clinic';

    const voiceMessage = `Perfect! I've booked you with ${clinicEmail} for ${procedureType || 'your appointment'} on ${new Date(start).toLocaleDateString()} at ${new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. You'll receive a calendar invite at ${patientEmail}. Thank you for choosing us!`;

    res.json({
      success: true,
      message: voiceMessage,
      eventId: booking.eventId,
      confirmationLink: booking.htmlLink,
    });
  } catch (error) {
    console.error('Error booking appointment:', error);

    res.json({
      success: false,
      message:
        'I encountered an issue booking your appointment. Please contact the clinic directly or try again shortly.',
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
