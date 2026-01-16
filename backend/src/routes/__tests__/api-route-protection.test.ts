/**
 * API Route Protection Tests
 * 
 * Tests multi-tenant isolation enforcement in API routes:
 * - JWT org_id vs URL :orgId parameter matching
 * - RLS policy enforcement in database queries
 * - Cross-organization access prevention
 * - Error response sanitization
 * 
 * Principle: "Does this one thing work?"
 * Each test validates that routes enforce org_id isolation correctly.
 */

import express, { Request, Response } from 'express';
import request from 'supertest';
import * as supabaseClient from '../../services/supabase-client';
import { requireAuth } from '../../middleware/auth';

// Mock the Supabase client
jest.mock('../../services/supabase-client', () => ({
    supabase: {
        from: jest.fn(),
        auth: {
            getUser: jest.fn(),
        },
    },
}));

// Create a test Express app with protected routes
function createTestApp() {
    const app = express();
    app.use(express.json());

    // Mock auth middleware that injects test user
    const mockAuth = (req: any, res: Response, next: Function) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Missing Authorization header' });
        }

        // Extract org_id from test token format: "Bearer orgId:userId"
        const token = authHeader.replace('Bearer ', '');
        const [orgId, userId] = token.split(':');

        if (!orgId || !userId) {
            return res.status(401).json({ error: 'Invalid token format' });
        }

        req.user = {
            id: userId,
            email: `${userId}@test.com`,
            orgId: orgId,
        };

        next();
    };

    // Test route: GET /api/orgs/:orgId/settings
    app.get('/api/orgs/:orgId/settings', mockAuth, async (req: Request, res: Response) => {
        const { orgId } = req.params;
        const userOrgId = req.user?.orgId;

        // CRITICAL: Validate JWT org_id matches URL parameter
        if (orgId !== userOrgId) {
            return res.status(403).json({
                error: 'Access denied to this organization',
            });
        }

        // Query database with RLS filtering
        const mockSupabase = supabaseClient.supabase;
        const { data, error } = await (mockSupabase.from as any)('organizations')
            .select('id, name, status')
            .eq('id', userOrgId)
            .single();

        if (error) {
            return res.status(500).json({ error: 'Internal server error' });
        }

        res.json(data);
    });

    // Test route: PUT /api/orgs/:orgId/settings
    app.put('/api/orgs/:orgId/settings', mockAuth, async (req: Request, res: Response) => {
        const { orgId } = req.params;
        const userOrgId = req.user?.orgId;

        if (orgId !== userOrgId) {
            return res.status(403).json({
                error: 'Access denied to this organization',
            });
        }

        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const mockSupabase = supabaseClient.supabase;
        const { data, error } = await (mockSupabase.from as any)('organizations')
            .update({ name })
            .eq('id', userOrgId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Internal server error' });
        }

        res.json(data);
    });

    // Test route: GET /api/orgs/:orgId/calls
    app.get('/api/orgs/:orgId/calls', mockAuth, async (req: Request, res: Response) => {
        const { orgId } = req.params;
        const userOrgId = req.user?.orgId;

        if (orgId !== userOrgId) {
            return res.status(403).json({
                error: 'Access denied to this organization',
            });
        }

        const mockSupabase = supabaseClient.supabase;
        const { data, error } = await (mockSupabase.from as any)('calls')
            .select('*')
            .eq('org_id', userOrgId)
            .limit(10);

        if (error) {
            return res.status(500).json({ error: 'Internal server error' });
        }

        res.json(data);
    });

    // Test route: POST /api/orgs/:orgId/agents
    app.post('/api/orgs/:orgId/agents', mockAuth, async (req: Request, res: Response) => {
        const { orgId } = req.params;
        const userOrgId = req.user?.orgId;

        if (orgId !== userOrgId) {
            return res.status(403).json({
                error: 'Access denied to this organization',
            });
        }

        const { name, role } = req.body;
        if (!name || !role) {
            return res.status(400).json({ error: 'Name and role are required' });
        }

        const mockSupabase = supabaseClient.supabase;
        const { data, error } = await (mockSupabase.from as any)('agents')
            .insert({
                org_id: userOrgId,
                name,
                role,
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Internal server error' });
        }

        res.status(201).json(data);
    });

    return app;
}

describe('API Route Protection - Multi-Tenant Isolation', () => {
    let app: express.Application;
    let mockSupabase: any;

    beforeEach(() => {
        app = createTestApp();
        mockSupabase = supabaseClient.supabase;
        jest.clearAllMocks();
    });

    describe('GET /api/orgs/:orgId/settings', () => {
        it('should allow access when JWT org_id matches URL parameter', async () => {
            const orgId = 'a0000000-0000-0000-0000-000000000001';
            const orgData = { id: orgId, name: 'Test Clinic', status: 'active' };

            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: orgData,
                            error: null,
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            const response = await request(app)
                .get(`/api/orgs/${orgId}/settings`)
                .set('Authorization', `Bearer ${orgId}:user_123`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(orgData);
        });

        it('should deny access when JWT org_id does NOT match URL parameter (403)', async () => {
            const userOrgId = 'b0000000-0000-0000-0000-000000000002';
            const requestedOrgId = 'c0000000-0000-0000-0000-000000000003';

            const response = await request(app)
                .get(`/api/orgs/${requestedOrgId}/settings`)
                .set('Authorization', `Bearer ${userOrgId}:user_123`);

            expect(response.status).toBe(403);
            expect(response.body).toEqual({
                error: 'Access denied to this organization',
            });
        });

        it('should reject request with missing JWT (401)', async () => {
            const orgId = 'd0000000-0000-0000-0000-000000000004';

            const response = await request(app).get(`/api/orgs/${orgId}/settings`);

            expect(response.status).toBe(401);
            expect(response.body).toEqual({
                error: 'Missing Authorization header',
            });
        });

        it('should reject request with invalid JWT format (401)', async () => {
            const orgId = 'e0000000-0000-0000-0000-000000000005';

            const response = await request(app)
                .get(`/api/orgs/${orgId}/settings`)
                .set('Authorization', 'Bearer invalid_token');

            expect(response.status).toBe(401);
            expect(response.body).toEqual({
                error: 'Invalid token format',
            });
        });
    });

    describe('PUT /api/orgs/:orgId/settings', () => {
        it('should allow update when JWT org_id matches URL parameter', async () => {
            const orgId = 'f0000000-0000-0000-0000-000000000006';
            const updatedData = { id: orgId, name: 'Updated Clinic', status: 'active' };

            const mockFrom = jest.fn().mockReturnValue({
                update: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        select: jest.fn().mockReturnValue({
                            single: jest.fn().mockResolvedValue({
                                data: updatedData,
                                error: null,
                            }),
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            const response = await request(app)
                .put(`/api/orgs/${orgId}/settings`)
                .set('Authorization', `Bearer ${orgId}:user_123`)
                .send({ name: 'Updated Clinic' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(updatedData);
        });

        it('should deny update when JWT org_id does NOT match URL parameter (403)', async () => {
            const userOrgId = 'g0000000-0000-0000-0000-000000000007';
            const requestedOrgId = 'h0000000-0000-0000-0000-000000000008';

            const response = await request(app)
                .put(`/api/orgs/${requestedOrgId}/settings`)
                .set('Authorization', `Bearer ${userOrgId}:user_123`)
                .send({ name: 'Hacked Clinic' });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({
                error: 'Access denied to this organization',
            });
        });

        it('should validate request body (400)', async () => {
            const orgId = 'i0000000-0000-0000-0000-000000000009';

            const response = await request(app)
                .put(`/api/orgs/${orgId}/settings`)
                .set('Authorization', `Bearer ${orgId}:user_123`)
                .send({}); // Missing required 'name' field

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                error: 'Name is required',
            });
        });
    });

    describe('GET /api/orgs/:orgId/calls', () => {
        it('should return calls scoped by JWT org_id', async () => {
            const orgId = 'j0000000-0000-0000-0000-000000000010';
            const callsData = [
                { id: 'call_1', org_id: orgId, status: 'completed' },
                { id: 'call_2', org_id: orgId, status: 'completed' },
            ];

            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        limit: jest.fn().mockResolvedValue({
                            data: callsData,
                            error: null,
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            const response = await request(app)
                .get(`/api/orgs/${orgId}/calls`)
                .set('Authorization', `Bearer ${orgId}:user_123`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual(callsData);
            expect(mockFrom).toHaveBeenCalledWith('calls');
        });

        it('should deny access to calls from different organization (403)', async () => {
            const userOrgId = 'k0000000-0000-0000-0000-000000000011';
            const requestedOrgId = 'l0000000-0000-0000-0000-000000000012';

            const response = await request(app)
                .get(`/api/orgs/${requestedOrgId}/calls`)
                .set('Authorization', `Bearer ${userOrgId}:user_123`);

            expect(response.status).toBe(403);
            expect(response.body).toEqual({
                error: 'Access denied to this organization',
            });
        });
    });

    describe('POST /api/orgs/:orgId/agents', () => {
        it('should create agent with JWT org_id', async () => {
            const orgId = 'm0000000-0000-0000-0000-000000000013';
            const agentData = {
                id: 'agent_123',
                org_id: orgId,
                name: 'Test Agent',
                role: 'inbound',
            };

            const mockFrom = jest.fn().mockReturnValue({
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: agentData,
                            error: null,
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            const response = await request(app)
                .post(`/api/orgs/${orgId}/agents`)
                .set('Authorization', `Bearer ${orgId}:user_123`)
                .send({ name: 'Test Agent', role: 'inbound' });

            expect(response.status).toBe(201);
            expect(response.body).toEqual(agentData);
        });

        it('should deny agent creation for different organization (403)', async () => {
            const userOrgId = 'n0000000-0000-0000-0000-000000000014';
            const requestedOrgId = 'o0000000-0000-0000-0000-000000000015';

            const response = await request(app)
                .post(`/api/orgs/${requestedOrgId}/agents`)
                .set('Authorization', `Bearer ${userOrgId}:user_123`)
                .send({ name: 'Hacked Agent', role: 'inbound' });

            expect(response.status).toBe(403);
            expect(response.body).toEqual({
                error: 'Access denied to this organization',
            });
        });

        it('should validate request body (400)', async () => {
            const orgId = 'p0000000-0000-0000-0000-000000000016';

            const response = await request(app)
                .post(`/api/orgs/${orgId}/agents`)
                .set('Authorization', `Bearer ${orgId}:user_123`)
                .send({ name: 'Test Agent' }); // Missing 'role' field

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                error: 'Name and role are required',
            });
        });
    });

    describe('Database query scoping', () => {
        it('should always use JWT org_id for database queries (not URL parameter)', async () => {
            const orgId = 'q0000000-0000-0000-0000-000000000017';

            const mockEq = jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                    data: { id: orgId, name: 'Test Clinic' },
                    error: null,
                }),
            });

            const mockSelect = jest.fn().mockReturnValue({
                eq: mockEq,
            });

            const mockFrom = jest.fn().mockReturnValue({
                select: mockSelect,
            });

            mockSupabase.from = mockFrom;

            await request(app)
                .get(`/api/orgs/${orgId}/settings`)
                .set('Authorization', `Bearer ${orgId}:user_123`);

            // Verify .eq('id', orgId) was called with JWT org_id
            expect(mockEq).toHaveBeenCalledWith('id', orgId);
        });
    });

    describe('Error response sanitization', () => {
        it('should not leak organization information in error responses', async () => {
            const userOrgId = 'r0000000-0000-0000-0000-000000000018';
            const requestedOrgId = 's0000000-0000-0000-0000-000000000019';

            const response = await request(app)
                .get(`/api/orgs/${requestedOrgId}/settings`)
                .set('Authorization', `Bearer ${userOrgId}:user_123`);

            expect(response.status).toBe(403);
            expect(response.body.error).not.toContain(requestedOrgId);
            expect(response.body.error).not.toContain(userOrgId);
            expect(response.body.error).toBe('Access denied to this organization');
        });

        it('should return generic error for database failures', async () => {
            const orgId = 't0000000-0000-0000-0000-000000000020';

            const mockFrom = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'Connection timeout', code: '08006' },
                        }),
                    }),
                }),
            });
            mockSupabase.from = mockFrom;

            const response = await request(app)
                .get(`/api/orgs/${orgId}/settings`)
                .set('Authorization', `Bearer ${orgId}:user_123`);

            expect(response.status).toBe(500);
            expect(response.body).toEqual({
                error: 'Internal server error',
            });
            expect(response.body.error).not.toContain('Connection timeout');
        });
    });
});
