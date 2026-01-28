/**
 * Webhook Retry Logic Integration Tests
 * 
 * Tests the end-to-end webhook retry mechanism:
 * - Webhook enqueueing
 * - Automatic retry on failure
 * - Exponential backoff
 * - Dead letter queue handling
 * - Metrics tracking
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { supabase } from '../../services/supabase-client';

// Test configuration
const TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379';
const TEST_QUEUE_NAME = 'test-webhook-queue';

describe('Webhook Retry Integration Tests', () => {
  let redis: Redis;
  let queue: Queue;
  let worker: Worker;
  let processedJobs: Job[] = [];
  let failedJobs: Job[] = [];

  beforeAll(async () => {
    // Connect to Redis
    redis = new Redis(TEST_REDIS_URL);
    
    // Create test queue
    queue = new Queue(TEST_QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 100, // Faster for testing (100ms instead of 2s)
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    });

    // Clear any existing jobs
    await queue.drain();
    await queue.clean(0, 1000, 'completed');
    await queue.clean(0, 1000, 'failed');
  });

  afterAll(async () => {
    // Cleanup
    if (worker) {
      await worker.close();
    }
    if (queue) {
      await queue.close();
    }
    if (redis) {
      await redis.quit();
    }
  });

  beforeEach(() => {
    processedJobs = [];
    failedJobs = [];
  });

  describe('Successful Webhook Processing', () => {
    test('should process webhook successfully on first attempt', async () => {
      // ARRANGE
      const mockWebhook = {
        eventType: 'call.started',
        event: { callId: 'test-call-123', status: 'in-progress' },
        orgId: 'test-org-456',
        receivedAt: new Date().toISOString(),
      };

      worker = new Worker(
        TEST_QUEUE_NAME,
        async (job: Job) => {
          processedJobs.push(job);
          return { success: true };
        },
        { connection: redis }
      );

      // ACT
      const job = await queue.add('process-webhook', mockWebhook);
      
      // Wait for processing
      await job.waitUntilFinished(queue.events);

      // ASSERT
      expect(processedJobs.length).toBe(1);
      expect(processedJobs[0].data.eventType).toBe('call.started');
      expect(processedJobs[0].attemptsMade).toBe(0); // First attempt
      
      const jobState = await job.getState();
      expect(jobState).toBe('completed');
    }, 10000);

    test('should track processing duration', async () => {
      // ARRANGE
      const startTime = Date.now();
      const mockWebhook = {
        eventType: 'call.ended',
        event: { callId: 'test-call-789' },
        orgId: 'test-org-456',
        receivedAt: new Date(startTime).toISOString(),
      };

      worker = new Worker(
        TEST_QUEUE_NAME,
        async (job: Job) => {
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 50));
          processedJobs.push(job);
          return { success: true };
        },
        { connection: redis }
      );

      // ACT
      const job = await queue.add('process-webhook', mockWebhook);
      await job.waitUntilFinished(queue.events);

      // ASSERT
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(50);
      expect(processedJobs[0].data.receivedAt).toBe(mockWebhook.receivedAt);
    }, 10000);
  });

  describe('Webhook Retry Logic', () => {
    test('should retry failed webhook with exponential backoff', async () => {
      // ARRANGE
      let attemptCount = 0;
      const attemptTimestamps: number[] = [];

      const mockWebhook = {
        eventType: 'call.started',
        event: { callId: 'test-call-retry' },
        orgId: 'test-org-456',
        receivedAt: new Date().toISOString(),
      };

      worker = new Worker(
        TEST_QUEUE_NAME,
        async (job: Job) => {
          attemptCount++;
          attemptTimestamps.push(Date.now());
          
          // Fail first 2 attempts, succeed on 3rd
          if (attemptCount < 3) {
            throw new Error(`Temporary failure (attempt ${attemptCount})`);
          }
          
          processedJobs.push(job);
          return { success: true };
        },
        { connection: redis }
      );

      // ACT
      const job = await queue.add('process-webhook', mockWebhook);
      await job.waitUntilFinished(queue.events);

      // ASSERT
      expect(attemptCount).toBe(3);
      expect(processedJobs.length).toBe(1);
      expect(processedJobs[0].attemptsMade).toBe(2); // 0-indexed, so 2 = 3rd attempt

      // Verify exponential backoff (100ms, 200ms delays)
      if (attemptTimestamps.length >= 3) {
        const delay1 = attemptTimestamps[1] - attemptTimestamps[0];
        const delay2 = attemptTimestamps[2] - attemptTimestamps[1];
        
        expect(delay1).toBeGreaterThanOrEqual(90); // ~100ms with tolerance
        expect(delay2).toBeGreaterThanOrEqual(180); // ~200ms with tolerance
      }
    }, 15000);

    test('should move to dead letter queue after max attempts', async () => {
      // ARRANGE
      let attemptCount = 0;
      const mockWebhook = {
        eventType: 'call.failed',
        event: { callId: 'test-call-permanent-fail' },
        orgId: 'test-org-456',
        receivedAt: new Date().toISOString(),
      };

      worker = new Worker(
        TEST_QUEUE_NAME,
        async (job: Job) => {
          attemptCount++;
          failedJobs.push(job);
          throw new Error('Permanent failure');
        },
        { connection: redis }
      );

      // ACT
      const job = await queue.add('process-webhook', mockWebhook);
      
      try {
        await job.waitUntilFinished(queue.events);
      } catch (error) {
        // Expected to fail
      }

      // ASSERT
      expect(attemptCount).toBe(3); // Max attempts
      expect(failedJobs.length).toBe(3);
      
      const jobState = await job.getState();
      expect(jobState).toBe('failed');
      
      const failedReason = job.failedReason;
      expect(failedReason).toContain('Permanent failure');
    }, 15000);
  });

  describe('Webhook Delivery Log', () => {
    test('should create delivery log entry on webhook receipt', async () => {
      // ARRANGE
      const mockWebhook = {
        eventType: 'call.started',
        event: { callId: 'test-call-log' },
        orgId: 'test-org-456',
        receivedAt: new Date().toISOString(),
      };

      worker = new Worker(
        TEST_QUEUE_NAME,
        async (job: Job) => {
          // Simulate logging to database
          await supabase
            .from('webhook_delivery_log')
            .insert({
              org_id: job.data.orgId,
              job_id: job.id!,
              event_type: job.data.eventType,
              event_data: job.data.event,
              status: 'processing',
              attempts: job.attemptsMade + 1,
            });
          
          return { success: true };
        },
        { connection: redis }
      );

      // ACT
      const job = await queue.add('process-webhook', mockWebhook);
      await job.waitUntilFinished(queue.events);

      // ASSERT
      const { data: logs } = await supabase
        .from('webhook_delivery_log')
        .select('*')
        .eq('job_id', job.id!);

      expect(logs).toBeDefined();
      expect(logs!.length).toBeGreaterThan(0);
      expect(logs![0].event_type).toBe('call.started');
      expect(logs![0].org_id).toBe('test-org-456');
    }, 10000);

    test('should update delivery log on failure', async () => {
      // ARRANGE
      const mockWebhook = {
        eventType: 'call.failed',
        event: { callId: 'test-call-log-fail' },
        orgId: 'test-org-456',
        receivedAt: new Date().toISOString(),
      };

      worker = new Worker(
        TEST_QUEUE_NAME,
        async (job: Job) => {
          // Log initial attempt
          await supabase
            .from('webhook_delivery_log')
            .upsert({
              org_id: job.data.orgId,
              job_id: job.id!,
              event_type: job.data.eventType,
              event_data: job.data.event,
              status: 'failed',
              attempts: job.attemptsMade + 1,
              error_message: 'Test failure',
              last_attempt_at: new Date().toISOString(),
            });
          
          throw new Error('Test failure');
        },
        { connection: redis }
      );

      // ACT
      const job = await queue.add('process-webhook', mockWebhook);
      
      try {
        await job.waitUntilFinished(queue.events);
      } catch (error) {
        // Expected
      }

      // ASSERT
      const { data: logs } = await supabase
        .from('webhook_delivery_log')
        .select('*')
        .eq('job_id', job.id!);

      expect(logs).toBeDefined();
      expect(logs!.length).toBeGreaterThan(0);
      expect(logs![0].status).toBe('failed');
      expect(logs![0].error_message).toBe('Test failure');
      expect(logs![0].attempts).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Queue Metrics', () => {
    test('should track queue job counts', async () => {
      // ARRANGE
      worker = new Worker(
        TEST_QUEUE_NAME,
        async (job: Job) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { success: true };
        },
        { connection: redis, concurrency: 1 }
      );

      // ACT - Add multiple jobs
      const jobs = await Promise.all([
        queue.add('webhook-1', { eventType: 'test-1', orgId: 'org-1', receivedAt: new Date().toISOString() }),
        queue.add('webhook-2', { eventType: 'test-2', orgId: 'org-1', receivedAt: new Date().toISOString() }),
        queue.add('webhook-3', { eventType: 'test-3', orgId: 'org-1', receivedAt: new Date().toISOString() }),
      ]);

      // Get metrics immediately
      const counts = await queue.getJobCounts();

      // ASSERT
      expect(counts.waiting + counts.active).toBeGreaterThanOrEqual(2);
      
      // Wait for all to complete
      await Promise.all(jobs.map(j => j.waitUntilFinished(queue.events)));
      
      const finalCounts = await queue.getJobCounts();
      expect(finalCounts.completed).toBeGreaterThanOrEqual(3);
    }, 15000);
  });

  describe('Concurrency Control', () => {
    test('should process webhooks with configured concurrency', async () => {
      // ARRANGE
      const concurrentJobs: Set<string> = new Set();
      let maxConcurrent = 0;

      worker = new Worker(
        TEST_QUEUE_NAME,
        async (job: Job) => {
          concurrentJobs.add(job.id!);
          maxConcurrent = Math.max(maxConcurrent, concurrentJobs.size);
          
          await new Promise(resolve => setTimeout(resolve, 50));
          
          concurrentJobs.delete(job.id!);
          return { success: true };
        },
        { connection: redis, concurrency: 3 }
      );

      // ACT - Add 10 jobs
      const jobs = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          queue.add(`webhook-${i}`, {
            eventType: `test-${i}`,
            orgId: 'org-1',
            receivedAt: new Date().toISOString(),
          })
        )
      );

      await Promise.all(jobs.map(j => j.waitUntilFinished(queue.events)));

      // ASSERT
      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(maxConcurrent).toBeGreaterThan(0);
    }, 15000);
  });
});
