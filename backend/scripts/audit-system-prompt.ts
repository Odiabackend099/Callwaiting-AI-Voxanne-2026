import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const VAPI_KEY = process.env.VAPI_API_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function auditSystemPrompt() {
    console.log('\n========================================');
    console.log('SYSTEM PROMPT AUDIT - END TO END');
    console.log('========================================\n');

    // STEP 1: Get latest agent from database
    console.log('STEP 1: Database Layer');
    console.log('----------------------------------------');

    const { data: agents } = await supabase
        .from('agents')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (!agents || agents.length === 0) {
        console.error("❌ No agents found in database");
        return;
    }

    const agent = agents[0];
    console.log(`Agent: "${agent.name}" (ID: ${agent.id})`);
    console.log(`Vapi ID: ${agent.vapi_assistant_id || 'NULL'}`);
    console.log(`Last Updated: ${agent.updated_at}`);
    console.log(`\nSystem Prompt in DB (first 200 chars):`);
    console.log(`"${(agent.system_prompt || '').substring(0, 200)}..."`);
    console.log(`Length: ${(agent.system_prompt || '').length} characters`);

    if (!agent.vapi_assistant_id) {
        console.error("\n❌ Agent not synced to Vapi yet (vapi_assistant_id is null)");
        return;
    }

    // STEP 2: Simulate buildAgentContext
    console.log('\n\nSTEP 2: Backend Context Building');
    console.log('----------------------------------------');

    let fullContext = agent.system_prompt || '';

    // Check if KB context would be added
    const { data: kbFiles, count: kbCount } = await supabase
        .from('knowledge_base')
        .select('*', { count: 'exact' })
        .eq('org_id', agent.org_id);

    if (kbCount && kbCount > 0) {
        console.log(`Found ${kbCount} KB files for this agent's org`);
        fullContext += '\n\n--- KNOWLEDGE BASE INTEGRATION ACTIVE ---';
    }

    console.log(`\nFull Context (what should be sent to Vapi):`);
    console.log(`"${fullContext.substring(0, 300)}..."`);
    console.log(`Length: ${fullContext.length} characters`);

    // STEP 3: Check what Vapi has
    console.log('\n\nSTEP 3: Vapi API Layer');
    console.log('----------------------------------------');

    try {
        const res = await fetch(`https://api.vapi.ai/assistant/${agent.vapi_assistant_id}`, {
            headers: { 'Authorization': `Bearer ${VAPI_KEY}` }
        });

        if (!res.ok) {
            console.error(`❌ Vapi API Error: ${res.status} ${await res.text()}`);
            return;
        }

        const vapiAssistant = await res.json();

        console.log(`Vapi Assistant Name: "${vapiAssistant.name}"`);
        console.log(`First Message: "${vapiAssistant.firstMessage?.substring(0, 100)}..."`);

        const systemMessage = vapiAssistant.model?.messages?.find((m: any) => m.role === 'system');

        if (!systemMessage) {
            console.error('\n❌ NO SYSTEM MESSAGE FOUND IN VAPI CONFIG');
            console.log('model.messages:', JSON.stringify(vapiAssistant.model?.messages, null, 2));
        } else {
            console.log(`\n✅ System Message Found in Vapi`);
            console.log(`Content (first 300 chars):`);
            console.log(`"${(systemMessage.content || '').substring(0, 300)}..."`);
            console.log(`Length: ${(systemMessage.content || '').length} characters`);

            // Compare
            if (systemMessage.content === fullContext) {
                console.log('\n🎉 SUCCESS: Vapi content EXACTLY matches expected context');
            } else if (!systemMessage.content || systemMessage.content.trim() === '') {
                console.error('\n❌ FAIL: Vapi system message is EMPTY');
            } else {
                console.error('\n⚠️ MISMATCH: Vapi content differs from expected');
                console.log(`Expected length: ${fullContext.length}`);
                console.log(`Actual length: ${systemMessage.content.length}`);
            }
        }

    } catch (e: any) {
        console.error("Exception fetching from Vapi:", e.message);
    }

    console.log('\n========================================');
    console.log('END OF AUDIT');
    console.log('========================================\n');
}

auditSystemPrompt();
