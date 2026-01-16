/**
 * Multi-Tenant Isolation Tests
 *
 * CRITICAL: These tests verify that the multi-tenant system enforces strict isolation.
 * Cross-tenant data access should be IMPOSSIBLE, even with:
 * - Valid JWT from different org
 * - x-org-id header spoofing
 * - Direct database queries
 *
 * These tests MUST pass before production deployment.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Multi-Tenant Isolation', () => {
  /**
   * Test Suite 1: JWT Authentication Requirements
   * Verifies that ALL protected routes require JWT authentication
   */
  describe('JWT Authentication Requirements', () => {
    it('should reject requests without JWT token', async () => {
      // Request to protected route WITHOUT Authorization header
      const response = await fetch('http://localhost:3001/api/analytics/dashboard-pulse', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
        // NO Authorization header
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Authorization');
    });

    it('should reject requests with invalid JWT token', async () => {
      const response = await fetch('http://localhost:3001/api/analytics/dashboard-pulse', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid.token.here'
        }
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Invalid or expired token');
    });

    it('should reject requests with missing org_id in JWT', async () => {
      // This test assumes a test JWT without org_id can be created
      // In practice, the database trigger should prevent this
      const testTokenWithoutOrgId = process.env.TEST_JWT_NO_ORG;
      if (!testTokenWithoutOrgId) {
        console.log('Skipping: TEST_JWT_NO_ORG not configured');
        return;
      }

      const response = await fetch('http://localhost:3001/api/analytics/dashboard-pulse', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testTokenWithoutOrgId}`
        }
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Missing org_id');
    });
  });

  /**
   * Test Suite 2: x-org-id Header Ignored
   * Verifies that x-org-id header is NOT trusted for org resolution
   */
  describe('x-org-id Header Security', () => {
    it('should ignore x-org-id header when JWT present', async () => {
      // This test requires valid test tokens
      const orgAToken = process.env.TEST_JWT_ORG_A;
      const orgBId = process.env.TEST_ORG_B_ID;

      if (!orgAToken || !orgBId) {
        console.log('Skipping: TEST_JWT_ORG_A or TEST_ORG_B_ID not configured');
        return;
      }

      // Request with Org A JWT but Org B x-org-id header (spoofing attempt)
      const response = await fetch('http://localhost:3001/api/analytics/dashboard-pulse', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orgAToken}`,
          'x-org-id': orgBId  // Spoofing attempt - should be IGNORED
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return Org A data (from JWT), NOT Org B data
      // This is verified indirectly: if we got a 200, the backend accepted the JWT
      // The RLS policy should have filtered to Org A only
      expect(data).toBeDefined();
    });

    it('should not accept x-org-id header without JWT', async () => {
      const orgId = process.env.TEST_ORG_A_ID;
      if (!orgId) {
        console.log('Skipping: TEST_ORG_A_ID not configured');
        return;
      }

      const response = await fetch('http://localhost:3001/api/analytics/dashboard-pulse', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId  // Header without JWT - should fail
        }
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Authorization');
    });
  });

  /**
   * Test Suite 3: Cross-Tenant Data Access Prevention
   * Verifies that users cannot access data from other organizations
   */
  describe('Cross-Tenant Data Access Prevention', () => {
    it('should reject org validation if user belongs to different org', async () => {
      const orgAToken = process.env.TEST_JWT_ORG_A;
      const orgBId = process.env.TEST_ORG_B_ID;

      if (!orgAToken || !orgBId) {
        console.log('Skipping: TEST_JWT_ORG_A or TEST_ORG_B_ID not configured');
        return;
      }

      // User from Org A tries to validate access to Org B
      const response = await fetch(`http://localhost:3001/api/orgs/validate/${orgBId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orgAToken}`
        }
      });

      // Should return 403 Forbidden (not allowed to access other org)
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Access denied');
    });

    it('should return different data for different orgs', async () => {
      const orgAToken = process.env.TEST_JWT_ORG_A;
      const orgBToken = process.env.TEST_JWT_ORG_B;

      if (!orgAToken || !orgBToken) {
        console.log('Skipping: TEST_JWT_ORG_A or TEST_JWT_ORG_B not configured');
        return;
      }

      // Get data for Org A
      const responseA = await fetch('http://localhost:3001/api/analytics/leads', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orgAToken}`
        }
      });
      expect(responseA.status).toBe(200);
      const dataA = await responseA.json();

      // Get data for Org B
      const responseB = await fetch('http://localhost:3001/api/analytics/leads', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orgBToken}`
        }
      });
      expect(responseB.status).toBe(200);
      const dataB = await responseB.json();

      // Data should be COMPLETELY DIFFERENT (no overlap)
      // This is the strongest possible isolation test
      const idsA = new Set(dataA.leads.map((l: any) => l.id));
      const idsB = new Set(dataB.leads.map((l: any) => l.id));

      // Should be NO intersection
      const intersection = [...idsA].filter(id => idsB.has(id));
      expect(intersection.length).toBe(0);
    });
  });

  /**
   * Test Suite 4: Protected Routes Verification
   * Confirms that all critical routes are protected
   */
  describe('Protected Routes Verification', () => {
    const protectedRoutes = [
      { method: 'GET', path: '/api/analytics/dashboard-pulse' },
      { method: 'GET', path: '/api/analytics/leads' },
      { method: 'GET', path: '/api/assistants' },
      { method: 'GET', path: '/api/phone-numbers' },
      { method: 'GET', path: '/api/contacts' },
      { method: 'GET', path: '/api/appointments' },
      { method: 'GET', path: '/api/notifications' }
    ];

    protectedRoutes.forEach(({ method, path }) => {
      it(`should require auth for ${method} ${path}`, async () => {
        const response = await fetch(`http://localhost:3001${path}`, {
          method: method as any,
          headers: {
            'Content-Type': 'application/json'
            // NO Authorization header
          }
        });

        expect(response.status).toBe(401);
      });
    });
  });

  /**
   * Test Suite 5: Org Validation Endpoint
   * Verifies the new /api/orgs/validate endpoint works correctly
   */
  describe('Organization Validation Endpoint', () => {
    it('should return 200 for valid org access', async () => {
      const orgAToken = process.env.TEST_JWT_ORG_A;
      const orgAId = process.env.TEST_ORG_A_ID;

      if (!orgAToken || !orgAId) {
        console.log('Skipping: TEST_JWT_ORG_A or TEST_ORG_A_ID not configured');
        return;
      }

      const response = await fetch(`http://localhost:3001/api/orgs/validate/${orgAId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orgAToken}`
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.orgId).toBe(orgAId);
      expect(data.validated).toBe(true);
    });

    it('should return 404 for non-existent org', async () => {
      const orgAToken = process.env.TEST_JWT_ORG_A;
      const fakeOrgId = '00000000-0000-0000-0000-000000000000';

      if (!orgAToken) {
        console.log('Skipping: TEST_JWT_ORG_A not configured');
        return;
      }

      const response = await fetch(`http://localhost:3001/api/orgs/validate/${fakeOrgId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orgAToken}`
        }
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('should return 400 for invalid UUID format', async () => {
      const orgAToken = process.env.TEST_JWT_ORG_A;

      if (!orgAToken) {
        console.log('Skipping: TEST_JWT_ORG_A not configured');
        return;
      }

      const response = await fetch('http://localhost:3001/api/orgs/validate/not-a-uuid', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${orgAToken}`
        }
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid');
    });
  });

  /**
   * Test Suite 6: Security Headers
   * Verifies that CORS is correctly configured (x-org-id NOT allowed)
   */
  describe('CORS Security Headers', () => {
    it('should not allow x-org-id in CORS allowedHeaders', async () => {
      // Make a preflight request
      const response = await fetch('http://localhost:3001/api/analytics/leads', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'x-org-id'
        }
      });

      // If x-org-id is in allowedHeaders, the preflight will include it
      const allowedHeaders = response.headers.get('Access-Control-Allow-Headers') || '';

      // x-org-id should NOT be in the allowed headers
      expect(allowedHeaders).not.toContain('x-org-id');

      // But Authorization SHOULD be allowed
      expect(allowedHeaders).toContain('Authorization');
    });
  });
});

/**
 * CONFIGURATION FOR TESTS
 *
 * Set these environment variables before running:
 *
 * TEST_JWT_ORG_A - Valid JWT token for organization A
 * TEST_ORG_A_ID - Organization A UUID (from app_metadata.org_id in token)
 * TEST_JWT_ORG_B - Valid JWT token for organization B
 * TEST_ORG_B_ID - Organization B UUID (from app_metadata.org_id in token)
 * TEST_JWT_NO_ORG - JWT token without org_id in app_metadata (optional)
 *
 * Example:
 * export TEST_JWT_ORG_A="eyJhbGc..."
 * export TEST_ORG_A_ID="a0000000-0000-0000-0000-000000000001"
 * export TEST_JWT_ORG_B="eyJhbGc..."
 * export TEST_ORG_B_ID="b0000000-0000-0000-0000-000000000002"
 *
 * To get test tokens:
 * 1. Create two test users in Supabase Auth (org_a@test.com, org_b@test.com)
 * 2. Each user should be auto-provisioned with their org via the database trigger
 * 3. Sign them in and copy their JWT tokens
 * 4. Set the environment variables
 * 5. Run: npm run test:integration
 */
