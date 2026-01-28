import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { getRedisClient } from '../config/redis';
import { log } from '../services/logger';

// Rate limit tiers
const DEFAULT_LIMITS = {
  free: { windowMs: 3600000, max: 100 },      // 100 req/hour
  paid: { windowMs: 3600000, max: 1000 },     // 1000 req/hour
  enterprise: { windowMs: 3600000, max: 10000 } // 10000 req/hour
};

export function orgRateLimit(customConfig?: Partial<RateLimitConfig>): Middleware {
  const redisClient = getRedisClient();
  
  // Fallback to in-memory store if Redis is unavailable
  const store = redisClient
    ? new RedisStore(redisClient)
    : new MemoryStore(customConfig?.windowMs || 3600000);
  
  return rateLimit({
    windowMs: 3600000, // 1 hour
    max: (req) => {
      // Get organization tier from request (set by auth middleware)
      const tier = req.user?.tier || 'free';
      return DEFAULT_LIMITS[tier]?.max || DEFAULT_LIMITS.free.max;
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for internal routes
      return req.path.startsWith('/health') || req.path.startsWith('/internal');
    },
    ...customConfig,
    store
  });
}

// Redis store for rate limiting
class RedisStore implements rateLimit.Store {
  constructor(private client: Redis) {}

  async increment(key: string): Promise<rateLimit.IncrementResponse> {
    const results = await this.client
      .multi()
      .incr(key)
      .ttl(key)
      .exec();
    
    if (!results) {
      throw new Error('Redis multi command failed');
    }

    const [[, total], [, ttl]] = results;
    
    if (total === 1) {
      // Set TTL if this is the first increment
      await this.client.expire(key, 3600);
    }

    return {
      totalHits: total as number,
      resetTime: new Date(Date.now() + (ttl as number) * 1000)
    };
  }

  async decrement(key: string): Promise<void> {
    await this.client.decr(key);
  }

  async resetKey(key: string): Promise<void> {
    await this.client.del(key);
  }
}

// In-memory store fallback
class MemoryStore implements rateLimit.Store {
  private hits: Record<string, number> = {};
  private resetTimes: Record<string, number> = {};
  private interval: NodeJS.Timeout;

  constructor(windowMs: number) {
    this.interval = setInterval(() => {
      const now = Date.now();
      Object.keys(this.resetTimes).forEach(key => {
        if (this.resetTimes[key] <= now) {
          delete this.hits[key];
          delete this.resetTimes[key];
        }
      });
    }, 300000); // Clean up every 5 minutes

    if (this.interval.unref) {
      this.interval.unref();
    }
  }

  async increment(key: string): Promise<rateLimit.IncrementResponse> {
    if (!this.hits[key]) {
      this.hits[key] = 0;
    }
    this.hits[key]++;

    if (!this.resetTimes[key]) {
      this.resetTimes[key] = Date.now() + 3600000;
    }

    return {
      totalHits: this.hits[key],
      resetTime: new Date(this.resetTimes[key])
    };
  }

  async decrement(key: string): Promise<void> {
    if (this.hits[key]) {
      this.hits[key]--;
    }
  }

  async resetKey(key: string): Promise<void> {
    delete this.hits[key];
    delete this.resetTimes[key];
  }
}
