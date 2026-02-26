/**
 * Rate Limiting Middleware for Action Endpoints
 * Prevents abuse of SMS, email, and other rate-limited operations
 *
 * Rate Limits:
 * - SMS: 10 per organization per minute
 * - Email: 100 per organization per hour
 * - Recording share: 50 per organization per hour
 * - Transcript export: 100 per organization per hour
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../services/logger';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // in milliseconds
}

// In-memory store for rate limiting (in production, use Redis)
// Structure: { `${orgId}:${action}`: { count: number, resetTime: number } }
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'sms': { maxRequests: 10, windowMs: 60 * 1000 }, // 10 per minute
  'email': { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
  'share': { maxRequests: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour
  'export': { maxRequests: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
};

/**
 * Check if request exceeds rate limit
 */
function checkRateLimit(orgId: string, action: string): { allowed: boolean; remaining: number; retryAfter: number } {
  const config = RATE_LIMITS[action];
  if (!config) {
    // No rate limit defined for this action
    return { allowed: true, remaining: -1, retryAfter: 0 };
  }

  const key = `${orgId}:${action}`;
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  // Initialize or reset if window expired
  if (!entry || now >= entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  // Increment counter
  entry.count++;

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

  return { allowed, remaining, retryAfter };
}

/**
 * Rate limit middleware factory
 * @param action - The action name (sms, email, share, export)
 */
export function rateLimitAction(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.user?.orgId;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { allowed, remaining, retryAfter } = checkRateLimit(orgId, action);

    // Set rate limit headers
    const config = RATE_LIMITS[action];
    if (config) {
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + retryAfter * 1000).toISOString());
    }

    if (!allowed) {
      log.warn('RateLimit', `Rate limit exceeded for ${action}`, {
        orgId,
        action,
        retryAfter,
      });

      return res.status(429).json({
        error: `Rate limit exceeded for ${action}`,
        retryAfter,
        message: `Please try again in ${retryAfter} seconds`,
      });
    }

    // Pass control to next middleware
    next();
  };
}

/**
 * Cleanup old entries periodically (prevent memory leak)
 * Run every 5 minutes (skip in test environment to prevent timeout)
 */
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of rateLimitStore.entries()) {
      if (now >= entry.resetTime) {
        rateLimitStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info('RateLimit', 'Cleaned up expired entries', { cleaned });
    }
  }, 5 * 60 * 1000);
}

export { rateLimitStore };
