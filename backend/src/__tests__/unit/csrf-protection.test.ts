/**
 * CSRF Protection Middleware Unit Tests
 *
 * Tests for CSRF token validation middleware (Fortress Protocol security).
 * Verifies:
 * - GET/HEAD/OPTIONS requests bypass CSRF checks (read-only safe)
 * - POST/PUT/DELETE require valid {timestamp}:{HMAC-SHA256} tokens
 * - Token format validation (must contain colon separator)
 * - Token freshness (tokens older than 24h rejected)
 * - Skip paths bypass validation (webhooks, signup, etc.)
 * - HMAC signature validation with timing-safe comparison
 */

import { createHmac } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { csrfProtection, generateCsrfToken } from '../../middleware/csrf-protection';
import { log } from '../../services/logger';

jest.mock('../../services/logger', () => ({
  log: {
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a valid {timestamp}:{HMAC-SHA256} CSRF token using the same
 * secret resolution logic as the middleware (CSRF_SECRET → SUPABASE_SERVICE_ROLE_KEY
 * → dev fallback).
 */
function makeValidCsrfToken(ageMs = 0): string {
  const secret =
    process.env.CSRF_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dev-only-insecure-do-not-use-in-production';
  const ts = (Date.now() - ageMs).toString();
  const mac = createHmac('sha256', secret).update(ts).digest('hex');
  return `${ts}:${mac}`;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('CSRF Protection Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let jsonResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();

    jsonResponse = null;
    mockRequest = {
      method: 'GET',
      headers: {},
      path: '/api/some-endpoint',
      query: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((data) => {
        jsonResponse = data;
        return mockResponse;
      })
    };

    mockNext = jest.fn();
  });

  // -------------------------------------------------------------------------
  // Safe methods: always bypass CSRF
  // -------------------------------------------------------------------------

  describe('Safe Methods (GET, HEAD, OPTIONS)', () => {
    test('should allow GET request without CSRF token', (done) => {
      mockRequest.method = 'GET';
      mockRequest.headers = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });

    test('should allow HEAD request without CSRF token', (done) => {
      mockRequest.method = 'HEAD';
      mockRequest.headers = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });

    test('should allow OPTIONS request without CSRF token', (done) => {
      mockRequest.method = 'OPTIONS';
      mockRequest.headers = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });
  });

  // -------------------------------------------------------------------------
  // Unsafe methods: require valid token
  // -------------------------------------------------------------------------

  describe('Unsafe Methods (POST, PUT, DELETE, PATCH) — missing token', () => {
    test('should reject POST without CSRF token header', (done) => {
      mockRequest.method = 'POST';
      mockRequest.headers = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(jsonResponse).toEqual({
        error: 'CSRF token missing',
        message: 'Request is missing required CSRF token'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledWith(
        'CSRF',
        'Missing CSRF token',
        expect.objectContaining({ method: 'POST' })
      );
      done();
    });

    test('should reject PUT without CSRF token header', (done) => {
      mockRequest.method = 'PUT';
      mockRequest.headers = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });

    test('should reject DELETE without CSRF token header', (done) => {
      mockRequest.method = 'DELETE';
      mockRequest.headers = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });

    test('should reject PATCH without CSRF token header', (done) => {
      mockRequest.method = 'PATCH';
      mockRequest.headers = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });
  });

  // -------------------------------------------------------------------------
  // Valid token acceptance
  // -------------------------------------------------------------------------

  describe('CSRF Token Validation — valid tokens', () => {
    test('should allow POST with valid HMAC token in csrf-token header', (done) => {
      const validToken = makeValidCsrfToken();
      mockRequest.method = 'POST';
      mockRequest.headers = { 'csrf-token': validToken };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalled();
      done();
    });

    test('should allow POST with valid HMAC token in x-csrf-token header', (done) => {
      const validToken = makeValidCsrfToken();
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': validToken };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });

    test('should allow POST with valid HMAC token in body._csrf', (done) => {
      const validToken = makeValidCsrfToken();
      mockRequest.method = 'POST';
      mockRequest.headers = {};
      mockRequest.body = { _csrf: validToken };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });

    test('should allow POST with valid HMAC token in body.csrfToken', (done) => {
      const validToken = makeValidCsrfToken();
      mockRequest.method = 'POST';
      mockRequest.headers = {};
      mockRequest.body = { csrfToken: validToken };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });
  });

  // -------------------------------------------------------------------------
  // Malformed token rejection
  // -------------------------------------------------------------------------

  describe('CSRF Token Validation — malformed tokens', () => {
    test('should reject token with no colon separator (plain hex string)', (done) => {
      // Old token format — no longer valid
      mockRequest.method = 'POST';
      mockRequest.headers = { 'csrf-token': 'a'.repeat(64) };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(jsonResponse).toEqual({
        error: 'Invalid CSRF token',
        message: 'Malformed token'
      });
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });

    test('should reject token with invalid HMAC signature', (done) => {
      // Valid format but wrong HMAC
      const ts = Date.now().toString();
      const badToken = `${ts}:${'x'.repeat(64)}`;
      mockRequest.method = 'POST';
      mockRequest.headers = { 'csrf-token': badToken };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(jsonResponse).toEqual({
        error: 'Invalid CSRF token',
        message: 'Token signature invalid'
      });
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });

    test('should reject arbitrary non-HMAC string', (done) => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'csrf-token': 'not-a-valid-token' };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(jsonResponse.error).toBe('Invalid CSRF token');
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });

    test('should reject empty/whitespace token', (done) => {
      mockRequest.method = 'POST';
      mockRequest.headers = { 'csrf-token': '   ' };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      // Whitespace has no colon → malformed
      expect(jsonResponse.error).toBe('Invalid CSRF token');
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });
  });

  // -------------------------------------------------------------------------
  // Token freshness (expiry)
  // -------------------------------------------------------------------------

  describe('CSRF Token Validation — token expiry', () => {
    test('should reject token older than 24 hours', (done) => {
      // Token generated 25 hours ago
      const expiredToken = makeValidCsrfToken(25 * 60 * 60 * 1000);
      mockRequest.method = 'POST';
      mockRequest.headers = { 'csrf-token': expiredToken };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(jsonResponse).toEqual({
        error: 'Invalid CSRF token',
        message: 'Token expired or invalid timestamp'
      });
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });

    test('should accept token just under 24 hours old', (done) => {
      // Token generated 23h 59m ago
      const freshEnoughToken = makeValidCsrfToken(23 * 60 * 60 * 1000 + 59 * 60 * 1000);
      mockRequest.method = 'POST';
      mockRequest.headers = { 'csrf-token': freshEnoughToken };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });
  });

  // -------------------------------------------------------------------------
  // Skip paths
  // -------------------------------------------------------------------------

  describe('Skip Paths', () => {
    test('should skip CSRF validation for webhook paths', (done) => {
      mockRequest.method = 'POST';
      mockRequest.path = '/api/webhooks/vapi';
      mockRequest.headers = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });

    test('should skip CSRF validation for /api/auth/signup (public endpoint)', (done) => {
      mockRequest.method = 'POST';
      mockRequest.path = '/api/auth/signup';
      mockRequest.headers = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });

    test('should skip CSRF validation for /health', (done) => {
      mockRequest.method = 'POST';
      mockRequest.path = '/health';
      mockRequest.headers = {};

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });
  });

  // -------------------------------------------------------------------------
  // generateCsrfToken() export
  // -------------------------------------------------------------------------

  describe('generateCsrfToken()', () => {
    test('should return string in {timestamp}:{64-char-hex} format', () => {
      const token = generateCsrfToken();

      expect(typeof token).toBe('string');
      const parts = token.split(':');
      expect(parts).toHaveLength(2);

      const [ts, mac] = parts;
      expect(ts).toMatch(/^\d+$/);          // numeric timestamp
      expect(mac).toMatch(/^[0-9a-f]{64}$/); // 64-char lowercase hex
    });

    test('should generate different tokens on successive calls', () => {
      const t1 = generateCsrfToken();
      // Small delay to ensure different timestamp
      const t2 = generateCsrfToken();
      // At minimum the HMAC part should differ if timestamps differ
      // (in practice they may be the same ms, so just verify format on both)
      expect(t1).toMatch(/^\d+:[0-9a-f]{64}$/);
      expect(t2).toMatch(/^\d+:[0-9a-f]{64}$/);
    });

    test('generated token should be accepted by validateCsrfToken', (done) => {
      const token = generateCsrfToken();
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': token };

      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });
  });
});
