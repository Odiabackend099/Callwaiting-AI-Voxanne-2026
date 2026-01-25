import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VAPI_BASE_URL = 'https://api.vapi.ai';
// Sanitize API Key
const VAPI_API_KEY = (process.env.VAPI_PRIVATE_KEY || '').replace(/[\r\n\t\x00-\x1F\x7F]/g, '').replace(/^['"]|['"]$/g, '');
const AUTH_HEADER = { 'Authorization': `Bearer ${VAPI_API_KEY}` };
const TARGET_ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function main() {
    console.log('🔗 STARTING ROBUST TOOL LINKING...');

    // 1. Get Assistant ID from Database
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // CORRECTED: Use vapi_assistant_id instead of vapi_assistant_id_inbound
    const { data: agent } = await supabase
        .from('agents')
        .select('vapi_assistant_id')
        .eq('org_id', TARGET_ORG_ID)
        .single();

    if (!agent?.vapi_assistant_id) {
        console.error('❌ Could not find Assistant ID in Supabase.');
        process.exit(1);
    }
    const ASSISTANT_ID = agent.vapi_assistant_id;
    console.log(`🎯 Target Assistant: ${ASSISTANT_ID}`);

    try {
        // 2. Fetch All Tools (to find the IDs of our new function tools)
        console.log('🔍 Fetching all tools...');
        const toolsResp = await axios.get(`${VAPI_BASE_URL}/tool`, { headers: AUTH_HEADER });
        const allTools = toolsResp.data;

        // Filter for our specific function tools
        const targetToolNames = [
            'checkAvailability',
            'bookClinicAppointment',
            'sendLiveSMS',
            'queryKnowledgeBase'
        ];

        const validToolIds = allTools
            .filter((t: any) => targetToolNames.includes(t.function?.name))
            .map((t: any) => t.id);

        console.log(`✅ Found ${validToolIds.length} valid function tools to link.`);
        console.log('   Tools:', allTools.filter((t: any) => targetToolNames.includes(t.function?.name)).map((t: any) => t.function?.name).join(', '));

        if (validToolIds.length === 0) {
            console.error('❌ No valid tools found! Run the registration script first.');
            process.exit(1);
        }

        // 3. Fetch Current Assistant Configuration (CRITICAL STEP)
        console.log('📥 Fetching current assistant config...');
        const assistantResp = await axios.get(
            `${VAPI_BASE_URL}/assistant/${ASSISTANT_ID}`,
            { headers: AUTH_HEADER }
        );
        const currentAssistant = assistantResp.data;

        // 4. Merge Tools into Existing Model
        // We strictly preserve the existing provider, model, voice, etc.
        const updatedModel = {
            ...currentAssistant.model, // Keep provider, temperature, etc.
            toolIds: validToolIds      // OVERWRITE tools with our clean list
        };

        // 5. Send the Update
        console.log('🚀 Sending Full PATCH update...');
        const patchPayload = {
            model: updatedModel,
            // We can optionally include other top-level fields if needed, 
            // but 'model' is usually where the validation gets strict.
        };

        await axios.patch(
            `${VAPI_BASE_URL}/assistant/${ASSISTANT_ID}`,
            patchPayload,
            { headers: AUTH_HEADER }
        );

        console.log('✅ SUCCESS! Tools linked automatically.');
        console.log('📋 Linked Tool IDs:', validToolIds);

    } catch (error: any) {
        console.error('❌ LINKING FAILED');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

main();
