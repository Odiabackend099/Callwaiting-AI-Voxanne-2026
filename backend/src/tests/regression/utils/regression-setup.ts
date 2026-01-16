import { createClient } from '@supabase/supabase-js';
import { config } from '../../../config';
import { randomUUID } from 'crypto';

// Initialize isolated admin client
const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export interface RegressionTestContext {
    // Client
    supabaseAdmin: ReturnType<typeof createClient>;

    // Users & Auth
    adminUser: { id: string; email: string };
    regularUser: { id: string; email: string };
    agentUser: { id: string; email: string };
    org2User: { id: string; email: string }; // New

    // Organizations
    orgId: string;
    // otherOrgId is used in the interface
    otherOrgId: string;

    // Resources
    testAgentId: string;
    testSlotId: string;
    testBookingId: string;
    testCallId: string;

    // Tokens
    adminToken: string;
    userToken: string;
    agentToken: string;
    org2Token: string; // New
}

export async function setupRegressionEnvironment(): Promise<RegressionTestContext> {
    const context: Partial<RegressionTestContext> = {
        supabaseAdmin
    };

    // 1. Create Test Organizations
    const org1Id = randomUUID();
    const org2Id = randomUUID();

    const { error: orgError } = await supabaseAdmin.from('organizations').insert([
        { id: org1Id, name: 'Regression Org 1', email: `org1-${Date.now()}@test.com` },
        { id: org2Id, name: 'Regression Org 2', email: `org2-${Date.now()}@test.com` }
    ]);
    if (orgError) console.error('Organization creation failed:', orgError);

    context.orgId = org1Id;
    context.otherOrgId = org2Id;

    // 2. Create Test Users (Admin, Regular, Agent)
    const timestamp = Date.now();
    const adminEmail = `reg-admin-${timestamp}@test.com`;
    const userEmail = `reg-user-${timestamp}@test.com`;
    const agentEmail = `reg-agent-${timestamp}@test.com`;
    const password = 'RegressionTest123!';

    // Helper to create user
    const createUser = async (email: string, role: 'admin' | 'user' | 'agent') => {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { org_id: org1Id },
            app_metadata: { org_id: org1Id, role } // Ensure org_id is in app_metadata too
        });
        if (error) {
            console.error(`Failed to create user ${email}:`, error);
            throw error;
        }

        // Assign role if needed (manually inserting into user_org_roles if that table exists,
        // OR relying on metadata if that's how the app works.
        // Based on audit, app checks `user_org_roles` table in middleware)
        if (data.user) {
            // Best effort role assignment
            const { error: roleError } = await supabaseAdmin.from('user_org_roles').insert({
                user_id: data.user.id,
                org_id: org1Id,
                role: role === 'user' ? 'viewer' : role // Mapping 'user' to 'viewer' or similar if needed
            });
            if (roleError) {
                // Ignore for now, relying on metadata for some checks
                // console.error('Role assignment failed:', roleError);
            }
        }
        return data.user;
    };

    const adminUser = await createUser(adminEmail, 'admin');
    const regularUser = await createUser(userEmail, 'user');
    const agentUser = await createUser(agentEmail, 'agent');

    // Create Org 2 User
    const org2UserEmail = `reg-org2-${timestamp}@test.com`;
    const { data: org2UserData, error: org2UserError } = await supabaseAdmin.auth.admin.createUser({
        email: org2UserEmail,
        password,
        email_confirm: true,
        user_metadata: { org_id: org2Id },
        app_metadata: { org_id: org2Id, role: 'admin' }
    });
    if (org2UserError) console.error('Org 2 User creation failed:', org2UserError);

    context.adminUser = { id: adminUser!.id, email: adminEmail };
    context.regularUser = { id: regularUser!.id, email: userEmail };
    context.agentUser = { id: agentUser!.id, email: agentEmail };
    context.org2User = { id: org2UserData!.user!.id, email: org2UserEmail };



    // 4. Create Test Agent (Move before token gen to ensure admin access)
    const { data: agent, error: agentError } = await supabaseAdmin.from('agents').insert({
        org_id: org1Id,
        name: 'Regression Test Agent',
        role: 'inbound',
        voice: {
            voiceId: 'default',
            provider: 'vapi'
        },
        system_prompt: 'Test prompt',
        first_message: 'Hello'
    }).select().single();

    if (agentError) {
        console.error('Agent creation failed:', agentError);
    }
    context.testAgentId = agent?.id;

    // 5. Create Test Calendar Slot
    try {
        const { data: slot } = await supabaseAdmin.from('calendar_slots').insert({
            org_id: org1Id,
            agent_id: agent?.id,
            start_time: new Date(Date.now() + 86400000).toISOString(),
            end_time: new Date(Date.now() + 86400000 + 1800000).toISOString(),
            status: 'available'
        }).select().single();
        context.testSlotId = slot?.id;
    } catch (e) { console.log('Skipping calendar_slots setup'); }

    // 6. Create Test Booking
    try {
        const { data: booking } = await supabaseAdmin.from('appointments').insert({
            org_id: org1Id,
            serviceType: 'Test Service',
            scheduledAt: new Date(Date.now() + 172800000).toISOString(),
            status: 'confirmed'
        }).select().single();
        context.testBookingId = booking?.id;
    } catch (e) { console.log('Skipping appointments setup'); }

    // 3. Generate Auth Tokens (Moved to end to avoid polluting admin client session)
    const getToken = async (email: string) => {
        // We create a new client to avoid persisting session on the admin client, 
        // OR just acknowledge that this mutates supabaseAdmin.
        // Since this is the last step, mutating supabaseAdmin is fine.
        const { data } = await supabaseAdmin.auth.signInWithPassword({ email, password });
        return data.session?.access_token;
    };

    context.adminToken = await getToken(adminEmail) || '';
    context.userToken = await getToken(userEmail) || '';
    context.agentToken = await getToken(agentEmail) || '';
    context.org2Token = await getToken(org2UserEmail) || '';


    return context as RegressionTestContext;
}

export async function cleanupRegressionEnvironment(context: RegressionTestContext) {
    if (!context.orgId) return;

    const cleanup = async () => {
        // Delete in reverse order of dependencies
        try { await supabaseAdmin.from('calls').delete().eq('org_id', context.orgId); } catch { }
        try { await supabaseAdmin.from('appointments').delete().eq('org_id', context.orgId); } catch { }
        try { await supabaseAdmin.from('bookings').delete().eq('org_id', context.orgId); } catch { } // Legacy table?
        try { await supabaseAdmin.from('calendar_slots').delete().eq('org_id', context.orgId); } catch { }
        try { await supabaseAdmin.from('agents').delete().eq('org_id', context.orgId); } catch { }

        // Users
        if (context.adminUser) await supabaseAdmin.auth.admin.deleteUser(context.adminUser.id);
        if (context.regularUser) await supabaseAdmin.auth.admin.deleteUser(context.regularUser.id);
        if (context.agentUser) await supabaseAdmin.auth.admin.deleteUser(context.agentUser.id);

        // Orgs
        await supabaseAdmin.from('organizations').delete().eq('id', context.orgId);
        await supabaseAdmin.from('organizations').delete().eq('id', context.otherOrgId);
    };

    await cleanup().catch(err => console.error('Regression Setup Cleanup Failed:', err));
}
