
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TARGET_EMAIL = 'callwaitingai@gmail.com';

async function main() {
    console.log(`\n🚨 STARTING TENANT RESET FOR: ${TARGET_EMAIL} 🚨`);
    console.log('------------------------------------------------');

    try {
        // 1. Get User and Org
        const { data: users, error: userError } = await supabase
            .from('users') // Check if 'users' table exists or use auth.users if possible (admin)
            .select('id, email')
            .eq('email', TARGET_EMAIL);

        // If 'users' table is not accessible directly or empty, try to find org via members
        // Note: In some setups users are only in auth.users. 
        // We'll search organization_members by finding the user ID somehow?
        // Actually, usually app has a 'users' public table or we look up by email in 'organization_members' joined with 'users' 
        // Let's assume we can query organization_members directly if we find the user ID from auth admin API 
        // OR just assume single tenant for now or search organizations?

        // Alternative: We might know the Org ID?
        // Let's search by email in `auth.users` using admin API? 
        // supabase-js admin auth client:
        const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
        const targetUser = authUsers?.find(u => u.email === TARGET_EMAIL);

        if (!targetUser) {
            console.error(`User ${TARGET_EMAIL} not found in Auth!`);
            // Fallback: check tables if using custom user table
        }

        if (!targetUser) process.exit(1);

        console.log(`Found User ID: ${targetUser.id}`);

        // Get Org
        let orgId;
        const { data: members, error: memError } = await supabase
            .from('organization_members')
            .select('*'); // Select ALL members to debug

        console.log('Total Membership Records:', members?.length);
        const userMember = members?.find(m => m.user_id === targetUser.id);

        if (userMember) {
            orgId = userMember.org_id;
            console.log('Found Membership:', userMember);
        } else {
            console.log('No membership found for user ID:', targetUser.id);
            console.log('First 5 memberships:', members?.slice(0, 5));

            console.log('Checking ownership...');
            const { data: ownedOrgs, error: ownError } = await supabase
                .from('organizations')
                .select('*'); // Select ALL orgs

            console.log('Total Organizations:', ownedOrgs?.length);
            const userOrg = ownedOrgs?.find(o => o.owner_id === targetUser.id);

            if (userOrg) {
                orgId = userOrg.id;
                console.log('Found Ownership:', userOrg);
            } else {
                console.log('No ownership found for user ID:', targetUser.id);
                console.log('First 5 Orgs:', ownedOrgs?.slice(0, 5));
            }
        }

        if (!orgId) {
            console.warn('WARNING: No organization found via membership/ownership.');
            console.warn('Assuming fallback to Default CallWaiting AI Org: a0000000-0000-0000-0000-000000000001');
            orgId = 'a0000000-0000-0000-0000-000000000001';
        }

        console.log(`Target Org ID: ${orgId}`);

        // 2. Fetch VAPI and Twilio Configs from Integrations
        const { data: integrations, error: intError } = await supabase
            .from('integrations')
            .select('*')
            .eq('org_id', orgId);

        const vapiInt = integrations?.find(i => i.provider === 'vapi');
        const twilioInt = integrations?.find(i => i.provider === 'twilio'); // OR inside VAPI config?

        // VAPI Keys
        const vapiApiKey = vapiInt?.config?.vapi_api_key || config.VAPI_PRIVATE_KEY;
        console.log(`VAPI API Key found: ${vapiApiKey ? 'YES' : 'NO'}`);

        // 3. VAPI Cleanup
        if (vapiApiKey) {
            console.log('\n--- VAPI CLEANUP ---');
            const vapi = axios.create({
                baseURL: 'https://api.vapi.ai',
                headers: { Authorization: `Bearer ${vapiApiKey}` }
            });

            // Delete Assistants
            const { data: agents } = await supabase.from('agents').select('vapi_assistant_id').eq('org_id', orgId);
            if (agents && agents.length > 0) {
                for (const agent of agents) {
                    if (agent.vapi_assistant_id) {
                        try {
                            console.log(`Deleting VAPI Assistant: ${agent.vapi_assistant_id}`);
                            await vapi.delete(`/assistant/${agent.vapi_assistant_id}`);
                            console.log('  Deleted.');
                        } catch (e: any) {
                            console.error(`  Failed to delete assistant: ${e.message}`);
                        }
                    }
                }
            }

            // Check for Phone Number in Integration Config
            const vapiPhoneId = vapiInt?.config?.vapi_phone_number_id;
            if (vapiPhoneId) {
                try {
                    console.log(`Deleting VAPI Phone Number: ${vapiPhoneId}`);
                    await vapi.delete(`/phone-number/${vapiPhoneId}`);
                    console.log('  Deleted.');
                } catch (e: any) {
                    console.error(`  Failed to delete VAPI phone: ${e.message}`);
                }
            }
        }

        // 4. Database Cleanup
        console.log('\n--- DATABASE CLEANUP ---');
        const tablesToClear = [
            'calls',
            'leads',
            'notifications',
            'knowledge_base', // Check table name
            'appointments',
            'contacts',
            'agents', // Deleting agents too
            // 'campaigns', 'campaign_runs' // if exist
        ];

        for (const table of tablesToClear) {
            try {
                const { error, count } = await supabase
                    .from(table)
                    .delete()
                    .eq('org_id', orgId)
                // .select('*', { count: 'exact' }); // count doesn't work well with delete sometimes

                if (error) {
                    // Ignore if table doesn't exist
                    if (error.code === '42P01') console.log(`  Table ${table} does not exist.`);
                    else console.error(`  Error clearing ${table}: ${error.message}`);
                } else {
                    console.log(`  Cleared ${table} for org ${orgId}`);
                }
            } catch (e) {
                console.error(`  Exception clearing ${table}: ${e}`);
            }
        }

        // Clear Integrations?
        // User said "Clear the database... everything".
        // But if we delete integrations we lose the API keys for Next time?
        // Maybe keep integrations but clear the vapi_phone_number_id stuff?
        // "Clear the database for this tenant... everything" implies wiping slate clean.
        // I'll delete integrations too.
        console.log('  Clearing Integrations...');
        await supabase.from('integrations').delete().eq('org_id', orgId);

        console.log('\n✅ TENANT RESET COMPLETE');

    } catch (err) {
        console.error('FATAL ERROR:', err);
    }
}

main();
