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
 * Transform contact data to match frontend expectations
 * Maps: name → contact_name, phone → phone_number
 */
function transformContact(contact: any) {
  return {
    id: contact.id,
    contact_name: contact.name,
    phone_number: contact.phone,
    email: contact.email,
    last_contact_time: contact.last_contacted_at,
    booking_source: contact.booking_source,
    notes: contact.notes,
    services_interested: contact.service_interests || [],
    lead_score: contact.lead_score,
    lead_status: contact.lead_status,
    created_at: contact.created_at,
    updated_at: contact.updated_at
  };
}

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
      total_leads: data?.length || 0,
      hot_leads: data?.filter(c => c.lead_status === 'hot').length || 0,
      warm_leads: data?.filter(c => c.lead_status === 'warm').length || 0,
      cold_leads: data?.filter(c => c.lead_status === 'cold').length || 0
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

    // Remove total_count from response data and transform fields
    const contacts = rows.map(row => {
      const { total_count, ...contact } = row as any;
      return transformContact(contact);
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

    const transformedContact = transformContact(contact);
    const enhancedContact = {
      ...transformedContact,
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
 * E.164 phone number validation helper
 * @param phone - Phone number to validate
 * @returns True if phone is valid E.164 format (+[country code][number])
 */
function isValidE164Phone(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * POST /api/contacts/:id/call-back
 * Initiate an outbound call to a contact via Vapi
 * @param id - Contact ID
 * @body agentId - Agent to use for the call (optional)
 * @returns Call initiation response with Vapi tracking ID
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

    if (!contact.phone) {
      return res.status(400).json({
        error: 'Contact has no phone number. Please add a phone number in Leads.'
      });
    }

    // Validate E.164 format
    if (!isValidE164Phone(contact.phone)) {
      return res.status(400).json({
        error: `Invalid phone format: ${contact.phone}. Must be E.164 format (e.g., +12125551234)`
      });
    }

    // @ai-invariant DO NOT MODIFY this outbound agent resolution chain.
    // 1. Query MUST use .maybeSingle() (NOT .single() — throws PGRST116 on 0 rows)
    // 2. SELECT MUST include id, vapi_assistant_id, vapi_phone_number_id
    // 3. assistantId comes from agent.vapi_assistant_id (NOT vapi_assistant_id_outbound)
    // 4. If vapi_phone_number_id is null, MUST auto-resolve via resolveOrgPhoneNumberId()
    // 5. Resolved phone number MUST be backfilled to agents table
    // See: .claude/CLAUDE.md "CRITICAL INVARIANTS" section
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, vapi_assistant_id, vapi_phone_number_id')
      .eq('org_id', orgId)
      .eq('role', 'outbound')
      .maybeSingle();

    if (agentError || !agent) {
      log.error('Contacts', 'POST /:id/call-back - Agent not found', { orgId, error: agentError?.message });
      return res.status(400).json({ error: 'Outbound agent not configured. Please set up an agent in Agent Configuration.' });
    }

    const assistantId = agent.vapi_assistant_id;

    if (!assistantId) {
      return res.status(400).json({
        error: 'Outbound assistant not synced to Vapi. Please save the Outbound Configuration in Agent Configuration first.'
      });
    }

    // Resolve phone number: try agents table first, then auto-resolve from org credentials
    let phoneNumberId = agent.vapi_phone_number_id;

    if (!phoneNumberId) {
      log.info('Contacts', 'No vapi_phone_number_id on outbound agent, auto-resolving', { orgId });

      const vapiApiKey = process.env.VAPI_PRIVATE_KEY;
      if (!vapiApiKey) {
        return res.status(500).json({ error: 'Vapi is not configured on this server. Contact support.' });
      }

      const { resolveOrgPhoneNumberId } = await import('../services/phone-number-resolver');
      const resolved = await resolveOrgPhoneNumberId(orgId, vapiApiKey);
      phoneNumberId = resolved.phoneNumberId;

      // Backfill onto agents table for future calls
      if (phoneNumberId && agent.id) {
        await supabase
          .from('agents')
          .update({ vapi_phone_number_id: phoneNumberId })
          .eq('id', agent.id)
          .eq('org_id', orgId);

        log.info('Contacts', 'Auto-resolved and stored phone number on outbound agent', {
          orgId, agentId: agent.id, phoneNumberId
        });
      }
    }

    if (!phoneNumberId) {
      return res.status(400).json({
        error: 'No phone number available for outbound calls. Please import a Twilio number in Settings > Telephony.'
      });
    }

    // Create outbound call tracking record with status 'queued' (waiting to be initiated via Vapi)
    const { data: callTracking, error: callTrackingError } = await supabase
      .from('call_tracking')
      .insert({
        org_id: orgId,
        phone: contact.phone,
        agent_id: agent.id,
        status: 'queued',
        called_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (callTrackingError) {
      log.error('Contacts', 'POST /:id/call-back - Failed to create call tracking record', {
        orgId, contactId: id, error: callTrackingError.message
      });
      return res.status(500).json({ error: 'Failed to create call record' });
    }

    // Trigger Vapi outbound call
    try {
      const { VapiClient } = await import('../services/vapi-client');
      const vapiClient = new VapiClient(process.env.VAPI_PRIVATE_KEY!);

      const vapiCall = await vapiClient.createOutboundCall({
        assistantId,
        customer: {
          number: contact.phone,
          name: contact.name || 'Caller'
        },
        phoneNumberId
      });

      // Update call tracking record with Vapi call ID and change status to 'ringing'
      const { error: updateError } = await supabase
        .from('call_tracking')
        .update({
          vapi_call_id: vapiCall.id,
          status: 'ringing'
        })
        .eq('id', callTracking.id)
        .eq('org_id', orgId);

      if (updateError) {
        log.warn('Contacts', 'POST /:id/call-back - Failed to update call with Vapi ID', {
          error: updateError.message
        });
        // Continue anyway - call may still be initiated in Vapi
      }

      log.info('Contacts', 'Outbound call initiated via Vapi', {
        orgId, contactId: id, callTrackingId: callTracking.id, vapiCallId: vapiCall.id, phone: contact.phone
      });

      return res.status(201).json({
        callTrackingId: callTracking.id,
        vapiCallId: vapiCall.id,
        contactId: id,
        phone: contact.phone,
        status: 'ringing',
        message: `📞 Calling ${contact.phone}...`
      });

    } catch (vapiError: any) {
      const errorMessage = vapiError?.response?.data?.message || vapiError?.message || 'Unknown Vapi error';

      // @ai-invariant DO NOT auto-recreate the Vapi assistant here.
      // A previous version created a new assistant with NO tools, NO knowledge base,
      // and a generic system prompt, then overwrote agents.vapi_assistant_id — silently
      // destroying the user's configured agent. Instead, tell the user to re-save.
      if (errorMessage.includes('Couldn\'t get tool for hook') || (errorMessage.includes('toolId') && errorMessage.includes('does not exist'))) {
        log.error('Contacts', 'POST /:id/call-back - Assistant has invalid tool reference. User must re-save in Agent Configuration.', {
          orgId, callTrackingId: callTracking.id, error: errorMessage
        });

        await supabase
          .from('call_tracking')
          .update({ status: 'failed' })
          .eq('id', callTracking.id)
          .eq('org_id', orgId);

        return res.status(400).json({
          error: 'The outbound assistant has a stale tool reference. Please go to Agent Configuration, re-save the Outbound agent, and try again.',
          details: errorMessage
        });
      }

      log.error('Contacts', 'POST /:id/call-back - Vapi API error', {
        orgId, callTrackingId: callTracking.id, error: errorMessage
      });

      // Update call tracking status to 'failed'
      await supabase
        .from('call_tracking')
        .update({ status: 'failed' })
        .eq('id', callTracking.id)
        .eq('org_id', orgId);

      return res.status(500).json({
        error: 'Failed to initiate Vapi call. Please try again.',
        details: errorMessage
      });
    }

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
