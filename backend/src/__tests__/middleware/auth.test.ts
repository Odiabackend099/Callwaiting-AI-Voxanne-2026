/**
 * Auth Middleware Tests - Comprehensive Unit Tests
 * 
 * Tests the authentication middleware functions in isolation:
 * - requireAuth() - Strict JWT validation for production
 * - requireAuthOrDev() - Development mode bypass with security defaults
 * - verifyOrgAccess() - Multi-tenant access control
 * - requireRole() - Role-based access control
 * 
 * Principle: "Does this one thing work?"
 * Each test validates a single middleware behavior without database dependencies.
 */

import { Request, Response, NextFunction } from 'express';
import { requireAuth, requireAuthOrDev, verifyOrgAccess, requireRole } from '../../middleware/auth';
import * as supabaseClient from '../../services/supabase-client';
import {
  createMockExpressRequest,
  createMockExpressResponse,
  createMockNextFunction,
  createMockJWT,
  createMockSupabaseAuthResponse,
} from '../../tests/utils/test-helpers';

// Mock the Supabase client
jest.mock('../../services/supabase-client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe('Auth Middleware - requireAuth()', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;
  let mockSupabase: any;

  beforeEach(() => {
    mockReq = createMockExpressRequest();
    mockRes = createMockExpressResponse();
    mockNext = createMockNextFunction();
    mockSupabase = supabaseClient.supabase;
    jest.clearAllMocks();
  });

  describe('Valid JWT with org_id in app_metadata', () => {
    it('should extract org_id from app_metadata and call next()', async () => {
      const orgId = 'a0000000-0000-0000-0000-000000000001';
      const mockUser = createMockJWT({ app_metadata: { org_id: orgId } });

      mockReq.headers.authorization = 'Bearer valid_token_123';
      mockSupabase.auth.getUser.mockResolvedValue(createMockSupabaseAuthResponse(mockUser));

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('valid_token_123');
      expect(mockReq.user).toEqual({
        id: mockUser.sub,
        email: mockUser.email,
        orgId: orgId,
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should accept valid UUID in various formats', async () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'ABCDEF01-2345-6789-ABCD-EF0123456789',
        'abcdef01-2345-6789-abcd-ef0123456789',
      ];

      for (const uuid of validUUIDs) {
        jest.clearAllMocks();
        mockReq = createMockExpressRequest();
        mockRes = createMockExpressResponse();
        mockNext = createMockNextFunction();

        const mockUser = createMockJWT({ app_metadata: { org_id: uuid } });
        mockReq.headers.authorization = 'Bearer valid_token';
        mockSupabase.auth.getUser.mockResolvedValue(createMockSupabaseAuthResponse(mockUser));

        await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

        expect(mockReq.user.orgId).toBe(uuid);
        expect(mockNext).toHaveBeenCalled();
      }
    });
  });

  describe('Fallback to user_metadata.org_id', () => {
    it('should fall back to user_metadata.org_id when app_metadata is missing', async () => {
      const orgId = 'b0000000-0000-0000-0000-000000000002';
      const mockUser = createMockJWT({
        app_metadata: {}, // No org_id in app_metadata
        user_metadata: { org_id: orgId },
      });

      mockReq.headers.authorization = 'Bearer valid_token';
      mockSupabase.auth.getUser.mockResolvedValue(createMockSupabaseAuthResponse(mockUser));

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockReq.user.orgId).toBe(orgId);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Missing or invalid Authorization header', () => {
    it('should reject request with no Authorization header (401)', async () => {
      mockReq.headers.authorization = undefined;

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing or invalid Authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with malformed Authorization header (401)', async () => {
      mockReq.headers.authorization = 'InvalidFormat token123';

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing or invalid Authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with empty Bearer token (401)', async () => {
      mockReq.headers.authorization = 'Bearer ';

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Invalid or expired JWT', () => {
    it('should reject expired JWT token (401)', async () => {
      mockReq.headers.authorization = 'Bearer expired_token';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT expired' },
      });

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid JWT token (401)', async () => {
      mockReq.headers.authorization = 'Bearer invalid_token';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid JWT' },
      });

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Missing org_id claim', () => {
    it('should reject JWT with missing org_id (401)', async () => {
      const mockUser = createMockJWT({
        app_metadata: {}, // No org_id
        user_metadata: {}, // No org_id
      });

      mockReq.headers.authorization = 'Bearer valid_token';
      mockSupabase.auth.getUser.mockResolvedValue(createMockSupabaseAuthResponse(mockUser));

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing org_id in JWT. User must be provisioned with organization.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject JWT with org_id === "default" (401)', async () => {
      const mockUser = createMockJWT({
        app_metadata: { org_id: 'default' },
      });

      mockReq.headers.authorization = 'Bearer valid_token';
      mockSupabase.auth.getUser.mockResolvedValue(createMockSupabaseAuthResponse(mockUser));

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing org_id in JWT. User must be provisioned with organization.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle Supabase service errors gracefully (500)', async () => {
      mockReq.headers.authorization = 'Bearer valid_token';
      mockSupabase.auth.getUser.mockRejectedValue(new Error('Supabase connection failed'));

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Request context attachment', () => {
    it('should attach user and org_id to request object', async () => {
      const orgId = 'c0000000-0000-0000-0000-000000000003';
      const userId = 'user_123';
      const email = 'test@clinic.com';
      const mockUser = createMockJWT({
        sub: userId,
        email: email,
        app_metadata: { org_id: orgId },
      });

      mockReq.headers.authorization = 'Bearer valid_token';
      mockSupabase.auth.getUser.mockResolvedValue(createMockSupabaseAuthResponse(mockUser));

      await requireAuth(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockReq.user).toEqual({
        id: userId,
        email: email,
        orgId: orgId,
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('Auth Middleware - requireAuthOrDev()', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;
  let mockSupabase: any;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    mockReq = createMockExpressRequest();
    mockRes = createMockExpressResponse();
    mockNext = createMockNextFunction();
    mockSupabase = supabaseClient.supabase;
    originalNodeEnv = process.env.NODE_ENV;
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Production mode (default)', () => {
    it('should enforce strict auth when NODE_ENV is not "development"', async () => {
      process.env.NODE_ENV = 'production';
      mockReq.headers.authorization = undefined;

      await requireAuthOrDev(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing or invalid Authorization header',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should enforce strict auth when NODE_ENV is undefined', async () => {
      delete process.env.NODE_ENV;
      mockReq.headers.authorization = undefined;

      await requireAuthOrDev(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Development mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should use dev user when no Authorization header provided', async () => {
      mockReq.headers.authorization = undefined;

      await requireAuthOrDev(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockReq.user).toEqual({
        id: process.env.DEV_USER_ID || 'dev-user',
        email: process.env.DEV_USER_EMAIL || 'dev@local',
        orgId: 'a0000000-0000-0000-0000-000000000001',
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should use valid token when provided in dev mode', async () => {
      const orgId = 'd0000000-0000-0000-0000-000000000004';
      const mockUser = createMockJWT({ app_metadata: { org_id: orgId } });

      mockReq.headers.authorization = 'Bearer valid_dev_token';
      mockSupabase.auth.getUser.mockResolvedValue(createMockSupabaseAuthResponse(mockUser));

      await requireAuthOrDev(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockReq.user.orgId).toBe(orgId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fall back to dev user when token validation fails', async () => {
      mockReq.headers.authorization = 'Bearer invalid_token';
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await requireAuthOrDev(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockReq.user.orgId).toBe('a0000000-0000-0000-0000-000000000001');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject dev user when org_id is "default" even in dev mode', async () => {
      const mockUser = createMockJWT({
        app_metadata: { org_id: 'default' },
      });

      mockReq.headers.authorization = 'Bearer token_with_default_org';
      mockSupabase.auth.getUser.mockResolvedValue(createMockSupabaseAuthResponse(mockUser));

      await requireAuthOrDev(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing org_id in JWT. User must be provisioned with organization.',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('CORS preflight', () => {
    it('should allow OPTIONS requests without auth', async () => {
      mockReq.method = 'OPTIONS';
      mockReq.headers.authorization = undefined;

      await requireAuthOrDev(mockReq as Request, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});

describe('Auth Middleware - verifyOrgAccess()', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = createMockExpressRequest();
    mockRes = createMockExpressResponse();
    mockNext = createMockNextFunction();
    jest.clearAllMocks();
  });

  it('should allow access when user owns the organization', async () => {
    const orgId = 'e0000000-0000-0000-0000-000000000005';
    mockReq.user = { id: 'user_123', email: 'test@example.com', orgId };
    mockReq.query = { org_id: orgId };

    await verifyOrgAccess(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should deny access when user does not own the organization (403)', async () => {
    mockReq.user = {
      id: 'user_123',
      email: 'test@example.com',
      orgId: 'f0000000-0000-0000-0000-000000000006',
    };
    mockReq.query = { org_id: 'g0000000-0000-0000-0000-000000000007' };

    await verifyOrgAccess(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Access denied to this organization',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject unauthenticated requests (401)', async () => {
    mockReq.user = undefined;

    await verifyOrgAccess(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'User not authenticated',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow access to default org', async () => {
    mockReq.user = { id: 'user_123', email: 'test@example.com', orgId: 'default' };
    mockReq.query = { org_id: 'default' };

    await verifyOrgAccess(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('Auth Middleware - requireRole()', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;
  let mockSupabase: any;

  beforeEach(() => {
    mockReq = createMockExpressRequest();
    mockRes = createMockExpressResponse();
    mockNext = createMockNextFunction();
    mockSupabase = supabaseClient.supabase;
    jest.clearAllMocks();
  });

  it('should allow access when user has required role', async () => {
    const orgId = 'h0000000-0000-0000-0000-000000000008';
    mockReq.user = { id: 'user_123', email: 'admin@clinic.com', orgId };

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null,
            }),
          }),
        }),
      }),
    });
    mockSupabase.from = mockFrom;

    const middleware = requireRole('admin');
    await middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockReq.user.role).toBe('admin');
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should deny access when user has insufficient role (403)', async () => {
    const orgId = 'i0000000-0000-0000-0000-000000000009';
    mockReq.user = { id: 'user_123', email: 'viewer@clinic.com', orgId };

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'viewer' },
              error: null,
            }),
          }),
        }),
      }),
    });
    mockSupabase.from = mockFrom;

    const middleware = requireRole('admin');
    await middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Access denied. Required role: admin',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow access when user has one of multiple allowed roles', async () => {
    const orgId = 'j0000000-0000-0000-0000-000000000010';
    mockReq.user = { id: 'user_123', email: 'agent@clinic.com', orgId };

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'agent' },
              error: null,
            }),
          }),
        }),
      }),
    });
    mockSupabase.from = mockFrom;

    const middleware = requireRole('admin', 'agent');
    await middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject unauthenticated requests (401)', async () => {
    mockReq.user = undefined;

    const middleware = requireRole('admin');
    await middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'User not authenticated',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject when user role not found in database (403)', async () => {
    const orgId = 'k0000000-0000-0000-0000-000000000011';
    mockReq.user = { id: 'user_123', email: 'unknown@clinic.com', orgId };

    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'No rows found' },
            }),
          }),
        }),
      }),
    });
    mockSupabase.from = mockFrom;

    const middleware = requireRole('admin');
    await middleware(mockReq as Request, mockRes as Response, mockNext as NextFunction);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'User role not found',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
