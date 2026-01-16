#!/usr/bin/env node

/**
 * Link VAPI Assistant to Database
 * 
 * This script updates the agents table with the correct vapi_assistant_id
 * for the user's organization
 */

const { createClient } = require('@supabase/supabase-client');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
});

const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

// Most recent "CallWaiting AI Inbound" assistant from VAPI API
const VAPI_ASSISTANT_ID = '95016f72-5882-45d2-8df6-f3c91f8d3f0d';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: Supabase credentials not found');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function linkAssistant() {
    try {
        console.log('Linking VAPI assistant to database...\n');
        console.log(`Organization ID: ${ORG_ID}`);
        console.log(`VAPI Assistant ID: ${VAPI_ASSISTANT_ID}\n`);

        // Update the inbound agent
        const { data, error } = await supabase
            .from('agents')
            .update({ vapi_assistant_id: VAPI_ASSISTANT_ID })
            .eq('org_id', ORG_ID)
            .eq('role', 'inbound')
            .eq('name', 'CallWaiting AI Inbound')
            .select();

        if (error) {
            console.error('Error updating agent:', error.message);
            process.exit(1);
        }

        if (!data || data.length === 0) {
            console.error('No agent found to update. Check org_id and agent name.');
            process.exit(1);
        }

        console.log('✅ Successfully linked VAPI assistant to database!');
        console.log('\nUpdated agent:');
        console.log(JSON.stringify(data[0], null, 2));

        // Verify the update
        const { data: verifyData, error: verifyError } = await supabase
            .from('agents')
            .select('id, name, role, vapi_assistant_id')
            .eq('org_id', ORG_ID);

        if (verifyError) {
            console.error('Error verifying update:', verifyError.message);
            process.exit(1);
        }

        console.log('\n✅ Verification - All agents for this organization:');
        verifyData.forEach(agent => {
            console.log(`  - ${agent.name} (${agent.role}): ${agent.vapi_assistant_id || 'NULL'}`);
        });

    } catch (error) {
        console.error('Unexpected error:', error.message);
        process.exit(1);
    }
}

linkAssistant();
