import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

// Configuration
const VAPI_API_KEY = process.env.VAPI_API_KEY;
if (!VAPI_API_KEY) {
    console.error("❌ Missing VAPI_API_KEY in .env");
    process.exit(1);
}

const TEST_AGENT_NAME = "Manual Sync Test Agent";
const SYSTEM_PROMPT = "You are a test assistant. Verified at " + new Date().toISOString();

async function runManualSync() {
    console.log("🚀 Starting Manual Vapi Sync Test...");

    try {
        // 1. Create a dummy Query Tool to test merging
        console.log("\n1️⃣ Creating Test Query Tool...");
        const toolRes = await fetch('https://api.vapi.ai/tool', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'function', // Trying standard function type first
                function: {
                    name: 'test_kb_tool',
                    description: 'A test knowledge base tool',
                    parameters: { type: 'object', properties: {} }
                },
                messages: [
                    {
                        type: 'request-start',
                        content: 'Checking knowledge base...'
                    }
                ]
            })
        });

        if (!toolRes.ok) {
            console.error("❌ Failed to create tool:", await toolRes.text());
            return;
        }

        const tool = await toolRes.json();
        console.log(`✅ Tool Created: ${tool.id}`);

        // 2. Create Assistant (with toolIds array)
        console.log("\n2️⃣ Creating Assistant...");

        const assistantPayload = {
            name: TEST_AGENT_NAME,
            model: {
                provider: 'openai',
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: SYSTEM_PROMPT
                    }
                ],
                toolIds: [tool.id] // CRITICAL: Testing toolIds array
            },
            voice: {
                provider: 'vapi', // Correct provider for 'paige'
                voiceId: 'Paige'
            },
            firstMessage: "Hello, this is a test.",
            transcriber: {
                provider: 'deepgram',
                model: 'nova-2',
                language: 'en'
            }
        };

        const createRes = await fetch('https://api.vapi.ai/assistant', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VAPI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(assistantPayload)
        });

        if (!createRes.ok) {
            console.error("❌ Failed to create assistant:", await createRes.text());
            return;
        }

        const assistant = await createRes.json();
        console.log(`✅ Assistant Created: ${assistant.id}`);

        // 3. Verify Persistence
        console.log("\n3️⃣ Verifying Persistence...");
        const getRes = await fetch(`https://api.vapi.ai/assistant/${assistant.id}`, {
            headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
        });

        const fetchedAssistant = await getRes.json();
        const fetchedPrompt = fetchedAssistant.model?.messages?.find((m: any) => m.role === 'system')?.content;
        const fetchedToolIds = fetchedAssistant.model?.toolIds || [];

        console.log("--- Verification Results ---");
        console.log(`Expected Prompt: "${SYSTEM_PROMPT}"`);
        console.log(`Actual Prompt:   "${fetchedPrompt}"`);
        console.log(`Expected Tool ID: ${tool.id}`);
        console.log(`Actual Tool IDs:  ${JSON.stringify(fetchedToolIds)}`);

        if (fetchedPrompt === SYSTEM_PROMPT && fetchedToolIds.includes(tool.id)) {
            console.log("\n🎉 SUCCESS: Logic is sound. System prompt and tools persisted.");
        } else {
            console.error("\n❌ FAILURE: Persistence check failed.");
        }

    } catch (error: any) {
        console.error("Exception:", error.message);
    }
}

runManualSync();
