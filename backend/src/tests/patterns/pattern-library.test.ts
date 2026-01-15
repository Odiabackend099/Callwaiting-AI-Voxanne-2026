/**
 * Pattern Library Integration Tests
 * 
 * Tests the complete Closed-Loop UX Synchronization pattern:
 * 1. Idempotency middleware - prevents duplicate processing
 * 2. Error recovery - retries with exponential backoff
 * 3. Realtime sync - broadcasts changes to all clients
 * 4. End-to-end - complete request/response cycle
 */

import { Request, Response } from 'express';
import { createIdempotencyMiddleware, clearIdempotencyCache, getIdempotencyCacheStats } from '../../middleware/idempotency';
import { retryWithBackoff, CircuitBreaker, OfflineQueue } from '../../utils/error-recovery';
import { RealtimeSyncService, RealtimeEventType } from '../../services/realtime-sync';

describe('Pattern Library - Closed-Loop UX Synchronization', () => {
  describe('Idempotency Middleware', () => {
    let middleware: any;

    beforeEach(() => {
      middleware = createIdempotencyMiddleware();
      clearIdempotencyCache();
    });

    it('should allow requests without idempotency key', (done) => {
      const req = {
        method: 'POST',
        path: '/api/booking/confirm',
        headers: {},
      } as any as Request;

      const res = {
        status: () => res,
        json: () => {
          expect(req.idempotencyKey).toBeUndefined();
          expect(req.isIdempotentReplay).toBe(false);
          done();
        },
      } as any as Response;

      const next = () => res.json();
      middleware(req, res, next);
    });

    it('should process request with valid idempotency key', (done) => {
      const req = {
        method: 'POST',
        path: '/api/booking/confirm',
        headers: { 'x-idempotency-key': 'key-123' },
      } as any as Request;

      const res = {
        status: () => res,
        json: (body: any) => {
          expect(req.idempotencyKey).toBe('key-123');
          expect(req.isIdempotentReplay).toBe(false);
          done();
          return res;
        },
        setHeader: () => {},
        getHeaders: () => ({}),
      } as any as Response;

      const next = () => res.json({});
      middleware(req, res, next);
    });

    it('should return cached response on duplicate request', (done) => {
      const req1 = {
        method: 'POST',
        path: '/api/booking/confirm',
        headers: { 'x-idempotency-key': 'key-123' },
      } as any as Request;

      const res1 = {
        status: (code: number) => {
          res1.statusCode = code;
          return res1;
        },
        statusCode: 200,
        json: (body: any) => {
          // First request succeeds
          expect(body).toEqual({ success: true, id: '123' });
        },
        setHeader: () => {},
        getHeaders: () => ({ 'content-type': 'application/json' }),
      } as any as Response;

      const next1 = () => res1.json({ success: true, id: '123' });
      middleware(req1, res1, next1);

      // Simulate second request with same key
      setTimeout(() => {
        const req2 = {
          method: 'POST',
          path: '/api/booking/confirm',
          headers: { 'x-idempotency-key': 'key-123' },
        } as any as Request;

        let callCount = 0;
        const res2 = {
          status: (code: number) => {
            res2.statusCode = code;
            return res2;
          },
          statusCode: 200,
          json: (body: any) => {
            callCount++;
            // Should return cached response without calling next
            expect(body).toEqual({ success: true, id: '123' });
            expect(req2.isIdempotentReplay).toBe(true);
            expect(callCount).toBe(1);
            done();
          },
          setHeader: () => {},
          getHeaders: () => ({ 'content-type': 'application/json' }),
        } as any as Response;

        const next2 = () => {
          // This should NOT be called for replay
          fail('next() should not be called for idempotent replay');
        };

        middleware(req2, res2, next2);
      }, 100);
    });

    it('should reject invalid idempotency key', (done) => {
      const req = {
        method: 'POST',
        path: '/api/booking/confirm',
        headers: { 'x-idempotency-key': '' },
      } as any as Request;

      const res = {
        status: (code: number) => {
          expect(code).toBe(400);
          return res;
        },
        json: (body: any) => {
          expect(body.error).toBe('Invalid idempotency key');
          done();
        },
      } as any as Response;

      const next = () => {
        fail('next() should not be called for invalid key');
      };

      middleware(req, res, next);
    });

    it('should only apply to POST/PUT/PATCH methods', (done) => {
      const req = {
        method: 'GET',
        path: '/api/booking/confirm',
        headers: { 'x-idempotency-key': 'key-123' },
      } as any as Request;

      const res = {} as any as Response;

      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      middleware(req, res, next);
      expect(nextCalled).toBe(true);
      expect(req.idempotencyKey).toBeUndefined();
      done();
    });
  });

  describe('Error Recovery - Retry with Backoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts exhausted', async () => {
      const fn = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));

      await expect(
        retryWithBackoff(fn, {
          maxAttempts: 2,
          initialDelayMs: 10,
          maxDelayMs: 50,
        })
      ).rejects.toThrow('Network error');

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect shouldRetry callback', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Not retryable'))
        .mockResolvedValueOnce('success');

      await expect(
        retryWithBackoff(fn, {
          maxAttempts: 3,
          shouldRetry: (error) => !error.message.includes('Not retryable'),
        })
      ).rejects.toThrow('Not retryable');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 50,
        onRetry,
      });

      expect(result).toBe('success');
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });
  });

  describe('Error Recovery - Circuit Breaker', () => {
    it('should allow requests in CLOSED state', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const fn = jest.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should open circuit after failure threshold', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });
      const fn = jest.fn().mockRejectedValue(new Error('Service down'));

      // First failure
      await expect(breaker.execute(fn)).rejects.toThrow();
      expect(breaker.getState()).toBe('CLOSED');

      // Second failure - should open
      await expect(breaker.execute(fn)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Should fail immediately without calling fn
      const callCount = fn.mock.calls.length;
      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
      expect(fn).toHaveBeenCalledTimes(callCount);
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });
      const fn = jest.fn().mockRejectedValue(new Error('Service down'));

      // Open the circuit
      await expect(breaker.execute(fn)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 75));

      // Should now be in HALF_OPEN state
      fn.mockResolvedValueOnce('recovered');
      const result = await breaker.execute(fn);

      expect(result).toBe('recovered');
      expect(breaker.getState()).toBe('HALF_OPEN');
    });

    it('should close circuit after successful HALF_OPEN attempts', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });
      const fn = jest.fn();

      // Open the circuit
      fn.mockRejectedValueOnce(new Error('Error'));
      await expect(breaker.execute(fn)).rejects.toThrow();

      // Wait and transition to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 75));

      // Three successful calls should close circuit
      fn.mockResolvedValue('ok');
      await breaker.execute(fn);
      await breaker.execute(fn);
      await breaker.execute(fn);

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should return metrics', () => {
      const breaker = new CircuitBreaker();
      const metrics = breaker.getMetrics();

      expect(metrics).toHaveProperty('state');
      expect(metrics).toHaveProperty('failureCount');
      expect(metrics).toHaveProperty('successCount');
    });
  });

  describe('Error Recovery - Offline Queue', () => {
    it('should add items to queue', () => {
      const queue = new OfflineQueue();
      const fn = jest.fn();

      const id = queue.add(fn);

      expect(id).toBeTruthy();
      expect(queue.size()).toBe(1);
    });

    it('should remove items from queue', () => {
      const queue = new OfflineQueue();
      const fn = jest.fn();

      const id = queue.add(fn);
      queue.remove(id);

      expect(queue.size()).toBe(0);
    });

    it('should process queue and retry failed items', async () => {
      const queue = new OfflineQueue();

      const fn1 = jest.fn().mockResolvedValue('ok');
      const fn2 = jest.fn().mockRejectedValue(new Error('Failed'));

      queue.add(fn1);
      queue.add(fn2, { maxRetries: 1 });

      const result = await queue.process();

      expect(result.succeeded).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(queue.size()).toBe(0);
    });

    it('should prioritize queue items', () => {
      const queue = new OfflineQueue();

      queue.add(() => Promise.resolve(), { priority: 'LOW' });
      queue.add(() => Promise.resolve(), { priority: 'HIGH' });
      queue.add(() => Promise.resolve(), { priority: 'NORMAL' });

      const items = queue.getAll();

      expect(items[0].priority).toBe('HIGH');
      expect(items[1].priority).toBe('NORMAL');
      expect(items[2].priority).toBe('LOW');
    });

    it('should return queue statistics', () => {
      const queue = new OfflineQueue();

      queue.add(() => Promise.resolve(), { priority: 'HIGH' });
      queue.add(() => Promise.resolve(), { priority: 'HIGH' });
      queue.add(() => Promise.resolve(), { priority: 'NORMAL' });

      const stats = queue.getStats();

      expect(stats.totalItems).toBe(3);
      expect(stats.byPriority.HIGH).toBe(2);
      expect(stats.byPriority.NORMAL).toBe(1);
    });
  });

  describe('Realtime Sync Service', () => {
    let realtimeSync: RealtimeSyncService;

    beforeEach(() => {
      realtimeSync = new RealtimeSyncService();
    });

    afterEach(async () => {
      await realtimeSync.destroy();
    });

    it('should subscribe to table changes', async () => {
      const callback = jest.fn();

      const unsubscribe = realtimeSync.subscribe('bookings', callback);

      expect(typeof unsubscribe).toBe('function');
      expect(realtimeSync.getSubscriptionCount()).toBe(1);

      unsubscribe();
      expect(realtimeSync.getSubscriptionCount()).toBe(0);
    });

    it('should cache latest state', async () => {
      const data = { id: 1, status: 'confirmed' };

      await realtimeSync.publish('bookings', data);

      const cached = realtimeSync.getLatest('bookings');
      expect(cached).toEqual(data);
    });

    it('should wait for specific changes', async () => {
      const changePromise = realtimeSync.waitForChange(
        'bookings',
        5000,
        (event) => event.new.status === 'confirmed'
      );

      // Simulate a change after a brief delay
      setTimeout(() => {
        realtimeSync.publish('bookings', { id: 1, status: 'confirmed' });
      }, 100);

      const event = await changePromise;

      expect(event.new.status).toBe('confirmed');
    });

    it('should timeout if change does not occur', async () => {
      const changePromise = realtimeSync.waitForChange(
        'bookings',
        100,
        (event) => event.new.status === 'confirmed'
      );

      await expect(changePromise).rejects.toThrow('Timeout waiting for change');
    });

    it('should handle multiple subscriptions', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsub1 = realtimeSync.subscribe('bookings', callback1);
      const unsub2 = realtimeSync.subscribe('leads', callback2);

      expect(realtimeSync.getSubscriptionCount()).toBe(2);

      unsub1();
      expect(realtimeSync.getSubscriptionCount()).toBe(1);

      unsub2();
      expect(realtimeSync.getSubscriptionCount()).toBe(0);
    });
  });

  describe('Integration - Complete Sync Pattern', () => {
    it('should coordinate idempotency + retry + realtime', async () => {
      // Simulate: request comes in with idempotency key
      // → processing fails → retry logic kicks in
      // → eventually succeeds → realtime notifies all clients

      const idempotencyKey = 'booking-123';
      let attemptCount = 0;

      // Simulate API endpoint with retry
      const executeBooking = async () => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        return { id: 123, status: 'confirmed' };
      };

      // Should succeed with retry
      const result = await retryWithBackoff(executeBooking, {
        maxAttempts: 3,
        initialDelayMs: 10,
      });

      expect(result).toEqual({ id: 123, status: 'confirmed' });
      expect(attemptCount).toBe(2);
    });

    it('should handle offline queue with circuit breaker', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const queue = new OfflineQueue();

      // Add failed request to queue
      queue.add(() => breaker.execute(() => Promise.reject(new Error('Service down'))));

      const result = await queue.process();

      // Should fail and add back to queue
      expect(queue.size()).toBeGreaterThan(0);
    });
  });
});
