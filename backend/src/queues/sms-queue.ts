/**
 * SMS Queue Implementation
 *
 * Asynchronous SMS delivery using BullMQ to prevent blocking call responses.
 *
 * CRITICAL: SMS sending must NOT block Vapi tool responses.
 * Vapi has a 15-30 second webhook timeout. Synchronous SMS can take 15s x 3 retries = 45s,
 * causing calls to disconnect before booking confirmation is sent.
 *
 * This queue ensures:
 * 1. Immediate response to Vapi (< 500ms)
 * 2. Background SMS delivery with retry
 * 3. Dead letter queue for failed SMS
 * 4. Delivery tracking and monitoring
 */

import { Queue, Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import TwilioGuard from '../services/twilio-guard'; // Default export
import { log } from '../services/logger';
import { supabase } from '../services/supabase-client';

// SMS delivery job data
export interface SmsJobData {
  orgId: string;
  recipientPhone: string;
  message: string;
  twilioCredentials?: {
    accountSid: string;
    authToken: string;
    fromPhone: string;
  };
  metadata?: {
    appointmentId?: string;
    contactId?: string;
    callId?: string;
    triggerType?: 'booking' | 'callback' | 'reminder' | 'test';
  };
}

// SMS queue configuration
const SMS_QUEUE_NAME = 'sms-delivery';

let smsQueue: Queue<SmsJobData> | null = null;
let smsWorker: Worker<SmsJobData> | null = null;

/**
 * Initialize SMS queue and worker. Call from server.ts after Redis is ready.
 */
export function initializeSmsQueue(): void {
  const queueConnection = createRedisConnection();
  if (!queueConnection) {
    log.warn('SmsQueue', 'Redis not available, SMS queue disabled');
    return;
  }

  const workerConnection = createRedisConnection();
  if (!workerConnection) {
    log.warn('SmsQueue', 'Redis not available for worker, SMS queue disabled');
    return;
  }

  smsQueue = new Queue<SmsJobData>(SMS_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 5, // Retry up to 5 times
      backoff: {
        type: 'exponential',
        delay: 1000 // 1s, 2s, 4s, 8s, 16s
      },
      removeOnComplete: {
        age: 3600,  // Keep completed jobs for 1 hour
        count: 100  // Keep last 100 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 1 day
        count: 50
      }
    }
  });

  // SMS worker - processes jobs from the queue
  smsWorker = new Worker<SmsJobData>(
    SMS_QUEUE_NAME,
    async (job: Job<SmsJobData>) => {
      const startTime = Date.now();
      const { orgId, recipientPhone, message, twilioCredentials, metadata } = job.data;

      log.info('SmsQueue', 'Processing SMS job', {
        jobId: job.id,
        orgId,
        recipientPhone,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts
      });

      try {
        // Log SMS delivery attempt
        await logSmsDelivery({
          jobId: job.id!,
          orgId,
          recipientPhone,
          message,
          status: 'processing',
          attemptNumber: job.attemptsMade + 1,
          metadata
        });

        // Send SMS via Twilio with circuit breaker
        const result = await TwilioGuard.sendSmsWithGuard(
          orgId,
          recipientPhone,
          message,
          {
            retries: 1, // BullMQ handles retries, so only 1 attempt per job
            timeoutMs: 10000 // 10 second timeout (reduced from 15s)
          },
          twilioCredentials
        );

        if (result.success) {
          const deliveryTime = Date.now() - startTime;

          // Update delivery log
          await logSmsDelivery({
            jobId: job.id!,
            orgId,
            recipientPhone,
            message,
            status: 'delivered',
            attemptNumber: job.attemptsMade + 1,
            deliveryTime,
            twilioSid: result.sid,
            metadata
          });

          log.info('SmsQueue', 'SMS delivered', {
            jobId: job.id,
            deliveryTime: `${deliveryTime}ms`,
            twilioSid: result.sid
          });

          return { success: true, deliveryTime, sid: result.sid };
        } else {
          // Twilio returned error - will trigger retry
          await logSmsDelivery({
            jobId: job.id!,
            orgId,
            recipientPhone,
            message,
            status: 'failed',
            attemptNumber: job.attemptsMade + 1,
            error: result.error,
            metadata
          });

          throw new Error(result.error || 'Twilio SMS delivery failed');
        }
      } catch (error: any) {
        log.error('SmsQueue', 'SMS delivery attempt failed', {
          jobId: job.id,
          attemptsMade: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts,
          error: error.message
        });

        // Update delivery log
        await logSmsDelivery({
          jobId: job.id!,
          orgId,
          recipientPhone,
          message,
          status: 'failed',
          attemptNumber: job.attemptsMade + 1,
          error: error.message,
          metadata
        });

        // Re-throw to trigger BullMQ retry logic
        throw error;
      }
    },
    {
      connection: workerConnection,
      concurrency: 5, // Process up to 5 SMS concurrently
      drainDelay: 5,  // Wait 5 seconds between polls when queue is empty (saves Redis commands)
      limiter: {
        max: 10, // Max 10 jobs
        duration: 1000 // Per second (10 SMS/sec to avoid Twilio rate limits)
      }
    }
  );

  // Worker error handling
  smsWorker.on('failed', async (job, error) => {
    if (job) {
      const isLastAttempt = job.attemptsMade >= (job.opts.attempts || 5);

      if (isLastAttempt) {
        // Final failure - move to dead letter queue
        log.error('SmsQueue', 'SMS moved to dead letter queue', {
          jobId: job.id,
          orgId: job.data.orgId,
          recipientPhone: job.data.recipientPhone,
          totalAttempts: job.attemptsMade,
          error: error.message
        });

        // Update delivery log as permanently failed
        await logSmsDelivery({
          jobId: job.id!,
          orgId: job.data.orgId,
          recipientPhone: job.data.recipientPhone,
          message: job.data.message,
          status: 'dead_letter',
          attemptNumber: job.attemptsMade,
          error: error.message,
          metadata: job.data.metadata
        });
      }
    }
  });

  log.info('SmsQueue', 'SMS queue and worker initialized', {
    queueName: SMS_QUEUE_NAME,
    concurrency: 5,
    rateLimit: '10 SMS/sec'
  });
}

// Helper: Log SMS delivery to database
interface SmsDeliveryLog {
  jobId: string;
  orgId: string;
  recipientPhone: string;
  message: string;
  status: 'processing' | 'delivered' | 'failed' | 'dead_letter';
  attemptNumber: number;
  deliveryTime?: number;
  twilioSid?: string;
  error?: string;
  metadata?: SmsJobData['metadata'];
}

async function logSmsDelivery(data: SmsDeliveryLog): Promise<void> {
  try {
    await supabase.from('sms_delivery_log').upsert({
      job_id: data.jobId,
      org_id: data.orgId,
      recipient_phone: data.recipientPhone,
      message: data.message,
      status: data.status,
      attempt_number: data.attemptNumber,
      delivery_time_ms: data.deliveryTime,
      twilio_sid: data.twilioSid,
      error_message: data.error,
      metadata: data.metadata,
      updated_at: new Date().toISOString()
    });
  } catch (error: any) {
    log.error('SmsQueue', 'Failed to log SMS delivery', {
      jobId: data.jobId,
      error: error.message
    });
  }
}

// Public API: Queue SMS for delivery
export async function queueSms(data: SmsJobData): Promise<{ jobId: string; queued: true }> {
  if (!smsQueue) {
    throw new Error('SMS queue not initialized. Call initializeSmsQueue() first.');
  }

  const job = await smsQueue.add('send-sms', data, {
    // Job-specific options (optional)
    jobId: `sms-${data.orgId}-${Date.now()}`, // Unique job ID
    priority: data.metadata?.triggerType === 'booking' ? 1 : 10 // Booking SMS prioritized
  });

  log.info('SmsQueue', 'SMS queued for delivery', {
    jobId: job.id,
    orgId: data.orgId,
    recipientPhone: data.recipientPhone,
    triggerType: data.metadata?.triggerType
  });

  return { jobId: job.id!, queued: true };
}

// Public API: Get queue health metrics
export async function getSmsQueueHealth() {
  if (!smsQueue) {
    return {
      queueName: SMS_QUEUE_NAME,
      healthy: false,
      counts: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
    };
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    smsQueue.getWaitingCount(),
    smsQueue.getActiveCount(),
    smsQueue.getCompletedCount(),
    smsQueue.getFailedCount(),
    smsQueue.getDelayedCount()
  ]);

  return {
    queueName: SMS_QUEUE_NAME,
    healthy: waiting < 100 && active < 20 && failed < 10,
    counts: {
      waiting,
      active,
      completed,
      failed,
      delayed
    }
  };
}

// Graceful shutdown
export async function shutdownSmsQueue() {
  log.info('SmsQueue', 'Shutting down SMS queue and worker');
  if (smsWorker) await smsWorker.close();
  if (smsQueue) await smsQueue.close();
}
