import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const VAPI_KEY = process.env.VAPI_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !VAPI_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkLatestAgent() {
    console.log('\n🔎 Finding most recently updated agent...');

    // Get latest updated agent
    const { data: agents, error } = await supabase
        .from('agents')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (error || !agents || agents.length === 0) {
        console.error("❌ No agents found or DB error:", error?.message);
        return;
    }

    const agent = agents[0];
    console.log(`✅ Found Agent: "${agent.name}"`);
    console.log(`   ID: ${agent.id}`);
    console.log(`   Vapi ID: ${agent.vapi_assistant_id}`);
    console.log(`   Updated At: ${agent.updated_at}`);

    if (!agent.vapi_assistant_id) {
        console.error("❌ Agent has no Vapi ID synced!");
        return;
    }

    // Fetch from Vapi
    console.log(`\n🌍 Fetching Vapi Configuration for ${agent.vapi_assistant_id}...`);
    try {
        const res = await fetch(`https://api.vapi.ai/assistant/${agent.vapi_assistant_id}`, {
            headers: {
                'Authorization': `Bearer ${VAPI_KEY}`
            }
        });

        if (!res.ok) {
            console.error(`❌ Vapi API Error: ${res.status} ${res.statusText}`);
            return;
        }

        const vapiAgent = await res.json();
        const tools = (vapiAgent.model?.toolIds || []).length > 0 ?
            ['Has toolIds ref'] :
            (vapiAgent.model?.tools || vapiAgent.tools || []); // Check legacy and new paths

        // Note: If using toolIds, we need to fetch the tools separately or trust they exist.
        // My fix was sending `tools` array directly in some places or `toolIds`. 
        // Let's see what Vapi returns. Vapi GET /assistant usually returns hydrated tools or just IDs depending on expansion.
        // If it returns IDs, we can't easily verify content without fetching tools.

        console.log("   Tool Configuration:");

        // If it uses toolIds, let's fetch those tools
        if (vapiAgent.model?.toolIds && vapiAgent.model.toolIds.length > 0) {
            console.log(`   - Uses toolIds: ${JSON.stringify(vapiAgent.model.toolIds)}`);
            for (const tId of vapiAgent.model.toolIds) {
                const tRes = await fetch(`https://api.vapi.ai/tool/${tId}`, {
                    headers: { 'Authorization': `Bearer ${VAPI_KEY}` }
                });
                if (tRes.ok) {
                    const tData = await tRes.json();
                    console.log(`     - Tool [${tData.type}]: ${tData.function?.name || tData.type} (ID: ${tData.id})`);
                    if (tData.type === 'query') {
                        console.log("       ✅ KB Query Tool Found!");
                        if (tData.messages) {
                            console.log("       ✅ Messages Configured:", JSON.stringify(tData.messages).substring(0, 100) + "...");
                        } else {
                            console.warn("       ⚠️ Messages missing in tool config");
                        }
                    }
                }
            }
        } else {
            console.log("   - Uses embedded tools array (Legacy/Hybrid):");
            const toolsList = vapiAgent.tools || [];
            toolsList.forEach((t: any) => {
                console.log(`     - Tool [${t.type}]: ${t.function?.name || t.name}`);
                if (t.type === 'query') console.log("       ✅ KB Query Tool Present");
            });
        }

    } catch (e: any) {
        console.error("Exception:", e.message);
    }
}

checkLatestAgent();
