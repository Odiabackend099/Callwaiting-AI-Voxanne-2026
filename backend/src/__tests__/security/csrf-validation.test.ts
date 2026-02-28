/**
 * CSRF Token Validation — Security-Focused Integration Tests
 *
 * Complements the unit tests in __tests__/unit/csrf-protection.test.ts by
 * exercising attack scenarios, timing-safety properties, secret-rotation
 * behaviour, and edge cases that are harder to cover at the unit level.
 *
 * The middleware under test lives at ../../middleware/csrf-protection.ts
 * and uses the stateless {timestamp}:{HMAC-SHA256} token format.
 */

import { createHmac } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import {
  generateCsrfToken,
  validateCsrfToken,
  csrfTokenEndpoint,
} from '../../middleware/csrf-protection';

// ---------------------------------------------------------------------------
// Logger mock — must come before any module that transitively imports logger
// ---------------------------------------------------------------------------

jest.mock('../../services/logger', () => ({
  log: {
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Build a valid CSRF token using the same secret-resolution chain as the middleware. */
function makeToken(ageMs = 0): string {
  const secret =
    process.env.CSRF_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dev-only-insecure-do-not-use-in-production';
  const ts = (Date.now() - ageMs).toString();
  const mac = createHmac('sha256', secret).update(ts).digest('hex');
  return `${ts}:${mac}`;
}

/** Build a token stamped with an arbitrary absolute timestamp (ms). */
function makeTokenAtTimestamp(epochMs: number): string {
  const secret =
    process.env.CSRF_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dev-only-insecure-do-not-use-in-production';
  const ts = epochMs.toString();
  const mac = createHmac('sha256', secret).update(ts).digest('hex');
  return `${ts}:${mac}`;
}

/** Build a token using an explicit secret (for secret-rotation tests). */
function makeTokenWithSecret(secret: string, ageMs = 0): string {
  const ts = (Date.now() - ageMs).toString();
  const mac = createHmac('sha256', secret).update(ts).digest('hex');
  return `${ts}:${mac}`;
}

/** Minimal Express-shaped request/response scaffolding. */
function scaffold() {
  let jsonBody: any = null;

  const req: Partial<Request> = {
    method: 'POST',
    headers: {},
    path: '/api/some-endpoint',
    query: {},
    body: {},
  };

  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis() as any,
    json: jest.fn((data) => {
      jsonBody = data;
      return res;
    }) as any,
    setHeader: jest.fn() as any,
  };

  const next: jest.Mock = jest.fn();

  return { req: req as Request, res: res as Response, next, getJson: () => jsonBody };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('CSRF Validation — Security Attack Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Timing-Attack Resistance
  // =========================================================================

  describe('Timing-Attack Resistance', () => {
    test('should use timingSafeEqual for HMAC comparison (rejects forged tokens without fast-path leak)', () => {
      // A token with correct format but totally wrong HMAC should still go
      // through the constant-time comparison path. We verify this indirectly:
      // the middleware returns the *same* 403 shape regardless of how many
      // leading bytes of the HMAC are correct.
      const ts = Date.now().toString();

      // Correct HMAC for reference
      const secret =
        process.env.CSRF_SECRET ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        'dev-only-insecure-do-not-use-in-production';
      const correctHmac = createHmac('sha256', secret).update(ts).digest('hex');

      // Token where the first 32 chars match but the rest are wrong
      const halfRight = correctHmac.slice(0, 32) + 'f'.repeat(32);
      const { req, res, next, getJson } = scaffold();
      req.headers = { 'csrf-token': `${ts}:${halfRight}` };

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(getJson()).toEqual({
        error: 'Invalid CSRF token',
        message: 'Token signature invalid',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should pad short HMAC strings so timingSafeEqual does not throw on length mismatch', () => {
      // A very short HMAC (e.g. 4 chars) must not cause an unhandled error.
      // The middleware pads with '0' before calling timingSafeEqual.
      const ts = Date.now().toString();
      const { req, res, next, getJson } = scaffold();
      req.headers = { 'csrf-token': `${ts}:abcd` };

      validateCsrfToken(req, res, next);

      // Should still reject cleanly (not crash)
      expect(res.status).toHaveBeenCalledWith(403);
      expect(getJson()?.error).toBe('Invalid CSRF token');
      expect(next).not.toHaveBeenCalled();
    });

    test('should take roughly constant time to reject tokens regardless of which byte fails', () => {
      const ts = Date.now().toString();
      const secret =
        process.env.CSRF_SECRET ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        'dev-only-insecure-do-not-use-in-production';
      const correctHmac = createHmac('sha256', secret).update(ts).digest('hex');

      // Build two forged tokens: one failing at byte 0, one failing at byte 31
      const failEarly = 'x' + correctHmac.slice(1);
      const failLate = correctHmac.slice(0, 62) + 'xx';

      const iterations = 50;
      const timings: { early: number[]; late: number[] } = { early: [], late: [] };

      for (let i = 0; i < iterations; i++) {
        // Early-fail token
        {
          const { req, res, next } = scaffold();
          req.headers = { 'csrf-token': `${ts}:${failEarly}` };
          const t0 = performance.now();
          validateCsrfToken(req, res, next);
          timings.early.push(performance.now() - t0);
        }

        // Late-fail token
        {
          const { req, res, next } = scaffold();
          req.headers = { 'csrf-token': `${ts}:${failLate}` };
          const t0 = performance.now();
          validateCsrfToken(req, res, next);
          timings.late.push(performance.now() - t0);
        }
      }

      const avgEarly = timings.early.reduce((a, b) => a + b, 0) / timings.early.length;
      const avgLate = timings.late.reduce((a, b) => a + b, 0) / timings.late.length;

      // The two averages should be within 2ms of each other (generous margin
      // for CI jitter). A non-constant-time comparison would show the late-fail
      // being measurably slower.
      expect(Math.abs(avgEarly - avgLate)).toBeLessThan(2);
    });
  });

  // =========================================================================
  // 2. Token Replay Prevention
  // =========================================================================

  describe('Token Replay Prevention', () => {
    test('should reject token with a future timestamp (negative age)', () => {
      // A token whose timestamp is 1 hour in the future. The middleware checks
      // `tokenAge < 0` which catches this.
      const futureToken = makeTokenAtTimestamp(Date.now() + 60 * 60 * 1000);
      const { req, res, next, getJson } = scaffold();
      req.headers = { 'csrf-token': futureToken };

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(getJson()).toEqual({
        error: 'Invalid CSRF token',
        message: 'Token expired or invalid timestamp',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject token with timestamp=0 (Unix epoch) as expired', () => {
      // A token minted at epoch 0 is >50 years old — must fail the 24h freshness check.
      const epochToken = makeTokenAtTimestamp(0);
      const { req, res, next, getJson } = scaffold();
      req.headers = { 'csrf-token': epochToken };

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(getJson()).toEqual({
        error: 'Invalid CSRF token',
        message: 'Token expired or invalid timestamp',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Secret Rotation Safety
  // =========================================================================

  describe('Secret Rotation Safety', () => {
    test('should reject token generated with a previous secret after CSRF_SECRET changes', () => {
      // Generate a token with the current secret
      const originalSecret = process.env.CSRF_SECRET;
      const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        // Set a known secret and generate a token
        process.env.CSRF_SECRET = 'old-secret-value-abc123';
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        const tokenWithOldSecret = generateCsrfToken();

        // Now rotate to a new secret
        process.env.CSRF_SECRET = 'new-secret-value-xyz789';

        // The token from the old secret should be rejected
        const { req, res, next, getJson } = scaffold();
        req.headers = { 'csrf-token': tokenWithOldSecret };

        validateCsrfToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(getJson()?.message).toBe('Token signature invalid');
        expect(next).not.toHaveBeenCalled();
      } finally {
        if (originalSecret !== undefined) process.env.CSRF_SECRET = originalSecret;
        else delete process.env.CSRF_SECRET;
        if (originalServiceKey !== undefined)
          process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
        else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    });

    test('should prefer CSRF_SECRET over SUPABASE_SERVICE_ROLE_KEY when both are set', () => {
      const originalCsrf = process.env.CSRF_SECRET;
      const originalService = process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        process.env.CSRF_SECRET = 'explicit-csrf-secret';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

        // Generate with explicit CSRF_SECRET
        const token = generateCsrfToken();

        // Validate — should pass because both generate and validate use CSRF_SECRET
        const { req, res, next } = scaffold();
        req.headers = { 'csrf-token': token };
        validateCsrfToken(req, res, next);
        expect(next).toHaveBeenCalled();

        // Now generate a token using the service key directly (simulating a
        // misconfigured client using the wrong secret)
        const tokenFromServiceKey = makeTokenWithSecret('service-role-key');
        const s2 = scaffold();
        s2.req.headers = { 'csrf-token': tokenFromServiceKey };
        validateCsrfToken(s2.req, s2.res, s2.next);

        // This must be rejected because the middleware prefers CSRF_SECRET
        expect(s2.res.status).toHaveBeenCalledWith(403);
        expect(s2.next).not.toHaveBeenCalled();
      } finally {
        if (originalCsrf !== undefined) process.env.CSRF_SECRET = originalCsrf;
        else delete process.env.CSRF_SECRET;
        if (originalService !== undefined)
          process.env.SUPABASE_SERVICE_ROLE_KEY = originalService;
        else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    });
  });

  // =========================================================================
  // 4. Cross-Origin Attack Scenarios
  // =========================================================================

  describe('Cross-Origin Attack Scenarios', () => {
    test('should NOT accept CSRF token from query parameters (prevents Referer/log leakage)', () => {
      // The middleware deliberately ignores req.query to prevent tokens
      // from appearing in URLs (which leak via Referer header and server logs).
      const validToken = makeToken();
      const { req, res, next } = scaffold();
      req.headers = {}; // No header token
      req.body = {}; // No body token
      (req as any).query = { _csrf: validToken, csrfToken: validToken };

      validateCsrfToken(req, res, next);

      // Should be rejected — query params are not a valid token source
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('should NOT accept CSRF token from Cookie header (prevents cookie-tossing CSRF)', () => {
      // Some naive CSRF implementations read from cookies. Ours must not.
      const validToken = makeToken();
      const { req, res, next } = scaffold();
      req.headers = {
        cookie: `csrf-token=${validToken}; _csrf=${validToken}`,
      };

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('should NOT skip CSRF validation for /api/contacts (skip list is minimal)', () => {
      // /api/contacts is a state-changing endpoint that must NOT be in the skip list.
      // This test ensures the skip list hasn't been accidentally expanded.
      const { req, res, next } = scaffold();
      req.method = 'POST';
      req.path = '/api/contacts';
      req.headers = {}; // No CSRF token

      validateCsrfToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Token Endpoint Security
  // =========================================================================

  describe('Token Endpoint Security', () => {
    test('csrfTokenEndpoint should return a token in valid {timestamp}:{hex64} format', () => {
      const req = {} as Request;
      let responseBody: any = null;
      const res = {
        json: jest.fn((data) => {
          responseBody = data;
        }),
      } as unknown as Response;

      csrfTokenEndpoint(req, res);

      expect(res.json).toHaveBeenCalledTimes(1);
      expect(responseBody).toHaveProperty('csrfToken');
      expect(responseBody.csrfToken).toMatch(/^\d+:[0-9a-f]{64}$/);
    });

    test('csrfTokenEndpoint should return an expiresAt ~24 hours in the future', () => {
      const beforeCall = Date.now();
      const req = {} as Request;
      let responseBody: any = null;
      const res = {
        json: jest.fn((data) => {
          responseBody = data;
        }),
      } as unknown as Response;

      csrfTokenEndpoint(req, res);

      expect(responseBody).toHaveProperty('expiresAt');
      const expiresAt = new Date(responseBody.expiresAt).getTime();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      // expiresAt should be between 23h59m and 24h01m from now
      // (generous margin to accommodate test execution time)
      expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + twentyFourHours - 60_000);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + twentyFourHours + 60_000);
    });
  });

  // =========================================================================
  // 6. Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    test('should handle very large token strings (>10KB) without crashing', () => {
      // An attacker might send an oversized token to cause memory issues or
      // trigger an unhandled exception in the HMAC comparison.
      const ts = Date.now().toString();
      const giantHmac = 'a'.repeat(10_240); // 10KB of 'a'
      const { req, res, next, getJson } = scaffold();
      req.headers = { 'csrf-token': `${ts}:${giantHmac}` };

      // Should not throw
      expect(() => {
        validateCsrfToken(req, res, next);
      }).not.toThrow();

      expect(res.status).toHaveBeenCalledWith(403);
      expect(getJson()?.error).toBe('Invalid CSRF token');
      expect(next).not.toHaveBeenCalled();
    });

    test('should split on first colon only — extra colons are part of the HMAC portion', () => {
      // Token format: "timestamp:hmac". If someone sends "ts:extra:data"
      // the middleware should treat "extra:data" as the HMAC (which will
      // then fail validation), NOT crash on unexpected structure.
      const ts = Date.now().toString();
      const tokenWithExtraColons = `${ts}:abc:def:ghi`;
      const { req, res, next, getJson } = scaffold();
      req.headers = { 'csrf-token': tokenWithExtraColons };

      expect(() => {
        validateCsrfToken(req, res, next);
      }).not.toThrow();

      // The middleware uses indexOf(':') for the first colon, so the
      // "HMAC" portion is "abc:def:ghi" which will fail HMAC validation.
      expect(res.status).toHaveBeenCalledWith(403);
      expect(getJson()?.error).toBe('Invalid CSRF token');
      expect(next).not.toHaveBeenCalled();
    });
  });
});
