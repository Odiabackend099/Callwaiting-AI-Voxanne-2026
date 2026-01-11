import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const VAPI_KEY = process.env.VAPI_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifySystemPrompt() {
    console.log('\n🔎 Finding test agent...');

    // Get an agent with a Vapi ID
    const { data: agents } = await supabase
        .from('agents')
        .select('*')
        .not('vapi_assistant_id', 'is', null) // Filter for agents WITH Vapi ID
        .limit(1);

    if (!agents || agents.length === 0) {
        console.error("❌ No agents with Vapi ID found.");
        return;
    }

    const agent = agents[0];
    const assistantId = agent.vapi_assistant_id;
    console.log(`✅ Using Agent: "${agent.name}" (ID: ${assistantId})`);

    const testSystemPrompt = `You are Voxanne. This is a TEST SYSTEM PROMPT verified at ${new Date().toISOString()}. Do not forget this.`;

    console.log(`\n📝 Attempting to UPDATE system prompt...`);

    try {
        const res = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${VAPI_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: {
                    messages: [
                        {
                            role: 'system',
                            content: testSystemPrompt
                        }
                    ]
                }
            })
        });

        if (!res.ok) {
            console.error(`❌ Update Failed: ${res.status} ${await res.text()}`);
            return;
        }
        console.log("✅ Update call successful.");

        // Verify by reading it back
        console.log(`\n📖 Reading back configuration...`);
        const readRes = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
            headers: { 'Authorization': `Bearer ${VAPI_KEY}` }
        });
        const data = await readRes.json();

        const retrievedPrompt = data.model?.messages?.find((m: any) => m.role === 'system')?.content;

        console.log("--- Retrieved System Prompt ---");
        console.log(retrievedPrompt);
        console.log("-------------------------------");

        if (retrievedPrompt === testSystemPrompt) {
            console.log("🎉 SUCCESS: System prompt was persisted correctly.");
        } else {
            console.error("❌ FAIL: Retrieved prompt does not match sent prompt.");
        }

    } catch (e: any) {
        console.error("Exception:", e.message);
    }
}

verifySystemPrompt();
