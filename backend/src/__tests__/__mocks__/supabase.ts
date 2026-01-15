/**
 * Mock Supabase client for backend tests
 * Simulates database queries without external connections
 */

import { vi } from 'vitest';

export interface MockOrgRecord {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface MockUserOrgRole {
  user_id: string;
  org_id: string;
  role: 'admin' | 'user';
}

// Simulated database
const mockOrganizations: Record<string, MockOrgRecord> = {
  'valid-org-uuid-1234': {
    id: 'valid-org-uuid-1234',
    name: 'Test Clinic',
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
  },
  'another-org-uuid': {
    id: 'another-org-uuid',
    name: 'Another Clinic',
    status: 'active',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
  },
};

const mockUserOrgRoles: MockUserOrgRole[] = [
  { user_id: 'user-123', org_id: 'valid-org-uuid-1234', role: 'admin' },
  { user_id: 'user-456', org_id: 'valid-org-uuid-1234', role: 'user' },
  { user_id: 'user-789', org_id: 'another-org-uuid', role: 'admin' },
];

/**
 * Creates a mock Supabase client
 * Provides methods: from(), select(), eq(), single(), update(), etc.
 */
export const createMockSupabaseClient = () => {
  let currentTable: string | null = null;
  let filterOrgId: string | null = null;
  let filterUserId: string | null = null;
  let updateData: Record<string, any> = {};

  return {
    from: (table: string) => {
      currentTable = table;
      return this;
    },
    
    select: (columns?: string) => {
      return this;
    },
    
    eq: (column: string, value: string) => {
      if (column === 'org_id') filterOrgId = value;
      if (column === 'user_id') filterUserId = value;
      if (column === 'id') filterOrgId = value;
      return this;
    },
    
    single: async () => {
      if (currentTable === 'organizations') {
        const org = mockOrganizations[filterOrgId!];
        if (!org) {
          return { data: null, error: { message: 'Not found' } };
        }
        return { data: org, error: null };
      }
      
      if (currentTable === 'user_org_roles') {
        const role = mockUserOrgRoles.find(
          (r) => r.user_id === filterUserId && r.org_id === filterOrgId
        );
        if (!role) {
          return { data: null, error: { message: 'Not found' } };
        }
        return { data: role, error: null };
      }
      
      return { data: null, error: null };
    },
    
    update: (data: Record<string, any>) => {
      updateData = data;
      return this;
    },
    
    returning: () => {
      return this;
    },
    
    execute: async () => {
      if (currentTable === 'organizations' && filterOrgId) {
        const org = mockOrganizations[filterOrgId];
        if (!org) {
          return { data: null, error: { message: 'Not found' } };
        }
        
        const updatedOrg = {
          ...org,
          ...updateData,
          updated_at: new Date().toISOString(),
        };
        
        mockOrganizations[filterOrgId] = updatedOrg;
        return { data: updatedOrg, error: null };
      }
      
      return { data: null, error: null };
    },
    
    // Reset mock data for tests
    _reset: () => {
      currentTable = null;
      filterOrgId = null;
      filterUserId = null;
      updateData = {};
    },
    
    // Direct access for assertions
    _mockOrganizations: mockOrganizations,
    _mockUserOrgRoles: mockUserOrgRoles,
  };
};

/**
 * Get user's role in organization
 */
export const getUserOrgRole = (
  userId: string,
  orgId: string
): 'admin' | 'user' | null => {
  const role = mockUserOrgRoles.find(
    (r) => r.user_id === userId && r.org_id === orgId
  );
  return role ? role.role : null;
};

/**
 * Check if user is admin
 */
export const isUserAdmin = (userId: string, orgId: string): boolean => {
  return getUserOrgRole(userId, orgId) === 'admin';
};

/**
 * Get organization by ID
 */
export const getMockOrganization = (orgId: string): MockOrgRecord | null => {
  return mockOrganizations[orgId] || null;
};

/**
 * Update organization
 */
export const updateMockOrganization = (
  orgId: string,
  updates: Partial<MockOrgRecord>
) => {
  if (!mockOrganizations[orgId]) {
    return null;
  }
  
  mockOrganizations[orgId] = {
    ...mockOrganizations[orgId],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  
  return mockOrganizations[orgId];
};
