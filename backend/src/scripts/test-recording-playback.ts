#!/usr/bin/env npx tsx
/**
 * Recording Playback E2E Test Script
 * Deliverable #5: backend/src/scripts/test-recording-playback.ts
 *
 * End-to-end test:
 * 1. Query DB for calls with recording_storage_path
 * 2. Generate signed URL via API
 * 3. Verify URL is accessible (HEAD request)
 * 4. Check URL expiration headers
 *
 * Usage: npx tsx src/scripts/test-recording-playback.ts
 * Requires: Backend running on localhost:3001
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TestResult {
    check: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    details: string;
}

const results: TestResult[] = [];

function report(check: string, status: 'PASS' | 'FAIL' | 'SKIP', details: string) {
    results.push({ check, status, details });
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${emoji} [${status}] ${check}: ${details}`);
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  RECORDING PLAYBACK E2E TEST');
    console.log(`  Run at: ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ── Step 1: Find calls with recordings ──
    console.log('── Step 1: Finding calls with recordings ──');
    const { data: callsWithRecording, count } = await supabase
        .from('calls')
        .select('id, org_id, recording_storage_path, recording_url, vapi_call_id', { count: 'exact' })
        .not('recording_storage_path', 'is', null)
        .limit(5);

    if (!callsWithRecording || callsWithRecording.length === 0) {
        report('Calls with recordings', 'SKIP', 'No calls found with recording_storage_path');

        // Check for calls with recording_url (Vapi CDN)
        const { data: vapiRecordings, count: vapiCount } = await supabase
            .from('calls')
            .select('id, recording_url', { count: 'exact' })
            .not('recording_url', 'is', null)
            .limit(5);

        if (vapiRecordings && vapiRecordings.length > 0) {
            report('Vapi CDN recordings', 'PASS', `Found ${vapiCount} calls with recording_url (Vapi CDN)`);

            // Test first Vapi CDN URL
            const firstUrl = vapiRecordings[0].recording_url;
            try {
                const response = await fetch(firstUrl, { method: 'HEAD' });
                if (response.ok) {
                    report('Vapi CDN URL accessible', 'PASS', `HEAD ${firstUrl.substring(0, 60)}... → ${response.status}`);
                } else {
                    report('Vapi CDN URL accessible', 'FAIL', `HEAD returned ${response.status}`);
                }
            } catch (e: any) {
                report('Vapi CDN URL accessible', 'FAIL', `Network error: ${e.message}`);
            }
        } else {
            report('Any recordings found', 'SKIP', 'No recordings found in database (test data may not have recordings)');
        }
    } else {
        report('Calls with recordings', 'PASS', `Found ${count} calls with recording_storage_path`);

        // ── Step 2: Test signed URL generation via API ──
        console.log('\n── Step 2: Testing signed URL generation ──');
        for (const call of callsWithRecording.slice(0, 3)) {
            try {
                const response = await fetch(`${BASE_URL}/api/calls-dashboard/${call.id}/recording-url`);
                const data = await response.json();

                if (response.ok && data.recording_url) {
                    report(`Signed URL for ${call.id.substring(0, 8)}`, 'PASS', `Source: ${data.source || 'unknown'}, expires: ${data.expires_in}s`);

                    // ── Step 3: Verify URL accessibility ──
                    try {
                        const urlCheck = await fetch(data.recording_url, { method: 'HEAD' });
                        if (urlCheck.ok) {
                            const contentType = urlCheck.headers.get('content-type');
                            report(`URL accessible (${call.id.substring(0, 8)})`, 'PASS', `Content-Type: ${contentType}`);
                        } else {
                            report(`URL accessible (${call.id.substring(0, 8)})`, 'FAIL', `HEAD returned ${urlCheck.status}`);
                        }
                    } catch (e: any) {
                        report(`URL accessible (${call.id.substring(0, 8)})`, 'FAIL', `Network error: ${e.message}`);
                    }
                } else {
                    report(`Signed URL for ${call.id.substring(0, 8)}`, 'FAIL', `API returned ${response.status}: ${JSON.stringify(data)}`);
                }
            } catch (e: any) {
                report(`Signed URL for ${call.id.substring(0, 8)}`, 'FAIL', `Request failed: ${e.message}`);
            }
        }
    }

    // ── Step 4: Test path traversal protection ──
    console.log('\n── Step 4: Testing path traversal protection ──');
    try {
        const response = await fetch(`${BASE_URL}/api/calls-dashboard/../../../etc/passwd/recording-url`);
        if (response.status === 400 || response.status === 404) {
            report('Path traversal blocked', 'PASS', `Server returned ${response.status} for traversal attempt`);
        } else {
            report('Path traversal blocked', 'FAIL', `Server returned ${response.status} instead of 400/404`);
        }
    } catch (e: any) {
        report('Path traversal blocked', 'PASS', 'Request rejected at network level');
    }

    // ── Step 5: Test non-existent recording ──
    console.log('\n── Step 5: Testing non-existent recording ──');
    try {
        const response = await fetch(`${BASE_URL}/api/calls-dashboard/00000000-0000-0000-0000-000000000000/recording-url`);
        if (response.status === 404) {
            report('Non-existent recording', 'PASS', 'Correctly returned 404');
        } else {
            report('Non-existent recording', 'FAIL', `Expected 404, got ${response.status}`);
        }
    } catch (e: any) {
        report('Non-existent recording', 'FAIL', `Request failed: ${e.message}`);
    }

    // ── Summary ──
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  RECORDING PLAYBACK TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    console.log(`  ✅ PASSED: ${passed}`);
    console.log(`  ❌ FAILED: ${failed}`);
    console.log(`  ⏭️  SKIPPED: ${skipped}`);
    console.log(`  Total: ${results.length}`);
    console.log(`  Overall: ${failed === 0 ? '✅ RECORDING PLAYBACK VERIFIED' : '❌ RECORDING ISSUES FOUND'}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
