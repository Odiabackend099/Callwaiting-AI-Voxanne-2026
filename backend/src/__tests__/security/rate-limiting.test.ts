/**
 * Rate Limiting & Cache Boundedness Security Tests
 *
 * Verifies:
 * - Rate limiter module exports and tier configuration
 * - Per-org isolation (independent counters per org_id)
 * - InMemoryCache LRU eviction, TTL expiration, and stats tracking
 * - Stampede prevention via getOrSet() coalescing
 * - Health endpoint availability (not rate-limited)
 */

// ---------------------------------------------------------------------------
// Mocks (must precede imports)
// ---------------------------------------------------------------------------

jest.mock('../../services/logger', () => ({
  log: { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() }
}));

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  withScope: jest.fn(),
  init: jest.fn(),
  Handlers: {
    requestHandler: jest.fn(() => (_req: any, _res: any, next: any) => next()),
    errorHandler: jest.fn(() => (_err: any, _req: any, _res: any, next: any) => next()),
  },
}));

jest.mock('../../config/redis', () => ({
  getRedisClient: jest.fn(() => null),
  initializeRedis: jest.fn(),
}));

jest.mock('rate-limit-redis', () => {
  return jest.fn();
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import express, { Request, Response } from 'express';
import request from 'supertest';
import { orgRateLimit } from '../../middleware/org-rate-limiter';
import { InMemoryCache } from '../../services/cache';

// ---------------------------------------------------------------------------
// 1. Rate Limiter Configuration
// ---------------------------------------------------------------------------

describe('Rate Limiter Configuration', () => {
  test('orgRateLimit export exists and is a function', () => {
    expect(orgRateLimit).toBeDefined();
    expect(typeof orgRateLimit).toBe('function');
  });

  test('orgRateLimit returns Express middleware', () => {
    const middleware = orgRateLimit();
    expect(typeof middleware).toBe('function');
    // express-rate-limit returns a function with (req, res, next) signature
    expect(middleware.length).toBeGreaterThanOrEqual(2);
  });

  test('returns 429 status code when rate limit is exceeded', async () => {
    // Create an express app with a very low limit to trigger 429
    const app = express();
    app.use(
      orgRateLimit({
        max: 1, // Allow only 1 request per window
        windowMs: 60_000,
      })
    );
    app.get('/api/test', (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    // First request should succeed
    const first = await request(app).get('/api/test');
    expect(first.status).toBe(200);

    // Second request should be rate-limited
    const second = await request(app).get('/api/test');
    expect(second.status).toBe(429);
    expect(second.body.error).toBe('Too many requests');
  });
});

// ---------------------------------------------------------------------------
// 2. Per-Org Isolation
// ---------------------------------------------------------------------------

describe('Per-Org Isolation', () => {
  test('different orgs have independent rate limit counters', async () => {
    const app = express();

    // Attach a fake user with an org-specific tier before the rate limiter runs
    app.use((req: any, _res, next) => {
      const orgId = req.headers['x-org-id'] as string;
      if (orgId) {
        req.user = { id: `user-${orgId}`, orgId, tier: 'free' };
      }
      next();
    });

    app.use(
      orgRateLimit({
        max: 1,
        windowMs: 60_000,
        // Key by org so different orgs get separate buckets
        keyGenerator: (req: any) => req.user?.orgId || req.ip,
      })
    );

    app.get('/api/data', (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    // Org A: first request succeeds
    const orgA1 = await request(app)
      .get('/api/data')
      .set('x-org-id', 'org-aaa');
    expect(orgA1.status).toBe(200);

    // Org B: first request also succeeds (independent counter)
    const orgB1 = await request(app)
      .get('/api/data')
      .set('x-org-id', 'org-bbb');
    expect(orgB1.status).toBe(200);

    // Org A: second request should be rate-limited
    const orgA2 = await request(app)
      .get('/api/data')
      .set('x-org-id', 'org-aaa');
    expect(orgA2.status).toBe(429);

    // Org B: second request should also be rate-limited independently
    const orgB2 = await request(app)
      .get('/api/data')
      .set('x-org-id', 'org-bbb');
    expect(orgB2.status).toBe(429);
  });

  test('requests without org_id fall back to IP-based limiting', async () => {
    const app = express();

    app.use(
      orgRateLimit({
        max: 1,
        windowMs: 60_000,
      })
    );

    app.get('/api/public', (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    // First request (no user/org context) succeeds
    const first = await request(app).get('/api/public');
    expect(first.status).toBe(200);

    // Second request from same IP is limited
    const second = await request(app).get('/api/public');
    expect(second.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// 3. Cache Boundedness (InMemoryCache)
// ---------------------------------------------------------------------------

describe('Cache Boundedness', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache(100);
  });

  afterEach(() => {
    cache.destroy();
  });

  test('default InMemoryCache has maxSize = 10,000 (DEFAULT_MAX_SIZE)', () => {
    const defaultCache = new InMemoryCache();
    const stats = defaultCache.getStats();
    expect(stats.maxSize).toBe(10_000);
    defaultCache.destroy();
  });

  test('LRU eviction: filling cache to max then adding one more evicts oldest entry', () => {
    const smallCache = new InMemoryCache(5);

    // Fill to capacity
    smallCache.set('a', 'alpha', 300);
    smallCache.set('b', 'bravo', 300);
    smallCache.set('c', 'charlie', 300);
    smallCache.set('d', 'delta', 300);
    smallCache.set('e', 'echo', 300);
    expect(smallCache.size()).toBe(5);

    // Adding one more should evict the oldest ('a')
    smallCache.set('f', 'foxtrot', 300);
    expect(smallCache.size()).toBe(5);
    expect(smallCache.get('a')).toBeNull(); // evicted
    expect(smallCache.get('f')).toBe('foxtrot'); // present

    // 'b' through 'e' should still be present
    expect(smallCache.get('b')).toBe('bravo');
    expect(smallCache.get('e')).toBe('echo');

    smallCache.destroy();
  });

  test('TTL expiration: entry expires after TTL and returns null', async () => {
    cache.set('temp', 'value', 1); // 1-second TTL

    // Immediately available
    expect(cache.get('temp')).toBe('value');

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    // Should be expired
    expect(cache.get('temp')).toBeNull();
  });

  test('getStats() returns accurate hit and miss counts', () => {
    cache.set('x', 42, 300);

    // 1 hit
    cache.get('x');
    // 2 misses
    cache.get('nonexistent-1');
    cache.get('nonexistent-2');

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
    expect(stats.hitRate).toBeCloseTo(33.33, 1);
    expect(stats.size).toBe(1);
    expect(stats.maxSize).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 4. Stampede Prevention (getOrSet)
// ---------------------------------------------------------------------------

describe('Stampede Prevention', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache(100);
  });

  afterEach(() => {
    cache.destroy();
  });

  test('concurrent getOrSet() calls with same key only trigger fetchFn once', async () => {
    const fetchFn = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('result'), 50);
        })
    );

    // Fire 5 concurrent calls for the same key
    const promises = Array.from({ length: 5 }, () =>
      cache.getOrSet('shared-key', fetchFn, 300)
    );

    const results = await Promise.all(promises);

    // fetchFn should only have been called once (stampede prevention)
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // All callers receive the same result
    results.forEach((r) => expect(r).toBe('result'));
  });

  test('failed fetchFn evicts the pending entry so next caller retries', async () => {
    let callCount = 0;
    const failingThenSucceeding = jest.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('transient failure');
      }
      return 'recovered';
    });

    // First call should fail
    await expect(
      cache.getOrSet('retry-key', failingThenSucceeding, 300)
    ).rejects.toThrow('transient failure');

    // The pending entry should have been evicted, so the next call retries fetchFn
    const result = await cache.getOrSet('retry-key', failingThenSucceeding, 300);
    expect(result).toBe('recovered');
    expect(failingThenSucceeding).toHaveBeenCalledTimes(2);
  });

  test('successful getOrSet() result is cached for subsequent callers', async () => {
    const fetchFn = jest.fn(async () => 'expensive-result');

    // First call fetches
    const first = await cache.getOrSet('cached-key', fetchFn, 300);
    expect(first).toBe('expensive-result');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Second call should serve from cache (no additional fetch)
    const second = await cache.getOrSet('cached-key', fetchFn, 300);
    expect(second).toBe('expensive-result');
    expect(fetchFn).toHaveBeenCalledTimes(1); // still 1 -- served from cache
  });
});

// ---------------------------------------------------------------------------
// 5. Health Endpoint Availability
// ---------------------------------------------------------------------------

describe('Health Endpoint Availability', () => {
  test('/health endpoint is not rate-limited', async () => {
    const app = express();
    app.use(
      orgRateLimit({
        max: 1,
        windowMs: 60_000,
      })
    );
    app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok' });
    });
    app.get('/api/data', (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    // Exhaust the rate limit via a normal API call
    await request(app).get('/api/data');
    const limited = await request(app).get('/api/data');
    expect(limited.status).toBe(429);

    // /health must remain accessible despite rate limit being exhausted
    const health1 = await request(app).get('/health');
    expect(health1.status).toBe(200);
    expect(health1.body.status).toBe('ok');

    const health2 = await request(app).get('/health');
    expect(health2.status).toBe(200);
  });

  test('/health responds within 500ms even under cache pressure', async () => {
    // Fill a cache to maximum to simulate memory pressure
    const pressureCache = new InMemoryCache(1000);
    for (let i = 0; i < 1000; i++) {
      pressureCache.set(`pressure-${i}`, `value-${i}`, 60);
    }

    const app = express();
    app.use(orgRateLimit());
    app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', cacheSize: pressureCache.size() });
    });

    const start = Date.now();
    const response = await request(app).get('/health');
    const elapsed = Date.now() - start;

    expect(response.status).toBe(200);
    expect(elapsed).toBeLessThan(500);

    pressureCache.destroy();
  });
});
