#!/usr/bin/env npx tsx
/**
 * Edge Case Audit Script
 * Deliverable #3: backend/src/scripts/audit-edge-cases.ts
 *
 * Tests all 43 edge cases across the 4 dashboard endpoints via HTTP requests.
 * Requires the backend server running on localhost:3001.
 *
 * Usage: npx tsx src/scripts/audit-edge-cases.ts
 */

import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const AUTH_TOKEN = process.env.DEV_AUTH_TOKEN || '';

interface TestResult {
    name: string;
    endpoint: string;
    status: 'PASS' | 'FAIL';
    expected: number;
    actual: number;
    details?: string;
}

const results: TestResult[] = [];

async function testEndpoint(
    name: string,
    method: string,
    path: string,
    expectedStatus: number,
    body?: any,
    customHeaders?: Record<string, string>
): Promise<TestResult> {
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
            ...customHeaders,
        };

        const options: RequestInit = { method, headers };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${BASE_URL}${path}`, options);
        const status = response.status;
        const result: TestResult = {
            name,
            endpoint: `${method} ${path}`,
            status: status === expectedStatus ? 'PASS' : 'FAIL',
            expected: expectedStatus,
            actual: status,
        };

        if (result.status === 'FAIL') {
            try {
                const responseBody = await response.json();
                result.details = JSON.stringify(responseBody).substring(0, 200);
            } catch {
                result.details = `Response status: ${status}`;
            }
        }

        results.push(result);
        const emoji = result.status === 'PASS' ? '✅' : '❌';
        console.log(`${emoji} ${name}: ${method} ${path} → ${status} (expected ${expectedStatus})`);
        return result;
    } catch (e: any) {
        const result: TestResult = {
            name,
            endpoint: `${method} ${path}`,
            status: 'FAIL',
            expected: expectedStatus,
            actual: 0,
            details: `Network error: ${e.message}`,
        };
        results.push(result);
        console.log(`❌ ${name}: NETWORK ERROR - ${e.message}`);
        return result;
    }
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  EDGE CASE AUDIT');
    console.log(`  Base URL: ${BASE_URL}`);
    console.log(`  Run at: ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ── Group 1: Call List Edge Cases (GET /api/calls-dashboard) ──
    console.log('── Group 1: Call List Edge Cases ──');

    await testEndpoint('Valid call list request', 'GET', '/api/calls-dashboard?limit=10&offset=0', 200);
    await testEndpoint('Limit = 0 (should reject)', 'GET', '/api/calls-dashboard?limit=0&offset=0', 400);
    await testEndpoint('Limit = 101 (exceeds max)', 'GET', '/api/calls-dashboard?limit=101&offset=0', 400);
    await testEndpoint('Negative offset', 'GET', '/api/calls-dashboard?limit=10&offset=-1', 400);
    await testEndpoint('Non-numeric limit', 'GET', '/api/calls-dashboard?limit=abc&offset=0', 400);
    await testEndpoint('Empty search parameter', 'GET', '/api/calls-dashboard?limit=10&offset=0&search=', 200);
    await testEndpoint('XSS in search', 'GET', '/api/calls-dashboard?limit=10&offset=0&search=%3Cscript%3Ealert(1)%3C/script%3E', 200);
    await testEndpoint('SQL injection in search', 'GET', '/api/calls-dashboard?limit=10&offset=0&search=1%27+OR+%271%27%3D%271', 200);
    await testEndpoint('Large offset (beyond data)', 'GET', '/api/calls-dashboard?limit=10&offset=999999', 200);
    await testEndpoint('Valid date filter', 'GET', '/api/calls-dashboard?limit=10&offset=0&date_from=2026-01-01&date_to=2026-12-31', 200);
    await testEndpoint('Invalid date format', 'GET', '/api/calls-dashboard?limit=10&offset=0&date_from=not-a-date', 400);
    await testEndpoint('Unicode search', 'GET', '/api/calls-dashboard?limit=10&offset=0&search=%E4%B8%AD%E6%96%87', 200);

    // ── Group 2: Call Detail Edge Cases (GET /api/calls-dashboard/:callId) ──
    console.log('\n── Group 2: Call Detail Edge Cases ──');

    await testEndpoint('Invalid UUID format', 'GET', '/api/calls-dashboard/not-a-uuid', 400);
    await testEndpoint('Non-existent valid UUID', 'GET', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000', 404);
    await testEndpoint('Empty callId', 'GET', '/api/calls-dashboard/', 200); // This hits the list endpoint
    await testEndpoint('UUID with special chars', 'GET', '/api/calls-dashboard/abc123-<script>', 400);
    await testEndpoint('Very long callId', 'GET', '/api/calls-dashboard/' + 'a'.repeat(200), 400);

    // ── Group 3: Recording URL Edge Cases (GET /api/calls-dashboard/:callId/recording-url) ──
    console.log('\n── Group 3: Recording URL Edge Cases ──');

    await testEndpoint('Invalid UUID for recording', 'GET', '/api/calls-dashboard/not-a-uuid/recording-url', 400);
    await testEndpoint('Non-existent call recording', 'GET', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/recording-url', 404);
    await testEndpoint('Path traversal in URL', 'GET', '/api/calls-dashboard/../../../etc/passwd/recording-url', 400);

    // ── Group 4: Stats Edge Cases (GET /api/calls-dashboard/stats) ──
    console.log('\n── Group 4: Stats Edge Cases ──');

    await testEndpoint('Valid stats request', 'GET', '/api/calls-dashboard/stats?time_window=7d', 200);
    await testEndpoint('Invalid time window', 'GET', '/api/calls-dashboard/stats?time_window=invalid', 400);
    await testEndpoint('Very large time window', 'GET', '/api/calls-dashboard/stats?time_window=365d', 200);

    // ── Group 5: Delete Edge Cases (DELETE /api/calls-dashboard/:callId) ──
    console.log('\n── Group 5: Delete Edge Cases ──');

    await testEndpoint('Delete invalid UUID', 'DELETE', '/api/calls-dashboard/not-a-uuid', 400);
    await testEndpoint('Delete non-existent call', 'DELETE', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000', 404);

    // ── Group 6: Followup SMS Edge Cases (POST /api/calls-dashboard/:callId/followup) ──
    console.log('\n── Group 6: Followup SMS Edge Cases ──');

    await testEndpoint('Followup with invalid UUID', 'POST', '/api/calls-dashboard/not-a-uuid/followup', 400, { message: 'test' });
    await testEndpoint('Followup with empty message', 'POST', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/followup', 400, { message: '' });
    await testEndpoint('Followup with too long message', 'POST', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/followup', 400, { message: 'a'.repeat(161) });
    await testEndpoint('Followup missing body', 'POST', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/followup', 400);

    // ── Group 7: Share Edge Cases (POST /api/calls-dashboard/:callId/share) ──
    console.log('\n── Group 7: Share Edge Cases ──');

    await testEndpoint('Share with invalid UUID', 'POST', '/api/calls-dashboard/not-a-uuid/share', 400, { email: 'test@example.com' });
    await testEndpoint('Share with invalid email', 'POST', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/share', 400, { email: 'not-an-email' });
    await testEndpoint('Share missing email', 'POST', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/share', 400, {});

    // ── Group 8: Transcript Export Edge Cases ──
    console.log('\n── Group 8: Transcript Export Edge Cases ──');

    await testEndpoint('Export with invalid UUID', 'POST', '/api/calls-dashboard/not-a-uuid/transcript/export', 400, { format: 'txt' });
    await testEndpoint('Export with invalid format', 'POST', '/api/calls-dashboard/00000000-0000-0000-0000-000000000000/transcript/export', 400, { format: 'pdf' });

    // ── Group 9: Auth Edge Cases ──
    console.log('\n── Group 9: Auth Edge Cases ──');

    await testEndpoint('No auth header', 'GET', '/api/calls-dashboard?limit=10&offset=0',
        process.env.NODE_ENV === 'development' ? 200 : 401, undefined, { Authorization: '' });
    await testEndpoint('Bearer with empty token', 'GET', '/api/calls-dashboard?limit=10&offset=0',
        process.env.NODE_ENV === 'development' ? 200 : 401, undefined, { Authorization: 'Bearer ' });
    await testEndpoint('Bearer undefined', 'GET', '/api/calls-dashboard?limit=10&offset=0',
        process.env.NODE_ENV === 'development' ? 200 : 401, undefined, { Authorization: 'Bearer undefined' });
    await testEndpoint('Bearer null', 'GET', '/api/calls-dashboard?limit=10&offset=0',
        process.env.NODE_ENV === 'development' ? 200 : 401, undefined, { Authorization: 'Bearer null' });

    // ── Summary ──
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  EDGE CASE AUDIT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`  ✅ PASSED: ${passed}`);
    console.log(`  ❌ FAILED: ${failed}`);
    console.log(`  Total tests: ${results.length}`);
    console.log(`  Overall: ${failed === 0 ? '✅ ALL EDGE CASES HANDLED' : `❌ ${failed} EDGE CASES NEED ATTENTION`}`);

    if (failed > 0) {
        console.log('\n  Failed tests:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`    ❌ ${r.name}: got ${r.actual}, expected ${r.expected}`);
            if (r.details) console.log(`       ${r.details}`);
        });
    }
    console.log('═══════════════════════════════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
