import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection } from './redis';
import { log } from '../services/logger';
import { sendSlackAlert } from '../services/slack-alerts';

export type BillingJobData = {
  orgId: string;
  ledgerId: string;
  subscriptionItemId: string;
  overageMinutes: number;
  callId: string;
};

let billingQueue: Queue<BillingJobData> | null = null;
let billingWorker: Worker<BillingJobData> | null = null;

export function initializeBillingQueue(): void {
  const connection = createRedisConnection();
  if (!connection) {
    log.warn('BillingQueue', 'Redis not available, billing queue disabled');
    return;
  }

  billingQueue = new Queue('billing-stripe-reporting', {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600,  // Keep completed jobs 1 hour
        count: 100
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs 1 day
        count: 50
      }
    },
  });

  log.info('BillingQueue', 'Billing queue initialized');
}

export function initializeBillingWorker(processor: (job: Job<BillingJobData>) => Promise<any>): void {
  const connection = createRedisConnection();
  if (!connection || !billingQueue) {
    log.warn('BillingQueue', 'Redis or queue not available, billing worker disabled');
    return;
  }

  billingWorker = new Worker<BillingJobData>(
    'billing-stripe-reporting',
    processor,
    {
      connection,
      concurrency: 2,
      drainDelay: 5, // Wait 5 seconds between polls when queue is empty (saves Redis commands)
    }
  );

  billingWorker.on('completed', (job) => {
    log.info('BillingQueue', `Billing job ${job.id} completed`, {
      orgId: job.data.orgId,
      callId: job.data.callId,
      overageMinutes: job.data.overageMinutes,
      attempts: job.attemptsMade + 1,
    });
  });

  billingWorker.on('failed', (job, err) => {
    const isLastAttempt = job?.attemptsMade === job?.opts?.attempts;

    log.error('BillingQueue', `Billing job ${job?.id} failed`, {
      error: err.message,
      orgId: job?.data.orgId,
      callId: job?.data.callId,
      overageMinutes: job?.data.overageMinutes,
      attempt: `${job?.attemptsMade}/${job?.opts?.attempts}`,
      isLastAttempt,
    });

    if (isLastAttempt) {
      log.error('BillingQueue', `Billing job ${job?.id} permanently failed`, {
        orgId: job?.data.orgId,
        callId: job?.data.callId,
      });

      sendSlackAlert('🔴 Billing Stripe Reporting Failed Permanently', {
        jobId: job?.id || 'unknown',
        orgId: job?.data.orgId || 'unknown',
        callId: job?.data.callId || 'unknown',
        overageMinutes: String(job?.data.overageMinutes || 0),
        error: err.message,
        attempts: String(job?.attemptsMade || 0),
      }).catch(() => {});
    }
  });

  billingWorker.on('error', (err) => {
    log.error('BillingQueue', 'Worker error', {
      error: err.message,
      stack: err.stack,
    });
  });

  billingWorker.on('stalled', (jobId) => {
    log.warn('BillingQueue', `Billing job ${jobId} stalled - will be retried`);
  });

  log.info('BillingQueue', 'Billing worker started', {
    concurrency: 2,
    maxAttempts: 5,
    backoffDelay: '2s exponential',
  });
}

export async function enqueueBillingJob(data: BillingJobData): Promise<Job<BillingJobData> | null> {
  if (!billingQueue) {
    log.warn('BillingQueue', 'Queue not available, cannot enqueue billing job');
    return null;
  }

  try {
    const job = await billingQueue.add('report-overage', data, {
      jobId: `billing-${data.callId}`, // Prevents duplicate jobs for same call
    });
    log.info('BillingQueue', `Billing job enqueued: ${job.id}`, {
      orgId: data.orgId,
      callId: data.callId,
      overageMinutes: data.overageMinutes,
    });
    return job;
  } catch (error) {
    log.error('BillingQueue', 'Failed to enqueue billing job', {
      error: (error as Error).message,
      callId: data.callId,
    });
    return null;
  }
}

export async function closeBillingQueue(): Promise<void> {
  if (billingWorker) {
    await billingWorker.close();
  }
  if (billingQueue) {
    await billingQueue.close();
  }
  log.info('BillingQueue', 'Billing queue closed');
}
