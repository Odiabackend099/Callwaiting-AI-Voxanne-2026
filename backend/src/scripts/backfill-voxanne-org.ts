/**
 * Backfill Script: Create Missing Org and Agent for voxanne@demo.com
 * 
 * This script creates the missing database records for the voxanne@demo.com user
 * and links them to the existing Vapi assistant.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// From user's auth metadata
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';
const USER_ID = '3e037587-8fb2-4159-9fa1-18ba46e9459b';

// From user's Vapi dashboard JSON - the assistant ID we need to link
// Looking at the tool JSON provided, we need to find the actual assistant ID
// For now, we'll create the org and agent, then ask user for the assistant ID
const VAPI_ASSISTANT_ID = process.argv[2]; // Pass as command line argument

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

if (!VAPI_ASSISTANT_ID) {
    console.error('❌ Usage: npm run script backfill-voxanne-org.ts <VAPI_ASSISTANT_ID>');
    console.error('   Please provide the Vapi Assistant ID from your dashboard');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function backfillOrg() {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 Backfilling voxanne@demo.com Organization');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`Org ID: ${ORG_ID}`);
    console.log(`User ID: ${USER_ID}`);
    console.log(`Vapi Assistant ID: ${VAPI_ASSISTANT_ID}`);
    console.log('');

    try {
        // 1. Create Organization
        console.log('📦 Step 1: Creating organization...');
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .upsert({
                id: ORG_ID,
                name: 'Voxanne Demo Clinic',
                email: 'voxanne@demo.com',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (orgError) {
            console.error('❌ Failed to create organization:', orgError);
            process.exit(1);
        }

        console.log('✅ Organization created:', org.name);
        console.log('');

        // 2. Create Inbound Agent
        console.log('🤖 Step 2: Creating inbound agent...');
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .insert({
                org_id: ORG_ID,
                role: 'inbound',
                name: 'Voxanne Inbound Agent',
                vapi_assistant_id: VAPI_ASSISTANT_ID,
                system_prompt: 'You are a helpful medical receptionist.',
                first_message: 'Hello! How can I help you today?',
                voice: 'jennifer-playht',
                language: 'en-US',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (agentError) {
            console.error('❌ Failed to create agent:', agentError);
            process.exit(1);
        }

        console.log('✅ Agent created');
        console.log(`   Agent DB ID: ${agent.id}`);
        console.log(`   Vapi Assistant ID: ${agent.vapi_assistant_id}`);
        console.log('');

        // 3. Verification
        console.log('✅ Backfill Complete!');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 Next Step: Run Nuclear Tool Fix');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('Now you can run:');
        console.log('  npx ts-node -r dotenv/config src/scripts/nuclear-tool-fix.ts');
        console.log('');

    } catch (error: any) {
        console.error('💥 Unexpected error:', error.message);
        process.exit(1);
    }
}

backfillOrg();
