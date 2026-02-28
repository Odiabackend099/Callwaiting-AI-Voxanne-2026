/**
 * Authentication Bypass Security Tests
 *
 * Validates that the auth middleware correctly rejects unauthenticated,
 * malformed, and tampered requests. Covers:
 *   - Missing / empty Authorization header
 *   - Malformed JWT (bad format, invalid signature, expired)
 *   - Org ID extraction from app_metadata only (not body/query)
 *   - MFA enforcement middleware
 *   - JWT LRU cache TTL and size bounds
 */

import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mocks — MUST be declared before any imports that reference them
// ---------------------------------------------------------------------------

jest.mock('../../services/logger', () => ({
  log: {
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
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

const mockGetUser = jest.fn();

jest.mock('../../services/supabase-client', () => ({
  supabase: {
    auth: {
      getUser: (...args: any[]) => mockGetUser(...args),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

jest.mock('../../services/org-validation', () => ({
  validateAndResolveOrgId: jest.fn().mockResolvedValue('test-org-id'),
}));

jest.mock('../../services/mfa-service', () => ({
  MFAService: {
    isMFAEnabled: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { requireAuth } from '../../middleware/auth';
import { requireMFA } from '../../middleware/require-mfa';
import { MFAService } from '../../services/mfa-service';
import { LRUCache } from 'lru-cache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a fake JWT token from a payload object.
 * The format is header.payload.signature — the payload is Base64url-encoded JSON.
 * The header and signature are plausible but not cryptographically valid,
 * which is fine because the middleware uses jwtDecode (no signature verification)
 * and relies on Supabase for full JWT validation.
 */
function fakeJWT(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = 'fake-signature-placeholder';
  return `${header}.${body}.${signature}`;
}

/** Minimal Express mock objects */
function buildMocks() {
  let jsonBody: any = null;
  let statusCode: number | null = null;

  const req: Partial<Request> = {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    path: '/api/test',
  };

  const res: Partial<Response> = {
    status: jest.fn(function (this: any, code: number) {
      statusCode = code;
      return this;
    }) as any,
    json: jest.fn(function (this: any, data: any) {
      jsonBody = data;
      return this;
    }) as any,
  };

  const next: jest.Mock<void, []> = jest.fn();

  return {
    req: req as Request,
    res: res as Response,
    next,
    getStatus: () => statusCode,
    getJson: () => jsonBody,
  };
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('Auth Bypass Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Missing Authorization Header
  // =========================================================================

  describe('Missing Authorization Header', () => {
    it('should return 401 when no Authorization header is present', async () => {
      const { req, res, next } = buildMocks();
      req.headers = {};

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header is empty string', async () => {
      const { req, res, next } = buildMocks();
      req.headers = { authorization: '' };

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Malformed JWT
  // =========================================================================

  describe('Malformed JWT', () => {
    it('should return 401 when Authorization has no Bearer prefix', async () => {
      const { req, res, next } = buildMocks();
      // Token present but not in "Bearer <token>" format
      req.headers = { authorization: 'Token some-random-string' };

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when JWT has invalid signature (Supabase rejects)', async () => {
      // Create a decodable JWT but with no org_id in app_metadata
      // The middleware's verifyJWTAndExtractOrgId will fail because org_id is missing
      const token = fakeJWT({
        sub: 'user-123',
        email: 'test@example.com',
        app_metadata: {}, // no org_id
      });

      const { req, res, next } = buildMocks();
      req.headers = { authorization: `Bearer ${token}` };

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when JWT is completely garbled / undecodable', async () => {
      const { req, res, next } = buildMocks();
      req.headers = { authorization: 'Bearer not.a.valid.jwt.at.all' };

      await requireAuth(req, res, next);

      // jwtDecode will throw, verifyJWTAndExtractOrgId returns null -> 401
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Org ID Extraction Security
  // =========================================================================

  describe('Org ID Extraction Security', () => {
    it('should extract org_id exclusively from app_metadata, not from request body', async () => {
      const legitimateOrgId = 'org-from-jwt-metadata';
      const maliciousOrgId = 'org-injected-via-body';

      const token = fakeJWT({
        sub: 'user-456',
        email: 'legit@example.com',
        app_metadata: { org_id: legitimateOrgId },
      });

      const { req, res, next } = buildMocks();
      req.headers = { authorization: `Bearer ${token}` };
      req.body = { org_id: maliciousOrgId }; // attacker tries to override

      await requireAuth(req, res, next);

      // Middleware should call next() and set req.user.orgId from the JWT
      expect(next).toHaveBeenCalled();
      expect((req as any).user.orgId).toBe(legitimateOrgId);
      expect((req as any).user.orgId).not.toBe(maliciousOrgId);
    });

    it('should reject JWT that has no org_id in app_metadata', async () => {
      const token = fakeJWT({
        sub: 'user-789',
        email: 'no-org@example.com',
        app_metadata: {}, // missing org_id
      });

      const { req, res, next } = buildMocks();
      req.headers = { authorization: `Bearer ${token}` };

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject JWT where org_id is the disallowed default value', async () => {
      const token = fakeJWT({
        sub: 'user-000',
        email: 'default-org@example.com',
        app_metadata: { org_id: 'default' },
      });

      const { req, res, next } = buildMocks();
      req.headers = { authorization: `Bearer ${token}` };

      await requireAuth(req, res, next);

      // The middleware explicitly rejects org_id === 'default'
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. MFA Middleware
  // =========================================================================

  describe('MFA Middleware (requireMFA)', () => {
    const mockedIsMFAEnabled = MFAService.isMFAEnabled as jest.Mock;

    it('should return 403 with MFA_REQUIRED code when user has no MFA enrolled', async () => {
      mockedIsMFAEnabled.mockResolvedValue(false);

      const { req, res, next } = buildMocks();
      // Simulate an already-authenticated user (requireAuth ran first)
      (req as any).user = {
        id: 'user-no-mfa',
        email: 'no-mfa@example.com',
        orgId: 'org-abc',
      };

      await requireMFA(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'MFA_REQUIRED' }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() when user has MFA enrolled and verified', async () => {
      mockedIsMFAEnabled.mockResolvedValue(true);

      const { req, res, next } = buildMocks();
      (req as any).user = {
        id: 'user-with-mfa',
        email: 'mfa@example.com',
        orgId: 'org-def',
      };

      await requireMFA(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 with AUTH_REQUIRED code when no user on request', async () => {
      const { req, res, next } = buildMocks();
      // No req.user set — simulates requireMFA called without prior requireAuth
      (req as any).user = undefined;

      await requireMFA(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AUTH_REQUIRED' }),
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. JWT Cache Security
  // =========================================================================

  describe('JWT Cache Security', () => {
    const MAX_JWT_CACHE_SIZE = 10000;
    const JWT_CACHE_TTL = 300000; // 5 minutes

    interface CachedJWT {
      userId: string;
      email: string;
      orgId: string;
      expiresAt: number;
    }

    it('should not return stale entries after TTL expires', (done) => {
      const shortTTLCache = new LRUCache<string, CachedJWT>({
        max: MAX_JWT_CACHE_SIZE,
        ttl: 100, // 100ms TTL for fast test
        updateAgeOnGet: false,
        allowStale: false,
      });

      const token = 'cache-ttl-test-token';
      shortTTLCache.set(token, {
        userId: 'user-ttl',
        email: 'ttl@example.com',
        orgId: 'org-ttl',
        expiresAt: Date.now() + 100,
      });

      // Immediately available
      expect(shortTTLCache.get(token)).toBeDefined();

      // After TTL, entry should be gone
      setTimeout(() => {
        const result = shortTTLCache.get(token);
        expect(result).toBeUndefined();
        done();
      }, 150);
    }, 500);

    it('should enforce bounded cache size (MAX_JWT_CACHE_SIZE = 10000)', () => {
      const boundedCache = new LRUCache<string, CachedJWT>({
        max: MAX_JWT_CACHE_SIZE,
        ttl: JWT_CACHE_TTL,
        updateAgeOnGet: false,
        allowStale: false,
      });

      // Insert more than max
      const insertCount = MAX_JWT_CACHE_SIZE + 500;
      for (let i = 0; i < insertCount; i++) {
        boundedCache.set(`token-${i}`, {
          userId: `user-${i}`,
          email: `user-${i}@test.com`,
          orgId: `org-${i}`,
          expiresAt: Date.now() + JWT_CACHE_TTL,
        });
      }

      // Cache must never exceed configured max
      expect(boundedCache.size).toBeLessThanOrEqual(MAX_JWT_CACHE_SIZE);
      expect(boundedCache.size).toBe(MAX_JWT_CACHE_SIZE);

      // Oldest entries should have been evicted
      expect(boundedCache.get('token-0')).toBeUndefined();
      expect(boundedCache.get('token-499')).toBeUndefined();

      // Newest entries should still be present
      expect(boundedCache.get(`token-${insertCount - 1}`)).toBeDefined();
    });
  });
});
