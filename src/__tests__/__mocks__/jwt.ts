/**
 * Mock JWT utilities for testing
 * Generates realistic JWT structures without actual signing
 */

export interface MockJWTPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  app_metadata: {
    org_id?: string;
    provider?: string;
  };
  user_metadata: {
    email?: string;
    name?: string;
  };
}

/**
 * Creates a mock JWT payload with valid org_id
 */
export const createMockJWT = (overrides: Partial<MockJWTPayload> = {}): MockJWTPayload => {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    iss: 'supabase',
    aud: 'authenticated',
    exp: now + 3600, // 1 hour expiry
    iat: now,
    sub: 'user-123',
    app_metadata: {
      org_id: 'valid-org-uuid-1234',
      provider: 'email',
    },
    user_metadata: {
      email: 'test@example.com',
      name: 'Test User',
    },
    ...overrides,
  };
};

/**
 * Creates a mock JWT with a specific org_id
 */
export const createMockJWTWithOrgId = (orgId: string): MockJWTPayload => {
  return createMockJWT({
    app_metadata: {
      org_id: orgId,
    },
  });
};

/**
 * Creates a mock JWT without org_id (missing org claim scenario)
 */
export const createMockJWTWithoutOrgId = (): MockJWTPayload => {
  return createMockJWT({
    app_metadata: {
      provider: 'email',
    },
  });
};

/**
 * Creates an expired JWT
 */
export const createExpiredJWT = (): MockJWTPayload => {
  const now = Math.floor(Date.now() / 1000);
  
  return createMockJWT({
    exp: now - 3600, // Expired 1 hour ago
    iat: now - 7200,
  });
};

/**
 * Creates a mock JWT with invalid org_id format
 */
export const createMockJWTWithInvalidOrgId = (invalidOrgId: string): MockJWTPayload => {
  return createMockJWT({
    app_metadata: {
      org_id: invalidOrgId, // e.g., 'not-a-uuid'
    },
  });
};

/**
 * Extracts org_id from mock JWT payload (mirrors server behavior)
 */
export const extractOrgIdFromMockJWT = (jwt: MockJWTPayload): string | null => {
  return jwt?.app_metadata?.org_id || null;
};

/**
 * Validates UUID format (mirrors server validation)
 */
export const isValidUUID = (value: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * Validates UUID format (alias for isValidUUID)
 */
export const validateUUIDFormat = (value: string): boolean => {
  return isValidUUID(value);
};

/**
 * Create a mock request with valid auth and org_id
 */
export const createMockRequest = (orgId: string, userId: string = 'user-123'): any => {
  return {
    headers: {
      authorization: `Bearer ${createMockJWTWithOrgId(orgId)}`,
    },
    user: {
      id: userId,
    },
    org_id: orgId,
  };
};

/**
 * Create a mock request without authentication
 */
export const createMockRequestNoAuth = (): any => {
  return {
    headers: {
      // No authorization header
    },
  };
};

/**
 * Create a mock request without org_id
 */
export const createMockRequestNoOrgId = (): any => {
  return {
    headers: {
      authorization: `Bearer ${createMockJWTWithoutOrgId()}`,
    },
  };
};

/**
 * Create a mock request with invalid org_id format
 */
export const createMockRequestInvalidOrgId = (invalidOrgId: string): any => {
  return {
    headers: {
      authorization: `Bearer ${createMockJWTWithInvalidOrgId(invalidOrgId)}`,
    },
  };
};

/**
 * Extract org_id from authorization header
 */
export const extractOrgIdFromHeader = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const tokenString = authHeader.substring(7);
  try {
    // For mock JWT strings, we can't actually decode, so return a placeholder
    // In real tests with MSW, the fetch mocks will handle this
    return null;
  } catch {
    return null;
  }
};
