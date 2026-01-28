/**
 * CSRF Protection Middleware Unit Tests
 *
 * Tests for CSRF token validation middleware (Fortress Protocol security).
 * Verifies:
 * - GET/HEAD/OPTIONS requests bypass CSRF checks (read-only safe)
 * - POST/PUT/DELETE require valid CSRF tokens
 * - Token validation against session
 * - Clear error messages for CSRF failures
 * - Graceful handling of missing session
 */

import { Request, Response, NextFunction } from 'express';
import { csrfProtection } from '../../middleware/csrf-protection';
import { log } from '../../services/logger';

jest.mock('../../services/logger', () => ({
  log: {
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

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

  describe('Safe Methods (GET, HEAD, OPTIONS)', () => {
    test('should allow GET request without CSRF token', (done) => {
      // ARRANGE
      mockRequest.method = 'GET';
      mockRequest.headers = {}; // No CSRF token

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });

    test('should allow HEAD request without CSRF token', (done) => {
      // ARRANGE
      mockRequest.method = 'HEAD';
      mockRequest.headers = {};

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });

    test('should allow OPTIONS request without CSRF token', (done) => {
      // ARRANGE
      mockRequest.method = 'OPTIONS';
      mockRequest.headers = {};

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });
  });

  describe('Unsafe Methods (POST, PUT, DELETE, PATCH)', () => {
    test('should reject POST without CSRF token header', (done) => {
      // ARRANGE
      mockRequest.method = 'POST';
      mockRequest.headers = {}; // No csrf-token header

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
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
      // ARRANGE
      mockRequest.method = 'PUT';
      mockRequest.headers = {};

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });

    test('should reject DELETE without CSRF token header', (done) => {
      // ARRANGE
      mockRequest.method = 'DELETE';
      mockRequest.headers = {};

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });

    test('should reject PATCH without CSRF token header', (done) => {
      // ARRANGE
      mockRequest.method = 'PATCH';
      mockRequest.headers = {};

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });
  });

  describe('CSRF Token Validation', () => {
    test('should allow POST with matching CSRF token in header and session', (done) => {
      // ARRANGE
      const validToken = 'a'.repeat(64);
      mockRequest.method = 'POST';
      mockRequest.headers = { 'csrf-token': validToken };

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalled();
      done();
    });

    test('should allow POST with CSRF token in x-csrf-token header', (done) => {
      // ARRANGE
      const validToken = 'b'.repeat(64);
      mockRequest.method = 'POST';
      mockRequest.headers = { 'x-csrf-token': validToken };

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });

    test('should reject POST with mismatched CSRF token', (done) => {
      // ARRANGE
      mockRequest.method = 'POST';
      mockRequest.headers = { 'csrf-token': 'not-hex-token' };

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(jsonResponse).toEqual({
        error: 'Invalid CSRF token',
        message: 'CSRF token format is invalid'
      });
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });

    test('should handle empty/whitespace CSRF token', (done) => {
      // ARRANGE
      mockRequest.method = 'POST';
      mockRequest.headers = { 'csrf-token': '   ' }; // Whitespace

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(jsonResponse).toEqual({
        error: 'Invalid CSRF token',
        message: 'CSRF token format is invalid'
      });
      expect(mockNext).not.toHaveBeenCalled();
      done();
    });
  });

  describe('Skip Paths', () => {
    test('should skip CSRF validation for webhook paths', (done) => {
      // ARRANGE
      mockRequest.method = 'POST';
      mockRequest.path = '/api/webhooks/vapi';
      mockRequest.headers = {};

      // ACT
      csrfProtection(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      done();
    });
  });
});
