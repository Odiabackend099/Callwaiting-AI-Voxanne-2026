/**
 * BullMQ Worker for Vapi Call Reconciliation
 *
 * Schedules and processes daily Vapi reconciliation jobs
 * Runs at 3 AM UTC every day via cron expression
 */

import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { reconcileVapiCalls } from './vapi-reconciliation';
import { createLogger } from '../services/logger';

const logger = createLogger('VapiReconciliationWorker');

// Redis connection for BullMQ
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

// Queue for reconciliation jobs
export const vapiReconcileQueue = new Queue('vapi-reconcile', {
  connection: redis
});

// Worker to process reconciliation jobs
export const vapiReconcileWorker = new Worker('vapi-reconcile', async (job) => {
  logger.info('Starting Vapi reconciliation job', {
    jobId: job.id,
    scheduledAt: new Date().toISOString()
  });

  try {
    const result = await reconcileVapiCalls();

    logger.info('Vapi reconciliation job completed successfully', {
      jobId: job.id,
      result
    });

    return result;
  } catch (error) {
    logger.error('Vapi reconciliation job failed', {
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error; // BullMQ will retry
  }
}, {
  connection: redis,
  concurrency: 1 // Only one reconciliation at a time
});

// Worker event handlers
vapiReconcileWorker.on('completed', (job, result) => {
  logger.info('Vapi reconciliation job completed', {
    jobId: job.id,
    totalChecked: result.totalChecked,
    recovered: result.recovered,
    webhookReliability: `${result.webhookReliability.toFixed(2)}%`
  });
});

vapiReconcileWorker.on('failed', (job, error) => {
  logger.error('Vapi reconciliation job failed', {
    jobId: job?.id,
    error: error.message,
    attempts: job?.attemptsMade
  });
});

vapiReconcileWorker.on('error', (error) => {
  logger.error('Vapi reconciliation worker error', {
    error: error.message
  });
});

/**
 * Schedule daily reconciliation at 3 AM UTC
 * Uses BullMQ repeatable jobs with cron expression
 */
export async function scheduleVapiReconciliation() {
  try {
    // Remove any existing repeatable jobs (to avoid duplicates)
    const repeatableJobs = await vapiReconcileQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await vapiReconcileQueue.removeRepeatableByKey(job.key);
    }

    // Schedule daily reconciliation at 3 AM UTC
    await vapiReconcileQueue.add(
      'daily-reconcile',
      {},
      {
        repeat: {
          pattern: '0 3 * * *', // Cron: 3 AM UTC every day
          tz: 'UTC'
        },
        jobId: 'daily-vapi-reconcile', // Idempotent job ID
        removeOnComplete: {
          age: 7 * 24 * 60 * 60, // Keep completed jobs for 7 days
          count: 100 // Keep last 100 jobs
        },
        removeOnFail: {
          age: 30 * 24 * 60 * 60, // Keep failed jobs for 30 days
          count: 200 // Keep last 200 failed jobs
        }
      }
    );

    logger.info('Vapi reconciliation scheduled successfully', {
      schedule: '3 AM UTC daily',
      pattern: '0 3 * * *'
    });
  } catch (error) {
    logger.error('Failed to schedule Vapi reconciliation', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Manual trigger for reconciliation (for testing/emergency)
 */
export async function triggerManualReconciliation(): Promise<void> {
  try {
    const job = await vapiReconcileQueue.add('manual-reconcile', {
      triggered: 'manual',
      timestamp: new Date().toISOString()
    });

    logger.info('Manual Vapi reconciliation triggered', {
      jobId: job.id
    });
  } catch (error) {
    logger.error('Failed to trigger manual reconciliation', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get reconciliation job status and history
 */
export async function getReconciliationStatus() {
  const [completed, failed, delayed, waiting, active] = await Promise.all([
    vapiReconcileQueue.getCompleted(0, 9),
    vapiReconcileQueue.getFailed(0, 9),
    vapiReconcileQueue.getDelayed(0, 9),
    vapiReconcileQueue.getWaiting(0, 9),
    vapiReconcileQueue.getActive(0, 9)
  ]);

  return {
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    waiting: waiting.length,
    active: active.length,
    lastCompleted: completed[0] ? {
      id: completed[0].id,
      timestamp: completed[0].timestamp,
      result: completed[0].returnvalue
    } : null,
    lastFailed: failed[0] ? {
      id: failed[0].id,
      timestamp: failed[0].timestamp,
      error: failed[0].failedReason
    } : null
  };
}

/**
 * Graceful shutdown
 */
export async function shutdownReconciliationWorker() {
  logger.info('Shutting down Vapi reconciliation worker...');

  await vapiReconcileWorker.close();
  await vapiReconcileQueue.close();
  redis.disconnect();

  logger.info('Vapi reconciliation worker shut down successfully');
}
