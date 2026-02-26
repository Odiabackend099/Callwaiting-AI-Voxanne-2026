/**
 * Org Context Validator Tests
 *
 * These tests ensure the organization context validation middleware
 * prevents the browser test voice mismatch bug from ever happening again.
 *
 * Date: 2026-02-07
 * Bug Reference: Browser test was querying random org instead of authenticated user's org
 */

// Mock logger before importing middleware
jest.mock('../../config/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { Request, Response, NextFunction } from 'express';
import {
  assertOrgContext,
  requireOrgContext,
  getOrgIdFromRequest,
  DO_NOT_USE_getRandomOrgId,
  validateOrgScopedQuery,
  preventRandomOrgQuery,
  AuthenticatedRequest
} from '../../middleware/org-context-validator';

describe('Organization Context Validator', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      path: '/api/test',
      method: 'GET',
      user: undefined
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('assertOrgContext', () => {
    it('should pass when orgId is present', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        orgId: '46cf2995-2bee-44e3-838b-24151486fe4e',
        role: 'admin'
      };

      expect(() => assertOrgContext(mockReq as Request)).not.toThrow();
    });

    it('should throw when orgId is missing', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com'
      } as any;

      expect(() => assertOrgContext(mockReq as Request)).toThrow(
        'CRITICAL: Organization context missing from authenticated request'
      );
    });

    it('should throw when user is undefined', () => {
      mockReq.user = undefined;

      expect(() => assertOrgContext(mockReq as Request)).toThrow();
    });

    it('should throw when user is null', () => {
      mockReq.user = null as any;

      expect(() => assertOrgContext(mockReq as Request)).toThrow();
    });
  });

  describe('requireOrgContext middleware', () => {
    it('should call next() when orgId is present', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        orgId: '46cf2995-2bee-44e3-838b-24151486fe4e',
        role: 'admin'
      };

      requireOrgContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when orgId is missing', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com'
      } as any;

      requireOrgContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Organization context required'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when user is undefined', () => {
      mockReq.user = undefined;

      requireOrgContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('getOrgIdFromRequest', () => {
    it('should return orgId when present', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        orgId: '46cf2995-2bee-44e3-838b-24151486fe4e',
        role: 'admin'
      };

      const orgId = getOrgIdFromRequest(mockReq as Request);

      expect(orgId).toBe('46cf2995-2bee-44e3-838b-24151486fe4e');
    });

    it('should throw when orgId is missing', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com'
      } as any;

      expect(() => getOrgIdFromRequest(mockReq as Request)).toThrow();
    });
  });

  describe('DO_NOT_USE_getRandomOrgId', () => {
    it('should always throw with helpful error message', () => {
      expect(() => DO_NOT_USE_getRandomOrgId()).toThrow(
        'CRITICAL: Attempted to query random organization ID'
      );
    });

    it('should reference the bug that was fixed', () => {
      try {
        DO_NOT_USE_getRandomOrgId();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('browser test voice mismatch');
        expect((error as Error).message).toContain('2026-02-07');
      }
    });

    it('should suggest correct pattern', () => {
      try {
        DO_NOT_USE_getRandomOrgId();
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('req.user?.orgId');
      }
    });
  });

  describe('validateOrgScopedQuery', () => {
    const testOrgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

    it('should return true when query has org_id filter', () => {
      const query = {
        org_id: testOrgId,
        other_field: 'value'
      };

      expect(validateOrgScopedQuery(query, testOrgId)).toBe(true);
    });

    it('should return true when query has orgId filter (camelCase)', () => {
      const query = {
        orgId: testOrgId,
        other_field: 'value'
      };

      expect(validateOrgScopedQuery(query, testOrgId)).toBe(true);
    });

    it('should return false when query has wrong org_id', () => {
      const query = {
        org_id: 'wrong-org-id',
        other_field: 'value'
      };

      expect(validateOrgScopedQuery(query, testOrgId)).toBe(false);
    });

    it('should return false when query missing org filter', () => {
      const query = {
        other_field: 'value'
      };

      expect(validateOrgScopedQuery(query, testOrgId)).toBe(false);
    });

    it('should return false when query is null', () => {
      expect(validateOrgScopedQuery(null, testOrgId)).toBe(false);
    });

    it('should return false when query is undefined', () => {
      expect(validateOrgScopedQuery(undefined, testOrgId)).toBe(false);
    });
  });

  describe('preventRandomOrgQuery', () => {
    it('should throw with query description', () => {
      expect(() => preventRandomOrgQuery('getOrgAndVapiConfig')).toThrow(
        'BLOCKED: Attempted to use .limit(1).single() pattern without org filter in getOrgAndVapiConfig'
      );
    });

    it('should explain the danger', () => {
      try {
        preventRandomOrgQuery('test-function');
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('RANDOM organization');
        expect((error as Error).message).toContain('data leakage');
      }
    });

    it('should suggest correct pattern', () => {
      try {
        preventRandomOrgQuery('test-function');
        fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('.eq("org_id", orgId)');
      }
    });
  });

  describe('Integration: Preventing the original bug', () => {
    it('should prevent getOrgAndVapiConfig pattern without org filter', () => {
      // Simulate the BROKEN pattern that caused the bug
      const attemptBrokenPattern = () => {
        // This would query: .from('organizations').select('id').limit(1).single()
        preventRandomOrgQuery('getOrgAndVapiConfig - organizations query');
      };

      expect(attemptBrokenPattern).toThrow('BLOCKED');
    });

    it('should allow correct pattern with org filter', () => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        orgId: '46cf2995-2bee-44e3-838b-24151486fe4e',
        role: 'admin'
      };

      // This is the CORRECT pattern
      const orgId = getOrgIdFromRequest(mockReq as Request);

      // Simulate correct query: .eq('org_id', orgId).limit(1).single()
      const query = { org_id: orgId };

      expect(validateOrgScopedQuery(query, orgId)).toBe(true);
    });
  });

  describe('Type safety: AuthenticatedRequest', () => {
    it('should enforce orgId in type system', () => {
      const validRequest: AuthenticatedRequest = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          orgId: '46cf2995-2bee-44e3-838b-24151486fe4e' // Required by type
        }
      } as AuthenticatedRequest;

      expect(validRequest.user.orgId).toBeDefined();
    });

    // This won't compile if uncommented (that's the point - type safety):
    // it('should not compile without orgId', () => {
    //   const invalidRequest: AuthenticatedRequest = {
    //     user: {
    //       id: 'user-123',
    //       email: 'test@example.com'
    //       // Missing orgId - TypeScript error!
    //     }
    //   } as AuthenticatedRequest;
    // });
  });
});

describe('Real-world usage patterns', () => {
  describe('Correct usage in route handlers', () => {
    it('should validate org context at start of handler', () => {
      const mockReq = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          orgId: '46cf2995-2bee-44e3-838b-24151486fe4e'
        },
        path: '/api/agents',
        method: 'GET'
      } as Request;

      // CORRECT: Assert org context first
      assertOrgContext(mockReq);
      const orgId = mockReq.user.orgId;

      expect(orgId).toBe('46cf2995-2bee-44e3-838b-24151486fe4e');
    });

    it('should use helper function for safety', () => {
      const mockReq = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          orgId: '46cf2995-2bee-44e3-838b-24151486fe4e'
        }
      } as Request;

      // CORRECT: Use helper function
      const orgId = getOrgIdFromRequest(mockReq);

      expect(orgId).toBe('46cf2995-2bee-44e3-838b-24151486fe4e');
    });
  });

  describe('Incorrect usage that should be caught', () => {
    it('should catch missing org validation', () => {
      const mockReq = {
        user: {
          id: 'user-123',
          email: 'test@example.com'
          // Missing orgId
        }
      } as any;

      // INCORRECT: Accessing orgId without validation
      expect(() => {
        assertOrgContext(mockReq);
        const orgId = mockReq.user.orgId; // Would be undefined!
      }).toThrow();
    });

    it('should catch random org query attempts', () => {
      // INCORRECT: Attempting to query random org
      expect(() => {
        DO_NOT_USE_getRandomOrgId();
      }).toThrow('CRITICAL');
    });
  });
});
