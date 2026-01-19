/**
 * Emergency Tool Sync Script
 * 
 * This script manually triggers ToolSyncService for Sara's organization.
 * Used during Operation Austin clean room setup to verify Vapi tool linkage.
 * 
 * Usage: npx tsx src/scripts/sync-tools-for-sara.ts
 */

import { ToolSyncService } from '../services/tool-sync-service';
import { log } from '../services/logger';

// Sara Organization ID
const SARA_ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';
// Sara Assistant ID (from Vapi)
const SARA_ASSISTANT_ID = 'd7c52ba1-c3ab-46d7-8a2d-85e7dc49e99e';

async function syncToolsForSara() {
  console.log('\n🔄 OPERATION AUSTIN: Syncing Vapi Tools for Sara Organization\n');
  console.log(`📍 Org ID: ${SARA_ORG_ID}`);
  console.log(`📍 Assistant ID: ${SARA_ASSISTANT_ID}\n`);

  try {
    const result = await ToolSyncService.syncAllToolsForAssistant({
      orgId: SARA_ORG_ID,
      assistantId: SARA_ASSISTANT_ID,
      backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
      skipIfExists: false  // Force re-sync to ensure fresh linkage
    });

    console.log('\n✅ Tool Sync Result:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Tools Registered: ${result.toolsRegistered}`);
    console.log(`   Tool ID: ${result.toolId || 'N/A'}`);
    console.log(`   Message: ${result.message}`);

    if (result.success) {
      console.log('\n🎯 Next Step: Verify with Vapi API curl command');
      console.log(`   curl -s -X GET "https://api.vapi.ai/assistant/${SARA_ASSISTANT_ID}" \\`);
      console.log(`     -H "Authorization: Bearer $VAPI_PRIVATE_KEY" | jq '.model.toolIds'`);
      console.log('\n   Expected: Array of tool IDs (NOT null)\n');
    } else {
      console.error('\n❌ Tool sync failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error during tool sync:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      console.error(error.stack);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Execute
syncToolsForSara().then(() => {
  console.log('✅ Script completed successfully');
  process.exit(0);
}).catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
