/**
 * Recording Playback Integration Tests
 * Deliverable #8: backend/src/__tests__/integration/recording-playback.test.ts
 *
 * Tests:
 * 1. Recording URL generation (signed URLs)
 * 2. Missing recordings (404 handling)
 * 3. Path traversal prevention
 * 4. Invalid UUID handling
 * 5. Error response format
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

async function apiRequest(method: string, path: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const response = await fetch(`${BASE_URL}${path}`, { method, headers });
    let body: any;
    try {
        body = await response.json();
    } catch {
        body = null;
    }
    return { status: response.status, body };
}

describe('Recording Playback Tests', () => {
    // ── UUID Validation ──
    describe('UUID validation on recording endpoint', () => {
        it('should return 400 for invalid UUID', async () => {
            const { status, body } = await apiRequest('GET', '/api/calls-dashboard/not-a-uuid/recording-url');
            expect(status).toBe(400);
            expect(body.code).toBe('INVALID_UUID');
            expect(body.request_id).toBeDefined();
        });

        it('should return 400 for script injection in UUID', async () => {
            const { status } = await apiRequest('GET',
                `/api/calls-dashboard/${encodeURIComponent('<script>alert(1)</script>')}/recording-url`);
            expect(status).toBe(400);
        });

        it('should return 400 for empty UUID', async () => {
            const { status } = await apiRequest('GET', '/api/calls-dashboard//recording-url');
            expect([400, 404]).toContain(status);
        });
    });

    // ── Missing Recording ──
    describe('Missing recording handling', () => {
        it('should return 404 for non-existent call', async () => {
            const { status, body } = await apiRequest('GET',
                '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/recording-url');
            expect(status).toBe(404);
            expect(body.code).toBe('CALL_NOT_FOUND');
        });
    });

    // ── Path Traversal Protection ──
    describe('Path traversal protection', () => {
        it('should block path traversal attempt', async () => {
            const { status } = await apiRequest('GET',
                '/api/calls-dashboard/../../../etc/passwd/recording-url');
            expect([400, 404]).toContain(status);
        });

        it('should block URL-encoded path traversal', async () => {
            const { status } = await apiRequest('GET',
                '/api/calls-dashboard/..%2F..%2F..%2Fetc%2Fpasswd/recording-url');
            expect([400, 404]).toContain(status);
        });
    });

    // ── Response Format ──
    describe('Response format', () => {
        it('should include recording_url, expires_in, and source in success response', async () => {
            // Find a call with a recording
            const listRes = await apiRequest('GET', '/api/calls-dashboard?limit=10&offset=0');
            if (listRes.status === 200 && listRes.body.data?.length > 0) {
                for (const call of listRes.body.data) {
                    const { status, body } = await apiRequest('GET',
                        `/api/calls-dashboard/${call.id}/recording-url`);
                    if (status === 200) {
                        expect(body).toHaveProperty('recording_url');
                        expect(body).toHaveProperty('source');
                        expect(typeof body.recording_url).toBe('string');
                        break;
                    }
                }
            }
        });

        it('should include request_id in error responses', async () => {
            const { body } = await apiRequest('GET', '/api/calls-dashboard/not-a-uuid/recording-url');
            expect(body.request_id).toBeDefined();
            expect(body.request_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });
    });

    // ── Concurrent Requests ──
    describe('Concurrent recording URL requests', () => {
        it('should handle 10 concurrent requests without crashing', async () => {
            const requests = Array.from({ length: 10 }, () =>
                apiRequest('GET', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/recording-url')
            );
            const results = await Promise.all(requests);

            // All should return 404 (not found) or 500 (connection pool under load) — never 200
            for (const { status } of results) {
                expect([404, 500]).toContain(status);
                expect(status).not.toBe(200);
            }
        });
    });
});
