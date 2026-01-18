import { supabase } from './src/services/supabase-client';
import { VapiClient } from './src/services/vapi-client';
import { config } from './src/config/index';

async function verify() {
  console.log('🔍 Verifying Vapi Assistant Configuration\n');

  // Get inbound agent
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, role, vapi_assistant_id, system_prompt, voice, language, functions')
    .eq('role', 'inbound')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
    .single();

  if (agentError) {
    console.error('❌ Error fetching agent:', agentError);
    process.exit(1);
  }

  if (!agent) {
    console.error('❌ No inbound agent found');
    process.exit(1);
  }

  console.log('✅ Agent found in database:');
  console.log(`   ID: ${agent.id}`);
  console.log(`   Role: ${agent.role}`);
  console.log(`   Vapi Assistant ID: ${agent.vapi_assistant_id || 'NOT SET'}`);
  console.log(`   Voice: ${agent.voice}`);
  console.log(`   Language: ${agent.language}`);
  console.log(`   Functions: ${agent.functions?.length || 0} registered`);

  if (!agent.vapi_assistant_id) {
    console.error('\n❌ ERROR: vapi_assistant_id is not set!');
    process.exit(1);
  }

  // Check Vapi
  console.log('\n🔌 Checking Vapi...\n');
  const vapiClient = new VapiClient(config.VAPI_PRIVATE_KEY);

  try {
    const vapiAssistant = await vapiClient.getAssistant(agent.vapi_assistant_id);

    console.log('✅ Assistant found in Vapi:');
    console.log(`   ID: ${vapiAssistant.id}`);
    console.log(`   Name: ${vapiAssistant.name}`);
    console.log(`   Voice: ${vapiAssistant.voice?.voiceId || 'Not set'}`);
    console.log(`   Model: ${vapiAssistant.model?.model || 'Not set'}`);

    if (vapiAssistant.tools) {
      console.log(`\n🛠️  Tools Registered: ${vapiAssistant.tools.length}`);
      vapiAssistant.tools.forEach((tool: any, i: number) => {
        console.log(`   ${i + 1}. ${tool.name}`);
        if (tool.type === 'server' && tool.server?.url) {
          console.log(`      → ${tool.server.url}`);
        }
      });
    } else {
      console.log('\n⚠️  No tools registered with assistant');
    }

    console.log('\n✅ Verification complete!');
  } catch (error: any) {
    console.error('❌ Error fetching from Vapi:', error.message);
    if (error.response?.data) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

verify().catch(console.error);
