import { VapiClient } from './src/services/vapi-client';
import { config } from './src/config/index';

async function registerToolsForAssistant() {
  console.log('🔄 Registering Tools for Inbound Assistant\n');

  const assistantId = '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada';
  const vapiClient = new VapiClient(config.VAPI_PRIVATE_KEY);

  try {
    // Get the appointment booking tools
    const tools = vapiClient.getAppointmentBookingTools(config.BACKEND_URL);

    console.log(`📦 Preparing ${tools.length} tools for registration:\n`);
    tools.forEach((tool: any, i: number) => {
      console.log(`${i + 1}. ${tool.name}`);
      if (tool.server?.url) {
        console.log(`   URL: ${tool.server.url}`);
      }
    });

    console.log('\n📝 Updating assistant with tools...\n');

    // The Vapi API requires updating the model.toolIds with registered tool IDs
    // Since these are custom server tools, we need to embed them in the assistant's tools array
    // But the API says we can't use "tools" in PATCH - we can only use "toolIds"

    // Let's try with toolIds array in the model
    const updatePayload = {
      model: {
        toolIds: [] // Start with empty, these are embedded server tools
      },
      tools: tools // Embed the tools directly in the assistant
    };

    try {
      console.log('Attempting to update with embedded tools array...\n');
      const updated = await vapiClient.updateAssistant(assistantId, updatePayload);
      console.log('✅ Assistant updated with tools!');
      console.log(`   Tools: ${updated.tools?.length || 0} registered\n`);
    } catch (error: any) {
      if (error.response?.data?.message?.includes('property tools')) {
        // The tools array approach won't work on PATCH
        // Try creating tools via the /tool endpoint and getting their IDs
        console.log('Note: Direct tools array not supported on PATCH\n');
        console.log('⚠️  This means tools need to be created as separate resources first\n');
        console.log('Current limitation: Custom server tools must be created fresh with assistant\n');

        // For now, update without tools - they'll need manual setup or re-creation
        const minimalUpdate = {
          model: {
            toolIds: []
          }
        };

        const updated = await vapiClient.updateAssistant(assistantId, minimalUpdate);
        console.log('✅ Assistant configuration updated\n');
        console.log('⚠️  Important: Tools need to be registered separately via Vapi dashboard\n');
      } else {
        throw error;
      }
    }

    console.log('For now, tools can be added via:');
    console.log(`1. Vapi Dashboard: https://dashboard.vapi.ai/assistants/${assistantId}`);
    console.log('2. Manual upload of tool definitions');
    console.log('3. API integration with proper tool registration flow\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

registerToolsForAssistant().catch(console.error);
