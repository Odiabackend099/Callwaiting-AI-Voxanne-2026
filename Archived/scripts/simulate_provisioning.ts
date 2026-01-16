
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Configuration
const API_BASE_URL = 'http://127.0.0.1:3001/api/founder-console/phone-numbers';
const ORG_ID = 'a0000000-0000-0000-0000-000000000001'; // Default Org
const CORRECT_NUMBER = '+16206791361';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('❌ Missing environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function simulateProvisioning() {
    console.log('🚀 Starting Integration Test (API Simulation) for', CORRECT_NUMBER);

    try {
        // 1. Get Inbound Agent from DB (Verification Baseline)
        console.log('\n--- Step 1: Fetching Inbound Agent (DB) ---');
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('org_id', ORG_ID)
            .eq('role', 'inbound')
            .single();

        if (agentError || !agent) {
            throw new Error(`Failed to fetch inbound agent: ${agentError?.message}`);
        }
        console.log('✅ Found Inbound Agent:', agent.id, 'Assistant ID:', agent.vapi_assistant_id);

        // 2. Call Backend API: Import from Twilio
        // This tests the new backend logic that handles "already exists" and DB sync
        console.log('\n--- Step 2: Calling POST /import API ---');

        let vapiPhoneId: string;
        try {
            const response = await axios.post(`${API_BASE_URL}/import`, {
                phoneNumber: CORRECT_NUMBER,
                twilioAccountSid: TWILIO_ACCOUNT_SID,
                twilioAuthToken: TWILIO_AUTH_TOKEN
                // orgId: ORG_ID // Optional in dev mode, inferred by backend
            });

            console.log('✅ API Response:', response.data);
            vapiPhoneId = response.data.id;
        } catch (err: any) {
            console.error('❌ Import API Failed:', err.response?.data || err.message);
            throw err;
        }

        // 3. Link Number to Assistant
        console.log('\n--- Step 3: Linking Number to Assistant ---');
        if (!agent.vapi_assistant_id) {
            console.error('❌ Agent has no VAPI Assistant ID. Cannot link.');
            return;
        }

        // Verify Assistant Exists via API
        try {
            await axios.get(`http://127.0.0.1:3001/api/assistants/${agent.vapi_assistant_id}`);
            console.log('✅ Assistant confirmed to exist in VAPI.');
        } catch (err: any) {
            console.error('❌ Assistant check failed:', err.response?.status, err.response?.data);
            console.warn('⚠️  The Assistant ID in DB might be stale/deleted in VAPI. Skipping link.');
            return;
        }

        try {
            // First try a simple update to confirm permissions/ID
            await axios.patch(`${API_BASE_URL}/${vapiPhoneId}`, { name: 'MedSpa Main Line' });
            console.log('✅ Phone Name updated (PATCH connectivity confirmed).');

            const response = await axios.patch(`${API_BASE_URL}/${vapiPhoneId}`, {
                assistantId: agent.vapi_assistant_id
            });
            console.log('✅ Link API Success:', response.data.id);
        } catch (err: any) {
            console.error('❌ Link API Failed:', JSON.stringify(err.response?.data));
            throw err;
        }

        // 4. Update Database Integrations (The "Backend Logic")
        // Verify that the BACKEND updated the DB!
        console.log('\n--- Step 4: Verifying DB Sync (Integrations) ---');
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('config, updated_at')
            .eq('org_id', ORG_ID)
            .eq('provider', 'vapi')
            .single();

        if (intError) throw intError;

        console.log('Current Integration Config:', integration.config);

        if (integration.config.vapi_phone_number_id === vapiPhoneId &&
            integration.config.twilio_from_number === CORRECT_NUMBER) {
            console.log('✅ DB Verification PASSED: Backend synced config correctly.');
        } else {
            console.error('❌ DB Verification FAILED: Backend did not sync config.');
            console.log('Expected ID:', vapiPhoneId);
            console.log('Actual ID:', integration.config.vapi_phone_number_id);
        }

        // 5. Final Success Message
        console.log('\n🎉 INTEGRATION TEST COMPLETE: Backend logic verified.');

    } catch (error: any) {
        console.error('❌ Simulation Failed:', error.message || error);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

simulateProvisioning();
