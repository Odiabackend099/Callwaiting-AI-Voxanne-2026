/**
 * Billing Queue Configuration (P0-1: Stripe Webhook Async Processing)
 *
 * BullMQ queue for processing Stripe webhooks asynchronously.
 * Ensures webhooks return 200 to Stripe within <1 second while
 * processing happens in the background with retry logic.
 *
 * Architecture:
 * - Queue: Receives webhook events from HTTP endpoint
 * - Worker: Processes events asynchronously
 * - Retry: 3 attempts with exponential backoff (2s, 4s, 8s)
 * - Dead Letter Queue: Permanent failures trigger Slack alerts
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection } from './redis';
import { log } from '../services/logger';
import { sendSlackAlert } from '../services/slack-alerts';

type StripeWebhookJobData = {
  eventId: string;
  eventType: string;
  eventData: any;
  receivedAt: string;
};

let billingQueue: Queue<StripeWebhookJobData> | null = null;
let worker: Worker<StripeWebhookJobData> | null = null;

/**
 * Initialize the billing webhook queue.
 * Call this once on server startup.
 */
export function initializeBillingQueue(): void {
  const connection = createRedisConnection();
  if (!connection) {
    log.error('BillingQueue', 'Redis not available, cannot initialize billing queue');
    return;
  }

  billingQueue = new Queue<StripeWebhookJobData>('stripe-webhooks', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000 // 2s, 4s, 8s
      },
      removeOnComplete: {
        age: 86400,  // Keep completed jobs 24 hours
        count: 1000
      },
      removeOnFail: {
        age: 7 * 86400, // Keep failed jobs 7 days
        count: 100
      }
    }
  });

  log.info('BillingQueue', 'Billing queue initialized', {
    queueName: 'stripe-webhooks',
    maxAttempts: 3,
    backoffDelay: '2s exponential'
  });
}

/**
 * Initialize the billing worker.
 * Processes Stripe webhook events asynchronously.
 *
 * @param processor - Async function that handles webhook event processing
 */
export function initializeBillingWorker(
  processor: (job: Job<StripeWebhookJobData>) => Promise<void>
): void {
  const connection = createRedisConnection();
  if (!connection || !billingQueue) {
    log.error('BillingQueue', 'Redis or queue not available, cannot initialize billing worker');
    return;
  }

  worker = new Worker<StripeWebhookJobData>(
    'stripe-webhooks',
    processor,
    {
      connection,
      concurrency: 5, // Process up to 5 webhooks in parallel
      drainDelay: 5, // Wait 5 seconds between polls when queue is empty
    }
  );

  worker.on('completed', (job) => {
    const duration = Date.now() - new Date(job.data.receivedAt).getTime();
    log.info('BillingQueue', `Job ${job.id} completed`, {
      eventType: job.data.eventType,
      eventId: job.data.eventId,
      duration: `${duration}ms`,
      attempts: job.attemptsMade + 1,
    });
  });

  worker.on('failed', (job, err) => {
    const isLastAttempt = job?.attemptsMade === job?.opts?.attempts;

    log.error('BillingQueue', `Job ${job?.id} failed`, {
      error: err.message,
      eventType: job?.data.eventType,
      eventId: job?.data.eventId,
      attempt: `${job?.attemptsMade}/${job?.opts?.attempts}`,
      isLastAttempt,
      stack: err.stack,
    });

    if (isLastAttempt) {
      // Final failure - send alert and move to dead letter queue
      log.error('BillingQueue', `Job ${job?.id} moved to dead letter queue`, {
        eventType: job?.data.eventType,
        eventId: job?.data.eventId,
        totalAttempts: job?.attemptsMade,
      });

      sendSlackAlert('🚨 CRITICAL: Stripe Webhook Failed Permanently', {
        jobId: job?.id,
        eventType: job?.data.eventType,
        eventId: job?.data.eventId,
        error: err.message,
        attempts: job?.attemptsMade,
        receivedAt: job?.data.receivedAt,
        severity: 'critical',
        action: 'Manual investigation required - billing data may be inconsistent'
      }).catch(() => {});
    }
  });

  worker.on('error', (err) => {
    log.error('BillingQueue', 'Worker error', {
      error: err.message,
      stack: err.stack,
    });
  });

  worker.on('stalled', (jobId) => {
    log.warn('BillingQueue', `Job ${jobId} stalled - will be retried`);
  });

  log.info('BillingQueue', 'Billing worker started', {
    concurrency: 5,
    maxAttempts: 3,
    backoffDelay: '2s exponential',
  });
}

/**
 * Enqueue a Stripe webhook event for async processing.
 * Returns immediately after queueing (does not wait for processing).
 *
 * @param data - Webhook event data
 * @returns Job instance or null if enqueueing failed
 */
export async function enqueueBillingWebhook(
  data: StripeWebhookJobData
): Promise<Job<StripeWebhookJobData> | null> {
  if (!billingQueue) {
    log.error('BillingQueue', 'Billing queue not initialized');
    return null;
  }

  try {
    const job = await billingQueue.add('process-stripe-webhook', data, {
      // Idempotency: Use Stripe event ID as job ID to prevent duplicates
      jobId: `stripe-${data.eventId}`,
    });

    log.info('BillingQueue', 'Stripe webhook enqueued', {
      jobId: job.id,
      eventType: data.eventType,
      eventId: data.eventId,
    });

    return job;
  } catch (error) {
    log.error('BillingQueue', 'Failed to enqueue Stripe webhook', {
      error: (error as Error).message,
      eventType: data.eventType,
      eventId: data.eventId,
    });
    return null;
  }
}

/**
 * Get billing queue metrics.
 * Useful for monitoring and debugging.
 */
export async function getBillingQueueMetrics() {
  if (!billingQueue) {
    return null;
  }

  try {
    const counts = await billingQueue.getJobCounts();
    return {
      ...counts,
      queueName: 'stripe-webhooks',
    };
  } catch (error) {
    log.error('BillingQueue', 'Failed to get billing queue metrics', {
      error: (error as Error).message,
    });
    return null;
  }
}

/**
 * Close the billing queue and worker gracefully.
 * Call this on server shutdown.
 */
export async function closeBillingQueue(): Promise<void> {
  if (worker) {
    await worker.close();
    log.info('BillingQueue', 'Billing worker closed');
  }
  if (billingQueue) {
    await billingQueue.close();
    log.info('BillingQueue', 'Billing queue closed');
  }
}
