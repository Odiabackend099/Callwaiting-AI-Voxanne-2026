import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../config/redis';
import { log } from '../services/logger';

// Rate limit tiers
const DEFAULT_LIMITS = {
  free: { windowMs: 3600000, max: 1000 },
  paid: { windowMs: 3600000, max: 5000 },
  enterprise: { windowMs: 3600000, max: 10000 }
};

export function orgRateLimit(customConfig?: any) {
  const redisClient = getRedisClient();

  const store = redisClient
    ? new RedisStore({
        // @ts-expect-error - rate-limit-redis uses different Redis type
        client: redisClient,
        prefix: 'rl:org:',
        sendCommand: (...args: string[]) => redisClient.call(...args),
      })
    : undefined;

  return rateLimit({
    windowMs: 3600000,
    max: (req: Request) => {
      const tier = req.user?.tier || 'free';
      return DEFAULT_LIMITS[tier]?.max || DEFAULT_LIMITS.free.max;
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      return req.path.startsWith('/health') || req.path.startsWith('/internal');
    },
    handler: (req: Request, res: Response) => {
      log.warn('RateLimit', 'Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        user: req.user?.id
      });
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: res.getHeader('Retry-After')
      });
    },
    ...customConfig,
    store
  });
}
