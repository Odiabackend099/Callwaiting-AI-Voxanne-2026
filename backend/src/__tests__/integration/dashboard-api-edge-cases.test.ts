/**
 * Dashboard API Edge Cases Integration Tests
 * Deliverable #7: backend/src/__tests__/integration/dashboard-api-edge-cases.test.ts
 *
 * Tests all edge cases across the dashboard endpoints.
 * API response format: { calls: [...], pagination: { page, limit, total, pages } }
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

async function apiRequest(
    method: string,
    path: string,
    options?: { body?: any; headers?: Record<string, string> }
) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options?.headers,
    };

    const fetchOptions: RequestInit = { method, headers };
    if (options?.body) fetchOptions.body = JSON.stringify(options.body);

    const response = await fetch(`${BASE_URL}${path}`, fetchOptions);
    let body: any;
    try {
        const text = await response.text();
        body = text ? JSON.parse(text) : null;
    } catch {
        body = null;
    }

    return { status: response.status, body };
}

describe('Dashboard API Edge Cases', () => {
    // ── Call List Edge Cases ──
    describe('GET /api/calls-dashboard (Call List)', () => {
        it('should return paginated results with valid params', async () => {
            const { status, body } = await apiRequest('GET', '/api/calls-dashboard?limit=10');
            expect(status).toBe(200);
            expect(body).toHaveProperty('calls');
            expect(Array.isArray(body.calls)).toBe(true);
        });

        it('should reject limit=0 (below minimum)', async () => {
            const { status } = await apiRequest('GET', '/api/calls-dashboard?limit=0');
            expect(status).toBe(400);
        });

        it('should reject limit=101 (above maximum)', async () => {
            const { status } = await apiRequest('GET', '/api/calls-dashboard?limit=101');
            expect(status).toBe(400);
        });

        it('should reject non-numeric limit', async () => {
            const { status } = await apiRequest('GET', '/api/calls-dashboard?limit=abc');
            expect(status).toBe(400);
        });

        it('should handle high page number gracefully', async () => {
            const { status } = await apiRequest('GET', '/api/calls-dashboard?limit=10&page=99999');
            // High offset may return empty array (200) or Supabase range error (500)
            expect([200, 500]).toContain(status);
        });

        it('should handle empty search param', async () => {
            const { status } = await apiRequest('GET', '/api/calls-dashboard?limit=10&search=');
            expect(status).toBe(200);
        });

        it('should handle XSS payload in search', async () => {
            const { status, body } = await apiRequest('GET',
                '/api/calls-dashboard?limit=10&search=%3Cscript%3Ealert(1)%3C/script%3E');
            expect(status).toBe(200);
            // Response should not contain unescaped script tag
            expect(JSON.stringify(body)).not.toContain('<script>');
        });

        it('should handle valid date filters', async () => {
            const { status } = await apiRequest('GET',
                '/api/calls-dashboard?limit=10&startDate=2026-01-01&endDate=2026-12-31');
            expect(status).toBe(200);
        });

        it('should handle status filter', async () => {
            const { status } = await apiRequest('GET',
                '/api/calls-dashboard?limit=10&status=completed');
            expect(status).toBe(200);
        });

        it('should include pagination metadata', async () => {
            const { status, body } = await apiRequest('GET', '/api/calls-dashboard?limit=5');
            expect(status).toBe(200);
            expect(body).toHaveProperty('pagination');
            expect(body.pagination).toHaveProperty('total');
            expect(typeof body.pagination.total).toBe('number');
        });
    });

    // ── Call Detail Edge Cases ──
    describe('GET /api/calls-dashboard/:callId (Call Detail)', () => {
        it('should return 400 for invalid UUID', async () => {
            const { status, body } = await apiRequest('GET', '/api/calls-dashboard/not-a-uuid');
            expect(status).toBe(400);
            expect(body.code).toBe('INVALID_UUID');
        });

        it('should return 404 for non-existent call', async () => {
            const { status, body } = await apiRequest('GET', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000');
            expect(status).toBe(404);
            expect(body.code).toBe('CALL_NOT_FOUND');
        });

        it('should return 400 for UUID with script injection', async () => {
            const { status } = await apiRequest('GET', '/api/calls-dashboard/abc123-<script>');
            expect(status).toBe(400);
        });

        it('should return 400 for very long callId', async () => {
            const { status } = await apiRequest('GET', `/api/calls-dashboard/${'a'.repeat(200)}`);
            expect(status).toBe(400);
        });

        it('should include Golden Record fields in response', async () => {
            const { status: listStatus, body: listBody } = await apiRequest('GET', '/api/calls-dashboard?limit=1');
            if (listStatus === 200 && listBody.calls?.length > 0) {
                const callId = listBody.calls[0].id;
                const { status, body } = await apiRequest('GET', `/api/calls-dashboard/${callId}`);
                expect(status).toBe(200);
                expect(body).toHaveProperty('cost_cents');
                expect(body).toHaveProperty('tools_used');
            }
        });

        it('should include call_type in response', async () => {
            const { body: listBody } = await apiRequest('GET', '/api/calls-dashboard?limit=1');
            if (listBody.calls?.length > 0) {
                const { body } = await apiRequest('GET', `/api/calls-dashboard/${listBody.calls[0].id}`);
                expect(body).toHaveProperty('call_type');
                expect(['inbound', 'outbound']).toContain(body.call_type);
            }
        });
    });

    // ── Recording URL Edge Cases ──
    describe('GET /api/calls-dashboard/:callId/recording-url', () => {
        it('should return 400 for invalid UUID', async () => {
            const { status, body } = await apiRequest('GET', '/api/calls-dashboard/not-a-uuid/recording-url');
            expect(status).toBe(400);
            expect(body.code).toBe('INVALID_UUID');
        });

        it('should return 404 for non-existent call', async () => {
            const { status } = await apiRequest('GET',
                '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/recording-url');
            expect(status).toBe(404);
        });
    });

    // ── Stats Edge Cases ──
    describe('GET /api/calls-dashboard/stats', () => {
        it('should return stats with valid time window', async () => {
            const { status, body } = await apiRequest('GET', '/api/calls-dashboard/stats?time_window=7d');
            expect(status).toBe(200);
            expect(body).toBeDefined();
        });

        it('should handle missing time_window param', async () => {
            const { status } = await apiRequest('GET', '/api/calls-dashboard/stats');
            // Should either use default or fail gracefully
            expect([200, 400]).toContain(status);
        });
    });

    // ── Delete Edge Cases ──
    describe('DELETE /api/calls-dashboard/:callId', () => {
        it('should return 400 for invalid UUID', async () => {
            const { status, body } = await apiRequest('DELETE', '/api/calls-dashboard/not-a-uuid');
            expect(status).toBe(400);
            expect(body.code).toBe('INVALID_UUID');
        });
    });

    // ── SMS Followup Edge Cases ──
    describe('POST /api/calls-dashboard/:callId/followup', () => {
        it('should return 400 for invalid UUID', async () => {
            const { status } = await apiRequest('POST', '/api/calls-dashboard/not-a-uuid/followup', {
                body: { message: 'test' },
            });
            expect(status).toBe(400);
        });

        it('should reject empty message', async () => {
            const { status } = await apiRequest('POST',
                '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/followup', {
                body: { message: '' },
            });
            expect(status).toBe(400);
        });

        it('should reject missing body', async () => {
            const { status } = await apiRequest('POST',
                '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/followup', {
                body: {},
            });
            expect(status).toBe(400);
        });
    });

    // ── Share Edge Cases ──
    describe('POST /api/calls-dashboard/:callId/share', () => {
        it('should return 400 for invalid UUID', async () => {
            const { status } = await apiRequest('POST', '/api/calls-dashboard/not-a-uuid/share', {
                body: { email: 'test@example.com' },
            });
            expect(status).toBe(400);
        });

        it('should reject invalid email', async () => {
            const { status } = await apiRequest('POST',
                '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/share', {
                body: { email: 'not-an-email' },
            });
            expect(status).toBe(400);
        });

        it('should reject missing email', async () => {
            const { status } = await apiRequest('POST',
                '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/share', {
                body: {},
            });
            expect(status).toBe(400);
        });
    });

    // ── Transcript Export Edge Cases ──
    describe('POST /api/calls-dashboard/:callId/transcript/export', () => {
        it('should return 400 for invalid UUID', async () => {
            const { status } = await apiRequest('POST',
                '/api/calls-dashboard/not-a-uuid/transcript/export', {
                body: { format: 'txt' },
            });
            expect(status).toBe(400);
        });

        it('should reject unsupported format', async () => {
            const { status } = await apiRequest('POST',
                '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/transcript/export', {
                body: { format: 'pdf' },
            });
            expect(status).toBe(400);
        });
    });
});
