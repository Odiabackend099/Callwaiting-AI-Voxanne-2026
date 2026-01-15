/**
 * Mock JWT extraction and validation for backend tests
 * Simulates server-side JWT parsing without external dependencies
 */

export interface MockBackendJWT {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  app_metadata: {
    org_id?: string;
    provider?: string;
  };
}

/**
 * Simulates extracting org_id from Authorization header
 * In real implementation: Supabase middleware extracts this from JWT
 */
export const extractOrgIdFromHeader = (
  authorizationHeader?: string
): string | null => {
  if (!authorizationHeader) return null;
  
  // Bearer token format
  const parts = authorizationHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  // In real code: JWT would be parsed here
  // For testing: return valid UUID format
  return '550e8400-e29b-41d4-a716-446655440000';
};

/**
 * Validates UUID format (mirrors Express middleware validation)
 */
export const validateUUIDFormat = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Simulates checking if JWT has required org_id claim
 */
export const hasOrgIdClaim = (jwt: MockBackendJWT): boolean => {
  return Boolean(jwt?.app_metadata?.org_id);
};

/**
 * Mock request context (simulates Express Request with auth)
 */
export interface MockRequest {
  headers: {
    authorization?: string;
  };
  user?: {
    id: string;
    org_id: string;
  };
}

/**
 * Creates a valid mock request with org_id
 */
export const createMockRequest = (
  orgId: string = '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
  userId: string = 'user-123'
): MockRequest => {
  return {
    headers: {
      authorization: `Bearer mock-jwt-token`,
    },
    user: {
      id: userId,
      org_id: orgId,
    },
  };
};

/**
 * Creates a mock request without authorization
 */
export const createMockRequestNoAuth = (): MockRequest => {
  return {
    headers: {},
  };
};

/**
 * Creates a mock request with invalid org_id format
 */
export const createMockRequestInvalidOrgId = (): MockRequest => {
  return {
    headers: {
      authorization: 'Bearer mock-jwt-token',
    },
    user: {
      id: 'user-123',
      org_id: 'invalid-org-id',
    },
  };
};

/**
 * Creates a mock request without org_id in JWT
 */
export const createMockRequestNoOrgId = (): MockRequest => {
  return {
    headers: {
      authorization: 'Bearer mock-jwt-token',
    },
    user: {
      id: 'user-123',
      org_id: '', // Missing org_id
    },
  };
};
