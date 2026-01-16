import { supabaseAdmin, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './db';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

export interface TestUser {
    id: string;
    email: string;
    password: string;
    orgId: string;
    token: string;
}

export const TEST_PASSWORD = 'password123';

/**
 * Creates a complete test environment:
 * 1. Creates a new Organization
 * 2. Creates a new Auth User with org_id in app_metadata
 * 3. Signs in to get the JWT
 */
export async function setupTestUser(role: 'admin' | 'agent' | 'viewer' = 'admin'): Promise<TestUser> {
    const uniqueId = randomUUID().substring(0, 8);
    const email = `test-${uniqueId}@voxanne.test`;
    const orgName = `Test Org ${uniqueId}`;

    // 1. Create Organization
    const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
            name: orgName,
            email: email, // Required by DB constraint
        })
        .select()
        .single();

    if (orgError) throw new Error(`Failed to create org: ${orgError.message}`);
    const orgId = org.id;

    // 2. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: TEST_PASSWORD,
        email_confirm: true,
        app_metadata: {
            org_id: orgId
        },
        user_metadata: {
            role: role // Assuming role is stored here or handled by triggers
        }
    });

    if (authError) throw new Error(`Failed to create user: ${authError.message}`);
    if (!authData.user) throw new Error('User data missing');

    const userId = authData.user.id;

    // 3. Ensure User is in 'profiles' (if trigger didn't catch it or for robustness)
    // Checking if profile exists
    const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).single();

    if (!profile) {
        // Manually insert if trigger failed or doesn't exist for test env
        await supabaseAdmin.from('profiles').insert({
            id: userId,
            email: email,
            org_id: orgId,
            role: role
        });
    } else {
        // Update org_id if needed
        await supabaseAdmin.from('profiles').update({ org_id: orgId, role: role }).eq('id', userId);
    }

    // 4. Create Role entry if using 'user_org_roles' table (seen in middleware/auth.ts)
    // The middleware checks 'user_org_roles'
    const { error: roleError } = await supabaseAdmin.from('user_org_roles').insert({
        user_id: userId,
        org_id: orgId,
        role: role
    });
    // Ignore error if it's duplicate (trigger might have created it)
    if (roleError && !roleError.message.includes('duplicate')) {
        // Log warning?
    }

    // 5. Sign In to get Token (Use a fresh client to avoid dirtying supabaseAdmin session)
    const tempClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
        email,
        password: TEST_PASSWORD
    });

    if (signInError) throw new Error(`Failed to sign in: ${signInError.message}`);
    if (!signInData.session) throw new Error('No session returned');

    return {
        id: userId,
        email,
        password: TEST_PASSWORD,
        orgId,
        token: signInData.session.access_token
    };
}

/**
 * Clean up test user and org
 */
export async function teardownTestUser(testUser: TestUser) {
    if (!testUser) return;

    // Delete Auth User (Cascades often handle profiles, but safe to check)
    await supabaseAdmin.auth.admin.deleteUser(testUser.id);

    // Delete Organization
    await supabaseAdmin.from('organizations').delete().eq('id', testUser.orgId);
}
