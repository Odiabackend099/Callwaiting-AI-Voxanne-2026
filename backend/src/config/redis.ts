import Redis from 'ioredis';
import { log } from '../services/logger';

let redisClient: Redis | null = null;

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

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    log.info('Redis', 'Redis connection closed');
  }
}
