/**
 * Verify that all demo accounts are fully and consistently provisioned:
 *   - Supabase Auth user exists
 *   - app_metadata.org_id is set and is a valid UUID
 *   - profiles row exists with matching org_id
 *   - organizations row exists and is active
 *
 * Run this before any end-to-end test session to catch provisioning drift.
 * Exit code 0 = all healthy.  Exit code 1 = at least one account broken.
 *
 * Usage:  cd backend && npm run verify:demo
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEMO_ACCOUNTS = [
    'test@demo.com',
    'peter@demo.com',
];

interface CheckResult {
    email: string;
    ok: boolean;
    issues: string[];
    orgId?: string;
}

async function checkAccount(email: string, allAuthUsers: any[]): Promise<CheckResult> {
    const issues: string[] = [];

    // 1. Auth user exists
    const authUser = allAuthUsers.find(u => u.email === email);
    if (!authUser) {
        return { email, ok: false, issues: [`No Supabase Auth user found for ${email}`] };
    }

    // 2. app_metadata.org_id exists and is a valid UUID
    const orgId: string | undefined = authUser.app_metadata?.org_id;
    if (!orgId) {
        issues.push('app_metadata.org_id is missing — dashboard will show "Organization Not Found"');
    } else if (!UUID_REGEX.test(orgId)) {
        issues.push(`app_metadata.org_id is not a valid UUID: "${orgId}"`);
    }

    // 3. profiles row exists with matching org_id
    const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', authUser.id)
        .maybeSingle();

    if (!profile) {
        issues.push('No profiles row — backend /api/orgs/validate will fail');
    } else if (orgId && profile.org_id !== orgId) {
        issues.push(`profiles.org_id "${profile.org_id}" !== app_metadata.org_id "${orgId}"`);
    }

    // 4. organizations row exists and is active (only if we have a valid orgId)
    if (orgId && UUID_REGEX.test(orgId)) {
        const { data: org } = await supabase
            .from('organizations')
            .select('id, name, status')
            .eq('id', orgId)
            .maybeSingle();

        if (!org) {
            issues.push(`Organization "${orgId}" not found in organizations table`);
        } else if (org.status !== 'active') {
            issues.push(`Organization "${org.name}" has status "${org.status}" (expected "active")`);
        }
    }

    return { email, ok: issues.length === 0, issues, orgId };
}

async function run() {
    console.log('─────────────────────────────────────────────');
    console.log('  verify:demo — checking demo accounts');
    console.log('─────────────────────────────────────────────\n');

    // Fetch all auth users once (avoids N separate API calls)
    const { data: { users: allUsers }, error: listErr } =
        await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) { console.error('❌ Failed to list auth users:', listErr.message); process.exit(1); }

    const results: CheckResult[] = [];
    for (const email of DEMO_ACCOUNTS) {
        const result = await checkAccount(email, allUsers);
        results.push(result);
    }

    // Report
    let anyFailed = false;
    for (const r of results) {
        if (r.ok) {
            console.log(`✅  ${r.email}  (org: ${r.orgId})`);
        } else {
            anyFailed = true;
            console.log(`❌  ${r.email}`);
            for (const issue of r.issues) {
                console.log(`       • ${issue}`);
            }
        }
    }

    console.log();
    if (anyFailed) {
        console.log('  ❌ One or more demo accounts are broken.');
        console.log('     Run: npm run seed:demo  to repair peter@demo.com\n');
        process.exit(1);
    } else {
        console.log('  ✅ All demo accounts are healthy.\n');
        process.exit(0);
    }
}

run().catch(err => {
    console.error('❌ Unhandled error:', err);
    process.exit(1);
});
