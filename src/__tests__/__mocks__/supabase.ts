/**
 * Mock Supabase client for frontend API route tests
 * Simulates database queries and responses
 */

// Mock organization data
const mockOrganizations: Record<string, any> = {
  '550e8400-e29b-41d4-a716-446655440000': {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Organization',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
  '660e8400-e29b-41d4-a716-446655440001': {
    id: '660e8400-e29b-41d4-a716-446655440001',
    name: 'Another Organization',
    status: 'active',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  },
};

// Mock user organization roles
const mockUserOrgRoles: Array<{ user_id: string; org_id: string; role: string }> = [
  { user_id: 'user-123', org_id: '550e8400-e29b-41d4-a716-446655440000', role: 'admin' },
  { user_id: 'user-456', org_id: '550e8400-e29b-41d4-a716-446655440000', role: 'user' },
  { user_id: 'user-789', org_id: '660e8400-e29b-41d4-a716-446655440001', role: 'admin' },
];

/**
 * Get user's role in an organization
 */
export function getUserOrgRole(userId: string, orgId: string): string | null {
  const role = mockUserOrgRoles.find((r) => r.user_id === userId && r.org_id === orgId);
  return role ? role.role : null;
}

/**
 * Check if user is admin in organization
 */
export function isUserAdmin(userId: string, orgId: string): boolean {
  return getUserOrgRole(userId, orgId) === 'admin';
}

/**
 * Get mock organization
 */
export function getMockOrganization(orgId: string): any {
  return mockOrganizations[orgId] || null;
}

/**
 * Update mock organization
 */
export function updateMockOrganization(orgId: string, updates: Record<string, any>): any {
  if (mockOrganizations[orgId]) {
    mockOrganizations[orgId] = {
      ...mockOrganizations[orgId],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return mockOrganizations[orgId];
  }
  return null;
}

/**
 * Create mock Supabase client for testing
 */
export function createMockSupabaseClient() {
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: any) => ({
          single: () => ({
            data: column === 'id' && mockOrganizations[value] ? mockOrganizations[value] : null,
            error: !mockOrganizations[value] ? { code: 'PGRST116', message: 'Not found' } : null,
          }),
          then: (callback: Function) => {
            if (column === 'id' && mockOrganizations[value]) {
              return callback({ data: mockOrganizations[value], error: null });
            }
            return callback({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
          },
        }),
      }),
      update: (data: Record<string, any>) => ({
        eq: (column: string, value: any) => ({
          returning: () => ({
            single: () => {
              if (mockOrganizations[value]) {
                return {
                  data: updateMockOrganization(value, data),
                  error: null,
                };
              }
              return {
                data: null,
                error: { code: 'PGRST116', message: 'Not found' },
              };
            },
          }),
        }),
      }),
    }),
  };
}

/**
 * Reset mock data (for test cleanup)
 */
export function resetMockData() {
  // Reset organizations to initial state
  Object.keys(mockOrganizations).forEach((key) => {
    if (!key.includes('550e8400-e29b-41d4-a716-446655440000') && !key.includes('660e8400-e29b-41d4-a716-446655440001')) {
      delete mockOrganizations[key];
    }
  });
}

// Direct access for advanced test scenarios
export const _mockOrganizations = mockOrganizations;
export const _mockUserOrgRoles = mockUserOrgRoles;
