/**
 * Organization Validation Service Tests
 * 
 * Tests the org-validation service functions in isolation:
 * - validateAndResolveOrgId() - UUID validation and org existence check
 * - validateUserOrgMembership() - User-org relationship verification
 * - validateOrgIdParameter() - Request parameter validation
 * - getOrganizationSafe() - Safe org data retrieval
 * 
 * Principle: "Does this one thing work?"
 * Each test validates a single validation behavior without external dependencies.
 */

import {
    validateAndResolveOrgId,
    validateUserOrgMembership,
    validateOrgIdParameter,
    getOrganizationSafe,
} from '../../services/org-validation';
import * as supabaseClient from '../../services/supabase-client';

// Mock the Supabase client
jest.mock('../../services/supabase-client', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

describe('Organization Validation Service - validateAndResolveOrgId()', () => {
    let mockSupabase: any;

    beforeEach(() => {
        mockSupabase = supabaseClient.supabase;
        jest.clearAllMocks();
    });

    describe('Valid UUID format validation', () => {
        it('should accept valid UUID v4 in lowercase', async () => {
            const validOrgId = '123e4567-e89b-12d3-a456-426614174000';

            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { id: validOrgId, name: 'Test Clinic', status: 'active' },
                            error: null,
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            const result = await validateAndResolveOrgId(validOrgId);

            expect(result).toBe(validOrgId);
            expect(mockFrom).toHaveBeenCalledWith('organizations');
        });

        it('should accept valid UUID v4 in uppercase', async () => {
            const validOrgId = 'ABCDEF01-2345-6789-ABCD-EF0123456789';

            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { id: validOrgId, name: 'Test Clinic', status: 'active' },
                            error: null,
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            const result = await validateAndResolveOrgId(validOrgId);

            expect(result).toBe(validOrgId);
        });

        it('should accept valid UUID v4 in mixed case', async () => {
            const validOrgId = 'aBcDeF01-2345-6789-AbCd-Ef0123456789';

            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { id: validOrgId, name: 'Test Clinic', status: 'active' },
                            error: null,
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            const result = await validateAndResolveOrgId(validOrgId);

            expect(result).toBe(validOrgId);
        });
    });

    describe('Invalid UUID format rejection', () => {
        it('should reject UUID that is too short', async () => {
            const invalidOrgId = '123-456-789';

            await expect(validateAndResolveOrgId(invalidOrgId)).rejects.toThrow(
                'ORG_ID_INVALID: org_id must be valid UUID'
            );
        });

        it('should reject UUID without hyphens', async () => {
            const invalidOrgId = '123e4567e89b12d3a456426614174000';

            await expect(validateAndResolveOrgId(invalidOrgId)).rejects.toThrow(
                'ORG_ID_INVALID: org_id must be valid UUID'
            );
        });

        it('should reject incomplete UUID', async () => {
            const invalidOrgId = '123e4567-e89b-12d3-a456';

            await expect(validateAndResolveOrgId(invalidOrgId)).rejects.toThrow(
                'ORG_ID_INVALID: org_id must be valid UUID'
            );
        });

        it('should reject UUID with extra characters', async () => {
            const invalidOrgId = '123e4567-e89b-12d3-a456-426614174000-extra';

            await expect(validateAndResolveOrgId(invalidOrgId)).rejects.toThrow(
                'ORG_ID_INVALID: org_id must be valid UUID'
            );
        });

        it('should reject empty string', async () => {
            await expect(validateAndResolveOrgId('')).rejects.toThrow(
                'ORG_ID_MISSING: User must have valid org_id in JWT'
            );
        });

        it('should reject null value', async () => {
            await expect(validateAndResolveOrgId(null)).rejects.toThrow(
                'ORG_ID_MISSING: User must have valid org_id in JWT'
            );
        });

        it('should reject undefined value', async () => {
            await expect(validateAndResolveOrgId(undefined)).rejects.toThrow(
                'ORG_ID_MISSING: User must have valid org_id in JWT'
            );
        });

        it('should reject "default" value', async () => {
            await expect(validateAndResolveOrgId('default')).rejects.toThrow(
                'ORG_ID_MISSING: User must have valid org_id in JWT'
            );
        });
    });

    describe('Database organization existence check', () => {
        it('should return org_id when organization exists', async () => {
            const validOrgId = 'a0000000-0000-0000-0000-000000000001';

            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { id: validOrgId, name: 'Active Clinic', status: 'active' },
                            error: null,
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            const result = await validateAndResolveOrgId(validOrgId);

            expect(result).toBe(validOrgId);
        });

        it('should throw error when organization not found', async () => {
            const nonExistentOrgId = 'b0000000-0000-0000-0000-000000000002';

            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'No rows found' },
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            await expect(validateAndResolveOrgId(nonExistentOrgId)).rejects.toThrow(
                `ORG_ID_NOT_FOUND: Organization ${nonExistentOrgId} does not exist`
            );
        });

        it('should throw error when organization is deleted', async () => {
            const deletedOrgId = 'c0000000-0000-0000-0000-000000000003';

            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: { id: deletedOrgId, name: 'Deleted Clinic', status: 'deleted' },
                            error: null,
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            await expect(validateAndResolveOrgId(deletedOrgId)).rejects.toThrow(
                'ORG_DELETED: Organization has been deleted'
            );
        });
    });

    describe('Database connection error handling', () => {
        it('should handle database connection errors gracefully', async () => {
            const validOrgId = 'd0000000-0000-0000-0000-000000000004';

            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockRejectedValue(new Error('Database connection failed')),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            await expect(validateAndResolveOrgId(validOrgId)).rejects.toThrow();
        });
    });
});

describe('Organization Validation Service - validateUserOrgMembership()', () => {
    let mockSupabase: any;

    beforeEach(() => {
        mockSupabase = supabaseClient.supabase;
        jest.clearAllMocks();
    });

    it('should return true when user belongs to organization', async () => {
        const userId = 'user_123';
        const orgId = 'e0000000-0000-0000-0000-000000000005';

        const mockFrom = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: userId, org_id: orgId },
                    error: null,
                }),
            }),
        });
        mockSupabase.from = mockFrom;

        const result = await validateUserOrgMembership(userId, orgId);

        expect(result).toBe(true);
    });

    it('should return false when user does not belong to organization', async () => {
        const userId = 'user_123';
        const orgId = 'f0000000-0000-0000-0000-000000000006';

        const mockFrom = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'No rows found' },
                }),
            }),
        });
        mockSupabase.from = mockFrom;

        const result = await validateUserOrgMembership(userId, orgId);

        expect(result).toBe(false);
    });

    it('should return false when userId is missing', async () => {
        const result = await validateUserOrgMembership('', 'org_123');

        expect(result).toBe(false);
    });

    it('should return false when orgId is missing', async () => {
        const result = await validateUserOrgMembership('user_123', '');

        expect(result).toBe(false);
    });

    it('should return false when database query fails', async () => {
        const userId = 'user_123';
        const orgId = 'g0000000-0000-0000-0000-000000000007';

        const mockFrom = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error', code: 'PGRST301' },
                }),
            }),
        });
        mockSupabase.from = mockFrom;

        const result = await validateUserOrgMembership(userId, orgId);

        expect(result).toBe(false);
    });
});

describe('Organization Validation Service - validateOrgIdParameter()', () => {
    it('should not throw when org_ids match', () => {
        const orgId = 'h0000000-0000-0000-0000-000000000008';

        expect(() => validateOrgIdParameter(orgId, orgId)).not.toThrow();
    });

    it('should throw when org_ids do not match', () => {
        const requestOrgId = 'i0000000-0000-0000-0000-000000000009';
        const userOrgId = 'j0000000-0000-0000-0000-000000000010';

        expect(() => validateOrgIdParameter(requestOrgId, userOrgId)).toThrow(
            `ORG_ID_MISMATCH: Cannot access organization ${requestOrgId} with credentials for ${userOrgId}`
        );
    });

    it('should throw when request org_id is missing', () => {
        const userOrgId = 'k0000000-0000-0000-0000-000000000011';

        expect(() => validateOrgIdParameter(undefined, userOrgId)).toThrow(
            'ORG_ID_PARAMETER_MISSING: org_id parameter required in request'
        );
    });

    it('should throw when request org_id is empty string', () => {
        const userOrgId = 'l0000000-0000-0000-0000-000000000012';

        expect(() => validateOrgIdParameter('', userOrgId)).toThrow(
            'ORG_ID_PARAMETER_MISSING: org_id parameter required in request'
        );
    });
});

describe('Organization Validation Service - getOrganizationSafe()', () => {
    let mockSupabase: any;

    beforeEach(() => {
        mockSupabase = supabaseClient.supabase;
        jest.clearAllMocks();
    });

    it('should return organization when validation passes', async () => {
        const orgId = 'm0000000-0000-0000-0000-000000000013';
        const orgData = {
            id: orgId,
            name: 'Test Clinic',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-15T00:00:00Z',
        };

        const mockFrom = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: orgData,
                    error: null,
                }),
            }),
        });
        mockSupabase.from = mockFrom;

        const result = await getOrganizationSafe(orgId, orgId);

        expect(result).toEqual(orgData);
    });

    it('should throw when org_ids do not match', async () => {
        const requestOrgId = 'n0000000-0000-0000-0000-000000000014';
        const userOrgId = 'o0000000-0000-0000-0000-000000000015';

        await expect(getOrganizationSafe(requestOrgId, userOrgId)).rejects.toThrow(
            `ORG_ID_MISMATCH: Cannot access organization ${requestOrgId} with credentials for ${userOrgId}`
        );
    });

    it('should throw when organization not found', async () => {
        const orgId = 'p0000000-0000-0000-0000-000000000016';

        const mockFrom = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'No rows found' },
                }),
            }),
        });
        mockSupabase.from = mockFrom;

        await expect(getOrganizationSafe(orgId, orgId)).rejects.toThrow(
            `ORGANIZATION_NOT_FOUND: Organization ${orgId} not found or access denied`
        );
    });

    it('should throw when database query fails', async () => {
        const orgId = 'q0000000-0000-0000-0000-000000000017';

        const mockFrom = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockRejectedValue(new Error('Database connection failed')),
            }),
        });
        mockSupabase.from = mockFrom;

        await expect(getOrganizationSafe(orgId, orgId)).rejects.toThrow();
    });
});
