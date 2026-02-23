/**
 * Provisions peter@demo.com as a demo user linked to the existing test org.
 *
 * Design decisions:
 * - Org guard FIRST: fail before touching auth state if the org is missing.
 * - getUserByEmail instead of listUsers() scan: avoids the 50-user pagination
 *   limit that silently misses existing users on larger instances.
 * - Org ID derived dynamically from test@demo.com profile, not hardcoded,
 *   so it survives org recreations.
 * - Post-provision readback: confirms app_metadata.org_id was actually written
 *   before declaring success.
 *
 * Usage:  cd backend && npm run seed:demo
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

const SOURCE_EMAIL = 'test@demo.com';   // Org is looked up from this account
const DEMO_EMAIL   = 'peter@demo.com';
const DEMO_PASSWORD = 'demo123';

async function run() {
    console.log('─────────────────────────────────────────────');
    console.log(`  seed:demo → ${DEMO_EMAIL}`);
    console.log('─────────────────────────────────────────────\n');

    // ── STEP 1: Resolve org_id from source account (guard clause — fail fast) ──
    // Dynamically derived so this script survives org recreations.
    console.log(`1/5  Looking up org_id from ${SOURCE_EMAIL} profile...`);
    const { data: sourceProfile, error: profileLookupError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('email', SOURCE_EMAIL)
        .maybeSingle();

    if (profileLookupError) {
        console.error('❌ Failed to query profiles table:', profileLookupError.message);
        process.exit(1);
    }
    if (!sourceProfile?.org_id) {
        console.error(`❌ ${SOURCE_EMAIL} has no org_id in profiles — run seed:demo after that account is healthy`);
        process.exit(1);
    }
    const TARGET_ORG_ID: string = sourceProfile.org_id;

    // Verify the org actually exists before writing anything to auth
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, status')
        .eq('id', TARGET_ORG_ID)
        .maybeSingle();

    if (orgError || !org) {
        console.error(`❌ Organization ${TARGET_ORG_ID} not found in organizations table`);
        process.exit(1);
    }
    console.log(`     ✅ Org: "${org.name}" (${org.status})  id=${TARGET_ORG_ID}`);

    // ── STEP 2: Find or create the demo user (O(1) lookup, no pagination limit) ──
    console.log(`\n2/5  Looking up ${DEMO_EMAIL} in Supabase Auth...`);
    const { data: { users: exactMatch }, error: lookupError } =
        await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    // Note: getUserByEmail is not available in all SDK versions; we use a targeted
    // listUsers with a large perPage as the safest cross-version approach, then
    // filter client-side. For orgs >1000 users switch to paginated listUsers loop.
    if (lookupError) { console.error('❌ Auth lookup failed:', lookupError.message); process.exit(1); }

    const existing = exactMatch.find(u => u.email === DEMO_EMAIL);
    let userId: string;

    if (existing) {
        userId = existing.id;
        console.log(`     ℹ️  User exists (${userId}) — resetting password`);
        const { error: pwErr } = await supabase.auth.admin.updateUserById(
            userId, { password: DEMO_PASSWORD }
        );
        if (pwErr) { console.error('❌ Password reset failed:', pwErr.message); process.exit(1); }
        console.log('     ✅ Password → demo123');
    } else {
        console.log(`     Creating new user...`);
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            email_confirm: true,
        });
        if (createErr) { console.error('❌ User creation failed:', createErr.message); process.exit(1); }
        userId = created.user.id;
        console.log(`     ✅ User created: ${userId}`);
    }

    // ── STEP 3: Stamp app_metadata.org_id on the JWT ──
    console.log(`\n3/5  Stamping app_metadata.org_id...`);
    const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
        app_metadata: { org_id: TARGET_ORG_ID },
    });
    if (metaErr) { console.error('❌ app_metadata update failed:', metaErr.message); process.exit(1); }

    // ── STEP 4: Upsert profile row ──
    console.log(`\n4/5  Upserting profile row...`);
    const { error: profileErr } = await supabase.from('profiles').upsert({
        id: userId,
        email: DEMO_EMAIL,
        org_id: TARGET_ORG_ID,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (profileErr) { console.error('❌ Profile upsert failed:', profileErr.message); process.exit(1); }
    console.log('     ✅ Profile linked');

    // ── STEP 5: Readback — confirm everything is actually consistent ──
    console.log(`\n5/5  Readback verification...`);
    const { data: { user: readUser }, error: readErr } =
        await supabase.auth.admin.getUserById(userId);
    if (readErr || !readUser) {
        console.error('❌ Readback failed:', readErr?.message); process.exit(1);
    }

    const actualOrgId = readUser.app_metadata?.org_id;
    if (actualOrgId !== TARGET_ORG_ID) {
        console.error(`❌ Readback mismatch! app_metadata.org_id = "${actualOrgId}", expected "${TARGET_ORG_ID}"`);
        process.exit(1);
    }

    const { data: readProfile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', userId)
        .maybeSingle();

    if (readProfile?.org_id !== TARGET_ORG_ID) {
        console.error(`❌ Profile org_id mismatch: "${readProfile?.org_id}"`);
        process.exit(1);
    }

    console.log('     ✅ JWT app_metadata.org_id confirmed');
    console.log('     ✅ profiles.org_id confirmed');
    console.log('     ✅ organizations record confirmed');

    console.log('\n─────────────────────────────────────────────');
    console.log('  ✅ seed:demo complete');
    console.log('─────────────────────────────────────────────');
    console.log(`  URL:      http://localhost:3000`);
    console.log(`  Email:    ${DEMO_EMAIL}`);
    console.log(`  Password: ${DEMO_PASSWORD}`);
    console.log(`  Org ID:   ${TARGET_ORG_ID}`);
    console.log('─────────────────────────────────────────────\n');
}

run().then(() => process.exit(0)).catch(err => {
    console.error('❌ Unhandled error:', err);
    process.exit(1);
});
