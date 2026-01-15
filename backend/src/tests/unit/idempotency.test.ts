/**
 * Unit Tests: Idempotency Middleware
 * Tests request deduplication and cache management
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { v4 as uuid } from 'uuid';

/**
 * Mock Idempotency Cache
 */
class IdempotencyCache {
  private cache: Map<string, any> = new Map();
  private expirations: Map<string, number> = new Map();

  async get(key: string): Promise<any | null> {
    const expiration = this.expirations.get(key);
    if (expiration && expiration < Date.now()) {
      this.cache.delete(key);
      this.expirations.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }

  async set(key: string, value: any, ttlSeconds = 86400): Promise<void> {
    this.cache.set(key, value);
    this.expirations.set(key, Date.now() + ttlSeconds * 1000);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.expirations.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.expirations.clear();
  }
}

/**
 * Mock Idempotency Middleware
 */
class IdempotencyMiddleware {
  constructor(private cache: IdempotencyCache) {}

  async handleRequest(
    key: string,
    operation: () => Promise<any>
  ): Promise<any> {
    if (!key) {
      throw new Error('Idempotency key required');
    }

    // Check cache
    const cached = await this.cache.get(key);
    if (cached) {
      return { cached: true, result: cached };
    }

    // Execute operation
    const result = await operation();

    // Store in cache
    await this.cache.set(key, result);

    return { cached: false, result };
  }
}

describe('Unit Tests: Idempotency Middleware', () => {
  let middleware: IdempotencyMiddleware;
  let cache: IdempotencyCache;
  const testKey = uuid();

  beforeEach(() => {
    cache = new IdempotencyCache();
    middleware = new IdempotencyMiddleware(cache);
  });

  describe('Happy Path', () => {
    it('Should execute operation and cache result', async () => {
      const operation = jest.fn().mockResolvedValue({ status: 'booked' });

      const result = await middleware.handleRequest(testKey, operation);

      expect(result.cached).toBe(false);
      expect(result.result.status).toBe('booked');
      expect(operation).toHaveBeenCalledTimes(1);

      console.log('✅ Idempotency Middleware: Operation execution PASS');
    });

    it('Should return cached result on duplicate request', async () => {
      const operation = jest.fn().mockResolvedValue({ status: 'booked' });

      // First request
      const result1 = await middleware.handleRequest(testKey, operation);
      expect(result1.cached).toBe(false);

      // Second request with same key
      const result2 = await middleware.handleRequest(testKey, operation);
      expect(result2.cached).toBe(true);

      // Operation should be called only once
      expect(operation).toHaveBeenCalledTimes(1);

      // Results should be identical
      expect(result1.result).toEqual(result2.result);

      console.log('✅ Idempotency Middleware: Caching PASS');
    });

    it('Should allow different keys to execute independently', async () => {
      const key1 = uuid();
      const key2 = uuid();
      const operation1 = jest
        .fn()
        .mockResolvedValue({ status: 'booked', key: key1 });
      const operation2 = jest
        .fn()
        .mockResolvedValue({ status: 'lost', key: key2 });

      const result1 = await middleware.handleRequest(key1, operation1);
      const result2 = await middleware.handleRequest(key2, operation2);

      expect(result1.result.status).toBe('booked');
      expect(result2.result.status).toBe('lost');
      expect(operation1).toHaveBeenCalledTimes(1);
      expect(operation2).toHaveBeenCalledTimes(1);

      console.log('✅ Idempotency Middleware: Multiple keys PASS');
    });
  });

  describe('Validation', () => {
    it('Should reject request without idempotency key', async () => {
      const operation = jest.fn();

      await expect(
        middleware.handleRequest('', operation)
      ).rejects.toThrow('Idempotency key required');

      console.log('✅ Idempotency Middleware: Key validation PASS');
    });

    it('Should reject null key', async () => {
      const operation = jest.fn();

      // @ts-ignore - testing invalid input
      await expect(middleware.handleRequest(null, operation)).rejects.toThrow(
        'Idempotency key required'
      );

      console.log('✅ Idempotency Middleware: Null key validation PASS');
    });
  });

  describe('Cache Expiration', () => {
    it('Should return expired cached entries as new requests', async () => {
      const operation = jest.fn().mockResolvedValue({ id: uuid() });

      // First request
      const result1 = await middleware.handleRequest(testKey, operation);
      const id1 = result1.result.id;

      // Manually expire the cache
      await cache.delete(testKey);

      // Second request - should execute again
      const result2 = await middleware.handleRequest(testKey, operation);
      const id2 = result2.result.id;

      expect(id1).not.toEqual(id2); // Different results
      expect(operation).toHaveBeenCalledTimes(2);

      console.log('✅ Idempotency Middleware: Cache expiration PASS');
    });

    it('Should respect TTL for cache entries', async () => {
      const operation = jest.fn().mockResolvedValue({ status: 'confirmed' });

      // Set with 1 second TTL
      await middleware.handleRequest(testKey, operation);

      // Immediately - should be cached
      const result1 = await middleware.handleRequest(testKey, operation);
      expect(result1.cached).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // After expiration - should execute again
      const result2 = await middleware.handleRequest(testKey, operation);
      expect(result2.cached).toBe(false);
      expect(operation).toHaveBeenCalledTimes(2);

      console.log('✅ Idempotency Middleware: TTL expiration PASS');
    }).timeout(3000);
  });

  describe('Error Handling', () => {
    it('Should handle operation failures without caching errors', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('Operation failed'))
        .mockResolvedValueOnce({ status: 'success' });

      // First request fails
      await expect(
        middleware.handleRequest(testKey, operation)
      ).rejects.toThrow('Operation failed');

      // Cache should be empty
      const cached = await cache.has(testKey);
      expect(cached).toBe(false);

      // Second request should retry operation
      const result = await middleware.handleRequest(testKey, operation);
      expect(result.result.status).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);

      console.log('✅ Idempotency Middleware: Error handling PASS');
    });

    it('Should continue working after operation failure', async () => {
      const key1 = uuid();
      const key2 = uuid();
      const operation1 = jest
        .fn()
        .mockRejectedValue(new Error('Operation failed'));
      const operation2 = jest.fn().mockResolvedValue({ status: 'success' });

      // First operation fails
      await expect(middleware.handleRequest(key1, operation1)).rejects.toThrow();

      // Second operation should still work
      const result = await middleware.handleRequest(key2, operation2);
      expect(result.result.status).toBe('success');

      console.log(
        '✅ Idempotency Middleware: Fault tolerance PASS'
      );
    });
  });

  describe('Concurrency', () => {
    it('Should handle concurrent requests with same key', async () => {
      let executionCount = 0;
      const operation = jest.fn().mockImplementation(async () => {
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async work
        return { executionCount, status: 'confirmed' };
      });

      // Fire 3 concurrent requests with same key
      const promises = Array(3)
        .fill(null)
        .map(() => middleware.handleRequest(testKey, operation));

      const results = await Promise.all(promises);

      // First request executes, others are cached
      expect(operation).toHaveBeenCalledTimes(1);

      // All results should be identical
      const firstResult = results[0].result;
      results.forEach((result) => {
        expect(result.result.status).toBe('confirmed');
      });

      console.log('✅ Idempotency Middleware: Concurrency handling PASS');
    });
  });

  describe('Cache Statistics', () => {
    it('Should track cache hits and misses', async () => {
      let hits = 0;
      let misses = 0;

      for (let i = 0; i < 3; i++) {
        const operation = jest.fn().mockResolvedValue({ id: uuid() });
        const key = i === 0 ? testKey : uuid(); // Reuse same key on first iteration

        const result = await middleware.handleRequest(key, operation);
        result.cached ? hits++ : misses++;
      }

      expect(misses).toBe(2); // First and second operations
      expect(hits).toBe(1); // Third operation (reused key)

      console.log('✅ Idempotency Middleware: Statistics tracking PASS');
    });
  });
});
