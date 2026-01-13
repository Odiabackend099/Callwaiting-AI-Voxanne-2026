
import { config } from 'dotenv';
import path from 'path';

// Force load env from backend root
config({ path: path.join(__dirname, '../../.env') });

import { supabase } from '../services/supabase-client';

async function seed() {
    console.log('🌱 Seeding QA Data...');

    // 1. Create Org
    const { data: existingOrgs, error: orgCheckError } = await supabase.from('organizations').select('id, name').limit(1);

    if (orgCheckError) {
        console.error('Error checking orgs:', orgCheckError);
        process.exit(1);
    }

    let orgId;

    if (existingOrgs && existingOrgs.length > 0) {
        orgId = existingOrgs[0].id;
        console.log(`Using existing Org: ${existingOrgs[0].name} (${orgId})`);
    } else {
        console.log('Creating QA Org...');
        const { data: newOrg, error } = await supabase.from('organizations').insert({
            name: 'QA Audit Labs',
            email: 'qa@example.com'
        }).select().single();

        if (error) {
            console.error('Failed to create org:', error);
            process.exit(1);
        }
        orgId = newOrg.id;
        console.log('Created Org:', orgId);
    }

    // 2. Create Agent
    const { data: existingAgent } = await supabase.from('agents').select('id, vapi_assistant_id').eq('org_id', orgId).limit(1);

    if (existingAgent && existingAgent.length > 0) {
        console.log(`Using existing Agent: ${existingAgent[0].id} (${existingAgent[0].vapi_assistant_id})`);
    } else {
        console.log('Creating QA Agent...');
        const { data: newAgent, error } = await supabase.from('agents').insert({
            org_id: orgId,
            name: 'QA Bot',
            vapi_assistant_id: 'qa-mock-assistant-id',
            system_prompt: 'You are a helpful assistant.',
            active: true,
            role: 'assistant'
        }).select().single();
        if (error) {
            console.error('Failed to create agent:', error);
        } else {
            console.log('Created Agent:', newAgent.id);
        }
    }

    console.log('✅ Seed Complete');
}

seed();
