
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../../config';

// Create a new isolated client for setup to avoid polluting the global singleton
// used by the application with user session data.
const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
        autoRefreshToken: false,
        persistSession: false // Critical: Do not persist session for this admin client
    }
});

export async function quickSetupTestUser() {
    const testOrgId = randomUUID();
    // We don't generate userId here, it comes from auth.createUser
    const testEmail = `smoke-${Date.now()}@test.com`;
    const testPassword = 'SmokeTest123!';

    try {
        // 1. Create test org (minimal data)
        // Using simple upsert or insert
        const { error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({
                id: testOrgId,
                name: 'Smoke Test Org',
                email: testEmail
                // Add other required fields if any, based on schema
            });

        if (orgError) {
            console.error('Failed to create test org:', orgError);
            throw new Error(`Failed to create test org: ${orgError.message}`);
        }

        // 2. Create test user via Admin API to skip email verification if needed
        // or set email_confirm: true
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true,
            user_metadata: { org_id: testOrgId }
        });

        if (authError || !authData.user) {
            console.error('Failed to create test user:', authError);
            throw new Error(`Failed to create test user: ${authError?.message}`);
        }

        const testUserId = authData.user.id;

        // 3. Generate JWT token (Login)
        const { data: sessionData, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        });

        if (loginError || !sessionData.session) {
            console.error('Failed to login test user:', loginError);
            throw new Error(`Failed to login test user: ${loginError?.message}`);
        }

        return {
            token: sessionData.session.access_token,
            orgId: testOrgId,
            userId: testUserId,
            email: testEmail
        };
    } catch (error) {
        // Attempt cleanup if something failed partially
        console.error('Setup failed, attempting cleanup...');
        try {
            await supabaseAdmin.from('organizations').delete().eq('id', testOrgId);
            // Note: User cleanup might fail if user wasn't created
        } catch (cleanupError) {
            console.error('Cleanup during setup failure failed:', cleanupError);
        }
        throw error;
    }
}

export async function quickCleanup(userId: string, orgId: string) {
    if (!orgId) return;

    // Delete in reverse order of dependencies
    // These table names should match your schema.
    // Using try-catch to ignore errors if tables don't exist or are empty
    try { await supabaseAdmin.from('bookings').delete().eq('org_id', orgId); } catch { }
    try { await supabaseAdmin.from('agents').delete().eq('org_id', orgId); } catch { }
    try { await supabaseAdmin.from('calls').delete().eq('org_id', orgId); } catch { }

    // Finally delete user and org
    if (userId) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    await supabaseAdmin.from('organizations').delete().eq('id', orgId);
}
