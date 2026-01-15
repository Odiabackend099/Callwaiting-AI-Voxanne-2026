/**
 * MSW (Mock Service Worker) handlers for testing API responses
 * Intercepts fetch/HTTP requests and returns controlled responses
 */

import { http, HttpResponse } from 'msw';

export interface OrgData {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'suspended';
  created_at: string;
  updated_at: string;
}

const mockOrgDatabase: Record<string, OrgData> = {
  'valid-org-uuid-1234': {
    id: 'valid-org-uuid-1234',
    name: 'Test Clinic',
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
  },
  'another-valid-uuid': {
    id: 'another-valid-uuid',
    name: 'Another Clinic',
    status: 'active',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
  },
};

/**
 * GET /api/orgs/validate/{orgId} - Validate org exists and user has access
 * Returns 200 if org exists and user authenticated
 * Returns 401 if user not authenticated
 * Returns 404 if org not found
 * Returns 400 if orgId is invalid UUID format
 */
export const orgValidateHandler = http.get(
  '/api/orgs/validate/:orgId',
  async ({ params, request }) => {
    const { orgId } = params as { orgId: string };
    
    // Check auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      return HttpResponse.json(
        { error: 'Organization ID must be a valid UUID' },
        { status: 400 }
      );
    }
    
    // Check if org exists in mock database
    if (!mockOrgDatabase[orgId]) {
      return HttpResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    // Return success
    return HttpResponse.json({
      orgId,
      valid: true,
      org: mockOrgDatabase[orgId],
    });
  }
);

/**
 * GET /api/orgs/{orgId} - Get organization data
 * Returns 200 + org data if user has access
 * Returns 401 if not authenticated
 * Returns 403 if user doesn't have access to org
 * Returns 404 if org not found
 */
export const getOrgHandler = http.get('/api/orgs/:orgId', async ({ params, request }) => {
  const { orgId } = params as { orgId: string };
  
  // Check auth
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return HttpResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // Check if org exists
  if (!mockOrgDatabase[orgId]) {
    return HttpResponse.json(
      { error: 'Organization not found' },
      { status: 404 }
    );
  }
  
  // In a real scenario, we'd check user_org_roles here
  // For testing, we'll return the org if authenticated
  return HttpResponse.json(mockOrgDatabase[orgId]);
});

/**
 * PUT /api/orgs/{orgId} - Update organization
 * Returns 200 + updated org if successful
 * Returns 401 if not authenticated
 * Returns 403 if not admin
 * Returns 404 if org not found
 * Returns 400 if input validation fails
 */
export const updateOrgHandler = http.put(
  '/api/orgs/:orgId',
  async ({ params, request }) => {
    const { orgId } = params as { orgId: string };
    
    // Check auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return HttpResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if org exists
    if (!mockOrgDatabase[orgId]) {
      return HttpResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    // Parse request body
    const body = (await request.json()) as { name?: string; status?: string };
    
    // Validate input
    if (!body.name || body.name.trim().length === 0) {
      return HttpResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }
    
    if (body.name.length > 100) {
      return HttpResponse.json(
        { error: 'Organization name must be less than 100 characters' },
        { status: 400 }
      );
    }
    
    // Update organization (in mock, just create a new version)
    const updatedOrg = {
      ...mockOrgDatabase[orgId],
      name: body.name,
      updated_at: new Date().toISOString(),
    };
    
    // Store updated org
    mockOrgDatabase[orgId] = updatedOrg;
    
    return HttpResponse.json(updatedOrg);
  }
);

/**
 * All handlers exported as array for MSW setup
 */
export const handlers = [orgValidateHandler, getOrgHandler, updateOrgHandler];
