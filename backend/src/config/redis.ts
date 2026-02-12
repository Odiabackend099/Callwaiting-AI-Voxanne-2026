import Redis from 'ioredis';
import { log } from '../services/logger';
import { isCircuitOpen, recordFailure, recordSuccess } from '../services/safe-call';
import { sendSlackAlert } from '../services/slack-alerts';

let redisClient: Redis | null = null;
const connections: Redis[] = [];

export function initializeRedis(): void {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    log.warn('Redis', 'REDIS_URL not set, skipping initialization');
    return;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      retryStrategy: (times) => {
        // Stop retrying if circuit breaker is open
        if (isCircuitOpen('Redis')) {
          log.warn('Redis', 'Circuit breaker open - stopping retry attempts');
          return null; // Stop retrying
        }

        // Exponential backoff with max 2s delay
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    connections.push(redisClient);

    redisClient.on('connect', () => {
      log.info('Redis', 'Connected to Redis');
      // Record success to reset circuit breaker
      recordSuccess('Redis');
    });

    redisClient.on('error', (err) => {
      log.error('Redis', 'Redis connection error', { error: err.message });

      // Record failure for circuit breaker
      recordFailure('Redis');

      // Send Slack alert if circuit breaker opens (after 3 failures)
      if (isCircuitOpen('Redis')) {
        sendSlackAlert('🔴 Redis Circuit Breaker OPEN', {
          message: 'Redis connection failed 3 times. Queue operations will fail.',
          action: 'Check Redis health immediately',
          nextRetryIn: '30 seconds'
        }).catch((alertErr) => {
          log.error('Redis', 'Failed to send Slack alert', { error: alertErr.message });
        });
      }
    });

    redisClient.on('reconnecting', () => {
      log.info('Redis', 'Attempting to reconnect to Redis...');
    });
  } catch (error) {
    log.error('Redis', 'Failed to initialize Redis', { error: (error as Error).message });
  }
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Creates a NEW Redis connection for BullMQ.
 * BullMQ requires separate connections for Queue, Worker, and QueueEvents.
 * Each call returns a fresh ioredis instance from the same REDIS_URL.
 */
export function createRedisConnection(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    log.warn('Redis', 'REDIS_URL not set, cannot create connection');
    return null;
  }

  const conn = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      // Stop retrying if circuit breaker is open
      if (isCircuitOpen('Redis')) {
        log.warn('Redis', 'Circuit breaker open - stopping retry attempts');
        return null;
      }
      return Math.min(times * 50, 2000);
    },
  });

  conn.on('connect', () => {
    recordSuccess('Redis');
  });

  conn.on('error', (err) => {
    log.error('Redis', 'Connection error', { error: err.message });
    recordFailure('Redis');
  });

  connections.push(conn);
  return conn;
}

export async function closeRedis(): Promise<void> {
  for (const conn of connections) {
    try {
      await conn.quit();
    } catch {
      // Connection may already be closed
    }
  }
  connections.length = 0;
  redisClient = null;
  log.info('Redis', 'All Redis connections closed');
}
