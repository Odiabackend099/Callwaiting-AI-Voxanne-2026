/**
 * SMS Queue Health Monitoring Endpoint
 *
 * GET /api/monitoring/sms-queue-health
 *
 * Provides real-time visibility into SMS delivery queue performance,
 * failed deliveries, and dead letter queue.
 *
 * Used for:
 * - Production monitoring dashboards
 * - Alerting on SMS delivery failures
 * - Debugging dead letter queue issues
 * - Performance optimization
 */

import { Router, Request, Response } from 'express';
import { getSmsQueueHealth } from '../queues/sms-queue';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

const router = Router();

/**
 * GET /api/monitoring/sms-queue-health
 *
 * Returns SMS queue health metrics and recent delivery stats
 */
router.get('/sms-queue-health', async (req: Request, res: Response) => {
  try {
    // Get queue health from BullMQ
    const queueHealth = await getSmsQueueHealth();

    // Get delivery stats from database (last 24 hours)
    const { data: stats, error: statsError } = await supabase
      .rpc('get_sms_delivery_stats', {
        p_org_id: '00000000-0000-0000-0000-000000000000', // Placeholder - will aggregate all orgs
        p_hours: 24
      });

    // Get dead letter queue count
    const { count: deadLetterCount, error: dlqError } = await supabase
      .from('sms_delivery_log')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'dead_letter')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

    // Get recent failures (last 10)
    const { data: recentFailures, error: failuresError } = await supabase
      .from('sms_delivery_log')
      .select('job_id, org_id, recipient_phone, error_message, attempt_number, created_at')
      .in('status', ['failed', 'dead_letter'])
      .order('created_at', { ascending: false })
      .limit(10);

    // Determine overall health status
    const isQueueHealthy = queueHealth.healthy;
    const isDeliveryHealthy = stats && stats.length > 0
      ? parseFloat(stats[0].success_rate || '0') > 95
      : true; // Assume healthy if no data

    const overallStatus = isQueueHealthy && isDeliveryHealthy
      ? 'healthy'
      : isQueueHealthy && !isDeliveryHealthy
        ? 'degraded'
        : 'unhealthy';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      queue: queueHealth,
      delivery: {
        last24Hours: stats && stats.length > 0 ? {
          totalSent: stats[0].total_sent,
          delivered: stats[0].delivered,
          failed: stats[0].failed,
          deadLetter: stats[0].dead_letter,
          successRate: parseFloat(stats[0].success_rate || '0'),
          avgDeliveryTimeMs: parseFloat(stats[0].avg_delivery_time_ms || '0')
        } : null,
        deadLetterQueueCount: deadLetterCount || 0,
        recentFailures: recentFailures || []
      },
      alerts: generateAlerts({
        queueHealth,
        deadLetterCount: deadLetterCount || 0,
        successRate: stats && stats.length > 0 ? parseFloat(stats[0].success_rate || '100') : 100
      })
    });

  } catch (error: any) {
    log.error('SmsHealth', 'Failed to get SMS queue health', {
      error: error.message
    });

    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/monitoring/sms-dead-letter-queue
 *
 * Returns SMS in dead letter queue (failed after all retries)
 */
router.get('/sms-dead-letter-queue', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;

    const { data: deadLetterSms, error } = await supabase
      .rpc('get_dead_letter_sms', { p_limit: limit });

    if (error) {
      throw error;
    }

    res.json({
      count: deadLetterSms?.length || 0,
      sms: deadLetterSms || []
    });

  } catch (error: any) {
    log.error('SmsHealth', 'Failed to get dead letter queue', {
      error: error.message
    });

    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * POST /api/monitoring/sms-retry-dead-letter/:jobId
 *
 * Manually retry a failed SMS from dead letter queue
 */
router.post('/sms-retry-dead-letter/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    // Get SMS from dead letter queue
    const { data: smsLog, error } = await supabase
      .from('sms_delivery_log')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'dead_letter')
      .single();

    if (error || !smsLog) {
      return res.status(404).json({
        error: `SMS job ${jobId} not found in dead letter queue`
      });
    }

    // Re-queue SMS with new job ID
    const { queueSms } = await import('../queues/sms-queue');

    const result = await queueSms({
      orgId: smsLog.org_id,
      recipientPhone: smsLog.recipient_phone,
      message: smsLog.message,
      metadata: {
        ...smsLog.metadata,
        retryOf: jobId
      }
    });

    res.json({
      success: true,
      originalJobId: jobId,
      newJobId: result.jobId,
      message: 'SMS re-queued for delivery'
    });

  } catch (error: any) {
    log.error('SmsHealth', 'Failed to retry dead letter SMS', {
      jobId: req.params.jobId,
      error: error.message
    });

    res.status(500).json({
      error: error.message
    });
  }
});

// Helper: Generate alerts based on queue health
function generateAlerts(data: {
  queueHealth: any;
  deadLetterCount: number;
  successRate: number;
}): string[] {
  const alerts: string[] = [];

  // Queue backlog alert
  if (data.queueHealth.counts.waiting > 100) {
    alerts.push(`⚠️ Queue backlog: ${data.queueHealth.counts.waiting} SMS waiting`);
  }

  // High failure rate alert
  if (data.successRate < 95 && data.successRate > 0) {
    alerts.push(`⚠️ Low success rate: ${data.successRate.toFixed(1)}% (expected >95%)`);
  }

  // Dead letter queue alert
  if (data.deadLetterCount > 10) {
    alerts.push(`🔴 Dead letter queue: ${data.deadLetterCount} permanently failed SMS`);
  }

  // Active jobs stuck alert
  if (data.queueHealth.counts.active > 20) {
    alerts.push(`⚠️ High active jobs: ${data.queueHealth.counts.active} (possible timeout issues)`);
  }

  return alerts;
}

export default router;
