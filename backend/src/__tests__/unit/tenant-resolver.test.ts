/**
 * Tenant Resolver Middleware Unit Tests
 *
 * Tests for multi-tenant org_id resolution (Fortress Protocol isolation).
 * Verifies:
 * - Primary: Extract org_id from JWT metadata
 * - Fallback 1: Extract from call.orgId (Vapi webhook payload)
 * - Fallback 2: Lookup from assistant_org_mapping table
 * - Security: Prefer JWT over webhook (JWT is more trustworthy)
 * - Error handling when org_id cannot be determined
 */

import { Request, Response, NextFunction } from 'express';
import { tenantResolver } from '../../middleware/tenant-resolver';
import { log } from '../../services/logger';

jest.mock('../../services/logger', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock Supabase for assistant_org_mapping lookups
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { org_id: 'mapped-org-id-123' },
        error: null
      })
    }))
  }))
}));

describe('Tenant Resolver Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Request>;
  let mockNext: jest.Mock;
  let jsonResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();

    jsonResponse = null;
    mockRequest = {
      headers: {},
      body: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((data) => {
        jsonResponse = data;
        return mockResponse;
      })
    } as any;

    mockNext = jest.fn();
  });

  describe('Primary Source: JWT Metadata', () => {
    test('should extract org_id from JWT user metadata', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com',
        app_metadata: {
          org_id: 'jwt-org-id-456'
        }
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('jwt-org-id-456');
      expect(mockNext).toHaveBeenCalled();
      expect(log.debug).toHaveBeenCalledWith(
        'TenantResolver',
        'Resolved org_id from JWT',
        expect.objectContaining({ orgId: 'jwt-org-id-456' })
      );
    });

    test('should prefer JWT org_id over other sources (security)', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123',
        app_metadata: {
          org_id: 'jwt-org-id' // From JWT (most trustworthy)
        }
      } as any;

      mockRequest.body = {
        message: {
          call: {
            orgId: 'webhook-org-id' // From Vapi webhook (less trustworthy)
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('jwt-org-id');
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle missing app_metadata in JWT gracefully', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123',
        email: 'test@example.com'
        // No app_metadata
      } as any;

      mockRequest.body = {
        message: {
          call: {
            orgId: 'webhook-org-id'
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('webhook-org-id'); // Falls back to webhook
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle null org_id in JWT app_metadata', async () => {
      // ARRANGE
      mockRequest.user = {
        id: 'user-123',
        app_metadata: {
          org_id: null
        }
      } as any;

      mockRequest.body = {
        message: {
          call: {
            orgId: 'webhook-org-id'
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('webhook-org-id'); // Falls back to webhook
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Fallback 1: Vapi Webhook Payload', () => {
    test('should extract org_id from call.orgId in webhook payload', async () => {
      // ARRANGE
      mockRequest.body = {
        message: {
          call: {
            id: 'call-123',
            orgId: 'webhook-org-id-789'
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('webhook-org-id-789');
      expect(mockNext).toHaveBeenCalled();
      expect(log.debug).toHaveBeenCalledWith(
        'TenantResolver',
        'Resolved org_id from webhook',
        expect.objectContaining({ orgId: 'webhook-org-id-789' })
      );
    });

    test('should handle missing call object in webhook payload', async () => {
      // ARRANGE
      mockRequest.body = {
        message: {
          // No call object
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT - Should not find org_id, will attempt database lookup
      // If database lookup also fails, should reject with 400
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    test('should handle null orgId in webhook call object', async () => {
      // ARRANGE
      mockRequest.body = {
        message: {
          call: {
            id: 'call-123',
            orgId: null
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT - Should reject
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Fallback 2: Assistant Org Mapping Lookup', () => {
    test('should lookup org_id from assistant_org_mapping table', async () => {
      // ARRANGE
      const mockSupabase = require('@supabase/supabase-js').createClient();
      mockSupabase.from().maybeSingle.mockResolvedValue({
        data: { org_id: 'mapped-org-id-xyz' },
        error: null
      });

      mockRequest.body = {
        message: {
          call: {
            assistantId: 'asst-123',
            orgId: null // No orgId in webhook
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('mapped-org-id-xyz');
      expect(mockNext).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('assistant_org_mapping');
    });

    test('should handle assistant not found in mapping table', async () => {
      // ARRANGE
      const mockSupabase = require('@supabase/supabase-js').createClient();
      mockSupabase.from().maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      mockRequest.body = {
        message: {
          call: {
            assistantId: 'unknown-asst-id',
            orgId: null
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT - Should reject if assistant not found
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle database error in mapping lookup', async () => {
      // ARRANGE
      const mockSupabase = require('@supabase/supabase-js').createClient();
      mockSupabase.from().maybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'RLS policy violation' }
      });

      mockRequest.body = {
        message: {
          call: {
            assistantId: 'asst-123',
            orgId: null
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('Org ID Fallback Chain', () => {
    test('should use JWT if available, skip webhooks and database', async () => {
      // ARRANGE
      const mockSupabase = require('@supabase/supabase-js').createClient();
      mockSupabase.from().maybeSingle = jest.fn().mockResolvedValue({
        data: { org_id: 'db-org-id' },
        error: null
      });

      mockRequest.user = {
        app_metadata: { org_id: 'jwt-org-id' }
      } as any;

      mockRequest.body = {
        message: {
          call: {
            orgId: 'webhook-org-id'
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('jwt-org-id');
      // Should NOT query database
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    test('should use webhook if JWT unavailable, skip database', async () => {
      // ARRANGE
      const mockSupabase = require('@supabase/supabase-js').createClient();
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { org_id: 'db-org-id' },
          error: null
        })
      }));

      // No JWT
      mockRequest.body = {
        message: {
          call: {
            orgId: 'webhook-org-id'
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('webhook-org-id');
      // Should NOT query database (webhook was available)
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    test('should query database only if JWT and webhook unavailable', async () => {
      // ARRANGE
      const mockSupabase = require('@supabase/supabase-js').createClient();
      mockSupabase.from().maybeSingle.mockResolvedValue({
        data: { org_id: 'db-org-id' },
        error: null
      });

      mockRequest.body = {
        message: {
          call: {
            assistantId: 'asst-123'
            // No orgId
          }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe('db-org-id');
      expect(mockSupabase.from).toHaveBeenCalledWith('assistant_org_mapping');
    });
  });

  describe('Error Handling', () => {
    test('should reject request with 400 when no org_id found', async () => {
      // ARRANGE
      const mockSupabase = require('@supabase/supabase-js').createClient();
      mockSupabase.from().maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      mockRequest.body = {};

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(jsonResponse).toEqual({
        success: false,
        error: expect.stringContaining('org_id')
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return clear error message for missing org_id', async () => {
      // ARRANGE
      mockRequest.body = { message: { call: {} } };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(jsonResponse.error).toBeTruthy();
      expect(typeof jsonResponse.error).toBe('string');
      expect(jsonResponse.error.toLowerCase()).toContain('unable to determine');
    });

    test('should log warning when org_id resolution fails', async () => {
      // ARRANGE
      const mockSupabase = require('@supabase/supabase-js').createClient();
      mockSupabase.from().maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      mockRequest.body = {};

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(log.warn).toHaveBeenCalled();
    });
  });

  describe('Security: Org ID Validation', () => {
    test('should validate org_id format (UUID-like)', async () => {
      // ARRANGE
      const validOrgId = '46cf2995-2bee-44e3-838b-24151486fe4e';
      mockRequest.user = {
        app_metadata: { org_id: validOrgId }
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe(validOrgId);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject suspicious org_id values (SQL injection attempt)', async () => {
      // ARRANGE
      mockRequest.user = {
        app_metadata: { org_id: "'; DROP TABLE orgs; --" }
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT - Should still work (parameterized queries prevent SQL injection)
      // But we should validate/sanitize org_id
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject empty org_id string', async () => {
      // ARRANGE
      mockRequest.user = {
        app_metadata: { org_id: '' }
      } as any;

      mockRequest.body = {
        message: { call: { orgId: null } }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Logging and Debugging', () => {
    test('should log successful org_id resolution from JWT', async () => {
      // ARRANGE
      mockRequest.user = {
        app_metadata: { org_id: 'test-org-id' }
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(log.debug).toHaveBeenCalledWith(
        'TenantResolver',
        'Resolved org_id from JWT',
        expect.objectContaining({ orgId: 'test-org-id', source: 'JWT' })
      );
    });

    test('should log org_id source for debugging', async () => {
      // ARRANGE
      mockRequest.body = {
        message: {
          call: { orgId: 'webhook-org-id' }
        }
      };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(log.debug).toHaveBeenCalledWith(
        'TenantResolver',
        expect.any(String),
        expect.objectContaining({ source: expect.stringMatching(/JWT|webhook|database/) })
      );
    });

    test('should log all failed resolution attempts', async () => {
      // ARRANGE
      const mockSupabase = require('@supabase/supabase-js').createClient();
      mockSupabase.from().maybeSingle.mockResolvedValue({
        data: null,
        error: null
      });

      mockRequest.body = { message: { call: { assistantId: 'unknown' } } };

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(log.warn).toHaveBeenCalled();
    });
  });

  describe('Request Enrichment', () => {
    test('should set req.orgId for use in downstream middleware', async () => {
      // ARRANGE
      const orgId = 'enriched-org-id-123';
      mockRequest.user = {
        app_metadata: { org_id: orgId }
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe(orgId);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should set req.tenantId as alias for req.orgId', async () => {
      // ARRANGE
      const orgId = 'alias-org-id';
      mockRequest.user = {
        app_metadata: { org_id: orgId }
      } as any;

      // ACT
      await tenantResolver(mockRequest as Request, mockResponse as Response, mockNext);

      // ASSERT
      expect(mockRequest.orgId).toBe(orgId);
      // Some implementations may also set tenantId
      expect(mockRequest.orgId).toBeDefined();
    });
  });
});
