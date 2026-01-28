import { Queue, QueueEvents, Worker, Job } from 'bullmq';
import { getRedisClient } from './redis';
import { log } from '../services/logger';
import { sendSlackAlert } from '../services/slack-alerts';

type WebhookJobData = {
  eventType: string;
  event: any;
  orgId: string;
  assistantId?: string;
  receivedAt: string;
};

let webhookQueue: Queue<WebhookJobData> | null = null;
let queueEvents: QueueEvents | null = null;
let worker: Worker<WebhookJobData> | null = null;

export function initializeWebhookQueue(): void {
  const redisClient = getRedisClient();
  if (!redisClient) {
    log.error('WebhookQueue', 'Redis not available, cannot initialize queue');
    return;
  }

  webhookQueue = new Queue('webhook-processing', {
    connection: redisClient,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  });

  queueEvents = new QueueEvents('webhook-processing', {
    connection: redisClient
  });

  log.info('WebhookQueue', 'Webhook queue initialized');
}

export function initializeWebhookWorker(processor: (job: any) => Promise<any>): void {
  const redisClient = getRedisClient();
  if (!redisClient || !webhookQueue) {
    log.error('WebhookQueue', 'Redis or queue not available, cannot initialize worker');
    return;
  }

  worker = new Worker<WebhookJobData>(
    'webhook-processing',
    processor,
    {
      connection: redisClient,
      concurrency: 5
    }
  );

  worker.on('completed', (job) => {
    const duration = Date.now() - new Date(job.data.receivedAt).getTime();
    log.info('WebhookQueue', `Job ${job.id} completed`, {
      eventType: job.data.eventType,
      orgId: job.data.orgId,
      duration: `${duration}ms`,
      attempts: job.attemptsMade + 1,
    });
  });

  worker.on('failed', (job, err) => {
    const isLastAttempt = job?.attemptsMade === job?.opts?.attempts;
    
    log.error('WebhookQueue', `Job ${job?.id} failed`, {
      error: err.message,
      eventType: job?.data.eventType,
      orgId: job?.data.orgId,
      attempt: `${job?.attemptsMade}/${job?.opts?.attempts}`,
      isLastAttempt,
      stack: err.stack,
    });
    
    if (isLastAttempt) {
      // Final failure - send alert and move to dead letter queue
      log.error('WebhookQueue', `Job ${job?.id} moved to dead letter queue`, {
        eventType: job?.data.eventType,
        orgId: job?.data.orgId,
        totalAttempts: job?.attemptsMade,
      });
      
      sendSlackAlert('🔴 Webhook Job Failed Permanently', {
        jobId: job?.id,
        eventType: job?.data.eventType,
        orgId: job?.data.orgId,
        error: err.message,
        attempts: job?.attemptsMade,
        receivedAt: job?.data.receivedAt,
      }).catch(() => {});
    }
  });

  worker.on('error', (err) => {
    log.error('WebhookQueue', 'Worker error', { 
      error: err.message,
      stack: err.stack,
    });
  });

  worker.on('stalled', (jobId) => {
    log.warn('WebhookQueue', `Job ${jobId} stalled - will be retried`);
  });

  log.info('WebhookQueue', 'Webhook worker started', {
    concurrency: 5,
    maxAttempts: 3,
    backoffDelay: '2s exponential',
  });
}

export async function enqueueWebhook(data: WebhookJobData): Promise<Job | null> {
  if (!webhookQueue) {
    return null;
  }

  try {
    const job = await webhookQueue.add('process-webhook', data);
    return job;
  } catch (error) {
    log.error('WebhookQueue', 'Failed to enqueue webhook', { error: (error as Error).message });
    return null;
  }
}

export async function getQueueMetrics() {
  if (!webhookQueue) {
    return null;
  }

  try {
    const counts = await webhookQueue.getJobCounts();
    return counts;
  } catch (error) {
    log.error('WebhookQueue', 'Failed to get queue metrics', { error: (error as Error).message });
    return null;
  }
}

export async function closeWebhookQueue(): Promise<void> {
  if (worker) {
    await worker.close();
  }
  if (queueEvents) {
    await queueEvents.close();
  }
  if (webhookQueue) {
    await webhookQueue.close();
  }
  log.info('WebhookQueue', 'Webhook queue closed');
}
