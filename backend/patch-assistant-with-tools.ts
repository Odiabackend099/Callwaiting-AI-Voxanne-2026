import axios from 'axios';
import { config } from './src/config/index';

/**
 * Correctly PATCH an assistant to add tool IDs
 * Must preserve the existing model configuration
 */

async function patchAssistantWithTools() {
  console.log('🔧 Linking Created Tool to Assistant\n');

  const assistantId = '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada';
  const toolId = 'c8617e87-be85-45b9-ba53-1fed059cb5e9'; // Tool we just created

  const vapiClient = axios.create({
    baseURL: 'https://api.vapi.ai',
    headers: {
      'Authorization': `Bearer ${config.VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  try {
    console.log('Step 1: Getting current assistant configuration\n');

    const getResponse = await vapiClient.get(`/assistant/${assistantId}`);
    const currentAssistant = getResponse.data;

    console.log('Current Assistant:');
    console.log(`  Name: ${currentAssistant.name}`);
    console.log(`  Model Provider: ${currentAssistant.model?.provider}`);
    console.log(`  Voice: ${currentAssistant.voice?.voiceId}`);
    console.log(`  Current toolIds: ${currentAssistant.model?.toolIds?.length || 0}\n`);

    console.log('Step 2: Building PATCH payload with full model config\n');

    // CRITICAL: Must include full model config, not just toolIds
    const patchPayload = {
      model: {
        provider: currentAssistant.model.provider,
        model: currentAssistant.model.model,
        messages: currentAssistant.model.messages,
        toolIds: [toolId] // Add our tool
      }
    };

    console.log('PATCH Payload:');
    console.log(JSON.stringify(patchPayload, null, 2));
    console.log('\n');

    console.log('Step 3: Sending PATCH to add tool\n');

    const patchResponse = await vapiClient.patch(`/assistant/${assistantId}`, patchPayload);

    console.log('✅ Assistant patched successfully!\n');

    console.log('Step 4: Verifying tool is linked\n');

    const verifyResponse = await vapiClient.get(`/assistant/${assistantId}`);
    const linkedToolIds = verifyResponse.data.model?.toolIds || [];

    console.log(`✅ Success! Assistant now has ${linkedToolIds.length} tool(s):\n`);
    linkedToolIds.forEach((id: string, i: number) => {
      console.log(`  ${i + 1}. ${id}`);
    });

    console.log('\n✅ Tool successfully linked to assistant!');
    console.log(`\nAssistant ID: ${assistantId}`);
    console.log(`Tool ID: ${toolId}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('\nVapi Response:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

patchAssistantWithTools().catch(console.error);
