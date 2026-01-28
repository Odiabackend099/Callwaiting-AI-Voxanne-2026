/**
 * Webhook Metrics and Monitoring Endpoints
 * 
 * Provides real-time metrics for webhook delivery monitoring:
 * - Queue health and job counts
 * - Delivery success/failure rates
 * - Recent failed webhooks for debugging
 * - Dead letter queue management
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getQueueMetrics } from '../config/webhook-queue';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

const router = Router();

/**
 * GET /api/webhook-metrics/queue-health
 * 
 * Returns current queue health metrics
 */
router.get('/queue-health', requireAuth, async (req: Request, res: Response) => {
  try {
    const metrics = await getQueueMetrics();
    
    if (!metrics) {
      return res.status(503).json({
        error: 'Queue metrics unavailable',
        message: 'Redis connection may be down',
      });
    }

    // Calculate health score
    const totalJobs = metrics.waiting + metrics.active + metrics.delayed;
    const failureRate = totalJobs > 0 ? metrics.failed / totalJobs : 0;
    const isHealthy = failureRate < 0.05 && metrics.waiting < 100;

    res.json({
      healthy: isHealthy,
      metrics: {
        waiting: metrics.waiting,
        active: metrics.active,
        completed: metrics.completed,
        failed: metrics.failed,
        delayed: metrics.delayed,
        paused: metrics.paused,
      },
      stats: {
        totalJobs,
        failureRate: `${(failureRate * 100).toFixed(2)}%`,
        queueDepth: metrics.waiting,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    log.error('WebhookMetrics', 'Error fetching queue health', {
      error: error.message,
    });
    res.status(500).json({ error: 'Failed to fetch queue health' });
  }
});

/**
 * GET /api/webhook-metrics/delivery-stats
 * 
 * Returns webhook delivery statistics for the organization
 */
router.get('/delivery-stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }

    const timeRange = req.query.range || '24h';
    const hoursBack = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 168; // 1h, 24h, or 7d

    // Get delivery stats from webhook_delivery_log
    const { data: stats, error } = await supabase
      .from('webhook_delivery_log')
      .select('status, event_type, created_at, attempts')
      .eq('org_id', orgId)
      .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString());

    if (error) {
      throw error;
    }

    // Calculate statistics
    const total = stats?.length || 0;
    const completed = stats?.filter(s => s.status === 'completed').length || 0;
    const failed = stats?.filter(s => s.status === 'failed').length || 0;
    const deadLetter = stats?.filter(s => s.status === 'dead_letter').length || 0;
    const pending = stats?.filter(s => s.status === 'pending').length || 0;

    // Group by event type
    const byEventType: Record<string, { total: number; completed: number; failed: number }> = {};
    stats?.forEach(s => {
      if (!byEventType[s.event_type]) {
        byEventType[s.event_type] = { total: 0, completed: 0, failed: 0 };
      }
      byEventType[s.event_type].total++;
      if (s.status === 'completed') byEventType[s.event_type].completed++;
      if (s.status === 'failed' || s.status === 'dead_letter') byEventType[s.event_type].failed++;
    });

    // Calculate average retry attempts
    const avgAttempts = stats?.length 
      ? stats.reduce((sum, s) => sum + s.attempts, 0) / stats.length 
      : 0;

    res.json({
      timeRange: `${hoursBack}h`,
      summary: {
        total,
        completed,
        failed,
        deadLetter,
        pending,
        successRate: total > 0 ? `${((completed / total) * 100).toFixed(2)}%` : '0%',
        avgAttempts: avgAttempts.toFixed(2),
      },
      byEventType,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    log.error('WebhookMetrics', 'Error fetching delivery stats', {
      error: error.message,
      orgId: req.user?.orgId,
    });
    res.status(500).json({ error: 'Failed to fetch delivery stats' });
  }
});

/**
 * GET /api/webhook-metrics/recent-failures
 * 
 * Returns recent failed webhooks for debugging
 */
router.get('/recent-failures', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }

    const limit = parseInt(req.query.limit as string) || 20;

    const { data: failures, error } = await supabase
      .from('webhook_delivery_log')
      .select('*')
      .eq('org_id', orgId)
      .in('status', ['failed', 'dead_letter'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    res.json({
      failures: failures?.map(f => ({
        id: f.id,
        jobId: f.job_id,
        eventType: f.event_type,
        status: f.status,
        attempts: f.attempts,
        maxAttempts: f.max_attempts,
        errorMessage: f.error_message,
        createdAt: f.created_at,
        lastAttemptAt: f.last_attempt_at,
      })) || [],
      count: failures?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    log.error('WebhookMetrics', 'Error fetching recent failures', {
      error: error.message,
      orgId: req.user?.orgId,
    });
    res.status(500).json({ error: 'Failed to fetch recent failures' });
  }
});

/**
 * POST /api/webhook-metrics/retry-failed/:jobId
 * 
 * Retry a failed webhook from dead letter queue
 */
router.post('/retry-failed/:jobId', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    const { jobId } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }

    // Get the failed webhook
    const { data: webhook, error: fetchError } = await supabase
      .from('webhook_delivery_log')
      .select('*')
      .eq('org_id', orgId)
      .eq('job_id', jobId)
      .eq('status', 'dead_letter')
      .single();

    if (fetchError || !webhook) {
      return res.status(404).json({ error: 'Failed webhook not found' });
    }

    // Re-enqueue the webhook
    const { enqueueWebhook } = require('../config/webhook-queue');
    const job = await enqueueWebhook({
      eventType: webhook.event_type,
      event: webhook.event_data,
      orgId: webhook.org_id,
      receivedAt: new Date().toISOString(),
    });

    if (!job) {
      return res.status(500).json({ error: 'Failed to re-enqueue webhook' });
    }

    // Update the log
    await supabase
      .from('webhook_delivery_log')
      .update({
        status: 'pending',
        job_id: job.id,
        attempts: 0,
        error_message: null,
      })
      .eq('id', webhook.id);

    log.info('WebhookMetrics', 'Webhook retried', {
      orgId,
      oldJobId: jobId,
      newJobId: job.id,
      eventType: webhook.event_type,
    });

    res.json({
      success: true,
      message: 'Webhook re-queued for processing',
      newJobId: job.id,
    });
  } catch (error: any) {
    log.error('WebhookMetrics', 'Error retrying failed webhook', {
      error: error.message,
      orgId: req.user?.orgId,
      jobId: req.params.jobId,
    });
    res.status(500).json({ error: 'Failed to retry webhook' });
  }
});

/**
 * GET /api/webhook-metrics/dead-letter-queue
 * 
 * Returns all webhooks in dead letter queue
 */
router.get('/dead-letter-queue', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }

    const { data: deadLetters, error } = await supabase
      .from('webhook_delivery_log')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'dead_letter')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      deadLetters: deadLetters?.map(d => ({
        id: d.id,
        jobId: d.job_id,
        eventType: d.event_type,
        attempts: d.attempts,
        errorMessage: d.error_message,
        createdAt: d.created_at,
        lastAttemptAt: d.last_attempt_at,
        eventData: d.event_data,
      })) || [],
      count: deadLetters?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    log.error('WebhookMetrics', 'Error fetching dead letter queue', {
      error: error.message,
      orgId: req.user?.orgId,
    });
    res.status(500).json({ error: 'Failed to fetch dead letter queue' });
  }
});

export default router;
