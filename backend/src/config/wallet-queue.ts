/**
 * Wallet Auto-Recharge Queue
 *
 * BullMQ queue for processing auto-recharge jobs when wallet balance
 * drops below threshold. Uses Redis for persistence and retry logic.
 *
 * Pattern cloned from billing-queue.ts.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection } from './redis';
import { log } from '../services/logger';
import { sendSlackAlert } from '../services/slack-alerts';

export type AutoRechargeJobData = {
  orgId: string;
};

let walletQueue: Queue<AutoRechargeJobData> | null = null;
let walletWorker: Worker<AutoRechargeJobData> | null = null;

export function initializeWalletQueue(): void {
  const connection = createRedisConnection();
  if (!connection) {
    log.warn('WalletQueue', 'Redis not available, wallet queue disabled');
    return;
  }

  walletQueue = new Queue('wallet-auto-recharge', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 10s, 20s
      },
      removeOnComplete: {
        age: 3600,
        count: 100,
      },
      removeOnFail: {
        age: 86400,
        count: 50,
      },
    },
  });

  log.info('WalletQueue', 'Wallet queue initialized');
}

export function initializeWalletWorker(
  processor: (job: Job<AutoRechargeJobData>) => Promise<any>
): void {
  const connection = createRedisConnection();
  if (!connection || !walletQueue) {
    log.warn('WalletQueue', 'Redis or queue not available, wallet worker disabled');
    return;
  }

  walletWorker = new Worker<AutoRechargeJobData>(
    'wallet-auto-recharge',
    processor,
    {
      connection,
      concurrency: 2,
      drainDelay: 5,
    }
  );

  walletWorker.on('completed', (job) => {
    log.info('WalletQueue', `Recharge job ${job.id} completed`, {
      orgId: job.data.orgId,
      attempts: job.attemptsMade + 1,
    });
  });

  walletWorker.on('failed', (job, err) => {
    const isLastAttempt = job?.attemptsMade === job?.opts?.attempts;

    log.error('WalletQueue', `Recharge job ${job?.id} failed`, {
      error: err.message,
      orgId: job?.data.orgId,
      attempt: `${job?.attemptsMade}/${job?.opts?.attempts}`,
      isLastAttempt,
    });

    if (isLastAttempt) {
      log.error('WalletQueue', `Recharge job ${job?.id} permanently failed`, {
        orgId: job?.data.orgId,
      });

      sendSlackAlert('🔴 Wallet Auto-Recharge Failed Permanently', {
        jobId: job?.id || 'unknown',
        orgId: job?.data.orgId || 'unknown',
        error: err.message,
        attempts: String(job?.attemptsMade || 0),
      }).catch(() => {});
    }
  });

  walletWorker.on('error', (err) => {
    log.error('WalletQueue', 'Worker error', {
      error: err.message,
      stack: err.stack,
    });
  });

  walletWorker.on('stalled', (jobId) => {
    log.warn('WalletQueue', `Recharge job ${jobId} stalled - will be retried`);
  });

  log.info('WalletQueue', 'Wallet worker started', {
    concurrency: 2,
    maxAttempts: 3,
    backoffDelay: '5s exponential',
  });
}

/**
 * Enqueue an auto-recharge job.
 * Uses orgId as jobId to prevent duplicate recharge jobs per org.
 */
export async function enqueueAutoRechargeJob(
  data: AutoRechargeJobData
): Promise<Job<AutoRechargeJobData> | null> {
  if (!walletQueue) {
    log.warn('WalletQueue', 'Queue not available, cannot enqueue recharge job');
    return null;
  }

  try {
    const job = await walletQueue.add('auto-recharge', data, {
      jobId: `recharge-${data.orgId}`, // Prevents duplicate jobs per org
    });
    log.info('WalletQueue', `Recharge job enqueued: ${job.id}`, {
      orgId: data.orgId,
    });
    return job;
  } catch (error) {
    log.error('WalletQueue', 'Failed to enqueue recharge job', {
      error: (error as Error).message,
      orgId: data.orgId,
    });
    return null;
  }
}

export async function closeWalletQueue(): Promise<void> {
  if (walletWorker) {
    await walletWorker.close();
  }
  if (walletQueue) {
    await walletQueue.close();
  }
  log.info('WalletQueue', 'Wallet queue closed');
}
