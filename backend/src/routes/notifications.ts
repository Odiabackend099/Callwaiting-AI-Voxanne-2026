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
      type: z.enum(['hot_lead', 'appointment', 'sms', 'call', 'system']).optional()
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
      query = query.eq('type', parsed.type);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parsed.limit - 1);

    const { data, error, count } = await query;

    if (error) {
      log.error('Notifications', 'GET / - Database error', { orgId, error: error.message });
      return res.status(500).json({ error: error.message });
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
    log.error('Notifications', 'GET / - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch notifications' });
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
      log.error('Notifications', 'GET /unread - Count error', { orgId, error: countError.message });
      return res.status(500).json({ error: countError.message });
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
      log.error('Notifications', 'GET /unread - Data error', { orgId, error: dataError.message });
      return res.status(500).json({ error: dataError.message });
    }

    return res.json({
      unreadCount: unreadCount || 0,
      recentUnread: unread || []
    });
  } catch (e: any) {
    log.error('Notifications', 'GET /unread - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to fetch unread notifications' });
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
      log.error('Notifications', 'PATCH /:id/read - Database error', { orgId, notificationId: id, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Notifications', 'Notification marked as read', { orgId, notificationId: id });
    return res.json(data);
  } catch (e: any) {
    log.error('Notifications', 'PATCH /:id/read - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to mark notification as read' });
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
      log.error('Notifications', 'DELETE /:id - Database error', { orgId, notificationId: id, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Notifications', 'Notification deleted', { orgId, notificationId: id });
    return res.json({ success: true });
  } catch (e: any) {
    log.error('Notifications', 'DELETE /:id - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to delete notification' });
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
      type: z.enum(['hot_lead', 'appointment', 'sms', 'call', 'system']),
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
      log.error('Notifications', 'POST / - Database error', { orgId, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    log.info('Notifications', 'Notification created', { orgId, notificationId: data.id, type: parsed.type });
    return res.status(201).json(data);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const firstError = e.issues?.[0];
      return res.status(400).json({ error: 'Invalid input: ' + (firstError?.message || 'validation failed') });
    }
    log.error('Notifications', 'POST / - Error', { error: e?.message });
    return res.status(500).json({ error: e?.message || 'Failed to create notification' });
  }
});

export { notificationsRouter };
