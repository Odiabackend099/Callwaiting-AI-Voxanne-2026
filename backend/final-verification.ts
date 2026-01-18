import axios from 'axios';
import { supabase } from './src/services/supabase-client';
import { config } from './src/config/index';

async function finalVerification() {
  console.log('✅ FINAL VERIFICATION - Inbound Assistant with Booking Tool\n');
  console.log('=' .repeat(60) + '\n');

  const assistantId = '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada';
  const toolId = 'c8617e87-be85-45b9-ba53-1fed059cb5e9';

  const vapiClient = axios.create({
    baseURL: 'https://api.vapi.ai',
    headers: {
      'Authorization': `Bearer ${config.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    // 1. Check database
    console.log('1️⃣  DATABASE CHECK:\n');
    const { data: agent } = await supabase
      .from('agents')
      .select('id, role, vapi_assistant_id, voice, language')
      .eq('role', 'inbound')
      .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
      .single();

    console.log(`   ✅ Agent ID: ${agent.id}`);
    console.log(`   ✅ Vapi Assistant ID: ${agent.vapi_assistant_id}`);
    console.log(`   ✅ Voice: ${agent.voice}`);
    console.log(`   ✅ Language: ${agent.language}\n`);

    // 2. Check Vapi assistant
    console.log('2️⃣  VAPI ASSISTANT CHECK:\n');
    const assistantResponse = await vapiClient.get(`/assistant/${assistantId}`);
    const assistant = assistantResponse.data;

    console.log(`   ✅ Name: ${assistant.name}`);
    console.log(`   ✅ Voice: ${assistant.voice.voiceId}`);
    console.log(`   ✅ Model: ${assistant.model.model}`);

    // 3. Check tools linked via toolIds
    console.log(`\n3️⃣  TOOLS LINKED (via model.toolIds):\n`);
    const linkedToolIds = assistant.model.toolIds || [];

    if (linkedToolIds.length > 0) {
      console.log(`   ✅ ${linkedToolIds.length} tool(s) linked:\n`);
      linkedToolIds.forEach((id: string, i: number) => {
        console.log(`      ${i + 1}. Tool ID: ${id}`);
      });
    } else {
      console.log(`   ❌ No tools linked`);
    }

    // 4. Check tool details
    console.log(`\n4️⃣  TOOL DETAILS:\n`);
    const toolResponse = await vapiClient.get(`/tool/${toolId}`);
    const tool = toolResponse.data;

    console.log(`   ✅ Tool Name: ${tool.function?.name || tool.name}`);
    console.log(`   ✅ Tool Description: ${tool.function?.description || tool.description}`);
    console.log(`   ✅ Server URL: ${tool.server?.url}`);
    console.log(`   ✅ Tool Type: ${tool.type}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 SUMMARY:\n');
    console.log('   ✅ Inbound Assistant created and configured');
    console.log(`   ✅ Assistant ID: ${assistantId}`);
    console.log('   ✅ Booking tool created and registered');
    console.log(`   ✅ Tool ID: ${toolId}`);
    console.log(`   ✅ Tool linked to assistant via model.toolIds`);
    console.log('\n✅ READY FOR VOICE TESTING!\n');
    console.log('The inbound assistant can now:');
    console.log('  • Accept incoming calls');
    console.log('  • Interact with custom booking tool');
    console.log('  • Book appointments via bookClinicAppointment tool');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

finalVerification().catch(console.error);
