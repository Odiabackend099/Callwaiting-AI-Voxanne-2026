#!/usr/bin/env ts-node
/**
 * Simple script to create a Vapi assistant for a tenant
 * Works with the agents table
 * 
 * Usage:
 *   npx ts-node scripts/create-vapi-assistant-simple.ts --org-id=a0000000-0000-0000-0000-000000000001
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const orgIdArg = args.find(arg => arg.startsWith('--org-id='))?.split('=')[1];

if (!orgIdArg) {
    console.error('❌ Usage: npx ts-node scripts/create-vapi-assistant-simple.ts --org-id=<org-id>');
    process.exit(1);
}

// Supabase setup
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Vapi API key from environment
const VAPI_API_KEY = process.env.VAPI_API_KEY;

async function createVapiAssistant() {
    console.log('🚀 Starting Vapi Assistant Creation...\n');

    try {
        const orgId = orgIdArg;
        console.log(`✅ Organization ID: ${orgId}\n`);

        // Step 2: Get Vapi API key
        console.log('2️⃣ Retrieving Vapi API key...');
        const vapiApiKey = VAPI_API_KEY;

        if (!vapiApiKey) {
            console.error('❌ No Vapi API key found. Set VAPI_API_KEY in .env');
            process.exit(1);
        }

        console.log(`✅ Vapi API key found: ***${vapiApiKey.slice(-4)}\n`);

        // Step 3: Get or create agent
        console.log('3️⃣ Finding agent...');
        const { data: agents, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('org_id', orgId)
            .eq('role', 'inbound')
            .limit(1);

        if (agentError) {
            console.error('❌ Error fetching agent:', agentError.message);
            process.exit(1);
        }

        let agent: any;

        if (!agents || agents.length === 0) {
            console.log('   No existing agent found. Creating new one...');

            const { data: newAgent, error: insertError } = await supabase
                .from('agents')
                .insert({
                    org_id: orgId,
                    name: 'CallWaiting AI Inbound',
                    role: 'inbound',
                    status: 'active',
                    system_prompt: 'You are a helpful AI assistant for CallWaiting AI. You help customers with their inquiries in a professional and friendly manner.',
                    first_message: 'Hello! Thank you for calling. How can I help you today?',
                    voice: 'Paige',
                    language: 'en',
                    max_call_duration: 600
                })
                .select()
                .single();

            if (insertError) {
                console.error('❌ Error creating agent:', insertError.message);
                process.exit(1);
            }

            agent = newAgent;
            console.log(`✅ Created new agent: ${agent.id}`);
        } else {
            agent = agents[0];
            console.log(`✅ Found existing agent: ${agent.id}`);
        }

        console.log(`   System Prompt: ${agent.system_prompt.substring(0, 50)}...`);
        console.log(`   Voice: ${agent.voice}`);
        console.log(`   Current Vapi Assistant ID: ${agent.vapi_assistant_id || 'none'}\n`);

        // Step 4: Create or update Vapi assistant
        console.log('4️⃣ Syncing to Vapi...');

        const assistantPayload = {
            name: agent.name,
            model: {
                provider: 'openai',
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: agent.system_prompt
                    }
                ],
                toolIds: []
            },
            voice: {
                provider: 'vapi',
                voiceId: agent.voice
            },
            transcriber: {
                provider: 'deepgram',
                model: 'nova-2',
                language: agent.language || 'en'
            },
            firstMessage: agent.first_message,
            maxDurationSeconds: agent.max_call_duration || 600
        };

        let vapiAssistantId = agent.vapi_assistant_id;
        let operation = 'create';

        // If assistant ID exists, try to update
        if (vapiAssistantId) {
            console.log(`   Updating existing assistant: ${vapiAssistantId}`);
            operation = 'update';

            const updateRes = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${vapiApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(assistantPayload)
            });

            if (!updateRes.ok) {
                const errorText = await updateRes.text();
                console.log(`   ⚠️  Update failed (${updateRes.status}): ${errorText}`);
                console.log('   Creating new assistant instead...');
                vapiAssistantId = null;
                operation = 'create';
            } else {
                const updated = await updateRes.json();
                console.log(`✅ Assistant updated successfully`);
                vapiAssistantId = updated.id;
            }
        }

        // Create new assistant if needed
        if (!vapiAssistantId) {
            console.log('   Creating new assistant...');

            const createRes = await fetch('https://api.vapi.ai/assistant', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${vapiApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(assistantPayload)
            });

            if (!createRes.ok) {
                const errorText = await createRes.text();
                console.error(`❌ Failed to create assistant (${createRes.status}):`, errorText);
                process.exit(1);
            }

            const created = await createRes.json();
            vapiAssistantId = created.id;
            console.log(`✅ Assistant created successfully: ${vapiAssistantId}`);
        }

        // Step 5: Store assistant ID in database
        console.log('\n5️⃣ Updating database...');
        const { error: updateError } = await supabase
            .from('agents')
            .update({ vapi_assistant_id: vapiAssistantId })
            .eq('id', agent.id);

        if (updateError) {
            console.error('❌ Error updating database:', updateError.message);
            process.exit(1);
        }

        console.log(`✅ Database updated with assistant ID\n`);

        // Step 6: Verify the assistant
        console.log('6️⃣ Verifying assistant in Vapi...');
        const verifyRes = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
            headers: {
                'Authorization': `Bearer ${vapiApiKey}`
            }
        });

        if (!verifyRes.ok) {
            console.error(`❌ Verification failed (${verifyRes.status})`);
            process.exit(1);
        }

        const verified = await verifyRes.json();
        const verifiedPrompt = verified.model?.messages?.find((m: any) => m.role === 'system')?.content;
        const verifiedVoice = verified.voice?.voiceId;

        console.log('   ✅ Assistant verified in Vapi');
        console.log(`   Name: ${verified.name}`);
        console.log(`   Voice: ${verifiedVoice}`);
        console.log(`   System Prompt: ${verifiedPrompt?.substring(0, 50)}...`);

        // Final summary
        console.log('\n' + '='.repeat(60));
        console.log('🎉 SUCCESS! Vapi Assistant Created and Verified');
        console.log('='.repeat(60));
        console.log(`Organization ID:    ${orgId}`);
        console.log(`Agent ID:           ${agent.id}`);
        console.log(`Vapi Assistant ID:  ${vapiAssistantId}`);
        console.log(`Operation:          ${operation}`);
        console.log('='.repeat(60));
        console.log('\n✅ The assistant is now ready to use!');
        console.log('✅ The frontend save button should now work correctly.');
        console.log('\nNext steps:');
        console.log('1. Test the frontend save button at /dashboard/agent-config');
        console.log('2. Verify the assistant appears in Vapi dashboard');
        console.log('3. Make a test call to verify the voice and behavior');

    } catch (error: any) {
        console.error('\n❌ Unexpected error:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

// Run the script
createVapiAssistant();
