import Redis from 'ioredis';
import { log } from '../services/logger';

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
        return Math.min(times * 50, 2000);
      }
    });

    connections.push(redisClient);

    redisClient.on('connect', () => {
      log.info('Redis', 'Connected to Redis');
    });

    redisClient.on('error', (err) => {
      log.error('Redis', 'Redis error', { error: err.message });
    });

    redisClient.on('reconnecting', () => {
      log.info('Redis', 'Reconnecting to Redis');
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
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  conn.on('error', (err) => {
    log.error('Redis', 'Connection error', { error: err.message });
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
