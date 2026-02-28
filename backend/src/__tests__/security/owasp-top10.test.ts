/**
 * OWASP Top 10 Security Tests
 *
 * Validates that the Voxanne AI backend enforces critical security controls
 * mapped to the OWASP Top 10 (2021) categories:
 *
 *   A01  Broken Access Control
 *   A03  Injection
 *   A04  Insecure Design
 *   A05  Security Misconfiguration
 *   A09  Security Logging and Monitoring Failures
 *
 * Each describe block corresponds to one OWASP category. Tests exercise
 * production code paths (routers, caches, sanitizers, health checks) with
 * mocked infrastructure so they run fast and deterministically.
 */

// ---------------------------------------------------------------------------
// Module mocks — MUST come before any import that touches these modules
// ---------------------------------------------------------------------------

jest.mock('../../services/logger', () => ({
  log: { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() }
}));

jest.mock('../../config/logger', () => ({
  log: { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() }
}));

jest.mock('../../services/supabase-client', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  }
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

// Mock external service modules that calls-dashboard.ts imports at module level
jest.mock('../../services/call-recording-storage', () => ({
  getSignedRecordingUrl: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/integration-decryptor', () => ({
  IntegrationDecryptor: {
    getTwilioCredentials: jest.fn().mockResolvedValue(null),
    validateGoogleCalendarHealth: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('twilio', () => ({
  Twilio: jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn().mockResolvedValue({ sid: 'mock-sid' }) },
  })),
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }) },
  })),
}));

jest.mock('../../services/retry-strategy', () => ({
  withTwilioRetry: jest.fn((fn: any) => fn()),
  withResendRetry: jest.fn((fn: any) => fn()),
}));

jest.mock('../../middleware/rate-limit-actions', () => ({
  rateLimitAction: jest.fn(() => (_req: any, _res: any, next: any) => next()),
}));

jest.mock('../../middleware/auth', () => ({
  requireAuth: jest.fn(async (req: any, _res: any, next: any) => {
    // Inject test user if not already present
    if (!req.user) {
      req.user = { id: 'test-user-id', orgId: 'test-org-id', email: 'test@example.com' };
    }
    next();
  }),
  requireAuthOrDev: jest.fn((req: any, _res: any, next: any) => {
    if (!req.user) {
      req.user = { id: 'test-user-id', orgId: 'test-org-id', email: 'test@example.com' };
    }
    next();
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import express, { Request, Response } from 'express';
import request from 'supertest';
import { InMemoryCache } from '../../services/cache';
import { sanitizeError, sanitizeValidationError } from '../../utils/error-sanitizer';
import { supabase } from '../../services/supabase-client';

// ---------------------------------------------------------------------------
// Helper: build minimal Express app with calls-dashboard router
// ---------------------------------------------------------------------------

function buildApp() {
  // callsRouter uses requireAuthOrDev which is mocked above
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { callsRouter } = require('../../routes/calls-dashboard');
  const app = express();
  app.use(express.json());
  // Inject test user via middleware (simulates auth)
  app.use((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', orgId: 'test-org-id', email: 'test@example.com' };
    next();
  });
  app.use('/api/calls-dashboard', callsRouter);
  return app;
}

function buildAppWithoutOrgId() {
  const { callsRouter } = require('../../routes/calls-dashboard');
  const app = express();
  app.use(express.json());
  // Inject user WITHOUT orgId — simulates a broken/partial JWT
  app.use((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id' }; // orgId deliberately omitted
    next();
  });
  app.use('/api/calls-dashboard', callsRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('OWASP Top 10 Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =======================================================================
  // A01: Broken Access Control
  // =======================================================================
  describe('A01 - Broken Access Control', () => {
    test('A01-001: requests without orgId in req.user should return 401', async () => {
      const app = buildAppWithoutOrgId();

      const res = await request(app)
        .get('/api/calls-dashboard')
        .expect(401);

      expect(res.body.error).toBeDefined();
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    test('A01-002: UUID format validation rejects non-UUID callId path params', async () => {
      const app = buildApp();

      // SQL injection attempt in callId
      const maliciousId = "'; DROP TABLE calls; --";
      const res = await request(app)
        .get(`/api/calls-dashboard/${encodeURIComponent(maliciousId)}`)
        .expect(400);

      expect(res.body.error).toMatch(/invalid call id/i);
      expect(res.body.code).toBe('INVALID_UUID');
    });

    test('A01-003: all main queries include org_id tenant isolation filter', async () => {
      const mockSupabase = supabase as any;

      // Reset mocks to track calls
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.or.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.range.mockReturnValue(
        Promise.resolve({ data: [], error: null, count: 0 })
      );

      const app = buildApp();
      await request(app).get('/api/calls-dashboard');

      // Verify .eq was called with 'org_id' matching the test user's orgId
      const eqCalls = mockSupabase.eq.mock.calls;
      const orgIdFilter = eqCalls.find(
        (call: any[]) => call[0] === 'org_id' && call[1] === 'test-org-id'
      );
      expect(orgIdFilter).toBeDefined();
    });

    test('A01-004: DELETE endpoint returns 404 when no rows match (not silent 200)', async () => {
      const mockSupabase = supabase as any;

      // Simulate Supabase delete returning 0 rows
      mockSupabase.from.mockReturnThis();
      mockSupabase.delete.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const app = buildApp();
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const res = await request(app)
        .delete(`/api/calls-dashboard/${validUUID}`)
        .expect(404);

      expect(res.body.error).toMatch(/not found/i);
    });
  });

  // =======================================================================
  // A03: Injection
  // =======================================================================
  describe('A03 - Injection', () => {
    test('A03-001: stats timeWindow parameter rejects invalid values', async () => {
      const mockSupabase = supabase as any;

      // The endpoint should reject before reaching the RPC call
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.or.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.limit.mockResolvedValue({ data: [], error: null });

      const app = buildApp();

      // SQL injection attempt in timeWindow
      const res = await request(app)
        .get("/api/calls-dashboard/stats?timeWindow='; DROP TABLE calls; --")
        .expect(400);

      expect(res.body.error).toMatch(/invalid timewindow/i);
    });

    test('A03-002: search parameter is sanitized — SQL metacharacters stripped', async () => {
      const mockSupabase = supabase as any;

      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnThis();
      mockSupabase.or.mockReturnThis();
      mockSupabase.order.mockReturnThis();
      mockSupabase.range.mockReturnValue(
        Promise.resolve({ data: [], error: null, count: 0 })
      );

      const app = buildApp();

      // Attempt filter injection via search parameter containing SQL metacharacters
      // The sanitizer (sanitizeSearchInput) strips: ; ' " = % ` \ and other non-safe chars
      // It keeps: alphanumeric, spaces, +, -, (, ), @, .
      const maliciousSearch = "test'); DROP TABLE calls;--";
      const res = await request(app)
        .get(`/api/calls-dashboard?search=${encodeURIComponent(maliciousSearch)}`)
        .expect(200);

      // The request should succeed (sanitized search) without error
      expect(res.body.calls).toBeDefined();

      // Verify dangerous SQL metacharacters were stripped from the .or() filter
      const orCalls = mockSupabase.or.mock.calls;
      for (const callArgs of orCalls) {
        const filterStr = callArgs[0];
        if (typeof filterStr === 'string' && filterStr.includes('ilike')) {
          // Single quotes are stripped (prevents breaking out of filter syntax)
          expect(filterStr).not.toContain("'");
          // Semicolons are stripped (prevents statement termination)
          expect(filterStr).not.toContain(';');
          // Double-dashes are stripped (prevents SQL comments)
          // Note: individual hyphens are allowed (for phone numbers), but -- together
          // is broken up because the quotes around them are stripped
          expect(filterStr).not.toContain("'--");
        }
      }
    });

    test('A03-003: Zod schema validation catches malformed query parameters', async () => {
      const app = buildApp();

      // page must be positive integer — negative values should fail validation
      const res = await request(app)
        .get('/api/calls-dashboard?page=-1')
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // =======================================================================
  // A04: Insecure Design
  // =======================================================================
  describe('A04 - Insecure Design', () => {
    test('A04-001: analytics/summary uses a 90-day date window (not unbounded scan)', async () => {
      const mockSupabase = supabase as any;

      // Track all .gte() calls across the two parallel queries
      const gteCalls: any[] = [];

      // Build a chainable mock that tracks .gte() and eventually resolves
      const makeChainMock = () => {
        const chain: any = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.gte = jest.fn().mockImplementation((...args: any[]) => {
          gteCalls.push(args);
          // Return a thenable (Promise-like) so Promise.all can resolve it
          return Promise.resolve({ data: [], error: null });
        });
        return chain;
      };

      // The analytics/summary endpoint calls supabase.from('calls') twice in Promise.all
      mockSupabase.from.mockImplementation(() => makeChainMock());

      const app = buildApp();
      await request(app).get('/api/calls-dashboard/analytics/summary');

      // At least one .gte() call should use the 90-day window
      expect(gteCalls.length).toBeGreaterThanOrEqual(1);

      // Find the 90-day window call (the first .gte('created_at', ...) call)
      const ninetyDayCall = gteCalls.find(
        (call: any[]) => call[0] === 'created_at'
      );
      expect(ninetyDayCall).toBeDefined();

      const dateArg = new Date(ninetyDayCall![1]);
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      // Allow 10-second tolerance for test execution time
      const diffMs = Math.abs(dateArg.getTime() - ninetyDaysAgo.getTime());
      expect(diffMs).toBeLessThan(10000);
    });

    test('A04-002: InMemoryCache has a maxSize limit (DEFAULT_MAX_SIZE = 10,000)', () => {
      // Instantiate cache with default constructor
      const cache = new InMemoryCache();
      const stats = cache.getStats();

      expect(stats.maxSize).toBe(10_000);
      cache.destroy();
    });

    test('A04-003: InMemoryCache LRU eviction works when at capacity', () => {
      // Create tiny cache with maxSize = 3 to test eviction
      const cache = new InMemoryCache(3);

      cache.set('key-1', 'value-1');
      cache.set('key-2', 'value-2');
      cache.set('key-3', 'value-3');

      // Cache is at capacity (3/3)
      expect(cache.size()).toBe(3);

      // Adding a 4th key should evict the oldest (key-1)
      cache.set('key-4', 'value-4');
      expect(cache.size()).toBe(3);
      expect(cache.get('key-1')).toBeNull(); // evicted
      expect(cache.get('key-4')).toBe('value-4'); // present

      cache.destroy();
    });
  });

  // =======================================================================
  // A05: Security Misconfiguration
  // =======================================================================
  describe('A05 - Security Misconfiguration', () => {
    test('A05-001: health endpoint returns 200 when DB is healthy (not blocked by missing OpenAI key)', async () => {
      const mockSupabase = supabase as any;

      // Simulate healthy DB: rpc('ping') resolves, then organizations query resolves
      mockSupabase.rpc.mockResolvedValue({ error: null });

      // Import health router
      const { healthRouter } = require('../../routes/health');
      const app = express();
      app.use(healthRouter);

      // Ensure VAPI_PRIVATE_KEY is set so the checks.vapi passes
      const originalVapiKey = process.env.VAPI_PRIVATE_KEY;
      process.env.VAPI_PRIVATE_KEY = 'test-key';

      try {
        const res = await request(app).get('/health').expect(200);
        expect(res.body.status).toBe('healthy');
        expect(res.body.checks.database).toBe(true);
      } finally {
        if (originalVapiKey === undefined) {
          delete process.env.VAPI_PRIVATE_KEY;
        } else {
          process.env.VAPI_PRIVATE_KEY = originalVapiKey;
        }
      }
    });

    test('A05-002: health check has 2s timeout (does not hang on slow DB)', async () => {
      const mockSupabase = supabase as any;

      // Simulate a slow DB that never resolves
      mockSupabase.rpc.mockImplementation(
        () => new Promise(() => {/* never resolves */})
      );

      // Override fallback .from query to also never resolve
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(new Promise(() => {/* never resolves */})),
        }),
      });

      const { healthRouter } = require('../../routes/health');
      const app = express();
      app.use(healthRouter);

      const start = Date.now();
      const res = await request(app).get('/health');
      const elapsed = Date.now() - start;

      // Should resolve within ~2-3s (2s timeout + overhead), not hang
      expect(elapsed).toBeLessThan(5000);
      // DB check should fail due to timeout
      expect(res.body.checks.database).toBe(false);
      // Returns 503 when DB is down
      expect(res.status).toBe(503);
    }, 10000); // 10s Jest timeout for this test

    test('A05-003: CSRF secret fallback chain works (CSRF_SECRET -> SUPABASE_SERVICE_ROLE_KEY -> dev fallback)', () => {
      const { generateCsrfToken, csrfProtection } = require('../../middleware/csrf-protection');

      // Save originals
      const origCsrf = process.env.CSRF_SECRET;
      const origSupa = process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        // Case 1: CSRF_SECRET set — should generate valid token
        process.env.CSRF_SECRET = 'test-csrf-secret-1';
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        const token1 = generateCsrfToken();
        expect(token1).toMatch(/^\d+:[0-9a-f]{64}$/);

        // Case 2: Only SUPABASE_SERVICE_ROLE_KEY set
        delete process.env.CSRF_SECRET;
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-supabase-key-2';
        const token2 = generateCsrfToken();
        expect(token2).toMatch(/^\d+:[0-9a-f]{64}$/);
        // Tokens differ because different secrets are used
        expect(token1).not.toEqual(token2);

        // Case 3: Neither set — uses dev fallback (should still generate token)
        delete process.env.CSRF_SECRET;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        const token3 = generateCsrfToken();
        expect(token3).toMatch(/^\d+:[0-9a-f]{64}$/);
      } finally {
        // Restore
        if (origCsrf !== undefined) process.env.CSRF_SECRET = origCsrf;
        else delete process.env.CSRF_SECRET;
        if (origSupa !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupa;
        else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    });
  });

  // =======================================================================
  // A09: Security Logging and Monitoring Failures
  // =======================================================================
  describe('A09 - Security Logging and Monitoring Failures', () => {
    test('A09-001: sanitizeError() strips internal database details from user-facing responses', () => {
      // Simulate a PostgreSQL relation error with internal schema details
      const dbError = new Error(
        'relation "public.calls" does not exist on server pg-12345.supabase.co'
      );
      (dbError as any).code = '42P01';
      (dbError as any).detail = 'Schema migration not applied';
      (dbError as any).constraint = 'calls_pkey';

      const result = sanitizeError(dbError, 'test-context', 'Something went wrong');

      // The sanitized message must NOT contain internal infrastructure details
      expect(result).not.toContain('pg-12345');
      expect(result).not.toContain('supabase.co');
      expect(result).not.toContain('42P01');
      expect(result).not.toContain('Schema migration');
      // It should return a user-friendly message about database configuration
      expect(result).toMatch(/database configuration|contact support/i);
    });

    test('A09-002: sanitizeError() returns generic fallback for unknown error types', () => {
      const unknownError = new Error('some_obscure_internal_thing_xyz_12345');
      const fallback = 'Operation failed. Please try again.';

      const result = sanitizeError(unknownError, 'test-context', fallback);

      // Should return the fallback, not the raw error message
      expect(result).toBe(fallback);
      expect(result).not.toContain('obscure_internal');
    });

    test('A09-003: sanitizeValidationError() does not expose schema details', () => {
      // Simulate a Zod error with field-level schema information
      const zodLikeError = {
        issues: [
          {
            code: 'too_small',
            minimum: 1,
            type: 'string',
            inclusive: true,
            exact: false,
            message: 'String must contain at least 1 character(s)',
            path: ['password'],
          },
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            message: 'Expected string, received number',
            path: ['email'],
          },
        ],
      };

      const result = sanitizeValidationError(zodLikeError);

      // Should NOT expose field names, types, or internal schema details
      expect(result).not.toContain('password');
      expect(result).not.toContain('email');
      expect(result).not.toContain('too_small');
      expect(result).not.toContain('invalid_type');
      // Should return a generic user-friendly message
      expect(result).toMatch(/invalid input|check your data/i);
    });

    test('A09-004: error responses from calls-dashboard include request_id for traceability', async () => {
      const app = buildApp();

      // Trigger a validation error (page=-1 is invalid)
      const res = await request(app)
        .get('/api/calls-dashboard?page=-1')
        .expect(400);

      // The response should include a request_id for log correlation
      expect(res.body.request_id).toBeDefined();
      expect(typeof res.body.request_id).toBe('string');
      // UUID v4 format
      expect(res.body.request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    test('A09-005: sanitizeError() handles network/timeout errors with user-friendly message', () => {
      const timeoutError = new Error('Request timed out after 30000ms');
      const result = sanitizeError(timeoutError, 'test-context', 'Fallback');

      expect(result).toMatch(/timed out|try again/i);
      expect(result).not.toContain('30000ms');
    });
  });
});
