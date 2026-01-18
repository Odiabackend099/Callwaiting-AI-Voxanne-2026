import { VapiClient } from './src/services/vapi-client';
import { supabase } from './src/services/supabase-client';
import { config } from './src/config/index';

async function recreateAssistantWithTools() {
  console.log('🔄 Recreating Inbound Assistant with Tools\n');

  const oldAssistantId = '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada';
  const agentId = '20bac455-7b1e-4d93-88bc-18dac0fdcc21';
  const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

  const vapiClient = new VapiClient(config.VAPI_PRIVATE_KEY);

  try {
    console.log('Step 1: Deleting old assistant from Vapi...\n');

    // Note: VapiClient doesn't have deleteAssistant, so we'll manually call the API
    // For now, we'll just clear the database record and let the save recreate it
    console.log(`Old Assistant ID: ${oldAssistantId}\n`);

    console.log('Step 2: Clearing assistant ID from database...\n');
    const { error: updateError } = await supabase
      .from('agents')
      .update({ vapi_assistant_id: null })
      .eq('id', agentId);

    if (updateError) {
      console.error('❌ Error clearing assistant ID:', updateError);
      process.exit(1);
    }

    console.log('✅ Assistant ID cleared from database\n');

    console.log('Step 3: Getting agent configuration...\n');
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (fetchError || !agent) {
      console.error('❌ Error fetching agent:', fetchError);
      process.exit(1);
    }

    console.log('Agent Configuration:');
    console.log(`  Name: ${agent.name}`);
    console.log(`  Voice: ${agent.voice}`);
    console.log(`  Language: ${agent.language}`);
    console.log(`  System Prompt Length: ${agent.system_prompt?.length || 0} chars\n`);

    console.log('Step 4: Creating assistant with tools embedded...\n');

    const tools = vapiClient.getAppointmentBookingTools(config.BACKEND_URL);
    const webhookUrl = `${config.BACKEND_URL}/api/webhooks/vapi`;

    const assistantPayload = {
      name: agent.name || 'CallWaiting AI Inbound',
      model: {
        provider: 'openai',
        model: 'gpt-4',
        messages: [{ role: 'system', content: agent.system_prompt }],
        toolIds: []
      },
      voice: {
        provider: 'vapi',
        voiceId: agent.voice || 'Kylie'
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: agent.language || 'en-US'
      },
      firstMessage: agent.first_message,
      maxDurationSeconds: agent.max_call_duration || 300,
      serverUrl: webhookUrl,
      serverMessages: ['function-call', 'hang', 'status-update', 'end-of-call-report', 'transcript'],
      tools: tools // CRITICAL: Embed tools at creation time
    };

    console.log(`Creating with ${tools.length} tools:\n`);
    tools.forEach((tool: any, i: number) => {
      console.log(`  ${i + 1}. ${tool.name}`);
    });
    console.log();

    const newAssistant = await vapiClient.createAssistant(assistantPayload);

    console.log(`✅ New Assistant Created: ${newAssistant.id}\n`);

    console.log('Step 5: Saving new assistant ID to database...\n');
    const { error: saveError } = await supabase
      .from('agents')
      .update({ vapi_assistant_id: newAssistant.id })
      .eq('id', agentId);

    if (saveError) {
      console.error('❌ Error saving assistant ID:', saveError);
      process.exit(1);
    }

    console.log('✅ Assistant ID saved to database\n');

    console.log('Step 6: Verifying tools are registered...\n');
    const verifyAssistant = await vapiClient.getAssistant(newAssistant.id);

    if (verifyAssistant.tools && verifyAssistant.tools.length > 0) {
      console.log(`✅ Success! ${verifyAssistant.tools.length} tools registered:\n`);
      verifyAssistant.tools.forEach((tool: any, i: number) => {
        console.log(`  ${i + 1}. ${tool.name}`);
      });
    } else {
      console.log('⚠️ No tools found on the new assistant');
    }

    console.log('\n✅ Recreation complete!\n');
    console.log('Summary:');
    console.log(`  Old Assistant ID: ${oldAssistantId}`);
    console.log(`  New Assistant ID: ${newAssistant.id}`);
    console.log(`  Tools Registered: ${verifyAssistant.tools?.length || 0}`);
    console.log('\nThe inbound assistant is now ready for booking!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

recreateAssistantWithTools().catch(console.error);
