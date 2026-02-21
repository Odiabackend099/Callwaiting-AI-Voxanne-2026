/**
 * Notifications Routes
 * Handles user notifications (hot leads, appointment reminders, etc.)
 * User-specific RLS: notifications only for logged-in user's org
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { log } from '../services/logger';
import { sanitizeError, sanitizeValidationError, handleDatabaseError } from '../utils/error-sanitizer';

const notificationsRouter = Router();

notificationsRouter.use(requireAuthOrDev);

/**
 * GET /api/notifications
 * List notifications with pagination
 * @query page - Page number (default 1)
 * @query limit - Items per page (default 20, max 100)
 * @query status - Filter by 'unread', 'read', 'all' (default 'all')
 * @query type - Filter by type: 'hot_lead', 'appointment', 'sms', 'call'
 * @returns Paginated notifications sorted by newest first
 */
notificationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: z.enum(['unread', 'read', 'all']).default('all'),
      // Allow both DB enums and frontend alias types
      type: z.enum([
        // DB Enums
        'hot_lead', 'appointment_booked', 'appointment_reminder', 'missed_call', 'system_alert', 'voicemail',
        // Frontend Aliases
        'appointment', 'call', 'system', 'sms', 'lead_update'
      ]).optional()
    });

    const parsed = schema.parse(req.query);
    const offset = (parsed.page - 1) * parsed.limit;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId);

    if (parsed.status === 'unread') {
      query = query.eq('is_read', false);
    } else if (parsed.status === 'read') {
      query = query.eq('is_read', true);
    }

    if (parsed.type) {
      if (parsed.type === 'appointment') {
        query = query.in('type', ['appointment_booked', 'appointment_reminder']);
      } else if (parsed.type === 'call') {
        query = query.in('type', ['missed_call', 'voicemail']);
      } else if (parsed.type === 'system') {
        query = query.eq('type', 'system_alert');
      } else if (parsed.type === 'sms') {
        // 'sms' isn't a DB type, maybe system_alert? Or ignore?
        // Legacy: 'sms' not in DB enum.
      } else if (parsed.type === 'lead_update') {
        // Legacy/Frontend only. Maybe map to hot_lead?
      } else {
        // Direct match for valid DB enums
        query = query.eq('type', parsed.type);
      }
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parsed.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      const userMessage = handleDatabaseError(res, error, 'Notifications - GET / - Database error', 'Failed to fetch notifications');
      return;
    }

    return res.json({
      notifications: data || [],
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / parsed.limit)
      }
    });
  } catch (e: any) {
    const userMessage = sanitizeError(e, 'Notifications - GET /', 'Failed to fetch notifications');
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * GET /api/notifications/unread
 * Get unread notification count and recent unread notifications
 * @returns Unread count and up to 5 most recent unread notifications
 */
notificationsRouter.get('/unread', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    // Get unread count
    const { count: unreadCount, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_read', false);

    if (countError) {
      const userMessage = handleDatabaseError(res, countError, 'Notifications - GET /unread - Count error', 'Failed to fetch unread count');
      return;
    }

    // Get recent unread notifications
    const { data: unread, error: dataError } = await supabase
      .from('notifications')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5);

    if (dataError) {
      const userMessage = handleDatabaseError(res, dataError, 'Notifications - GET /unread - Data error', 'Failed to fetch unread notifications');
      return;
    }

    return res.json({
      unreadCount: unreadCount || 0,
      recentUnread: unread || []
    });
  } catch (e: any) {
    const userMessage = sanitizeError(e, 'Notifications - GET /unread', 'Failed to fetch unread notifications');
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 * @param id - Notification ID
 * @returns Updated notification
 */
notificationsRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    // Verify notification exists and belongs to org
    const { data: existing, error: existingError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*')
      .single();

    if (error) {
      const userMessage = handleDatabaseError(res, error, 'Notifications - PATCH /:id/read', 'Failed to mark notification as read');
      return;
    }

    log.info('Notifications', 'Notification marked as read', { orgId, notificationId: id });
    return res.json(data);
  } catch (e: any) {
    const userMessage = sanitizeError(e, 'Notifications - PATCH /:id/read', 'Failed to mark notification as read');
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete/archive a notification
 * @param id - Notification ID
 * @returns Success response
 */
notificationsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    // Verify notification exists and belongs to org
    const { data: existing, error: existingError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (existingError || !existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      const userMessage = handleDatabaseError(res, error, 'Notifications - DELETE /:id', 'Failed to delete notification');
      return;
    }

    log.info('Notifications', 'Notification deleted', { orgId, notificationId: id });
    return res.json({ success: true });
  } catch (e: any) {
    const userMessage = sanitizeError(e, 'Notifications - DELETE /:id', 'Failed to delete notification');
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * POST /api/notifications (Internal Only)
 * Create a notification
 * NOT exposed to frontend - used internally by backend services
 * @body type - Notification type ('hot_lead', 'appointment', 'sms', 'call', 'system')
 * @body title - Notification title
 * @body message - Notification message
 * @body metadata - Additional data (optional)
 * @returns Created notification
 */
notificationsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      // Strictly enforce DB Enums for creation to prevent errors
      type: z.enum(['hot_lead', 'appointment_booked', 'appointment_reminder', 'missed_call', 'system_alert', 'voicemail']),
      title: z.string().min(1),
      message: z.string().min(1),
      metadata: z.record(z.any()).optional()
    });

    const parsed = schema.parse(req.body);

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        org_id: orgId,
        type: parsed.type,
        title: parsed.title,
        message: parsed.message,
        metadata: parsed.metadata || {},
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      const userMessage = handleDatabaseError(res, error, 'Notifications - POST /', 'Failed to create notification');
      return;
    }

    log.info('Notifications', 'Notification created', { orgId, notificationId: data.id, type: parsed.type });
    return res.status(201).json(data);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const userMessage = sanitizeValidationError(e);
      return res.status(400).json({ error: userMessage });
    }
    const userMessage = sanitizeError(e, 'Notifications - POST /', 'Failed to create notification');
    return res.status(500).json({ error: userMessage });
  }
});

export { notificationsRouter };
