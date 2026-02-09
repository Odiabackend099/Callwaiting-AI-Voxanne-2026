/**
 * Billing Reconciliation API Routes
 *
 * Provides endpoints for:
 * - Manual reconciliation triggers
 * - Reconciliation status monitoring
 * - Webhook reliability metrics
 * - Historical reconciliation results
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { reconcileVapiCalls } from '../jobs/vapi-reconciliation';
import {
  triggerManualReconciliation,
  getReconciliationStatus,
  vapiReconcileQueue
} from '../jobs/vapi-reconciliation-worker';
import { supabase } from '../services/supabase-client';
import { createLogger } from '../services/logger';

const logger = createLogger('BillingReconciliation');

const router = Router();

/**
 * POST /api/billing/reconciliation/trigger
 *
 * Manually trigger Vapi call reconciliation
 * Requires admin authentication
 */
router.post('/trigger', requireAuth, async (req, res) => {
  try {
    // Check if user is admin (you may have a different auth check)
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.info('Manual Vapi reconciliation triggered by user', { userId });

    // Trigger manual reconciliation job
    await triggerManualReconciliation();

    res.json({
      success: true,
      message: 'Reconciliation job queued successfully',
      checkStatus: '/api/billing/reconciliation/status'
    });
  } catch (error) {
    logger.error('Failed to trigger manual reconciliation', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      error: 'Failed to trigger reconciliation',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/billing/reconciliation/run-now
 *
 * Run reconciliation synchronously (for testing/debugging)
 * Requires service role authentication
 */
router.post('/run-now', requireRole('admin'), async (req, res) => {
  try {
    logger.info('Running synchronous Vapi reconciliation');

    const result = await reconcileVapiCalls();

    res.json({
      success: true,
      result,
      message: 'Reconciliation completed successfully'
    });
  } catch (error) {
    logger.error('Failed to run reconciliation', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      error: 'Reconciliation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/billing/reconciliation/status
 *
 * Get current reconciliation job status
 * Requires authentication
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const status = await getReconciliationStatus();

    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error('Failed to get reconciliation status', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      error: 'Failed to get status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/billing/reconciliation/metrics
 *
 * Get webhook reliability metrics from database view
 * Requires authentication
 */
router.get('/metrics', requireAuth, async (req, res) => {
  try {
    const { data: metrics, error } = await supabase
      .from('vapi_webhook_reliability')
      .select('*')
      .order('date', { ascending: false })
      .limit(30); // Last 30 days

    if (error) {
      throw error;
    }

    // Calculate overall statistics
    const totalCalls = metrics?.reduce((sum, m) => sum + m.total_calls, 0) || 0;
    const totalReconciled = metrics?.reduce((sum, m) => sum + m.reconciled_calls, 0) || 0;
    const overallReliability = totalCalls > 0
      ? ((totalCalls - totalReconciled) / totalCalls) * 100
      : 100;

    res.json({
      success: true,
      metrics: {
        overall: {
          totalCalls,
          reconciledCalls: totalReconciled,
          webhookCalls: totalCalls - totalReconciled,
          webhookReliability: parseFloat(overallReliability.toFixed(2))
        },
        daily: metrics || []
      }
    });
  } catch (error) {
    logger.error('Failed to get reconciliation metrics', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      error: 'Failed to get metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/billing/reconciliation/history
 *
 * Get recent reconciliation job history
 * Requires authentication
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const [completed, failed] = await Promise.all([
      vapiReconcileQueue.getCompleted(0, limit - 1),
      vapiReconcileQueue.getFailed(0, limit - 1)
    ]);

    const history = [
      ...completed.map(job => ({
        id: job.id,
        status: 'completed',
        timestamp: job.timestamp,
        result: job.returnvalue,
        processedOn: job.processedOn
      })),
      ...failed.map(job => ({
        id: job.id,
        status: 'failed',
        timestamp: job.timestamp,
        error: job.failedReason,
        processedOn: job.processedOn
      }))
    ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    res.json({
      success: true,
      history: history.slice(0, limit)
    });
  } catch (error) {
    logger.error('Failed to get reconciliation history', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      error: 'Failed to get history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/billing/reconciliation/health
 *
 * Health check endpoint for reconciliation system
 * Public endpoint (no auth required)
 */
router.get('/health', async (req, res) => {
  try {
    const status = await getReconciliationStatus();

    const isHealthy = status.active < 5 && status.failed === 0;

    res.json({
      success: true,
      healthy: isHealthy,
      status: {
        active: status.active,
        waiting: status.waiting,
        completed: status.completed,
        failed: status.failed,
        lastCompleted: status.lastCompleted
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
