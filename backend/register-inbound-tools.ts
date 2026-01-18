import { VapiClient } from './src/services/vapi-client';
import { config } from './src/config/index';

async function registerTools() {
  console.log('📋 Registering Tools for Inbound Assistant\n');

  const assistantId = '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada';
  const vapiClient = new VapiClient(config.VAPI_PRIVATE_KEY);

  // Get available tools from VapiClient
  const tools = vapiClient.getAppointmentBookingTools(
    config.BACKEND_URL || 'http://localhost:3001'
  );

  console.log(`📦 Found ${tools.length} tools to register:\n`);
  tools.forEach((tool: any, i: number) => {
    console.log(`${i + 1}. ${tool.name}`);
    console.log(`   Description: ${tool.description}`);
    if (tool.server?.url) {
      console.log(`   URL: ${tool.server.url}`);
    }
    console.log();
  });

  try {
    console.log('🔄 Updating assistant with tools...\n');
    const updated = await vapiClient.updateAssistant(assistantId, { tools });

    console.log('✅ Assistant updated successfully!');
    console.log(`   ID: ${updated.id}`);
    console.log(`   Tools: ${updated.tools?.length || 0} registered\n`);

    if (updated.tools && updated.tools.length > 0) {
      console.log('🛠️  Registered Tools:');
      updated.tools.forEach((tool: any, i: number) => {
        console.log(`   ${i + 1}. ${tool.name}`);
      });
    }

    console.log('\n✅ Tool registration complete!');
  } catch (error: any) {
    console.error('❌ Error updating assistant:', error.message);
    if (error.response?.data) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

registerTools().catch(console.error);
