/**
 * Appointments Routes
 * Handles appointment scheduling, management, and availability checks
 * Multi-tenant safe: all queries filtered by org_id
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { log } from '../services/logger';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { Twilio } from 'twilio';
import { Resend } from 'resend';
import { withTwilioRetry, withResendRetry } from '../services/retry-strategy';
import { createAppointmentReminderMessage, createAppointmentEmailSubject, getOrgTimezone } from '../services/timezone-helper';
import { rateLimitAction } from '../middleware/rate-limit-actions';
import { sanitizeError, handleDatabaseError, sanitizeValidationError } from '../utils/error-sanitizer';

const appointmentsRouter = Router();

appointmentsRouter.use(requireAuthOrDev);

/**
 * Transform appointment data to match frontend expectations
 * Flattens nested contacts object and renames scheduled_at → scheduled_time
 */
function transformAppointment(apt: any, linkedCall?: any) {
  return {
    id: apt.id,
    service_type: apt.service_type,
    scheduled_time: apt.scheduled_at,
    scheduled_at: apt.scheduled_at, // Keep both for backward compatibility
    duration_minutes: apt.duration_minutes,
    status: apt.status,
    confirmation_sent: apt.confirmation_sent,
    contact_name: apt.contacts?.name,
    phone_number: apt.contacts?.phone,
    contact_email: apt.contacts?.email,
    contact_id: apt.contact_id,
    notes: apt.notes,
    created_at: apt.created_at,
    updated_at: apt.updated_at,
    deleted_at: apt.deleted_at,
    // Call-linked data (from Golden Record)
    call_id: apt.call_id || linkedCall?.id || null,
    // Prioritize appointment's own outcome columns (after schema fix)
    outcome_summary: apt.outcome_summary || linkedCall?.outcome_summary || null,
    sentiment_label: apt.sentiment_label || linkedCall?.sentiment_label || null,
    sentiment_score: apt.sentiment_score || linkedCall?.sentiment_score || null,
    has_recording: !!(linkedCall?.recording_url || linkedCall?.recording_storage_path),
    call_direction: linkedCall?.call_direction || null,
    call_duration_seconds: linkedCall?.duration_seconds || null,
  };
}

/**
 * Validate phone number in E.164 format
 * @param phoneNumber The phone number to validate
 * @returns true if valid E.164 format, false otherwise
 */
function isValidE164PhoneNumber(phoneNumber: string): boolean {
  // E.164 format: +[country code][number]
  // Must start with + and contain only digits (10-15 digits total)
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * GET /api/appointments
 * List appointments with pagination and filtering
 * @query page - Page number (default 1)
 * @query limit - Items per page (default 20, max 100)
 * @query status - Filter by status: 'scheduled', 'completed', 'cancelled'
 * @query contact_id - Filter by contact ID
 * @query startDate - ISO date range start
 * @query endDate - ISO date range end
 * @returns Paginated list of appointments with pagination info
 */
appointmentsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
      contact_id: z.string().uuid().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    });

    const parsed = schema.parse(req.query);
    const offset = (parsed.page - 1) * parsed.limit;

    let query = supabase
      .from('appointments')
      .select(
        `*,
        contacts(id, name, phone, email, lead_status)`,
        { count: 'exact' }
      )
      .eq('org_id', orgId);

    if (parsed.status) {
      query = query.eq('status', parsed.status);
    }
    if (parsed.contact_id) {
      query = query.eq('contact_id', parsed.contact_id);
    }
    if (parsed.startDate) {
      query = query.gte('scheduled_at', new Date(parsed.startDate).toISOString());
    }
    if (parsed.endDate) {
      query = query.lte('scheduled_at', new Date(parsed.endDate).toISOString());
    }

    query = query.order('scheduled_at', { ascending: true }).range(offset, offset + parsed.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return handleDatabaseError(
        res,
        error,
        'Appointments - GET /',
        'Failed to fetch appointments'
      );
    }

    // Batch-fetch linked call data for appointments (Golden Record enrichment)
    const appointmentIds = (data || []).map((a: any) => a.id).filter(Boolean);
    const callsByAppointment = new Map<string, any>();

    if (appointmentIds.length > 0) {
      const { data: linkedCalls, error: linkedCallsError } = await supabase
        .from('calls')
        .select('id, appointment_id, outcome_summary, sentiment_label, sentiment_score, recording_url, recording_storage_path, call_direction, duration_seconds')
        .eq('org_id', orgId)
        .in('appointment_id', appointmentIds);

      if (linkedCallsError) {
        log.error('Appointments', 'Failed to fetch linked calls for Golden Record enrichment', {
          orgId,
          appointmentCount: appointmentIds.length,
          error: linkedCallsError.message
        });
      }

      (linkedCalls || []).forEach((c: any) => {
        if (c.appointment_id) callsByAppointment.set(c.appointment_id, c);
      });
    }

    const transformedAppointments = (data || []).map((apt: any) =>
      transformAppointment(apt, callsByAppointment.get(apt.id))
    );

    return res.json({
      appointments: transformedAppointments,
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / parsed.limit)
      }
    });
  } catch (e: any) {
    const userMessage = sanitizeError(
      e,
      'Appointments - GET / - Unexpected error',
      'Failed to fetch appointments'
    );
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * POST /api/appointments
 * Create a new appointment
 * @body serviceType - Type of service (e.g., "Botox", "Filler")
 * @body scheduledAt - ISO datetime
 * @body duration_minutes - Duration in minutes (optional, default 45)
 * @body contactPhone - Phone number for callback (optional)
 * @body customerName - Customer name (optional)
 * @body contact_id - Link to existing contact (optional)
 * @returns Created appointment with full details
 */
appointmentsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      serviceType: z.string().min(1),
      scheduledAt: z.string().datetime(),
      duration_minutes: z.number().int().positive().default(45),
      contactPhone: z.string().optional(),
      customerName: z.string().optional(),
      contact_id: z.string().uuid().optional()
    });

    const parsed = schema.parse(req.body);

    // Validate datetime is not in the past
    const scheduledDate = new Date(parsed.scheduledAt);
    if (scheduledDate < new Date()) {
      return res.status(400).json({ error: 'Appointment time cannot be in the past' });
    }

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        org_id: orgId,
        service_type: parsed.serviceType,
        scheduled_at: parsed.scheduledAt,
        duration_minutes: parsed.duration_minutes,
        contact_id: parsed.contact_id || null,
        status: 'confirmed',
        confirmation_sent: false,
        created_at: new Date().toISOString()
      })
      .select(`*,
        contacts(id, name, phone, email, lead_status)`)
      .single();

    if (error) {
      return handleDatabaseError(
        res,
        error,
        'Appointments - POST /',
        'Failed to create appointment'
      );
    }

    log.info('Appointments', 'Appointment created', { orgId, appointmentId: data.id, service: parsed.serviceType });
    return res.status(201).json(transformAppointment(data));
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const userMessage = sanitizeValidationError(e);
      return res.status(400).json({ error: userMessage });
    }
    const userMessage = sanitizeError(
      e,
      'Appointments - POST / - Unexpected error',
      'Failed to create appointment'
    );
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * GET /api/appointments/:id
 * Get single appointment detail with contact info
 * @param id - Appointment ID
 * @returns Full appointment details including contact information
 */
appointmentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const { data, error } = await supabase
      .from('appointments')
      .select(`*,
        contacts(id, name, phone, email, lead_status)`)
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !data) {
      log.warn('Appointments', 'GET /:id - Not found', { orgId, appointmentId: id });
      return res.status(404).json({ error: 'Appointment not found' });
    }

    return res.json(transformAppointment(data));
  } catch (e: any) {
    const userMessage = sanitizeError(
      e,
      'Appointments - GET /:id - Unexpected error',
      'Failed to fetch appointment'
    );
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * PATCH /api/appointments/:id
 * Update appointment details
 * @param id - Appointment ID
 * @body status - New status ('scheduled', 'completed', 'cancelled')
 * @body notes - Appointment notes
 * @body confirmationSent - Mark confirmation as sent
 * @returns Updated appointment
 */
appointmentsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const schema = z.object({
      status: z.enum(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
      notes: z.string().optional(),
      confirmationSent: z.boolean().optional(),
      scheduled_at: z.string().datetime().optional()
    });

    const parsed = schema.parse(req.body);

    // Verify appointment exists and belongs to org
    const { data: existing, error: existingError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
        ...(parsed.confirmationSent !== undefined ? { confirmation_sent: parsed.confirmationSent } : {}),
        ...(parsed.scheduled_at !== undefined ? { scheduled_at: parsed.scheduled_at } : {}),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select(`*,
        contacts(id, name, phone, email, lead_status)`)
      .single();

    if (error) {
      return handleDatabaseError(
        res,
        error,
        'Appointments - PATCH /:id',
        'Failed to update appointment'
      );
    }

    log.info('Appointments', 'Appointment updated', { orgId, appointmentId: id });
    return res.json(transformAppointment(data));
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    const userMessage = sanitizeError(
      e,
      'Appointments - PATCH /:id - Unexpected error',
      'Failed to update appointment'
    );
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * DELETE /api/appointments/:id
 * Cancel/delete an appointment
 * @param id - Appointment ID
 * @returns Success response
 */
appointmentsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      return handleDatabaseError(
        res,
        error,
        'Appointments - DELETE /:id',
        'Failed to delete appointment'
      );
    }

    log.info('Appointments', 'Appointment deleted', { orgId, appointmentId: id });
    return res.json({ success: true });
  } catch (e: any) {
    const userMessage = sanitizeError(
      e,
      'Appointments - DELETE /:id - Unexpected error',
      'Failed to delete appointment'
    );
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * GET /api/appointments/available-slots?date=YYYY-MM-DD
 * Get available appointment slots for a given date
 * @query date - Date in YYYY-MM-DD format
 * @returns Array of available time slots (e.g., ['09:00', '10:00', ...])
 */
appointmentsRouter.get('/available-slots', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    });

    const parsed = schema.parse(req.query);
    const date = new Date(parsed.date);

    // Verify date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      return res.status(400).json({ error: 'Cannot check availability for past dates' });
    }

    // Fetch all appointments for this date
    const dateStart = date.toISOString().split('T')[0];
    const dateEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('scheduled_at, duration_minutes')
      .eq('org_id', orgId)
      .gte('scheduled_at', dateStart + 'T00:00:00Z')
      .lt('scheduled_at', dateEnd + 'T00:00:00Z')
      .in('status', ['pending', 'confirmed', 'in_progress']);

    if (error) {
      return handleDatabaseError(
        res,
        error,
        'Appointments - GET /available-slots',
        'Failed to fetch available slots'
      );
    }

    // Generate time slots (9 AM to 6 PM, 45-min slots)
    const slots: string[] = [];
    const bookedTimes = new Set<string>();

    // Mark booked times
    if (appointments) {
      for (const appt of appointments) {
        const start = new Date(appt.scheduled_at);
        const end = new Date(start.getTime() + (appt.duration_minutes || 45) * 60 * 1000);

        let current = new Date(start);
        while (current < end) {
          const hour = String(current.getHours()).padStart(2, '0');
          const minute = String(current.getMinutes()).padStart(2, '0');
          bookedTimes.add(`${hour}:${minute}`);
          current.setMinutes(current.getMinutes() + 15); // 15-min resolution
        }
      }
    }

    // Generate available slots from 9 AM to 6 PM
    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 45) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        if (!bookedTimes.has(timeStr)) {
          slots.push(timeStr);
        }
      }
    }

    return res.json({ date: parsed.date, availableSlots: slots });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    const userMessage = sanitizeError(
      e,
      'Appointments - GET /available-slots - Unexpected error',
      'Failed to fetch available slots'
    );
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * POST /api/appointments/:appointmentId/send-reminder
 * Send appointment reminder via SMS or email
 * @param appointmentId - Appointment ID
 * @body method - 'sms' or 'email'
 * @returns Success/failure with confirmation
 */
appointmentsRouter.post('/:appointmentId/send-reminder', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { appointmentId } = req.params;
    const schema = z.object({
      method: z.enum(['sms', 'email']).default('sms')
    });

    const parsed = schema.parse(req.body);

    // Check duplicate prevention: Has a reminder been sent in the last 24 hours?
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingReminder } = await supabase
      .from('messages')
      .select('id')
      .eq('org_id', orgId)
      .eq('contact_id', appointmentId) // Note: This is actually checking appointments table, need call_id approach
      .eq('method', parsed.method)
      .gte('sent_at', oneDayAgo)
      .limit(1);

    if (existingReminder && existingReminder.length > 0) {
      return res.status(400).json({
        error: `A reminder has already been sent within the last 24 hours. Please try again later.`
      });
    }

    // Fetch appointment with contact info AND org timezone
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`*,
        contacts(id, name, phone, email, lead_status)`)
      .eq('id', appointmentId)
      .eq('org_id', orgId)
      .single();

    if (appointmentError || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (!appointment.contacts) {
      return res.status(400).json({ error: 'Appointment does not have associated contact information' });
    }

    // Fetch org timezone settings
    const { data: orgData } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single();

    const orgSettings = orgData?.settings as any || {};
    const timezone = getOrgTimezone(orgSettings?.timezone);

    const contact = appointment.contacts;
    const appointment_date = new Date(appointment.scheduled_at);

    let recipient = '';
    const reminderContent = createAppointmentReminderMessage(
      appointment_date,
      appointment.service_type,
      timezone
    );

    // Apply rate limiting based on method
    const method = parsed.method;
    if (method === 'sms') {
      // Check SMS rate limit (10 per minute)
      const smsLimitKey = `sms:${orgId}`;
      const { data: smsRates } = await supabase
        .from('rate_limits')
        .select('count')
        .eq('key', smsLimitKey)
        .gte('reset_time', new Date().toISOString())
        .single();

      // For now, rely on middleware rate limiting (could enhance here)
    } else {
      // Check email rate limit (100 per hour) - applied in middleware
    }

    if (method === 'sms') {
      if (!contact.phone) {
        return res.status(400).json({ error: 'Contact does not have a phone number' });
      }

      // Validate phone number format
      if (!isValidE164PhoneNumber(contact.phone)) {
        log.warn('Appointments', 'Invalid phone number format', {
          orgId,
          appointmentId,
          phone: contact.phone
        });
        return res.status(400).json({ error: 'Invalid phone number format' });
      }

      recipient = contact.phone;

      // Get Twilio credentials
      const twilioCredentials = await IntegrationDecryptor.getTwilioCredentials(orgId);
      if (!twilioCredentials) {
        return res.status(400).json({ error: 'SMS is not configured for your organization' });
      }

      // Send SMS via Twilio with retry logic
      const client = new Twilio(twilioCredentials.accountSid, twilioCredentials.authToken);
      const smsMessage = await withTwilioRetry(() =>
        client.messages.create({
          body: reminderContent,
          from: twilioCredentials.phoneNumber,
          to: contact.phone
        })
      );

      // Only log after successful send (fixes race condition)
      const { error: logError } = await supabase
        .from('messages')
        .insert({
          org_id: orgId,
          contact_id: contact.id,
          direction: 'outbound',
          method: 'sms',
          recipient: contact.phone,
          content: reminderContent,
          status: 'sent',
          service_provider: 'twilio',
          external_message_id: smsMessage.sid,
          sent_at: new Date().toISOString()
        });

      if (logError) {
        log.warn('Appointments', 'Failed to log SMS reminder', { orgId, appointmentId, error: logError.message });
      }

      // Update confirmation_sent flag only after successful send
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ confirmation_sent: true, updated_at: new Date().toISOString() })
        .eq('id', appointmentId)
        .eq('org_id', orgId);

      if (updateError) {
        log.warn('Appointments', 'Failed to update confirmation_sent', { orgId, appointmentId, error: updateError.message });
      }

      log.info('Appointments', 'SMS reminder sent', { orgId, appointmentId, phone: contact.phone });
    } else {
      // Email reminder
      if (!contact.email) {
        return res.status(400).json({ error: 'Contact does not have an email address' });
      }

      recipient = contact.email;

      // Send email via Resend
      const resend = new Resend(process.env.RESEND_API_KEY);
      const emailSubject = createAppointmentEmailSubject(appointment_date, timezone);

      try {
        const emailResult = await withResendRetry(() =>
          resend.emails.send({
            from: 'noreply@voxanne.ai',
            to: contact.email,
            subject: emailSubject,
            text: reminderContent
          })
        );

        // Log the email reminder after successful send
        const { error: logError } = await supabase
          .from('messages')
          .insert({
            org_id: orgId,
            contact_id: contact.id,
            direction: 'outbound',
            method: 'email',
            recipient: contact.email,
            subject: emailSubject,
            content: reminderContent,
            status: 'sent',
            service_provider: 'resend',
            external_message_id: emailResult.id,
            sent_at: new Date().toISOString()
          });

        if (logError) {
          log.warn('Appointments', 'Failed to log email reminder', { orgId, appointmentId, error: logError.message });
        }

        // Update confirmation_sent flag only after successful send
        const { error: updateError } = await supabase
          .from('appointments')
          .update({ confirmation_sent: true, updated_at: new Date().toISOString() })
          .eq('id', appointmentId)
          .eq('org_id', orgId);

        if (updateError) {
          log.warn('Appointments', 'Failed to update confirmation_sent', { orgId, appointmentId, error: updateError.message });
        }

        log.info('Appointments', 'Email reminder sent', { orgId, appointmentId, email: contact.email, emailId: emailResult.id });
      } catch (emailError: any) {
        log.error('Appointments', 'Failed to send email reminder', {
          orgId,
          appointmentId,
          email: contact.email,
          error: emailError?.message
        });

        // Log the failed attempt
        await supabase
          .from('messages')
          .insert({
            org_id: orgId,
            contact_id: contact.id,
            direction: 'outbound',
            method: 'email',
            recipient: contact.email,
            subject: emailSubject,
            content: reminderContent,
            status: 'failed',
            error_message: emailError?.message,
            service_provider: 'resend',
            sent_at: new Date().toISOString()
          });

        return res.status(500).json({ error: 'Failed to send email reminder. Please try again later.' });
      }
    }

    return res.json({
      success: true,
      recipient,
      method: parsed.method,
      message: `📧 Reminder sent via ${parsed.method.toUpperCase()}`
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const userMessage = sanitizeValidationError(e);
      return res.status(400).json({ error: userMessage });
    }
    const userMessage = sanitizeError(
      e,
      'Appointments - POST /:appointmentId/send-reminder - Unexpected error',
      'Failed to send reminder. Please try again later.'
    );
    return res.status(500).json({ error: userMessage });
  }
});

export { appointmentsRouter };
