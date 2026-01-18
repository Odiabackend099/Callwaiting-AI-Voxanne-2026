import { ToolSyncService } from './src/services/tool-sync-service';
import { config } from './src/config/index';

async function syncTools() {
  console.log('🔄 Synchronizing Tools for Inbound Assistant\n');

  const result = await ToolSyncService.syncAllToolsForAssistant({
    orgId: '46cf2995-2bee-44e3-838b-24151486fe4e',
    assistantId: '1f2c1e48-3c41-4a8d-9ddc-cdf6a7303ada',
    backendUrl: config.BACKEND_URL,
    skipIfExists: false
  });

  console.log('\n📊 Sync Result:');
  console.log(`   Success: ${result.success}`);
  console.log(`   Tools Registered: ${result.toolsRegistered}`);
  console.log(`   Message: ${result.message}`);

  if (result.toolId) {
    console.log(`   Tool ID: ${result.toolId}`);
  }

  process.exit(result.success ? 0 : 1);
}

syncTools().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
