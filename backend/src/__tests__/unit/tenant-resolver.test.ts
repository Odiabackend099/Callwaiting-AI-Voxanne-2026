/**
 * Tenant Resolver Middleware Unit Tests
 *
 * Tests for multi-tenant org_id resolution (Fortress Protocol isolation).
 * Verifies:
 * - Primary: Extract org_id from JWT metadata
 * - Fallback: Query profiles table if JWT missing
 * - Error handling when org_id cannot be determined
 */

import { Request, Response, NextFunction } from 'express';
import { tenantResolver } from '../../middleware/tenant-resolver';

// Mock Supabase for profile lookups
jest.mock('../../services/supabase-client', () => ({
  supabase: {
    from: jest.fn()
  }
}));

import { supabase } from '../../services/supabase-client';

describe('Tenant Resolver Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockNext: jest.Mock;
  const mockSupabase = supabase as jest.Mocked<typeof supabase>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      headers: {},
      body: {},
      user: undefined
    };

    mockNext = jest.fn();
  });

  describe('Primary Source: JWT Metadata', () => {
    test('should extract org_id from JWT user metadata', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        orgId: 'jwt-org-id-456'
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('jwt-org-id-456');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should prefer JWT org_id over app_metadata', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123',
        orgId: 'jwt-org-id',
        app_metadata: { org_id: 'app-metadata-org-id' }
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('jwt-org-id');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should extract org_id from app_metadata if missing from root', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123',
        app_metadata: { org_id: 'app-metadata-org-id' }
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('app-metadata-org-id');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should skip middleware if no authenticated user', async () => {
      // ARRANGE
      mockRequest.user = undefined;

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.orgId).toBeUndefined();
    });
  });

  describe('Fallback: Database Lookup', () => {
    test('should query profiles table when JWT org_id missing', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com'
        // No org_id in JWT
      } as any;

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { org_id: 'db-org-id-789' },
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockChain as any);

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      expect(mockChain.select).toHaveBeenCalledWith('org_id');
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'user-123');
      expect(mockRequest.orgId).toBe('db-org-id-789');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should set resolvedOrgId flag when resolved from database', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123'
      } as any;

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { org_id: 'db-resolved-org-id' },
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockChain as any);

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect((mockRequest as any).resolvedOrgId).toBe('db-resolved-org-id');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle database error gracefully', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123'
      } as any;

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' }
        })
      };

      mockSupabase.from.mockReturnValue(mockChain as any);

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      // Should continue without org_id on error
      expect(mockRequest.orgId).toBeUndefined();
    });

    test('should handle missing profile gracefully', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123'
      } as any;

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null, // No profile found
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockChain as any);

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.orgId).toBeUndefined();
    });

    test('should handle profile with missing org_id', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123'
      } as any;

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'profile-123', name: 'Test User' }, // No org_id
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockChain as any);

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.orgId).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should catch and log unexpected errors', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123'
      } as any;

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockRejectedValue(new Error('Unexpected error'))
      };

      mockSupabase.from.mockReturnValue(mockChain as any);

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect(mockNext).toHaveBeenCalled();
      // Should continue without org_id on error
      expect(mockRequest.orgId).toBeUndefined();
    });

    test('should call next() even if org_id not found', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123'
        // No org_id in JWT
      } as any;

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null
        })
      };

      mockSupabase.from.mockReturnValue(mockChain as any);

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      // Should always call next, even without org_id
      // (let downstream routes handle the error)
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Fortess Protocol: Multi-Tenant Isolation', () => {
    test('should enforce org_id isolation per user', async () => {
      // ARRANGE - User A
      mockRequest.user = {
        id: 'user-a',
        orgId: 'org-a'
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('org-a');
      expect(mockNext).toHaveBeenCalled();

      // Reset for User B test
      jest.clearAllMocks();
      mockNext = jest.fn();

      // ARRANGE - User B
      mockRequest.user = {
        id: 'user-b',
        orgId: 'org-b'
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, {} as Response, mockNext);

      // ASSERT - Verify org-a != org-b
      expect(mockRequest.orgId).toBe('org-b');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
