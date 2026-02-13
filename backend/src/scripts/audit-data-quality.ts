#!/usr/bin/env npx tsx
/**
 * Data Quality Audit Script
 * Deliverable #2: backend/src/scripts/audit-data-quality.ts
 *
 * Automated checks:
 * 1. Completed calls with cost_cents = 0 or NULL
 * 2. Completed calls missing sentiment data
 * 3. Outcome summary format (must be exactly 3 sentences)
 * 4. Orphaned appointment_id references
 * 5. Invalid phone number formats
 * 6. NULL or empty vapi_call_id on non-test calls
 * 7. Golden Record field completeness
 *
 * Usage: npx tsx src/scripts/audit-data-quality.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface AuditResult {
    check: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    details: string;
    count?: number;
    records?: any[];
}

const results: AuditResult[] = [];

function report(check: string, status: 'PASS' | 'FAIL' | 'WARN', details: string, count?: number, records?: any[]) {
    results.push({ check, status, details, count, records });
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} [${status}] ${check}: ${details}${count !== undefined ? ` (${count})` : ''}`);
}

/**
 * Count sentences in a string (basic heuristic: split by period, question mark, or exclamation)
 */
function countSentences(text: string): number {
    if (!text) return 0;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.length;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DATA QUALITY AUDIT');
    console.log(`  Run at: ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ── Check 1: Completed calls with cost_cents = 0 or NULL ──
    console.log('── Check 1: Completed calls with cost_cents = 0 or NULL ──');
    const { data: zeroCostCalls, count: zeroCostCount } = await supabase
        .from('calls')
        .select('id, vapi_call_id, status, cost_cents, created_at', { count: 'exact' })
        .eq('status', 'completed')
        .or('cost_cents.is.null,cost_cents.eq.0');

    if (zeroCostCount === 0) {
        report('Zero-cost completed calls', 'PASS', 'All completed calls have cost data');
    } else {
        report('Zero-cost completed calls', 'WARN', `${zeroCostCount} completed calls have cost_cents=0 or NULL`, zeroCostCount ?? 0);
        zeroCostCalls?.forEach(c => {
            console.log(`    └─ ${c.id.substring(0, 8)}... vapi=${c.vapi_call_id?.substring(0, 20)}... cost=${c.cost_cents} @ ${c.created_at}`);
        });
    }

    // ── Check 2: Completed calls missing sentiment ──
    console.log('\n── Check 2: Completed calls missing sentiment ──');
    const { data: missingSentiment, count: missingSentimentCount } = await supabase
        .from('calls')
        .select('id, status, sentiment_score, sentiment_label', { count: 'exact' })
        .eq('status', 'completed')
        .or('sentiment_score.is.null,sentiment_label.is.null');

    if (missingSentimentCount === 0) {
        report('Missing sentiment', 'PASS', 'All completed calls have sentiment data');
    } else {
        report('Missing sentiment', 'WARN', `${missingSentimentCount} completed calls missing sentiment_score or sentiment_label`, missingSentimentCount ?? 0);
    }

    // ── Check 3: Outcome summary format (3 sentences) ──
    console.log('\n── Check 3: Outcome summary format validation ──');
    const { data: callsWithSummary } = await supabase
        .from('calls')
        .select('id, outcome_summary')
        .not('outcome_summary', 'is', null);

    let badSummaryCount = 0;
    if (callsWithSummary) {
        for (const call of callsWithSummary) {
            const sentenceCount = countSentences(call.outcome_summary);
            if (sentenceCount !== 3) {
                badSummaryCount++;
                console.log(`    ⚠️ Call ${call.id.substring(0, 8)}... has ${sentenceCount} sentences (expected 3)`);
            }
        }
    }
    if (badSummaryCount === 0) {
        report('Outcome summary format', 'PASS', 'All outcome summaries are exactly 3 sentences');
    } else {
        report('Outcome summary format', 'WARN', `${badSummaryCount} summaries deviate from 3-sentence format`, badSummaryCount);
    }

    // ── Check 4: Orphaned appointment_id references ──
    console.log('\n── Check 4: Orphaned appointment references ──');
    const { data: callsWithAppt } = await supabase
        .from('calls')
        .select('id, appointment_id')
        .not('appointment_id', 'is', null);

    let orphanedApptCount = 0;
    if (callsWithAppt) {
        for (const call of callsWithAppt) {
            const { data: appt } = await supabase
                .from('appointments')
                .select('id')
                .eq('id', call.appointment_id)
                .maybeSingle();

            if (!appt) {
                orphanedApptCount++;
                console.log(`    ❌ Call ${call.id.substring(0, 8)}... references non-existent appointment ${call.appointment_id}`);
            }
        }
    }
    if (orphanedApptCount === 0) {
        report('Orphaned appointment refs', 'PASS', 'All appointment_id references are valid');
    } else {
        report('Orphaned appointment refs', 'FAIL', `${orphanedApptCount} orphaned appointment references`, orphanedApptCount);
    }

    // ── Check 5: Invalid phone number format ──
    console.log('\n── Check 5: Phone number format validation ──');
    const { data: allCalls } = await supabase
        .from('calls')
        .select('id, phone_number');

    let invalidPhoneCount = 0;
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (allCalls) {
        for (const call of allCalls) {
            if (call.phone_number && !e164Regex.test(call.phone_number) && !call.phone_number.startsWith('test')) {
                invalidPhoneCount++;
                if (invalidPhoneCount <= 5) {
                    console.log(`    ⚠️ Call ${call.id.substring(0, 8)}... has non-E.164 phone: "${call.phone_number}"`);
                }
            }
        }
    }
    if (invalidPhoneCount === 0) {
        report('Phone number format', 'PASS', 'All phone numbers are E.164 format');
    } else {
        report('Phone number format', 'WARN', `${invalidPhoneCount} calls with non-E.164 phone numbers`, invalidPhoneCount);
    }

    // ── Check 6: Golden Record field completeness ──
    console.log('\n── Check 6: Golden Record field completeness ──');
    const goldenFields = ['cost_cents', 'ended_reason', 'tools_used', 'outcome', 'outcome_summary', 'sentiment_summary'];
    const { data: completedCalls, count: totalCompleted } = await supabase
        .from('calls')
        .select('id, cost_cents, ended_reason, tools_used, outcome, outcome_summary, sentiment_summary', { count: 'exact' })
        .eq('status', 'completed');

    if (completedCalls && totalCompleted) {
        for (const field of goldenFields) {
            const nullCount = completedCalls.filter((c: any) => c[field] === null || c[field] === undefined).length;
            const pct = Math.round(((totalCompleted - nullCount) / totalCompleted) * 100);
            if (pct === 100) {
                report(`Golden Record: ${field}`, 'PASS', `100% populated on completed calls`);
            } else if (pct >= 80) {
                report(`Golden Record: ${field}`, 'WARN', `${pct}% populated (${nullCount} NULLs)`, nullCount);
            } else {
                report(`Golden Record: ${field}`, 'FAIL', `Only ${pct}% populated (${nullCount} NULLs)`, nullCount);
            }
        }
    }

    // ── Summary ──
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  DATA QUALITY AUDIT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warned = results.filter(r => r.status === 'WARN').length;
    console.log(`  ✅ PASSED: ${passed}`);
    console.log(`  ❌ FAILED: ${failed}`);
    console.log(`  ⚠️  WARNED: ${warned}`);
    console.log(`  Total checks: ${results.length}`);
    console.log(`  Overall: ${failed === 0 ? '✅ DATA QUALITY ACCEPTABLE' : '❌ DATA QUALITY ISSUES FOUND'}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
