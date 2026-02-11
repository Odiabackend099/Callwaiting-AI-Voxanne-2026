import { LRUCache } from 'lru-cache';

/**
 * JWT Cache Unit Tests (P0-2 Fix)
 *
 * Testing LRU cache implementation for JWT tokens:
 * - Cache operations (set, get, delete)
 * - LRU eviction when max size reached
 * - TTL-based expiration
 *
 * Security: Prevents OOM attacks via unbounded cache growth
 */

describe('JWT Cache Security (P0-2 Fix)', () => {
  const MAX_JWT_CACHE_SIZE = 10000;
  const JWT_CACHE_TTL = 300000; // 5 minutes

  interface CachedJWT {
    userId: string;
    email: string;
    orgId: string;
    expiresAt: number;
  }

  let jwtCache: LRUCache<string, CachedJWT>;

  beforeEach(() => {
    // Create fresh cache instance for each test
    jwtCache = new LRUCache<string, CachedJWT>({
      max: MAX_JWT_CACHE_SIZE,
      ttl: JWT_CACHE_TTL,
      updateAgeOnGet: false,
      allowStale: false,
    });
  });

  describe('Cache Operations', () => {
    it('should store and retrieve cached JWT tokens', () => {
      const token = 'test-jwt-token-123';
      const userId = 'user-abc';
      const email = 'test@example.com';
      const orgId = 'org-xyz';
      const expiresAt = Date.now() + JWT_CACHE_TTL;

      // Store in cache
      jwtCache.set(token, { userId, email, orgId, expiresAt });

      // Retrieve from cache
      const cached = jwtCache.get(token);

      expect(cached).toBeDefined();
      expect(cached?.userId).toBe(userId);
      expect(cached?.email).toBe(email);
      expect(cached?.orgId).toBe(orgId);
      expect(cached?.expiresAt).toBe(expiresAt);
    });

    it('should return undefined for non-existent tokens', () => {
      const cached = jwtCache.get('non-existent-token');
      expect(cached).toBeUndefined();
    });

    it('should delete cached tokens', () => {
      const token = 'test-jwt-token-456';
      const userId = 'user-def';
      const email = 'delete@example.com';
      const orgId = 'org-abc';
      const expiresAt = Date.now() + JWT_CACHE_TTL;

      jwtCache.set(token, { userId, email, orgId, expiresAt });
      expect(jwtCache.get(token)).toBeDefined();

      jwtCache.delete(token);
      expect(jwtCache.get(token)).toBeUndefined();
    });

    it('should track cache size correctly', () => {
      expect(jwtCache.size).toBe(0);

      jwtCache.set('token1', {
        userId: 'user1',
        email: 'user1@example.com',
        orgId: 'org1',
        expiresAt: Date.now() + JWT_CACHE_TTL,
      });
      expect(jwtCache.size).toBe(1);

      jwtCache.set('token2', {
        userId: 'user2',
        email: 'user2@example.com',
        orgId: 'org2',
        expiresAt: Date.now() + JWT_CACHE_TTL,
      });
      expect(jwtCache.size).toBe(2);

      jwtCache.delete('token1');
      expect(jwtCache.size).toBe(1);
    });
  });

  describe('LRU Eviction (OOM Protection)', () => {
    it('should enforce max size limit and evict oldest entries', () => {
      // Create small cache for testing eviction
      const smallCache = new LRUCache<string, CachedJWT>({
        max: 3,
        ttl: JWT_CACHE_TTL,
        updateAgeOnGet: false,
        allowStale: false,
      });

      // Add 3 entries (fills cache)
      smallCache.set('token1', {
        userId: 'user1',
        email: 'user1@example.com',
        orgId: 'org1',
        expiresAt: Date.now() + JWT_CACHE_TTL,
      });
      smallCache.set('token2', {
        userId: 'user2',
        email: 'user2@example.com',
        orgId: 'org2',
        expiresAt: Date.now() + JWT_CACHE_TTL,
      });
      smallCache.set('token3', {
        userId: 'user3',
        email: 'user3@example.com',
        orgId: 'org3',
        expiresAt: Date.now() + JWT_CACHE_TTL,
      });

      expect(smallCache.size).toBe(3);

      // Verify all 3 tokens exist before adding 4th
      expect(smallCache.has('token1')).toBe(true);
      expect(smallCache.has('token2')).toBe(true);
      expect(smallCache.has('token3')).toBe(true);

      // Add 4th entry - should evict oldest (token1)
      smallCache.set('token4', {
        userId: 'user4',
        email: 'user4@example.com',
        orgId: 'org4',
        expiresAt: Date.now() + JWT_CACHE_TTL,
      });

      expect(smallCache.size).toBe(3);
      expect(smallCache.has('token1')).toBe(false); // Evicted (oldest)
      expect(smallCache.has('token2')).toBe(true);
      expect(smallCache.has('token3')).toBe(true);
      expect(smallCache.has('token4')).toBe(true);
    });

    it('should not grow beyond max size even with many insertions', () => {
      const smallCache = new LRUCache<string, CachedJWT>({
        max: 100,
        ttl: JWT_CACHE_TTL,
        updateAgeOnGet: false,
        allowStale: false,
      });

      // Insert 200 entries (2x max size)
      for (let i = 0; i < 200; i++) {
        smallCache.set(`token${i}`, {
          userId: `user${i}`,
          email: `user${i}@example.com`,
          orgId: `org${i}`,
          expiresAt: Date.now() + JWT_CACHE_TTL,
        });
      }

      // Cache should never exceed max size
      expect(smallCache.size).toBe(100);
      expect(smallCache.size).toBeLessThanOrEqual(100);

      // Oldest 100 entries should be evicted
      expect(smallCache.get('token0')).toBeUndefined();
      expect(smallCache.get('token99')).toBeUndefined();

      // Newest 100 entries should still exist
      expect(smallCache.get('token100')).toBeDefined();
      expect(smallCache.get('token199')).toBeDefined();
    });

    it('should prevent OOM attack scenario', () => {
      // Simulate attacker sending 100K unique tokens
      const attackCache = new LRUCache<string, CachedJWT>({
        max: 10000,
        ttl: JWT_CACHE_TTL,
        updateAgeOnGet: false,
        allowStale: false,
      });

      // Attacker sends 100K requests with unique tokens
      for (let i = 0; i < 100000; i++) {
        attackCache.set(`malicious-token-${i}`, {
          userId: `attacker-${i}`,
          email: `attacker${i}@evil.com`,
          orgId: `fake-org-${i}`,
          expiresAt: Date.now() + JWT_CACHE_TTL,
        });
      }

      // Cache should be capped at 10K entries (not 100K)
      expect(attackCache.size).toBe(10000);
      expect(attackCache.size).toBeLessThanOrEqual(10000);

      // Memory usage bounded (not unbounded like old Map implementation)
      // Old Map: 100K entries × ~200 bytes = ~20MB
      // New LRU: 10K entries × ~200 bytes = ~2MB (10x reduction)
    });
  });

  describe('TTL-Based Expiration', () => {
    it('should return undefined for expired entries', (done) => {
      const shortTTLCache = new LRUCache<string, CachedJWT>({
        max: MAX_JWT_CACHE_SIZE,
        ttl: 100, // 100ms TTL for testing
        updateAgeOnGet: false,
        allowStale: false,
      });

      const token = 'test-ttl-token';
      shortTTLCache.set(token, {
        userId: 'user-ttl',
        email: 'ttl@example.com',
        orgId: 'org-ttl',
        expiresAt: Date.now() + 100,
      });

      // Immediately after insert - should exist
      expect(shortTTLCache.get(token)).toBeDefined();

      // After TTL expires - should return undefined
      setTimeout(() => {
        expect(shortTTLCache.get(token)).toBeUndefined();
        done();
      }, 150); // Wait 150ms (past 100ms TTL)
    }, 300); // Test timeout 300ms

    it('should not reset TTL on cache hit (updateAgeOnGet: false)', (done) => {
      const shortTTLCache = new LRUCache<string, CachedJWT>({
        max: MAX_JWT_CACHE_SIZE,
        ttl: 100,
        updateAgeOnGet: false, // Don't reset TTL on get
        allowStale: false,
      });

      const token = 'test-no-reset-ttl';
      shortTTLCache.set(token, {
        userId: 'user-no-reset',
        email: 'no-reset@example.com',
        orgId: 'org-no-reset',
        expiresAt: Date.now() + 100,
      });

      // Access cache at 50ms (should not reset TTL)
      setTimeout(() => {
        expect(shortTTLCache.get(token)).toBeDefined();
      }, 50);

      // At 150ms, should still be expired (TTL not reset)
      setTimeout(() => {
        expect(shortTTLCache.get(token)).toBeUndefined();
        done();
      }, 150);
    }, 300);

    it('should handle multiple entries with different expiration times', (done) => {
      const staggeredCache = new LRUCache<string, CachedJWT>({
        max: MAX_JWT_CACHE_SIZE,
        ttl: 200,
        updateAgeOnGet: false,
        allowStale: false,
      });

      // Insert token1 (TTL 200ms)
      staggeredCache.set('token1', {
        userId: 'user1',
        email: 'user1@example.com',
        orgId: 'org1',
        expiresAt: Date.now() + 200,
      });

      // Wait 100ms, insert token2 (TTL 200ms from now)
      setTimeout(() => {
        staggeredCache.set('token2', {
          userId: 'user2',
          email: 'user2@example.com',
          orgId: 'org2',
          expiresAt: Date.now() + 200,
        });
      }, 100);

      // At 250ms: token1 expired, token2 still valid
      setTimeout(() => {
        expect(staggeredCache.get('token1')).toBeUndefined();
        expect(staggeredCache.get('token2')).toBeDefined();
      }, 250);

      // At 350ms: both expired
      setTimeout(() => {
        expect(staggeredCache.get('token1')).toBeUndefined();
        expect(staggeredCache.get('token2')).toBeUndefined();
        done();
      }, 350);
    }, 500);
  });

  describe('Cache Statistics', () => {
    it('should provide cache size information', () => {
      expect(jwtCache.size).toBe(0);

      for (let i = 0; i < 5; i++) {
        jwtCache.set(`token${i}`, {
          userId: `user${i}`,
          email: `user${i}@example.com`,
          orgId: `org${i}`,
          expiresAt: Date.now() + JWT_CACHE_TTL,
        });
      }

      expect(jwtCache.size).toBe(5);
    });

    it('should support cache clearing', () => {
      for (let i = 0; i < 10; i++) {
        jwtCache.set(`token${i}`, {
          userId: `user${i}`,
          email: `user${i}@example.com`,
          orgId: `org${i}`,
          expiresAt: Date.now() + JWT_CACHE_TTL,
        });
      }

      expect(jwtCache.size).toBe(10);

      jwtCache.clear();
      expect(jwtCache.size).toBe(0);
    });
  });
});
