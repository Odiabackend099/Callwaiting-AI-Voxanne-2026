import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const VAPI_KEY = process.env.VAPI_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function getEmbedding(text: string) {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return response.data[0].embedding;
}

// ------------------------------------------------------------------
// TEST 1: Direct Retrieval (Supabase)
// ------------------------------------------------------------------
async function verifyDirectRetrieval() {
    console.log('\n==================================================');
    console.log('TEST 1: Direct Knowledge Base Retrieval (Supabase)');
    console.log('==================================================\n');

    const questions = [
        "What is Voxanne?",
        "Does Voxanne work for dental clinics?",
        "What is the average response time?",
        "Can Voxanne handle multiple calls at once?",
        "Is Voxanne HIPAA compliant?",
        "What is the pricing for the Essentials plan?"
    ];

    const orgId = 'a0000000-0000-0000-0000-000000000001';
    let successCount = 0;

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        try {
            const embedding = await getEmbedding(q);
            const { data, error } = await supabase.rpc('match_knowledge_chunks', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: 5,
                p_org_id: orgId
            });

            if (error) {
                console.error(`[${i + 1}] ❌ Error: ${error.message}`);
                continue;
            }

            if (data && data.length > 0) {
                successCount++;
                process.stdout.write('✅ ');
            } else {
                process.stdout.write('❌ ');
            }
        } catch (err: any) {
            console.error(`[${i + 1}] ❌ Exception: ${err.message}`);
        }
    }
    console.log(`\n\nResults: ${successCount}/${questions.length} success.`);
}

// ------------------------------------------------------------------
// TEST 2: Vapi Assistant Sync (Guaranteed Solution)
// ------------------------------------------------------------------
async function verifyVapiSync() {
    console.log('\n==================================================');
    console.log('TEST 2: Vapi Assistant Sync (Tool Creation & Assignment)');
    console.log('==================================================\n');

    if (!VAPI_KEY) {
        console.error("❌ VAPI_API_KEY missing.");
        return;
    }

    // 1. Create the Query Tool first
    console.log("1. Creating Vapi Query Tool...");
    let toolId = '';
    try {
        const toolPayload = {
            type: 'query',
            function: { name: 'knowledge_base' },
            knowledgeBases: [
                {
                    provider: 'google', // Mock
                    name: 'callwaitingai-master-kb',
                    description: 'Main Knowledge Base for Voxanne', // FIXED: Added description
                    fileIds: []
                }
            ],
            // FIXED: Messages is an ARRAY of objects with TYPE
            messages: [
                {
                    type: 'request-start',
                    content: 'Checking my notes...'
                },
                {
                    type: 'request-start',
                    content: 'One moment please...'
                },
                {
                    type: 'request-complete',
                    content: 'Here is what I found.'
                },
                {
                    type: 'request-failed',
                    content: 'I could not find that info.'
                }
            ]
        };

        // console.log("Payload:", JSON.stringify(toolPayload, null, 2));

        const toolRes = await fetch('https://api.vapi.ai/tool', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VAPI_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(toolPayload)
        });

        if (!toolRes.ok) {
            const err = await toolRes.text();
            console.error(`❌ Tool Creation Failed: ${toolRes.status} ${err}`);
            return;
        }

        const toolData = await toolRes.json();
        toolId = toolData.id;
        console.log(`✅ Tool Created! ID: ${toolId}`);

        const startMsg = toolData.messages?.find((m: any) => m.type === 'request-start');
        if (startMsg) {
            console.log("   - Filler messages verified.");
        } else {
            console.warn("   - Filler messages missing in response.");
        }

    } catch (e: any) {
        console.error("Tool Creation Exception:", e.message);
        return;
    }

    // 2. Create Assistant
    console.log("\n2. Creating Assistant with Tool ID...");
    try {
        const asstRes = await fetch('https://api.vapi.ai/assistant', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VAPI_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: "Voxanne Verification Agent",
                model: {
                    provider: 'openai',
                    model: 'gpt-4',
                    messages: [
                        { role: 'system', content: "You are a helpful assistant." }
                    ],
                    toolIds: [toolId]
                }
            })
        });

        if (!asstRes.ok) {
            const err = await asstRes.text();
            console.error(`❌ Assistant Creation Failed: ${asstRes.status} ${err}`);
        } else {
            const asstData = await asstRes.json();
            console.log(`✅ Assistant Created! ID: ${asstData.id}`);
            console.log(`   - Verified Model Tool IDs: ${JSON.stringify(asstData.model.toolIds)}`);

            if (asstData.model.toolIds.includes(toolId)) {
                console.log("\n🎉 SUCCESS: All Verification Steps Passed!");
            } else {
                console.error("\n❌ FAILURE: Tool ID not attached.");
            }
        }

    } catch (e: any) {
        console.error("Assistant Creation Exception:", e.message);
    }
}

(async () => {
    await verifyDirectRetrieval();
    await verifyVapiSync();
})();
