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

const appointmentsRouter = Router();

appointmentsRouter.use(requireAuthOrDev);

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
      status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
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
      log.error('Appointments', 'GET / - Database error', { orgId, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      appointments: data || [],
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / parsed.limit)
      }
    });
  } catch (e: any) {
    log.error('Appointments', 'GET / - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch appointments' });
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
        contact_phone: parsed.contactPhone,
        customer_name: parsed.customerName,
        contact_id: parsed.contact_id || null,
        status: 'scheduled',
        confirmation_sent: false,
        created_at: new Date().toISOString()
      })
      .select(`*,
        contacts(id, name, phone, email, lead_status)`)
      .single();

    if (error) {
      log.error('Appointments', 'POST / - Database error', { orgId, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Appointments', 'Appointment created', { orgId, appointmentId: data.id, service: parsed.serviceType });
    return res.status(201).json(data);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const firstError = e.issues?.[0];
      return res.status(400).json({ error: 'Invalid input: ' + (firstError?.message || 'validation failed') });
    }
    log.error('Appointments', 'POST / - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to create appointment' });
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

    return res.json(data);
  } catch (e: any) {
    log.error('Appointments', 'GET /:id - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch appointment' });
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
      status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
      notes: z.string().optional(),
      confirmationSent: z.boolean().optional()
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
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select(`*,
        contacts(id, name, phone, email, lead_status)`)
      .single();

    if (error) {
      log.error('Appointments', 'PATCH /:id - Database error', { orgId, appointmentId: id, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Appointments', 'Appointment updated', { orgId, appointmentId: id });
    return res.json(data);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    log.error('Appointments', 'PATCH /:id - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to update appointment' });
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
      log.error('Appointments', 'DELETE /:id - Database error', { orgId, appointmentId: id, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Appointments', 'Appointment deleted', { orgId, appointmentId: id });
    return res.json({ success: true });
  } catch (e: any) {
    log.error('Appointments', 'DELETE /:id - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to delete appointment' });
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
      .eq('status', 'scheduled');

    if (error) {
      log.error('Appointments', 'GET /available-slots - Database error', { orgId, date: parsed.date, error: error.message });
      return res.status(500).json({ error: error.message });
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
    log.error('Appointments', 'GET /available-slots - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch available slots' });
  }
});

export { appointmentsRouter };
