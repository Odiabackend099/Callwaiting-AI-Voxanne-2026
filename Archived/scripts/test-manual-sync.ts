import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const BACKEND_URL = 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testAssistantSync() {
    console.log('\n🧪 Manual Sync Test\n');

    // Get the latest agent
    const { data: agents } = await supabase
        .from('agents')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (!agents || agents.length === 0) {
        console.error("❌ No agents found");
        return;
    }

    const agent = agents[0];
    console.log(`Testing with Agent: "${agent.name}" (ID: ${agent.id})`);
    console.log(`Current Vapi ID: ${agent.vapi_assistant_id || 'NULL'}\n`);

    // Get user token (simulate auth)
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: 'callwaitingai@gmail.com',
        password: 'tempPassword123!' // This might not work, but trying
    });

    if (authError) {
        console.error("❌ Auth failed:", authError.message);
        console.log("   Attempting without auth (might fail)...\n");
    }

    const token = user?.access_token || '';

    // Call the sync endpoint
    console.log(`POST ${BACKEND_URL}/api/founder-console/agent/behavior`);
    console.log(`Agent ID: ${agent.id}\n`);

    try {
        const res = await fetch(`${BACKEND_URL}/api/founder-console/agent/behavior`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                agentId: agent.id
            })
        });

        console.log(`Response Status: ${res.status} ${res.statusText}`);

        const responseText = await res.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            console.log("Response (raw text):", responseText);
            return;
        }

        console.log("Response Data:", JSON.stringify(data, null, 2));

        if (!res.ok) {
            console.error("\n❌ Sync failed");
            return;
        }

        // Re-fetch the agent to see if vapi_assistant_id was updated
        console.log("\n📊 Checking DB after sync...");
        const { data: updatedAgents } = await supabase
            .from('agents')
            .select('vapi_assistant_id')
            .eq('id', agent.id)
            .single();

        if (updatedAgents?.vapi_assistant_id) {
            console.log(`✅ SUCCESS: vapi_assistant_id is now ${updatedAgents.vapi_assistant_id}`);
        } else {
            console.error(`❌ FAIL: vapi_assistant_id is still NULL`);
        }

    } catch (e: any) {
        console.error("Exception:", e.message);
    }
}

testAssistantSync();
