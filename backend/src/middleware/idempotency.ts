/**
 * Idempotency Middleware
 * 
 * Prevents duplicate request processing within a 60-second deduplication window.
 * Clients must provide an X-Idempotency-Key header. If the same key is received
 * within the window, the cached response is returned without re-processing.
 * 
 * Pattern: Closed-Loop UX Synchronization - Core Foundation
 * Used by: Booking confirmation, SMS send, Lead status update, etc.
 */

import { Request, Response, NextFunction } from 'express';
import { InMemoryCache } from '../services/cache';

// Create a dedicated cache instance for idempotency results
const idempotencyCache = new InMemoryCache();

// Configuration
const IDEMPOTENCY_WINDOW_SECONDS = 60;
const HEADER_NAME = 'x-idempotency-key';

/**
 * Idempotency error - thrown when key validation fails
 */
export class IdempotencyError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'IdempotencyError';
  }
}

/**
 * Idempotency response structure
 */
interface IdempotencyResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
}

/**
 * Enhanced request object with idempotency context
 */
declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
      isIdempotentReplay?: boolean;
    }
  }
}

/**
 * Creates Express middleware for request idempotency
 * 
 * Usage in route:
 * ```
 * router.post('/api/booking/confirm', createIdempotencyMiddleware(), confirmBooking);
 * ```
 * 
 * Client must send:
 * ```
 * X-Idempotency-Key: unique-key-123
 * ```
 */
export function createIdempotencyMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to POST, PUT, PATCH requests
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    // Get idempotency key from headers
    const idempotencyKey = req.headers[HEADER_NAME] as string;

    // Key is optional - if not provided, process normally
    if (!idempotencyKey) {
      req.idempotencyKey = undefined;
      req.isIdempotentReplay = false;
      return next();
    }

    // Validate key format (non-empty string, max 255 chars)
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0 || idempotencyKey.length > 255) {
      return res.status(400).json({
        error: 'Invalid idempotency key',
        message: 'X-Idempotency-Key must be a non-empty string (max 255 chars)',
      });
    }

    // Create cache key: combination of endpoint + method + idempotency key
    const cacheKey = `idempotency:${req.method}:${req.path}:${idempotencyKey}`;

    // Check if this request was already processed
    const cachedResponse = idempotencyCache.get<IdempotencyResponse>(cacheKey);

    if (cachedResponse) {
      // Return cached response
      req.idempotencyKey = idempotencyKey;
      req.isIdempotentReplay = true;

      // Apply cached headers
      Object.entries(cachedResponse.headers).forEach(([key, value]) => {
        if (!['content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      // Set idempotency header to indicate this is a replay
      res.setHeader('X-Idempotency-Replayed', 'true');

      return res.status(cachedResponse.status).json(cachedResponse.body);
    }

    // Store the idempotency key for this request
    req.idempotencyKey = idempotencyKey;
    req.isIdempotentReplay = false;

    // Wrap res.json to intercept response and cache it
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const response: IdempotencyResponse = {
          status: res.statusCode,
          headers: res.getHeaders() as Record<string, string>,
          body: body,
          timestamp: Date.now(),
        };

        idempotencyCache.set(cacheKey, response, IDEMPOTENCY_WINDOW_SECONDS);
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Store idempotent result for non-JSON responses
 * Use this when you need to cache responses that use res.send() or res.end()
 */
export function storeIdempotentResult(
  req: Request,
  status: number,
  body: any,
  headers?: Record<string, string>
): void {
  if (!req.idempotencyKey) return;

  const cacheKey = `idempotency:${req.method}:${req.path}:${req.idempotencyKey}`;

  const response: IdempotencyResponse = {
    status,
    headers: headers || {},
    body,
    timestamp: Date.now(),
  };

  idempotencyCache.set(cacheKey, response, IDEMPOTENCY_WINDOW_SECONDS);
}

/**
 * Clear idempotency cache for testing purposes
 */
export function clearIdempotencyCache(): void {
  idempotencyCache.clear();
}

/**
 * Get idempotency cache stats for monitoring
 */
export function getIdempotencyCacheStats() {
  return {
    size: idempotencyCache.size(),
    windowSeconds: IDEMPOTENCY_WINDOW_SECONDS,
  };
}
