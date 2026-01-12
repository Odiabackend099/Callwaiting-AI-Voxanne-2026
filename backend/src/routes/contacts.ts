/**
 * Contacts Routes
 * Handles contact management, lead scoring, and outbound communications
 * Multi-tenant safe: all queries filtered by org_id
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { log } from '../services/logger';
import { sendHotLeadSMS } from '../services/sms-notifications';
import { scoreLead } from '../services/lead-scoring';

const contactsRouter = Router();

contactsRouter.use(requireAuthOrDev);

/**
 * GET /api/contacts/stats
 * Get aggregated contact statistics
 * @returns Contact counts by lead status and total
 */
contactsRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
      .from('contacts')
      .select('lead_status', { count: 'exact' })
      .eq('org_id', orgId);

    if (error) {
      log.error('Contacts', 'GET /stats - Database error', { orgId, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    const stats = {
      total: data?.length || 0,
      hot: data?.filter(c => c.lead_status === 'hot').length || 0,
      warm: data?.filter(c => c.lead_status === 'warm').length || 0,
      cold: data?.filter(c => c.lead_status === 'cold').length || 0
    };

    return res.json(stats);
  } catch (e: any) {
    log.error('Contacts', 'GET /stats - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch contact stats' });
  }
});

/**
 * GET /api/contacts
 * List contacts with pagination and filtering
 * Uses RPC function to bypass PostgREST schema cache issues
 * @query page - Page number (default 1)
 * @query limit - Items per page (default 20, max 100)
 * @query leadStatus - Filter by status: 'hot', 'warm', 'cold'
 * @query search - Search by name, phone, or email
 * @returns Paginated list of contacts
 */
contactsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      leadStatus: z.enum(['hot', 'warm', 'cold']).optional(),
      search: z.string().optional()
    });

    const parsed = schema.parse(req.query);
    const offset = (parsed.page - 1) * parsed.limit;

    // Call RPC function directly - bypasses schema introspection cache
    const { data, error } = await supabase.rpc('get_contacts_paged', {
      p_org_id: orgId,
      p_limit: parsed.limit,
      p_offset: offset,
      p_lead_status: parsed.leadStatus || null,
      p_search: parsed.search || null
    });

    if (error) {
      log.error('Contacts', 'GET / - RPC error', { orgId, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    const rows = Array.isArray(data) ? data : [];
    const total = rows.length > 0 ? (rows[0] as any).total_count : 0;

    // Remove total_count from response data
    const contacts = rows.map(row => {
      const { total_count, ...contact } = row as any;
      return contact;
    });

    return res.json({
      contacts,
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total,
        pages: Math.ceil(total / parsed.limit)
      }
    });
  } catch (e: any) {
    log.error('Contacts', 'GET / - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch contacts' });
  }
});

/**
 * POST /api/contacts
 * Create a new contact
 * @body name - Contact name (required)
 * @body phone - Phone number (required, unique per org)
 * @body email - Email address (optional)
 * @body serviceInterests - Array of interested services (optional)
 * @body leadStatus - Initial lead status (optional, default 'warm')
 * @returns Created contact
 */
contactsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      name: z.string().min(1),
      phone: z.string().min(10),
      email: z.string().email().optional(),
      serviceInterests: z.array(z.string()).optional(),
      leadStatus: z.enum(['hot', 'warm', 'cold']).optional().default('warm')
    });

    const parsed = schema.parse(req.body);

    // Check for duplicate phone within org
    const { data: existing, error: existingError } = await supabase
      .from('contacts')
      .select('id')
      .eq('org_id', orgId)
      .eq('phone', parsed.phone)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Contact with this phone number already exists in your organization' });
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        org_id: orgId,
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email || null,
        service_interests: parsed.serviceInterests || [],
        lead_status: parsed.leadStatus,
        lead_score: 50, // Default score for manually created contacts
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      log.error('Contacts', 'POST / - Database error', { orgId, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Contacts', 'Contact created', { orgId, contactId: data.id, phone: parsed.phone });
    return res.status(201).json(data);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const firstError = e.issues?.[0];
      return res.status(400).json({ error: 'Invalid input: ' + (firstError?.message || 'validation failed') });
    }
    log.error('Contacts', 'POST / - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to create contact' });
  }
});

/**
 * GET /api/contacts/:id
 * Get contact profile with call and appointment history
 * @param id - Contact ID
 * @returns Contact with call history, appointment history, and aggregated metrics
 */
contactsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (contactError || !contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Fetch call history
    const { data: calls, error: callsError } = await supabase
      .from('call_logs')
      .select('id, phone_number, caller_name, duration_seconds, status, created_at, sentiment_score, sentiment_label')
      .eq('org_id', orgId)
      .eq('phone_number', contact.phone)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch appointment history
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, service_type, scheduled_at, status, created_at')
      .eq('org_id', orgId)
      .eq('contact_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(10);

    const enhancedContact = {
      ...contact,
      call_history: calls || [],
      appointment_history: appointments || [],
      total_calls: calls?.length || 0,
      total_appointments: appointments?.length || 0
    };

    return res.json(enhancedContact);
  } catch (e: any) {
    log.error('Contacts', 'GET /:id - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch contact' });
  }
});

/**
 * PATCH /api/contacts/:id
 * Update contact details
 * @param id - Contact ID
 * @body name - Name update
 * @body email - Email update
 * @body serviceInterests - Service interests array
 * @body notes - Contact notes
 * @body leadStatus - Lead status update
 * @returns Updated contact
 */
contactsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const schema = z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      serviceInterests: z.array(z.string()).optional(),
      notes: z.string().optional(),
      leadStatus: z.enum(['hot', 'warm', 'cold']).optional()
    });

    const parsed = schema.parse(req.body);

    // Verify contact exists
    const { data: existing, error: existingError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const { data, error } = await supabase
      .from('contacts')
      .update({
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.email !== undefined ? { email: parsed.email } : {}),
        ...(parsed.serviceInterests !== undefined ? { service_interests: parsed.serviceInterests } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
        ...(parsed.leadStatus !== undefined ? { lead_status: parsed.leadStatus } : {}),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*')
      .single();

    if (error) {
      log.error('Contacts', 'PATCH /:id - Database error', { orgId, contactId: id, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Contacts', 'Contact updated', { orgId, contactId: id });
    return res.json(data);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    log.error('Contacts', 'PATCH /:id - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to update contact' });
  }
});

/**
 * DELETE /api/contacts/:id
 * Delete a contact
 * @param id - Contact ID
 * @returns Success response
 */
contactsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      log.error('Contacts', 'DELETE /:id - Database error', { orgId, contactId: id, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Contacts', 'Contact deleted', { orgId, contactId: id });
    return res.json({ success: true });
  } catch (e: any) {
    log.error('Contacts', 'DELETE /:id - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to delete contact' });
  }
});

/**
 * POST /api/contacts/:id/call-back
 * Initiate an outbound call to a contact
 * @param id - Contact ID
 * @body agentId - Agent to use for the call (optional)
 * @returns Call initiation response with tracking ID
 */
contactsRouter.post('/:id/call-back', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const schema = z.object({
      agentId: z.string().optional()
    });

    const parsed = schema.parse(req.body);

    // Fetch contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (contactError || !contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Create outbound call record
    const { data: call, error: callError } = await supabase
      .from('calls')
      .insert({
        org_id: orgId,
        phone_number: contact.phone,
        caller_name: contact.name,
        call_type: 'outbound',
        status: 'initiated',
        call_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (callError) {
      log.error('Contacts', 'POST /:id/call-back - Failed to create call', { orgId, contactId: id, error: callError.message });
      return res.status(500).json({ error: 'Failed to initiate call' });
    }

    log.info('Contacts', 'Outbound call initiated', { orgId, contactId: id, callId: call.id, phone: contact.phone });
    return res.status(201).json({
      callId: call.id,
      contactId: id,
      phone: contact.phone,
      status: 'initiated',
      message: '🔥 Outbound call initiated'
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    log.error('Contacts', 'POST /:id/call-back - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to initiate call' });
  }
});

/**
 * POST /api/contacts/:id/sms
 * Send SMS notification to contact
 * @param id - Contact ID
 * @body message - SMS message (max 160 characters)
 * @returns SMS delivery confirmation
 */
contactsRouter.post('/:id/sms', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const schema = z.object({
      message: z.string().min(1).max(160)
    });

    const parsed = schema.parse(req.body);

    // Fetch contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (contactError || !contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Send SMS
    try {
      const messageId = await sendHotLeadSMS(contact.phone, {
        name: contact.name,
        phone: contact.phone,
        service: contact.service_interests?.[0] || 'Service',
        summary: parsed.message
      }, orgId);

      // Log SMS in database
      const { error: logError } = await supabase
        .from('sms_logs')
        .insert({
          org_id: orgId,
          contact_id: id,
          phone_number: contact.phone,
          message: parsed.message,
          message_id: messageId,
          status: 'sent',
          created_at: new Date().toISOString()
        });

      if (logError) {
        log.warn('Contacts', 'POST /:id/sms - Failed to log SMS', { orgId, contactId: id, error: logError.message });
      }

      log.info('Contacts', 'SMS sent', { orgId, contactId: id, phone: contact.phone, messageId });
      return res.json({
        success: true,
        messageId,
        phone: contact.phone,
        message: '📱 SMS sent successfully'
      });
    } catch (smsError: any) {
      log.error('Contacts', 'POST /:id/sms - SMS delivery failed', { orgId, contactId: id, error: smsError?.message });
      return res.status(500).json({ error: 'Failed to send SMS: ' + (smsError?.message || 'Unknown error') });
    }
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const firstError = e.issues?.[0];
      return res.status(400).json({ error: 'Invalid input: ' + (firstError?.message || 'validation failed') });
    }
    log.error('Contacts', 'POST /:id/sms - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to send SMS' });
  }
});

export { contactsRouter };
