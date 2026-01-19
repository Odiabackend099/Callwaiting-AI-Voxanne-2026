/**
 * Detailed Tool Sync Diagnostic
 * 
 * This script provides step-by-step verification of the tool sync process.
 * Usage: npx tsx src/scripts/diagnose-tool-sync.ts
 */

import { VapiClient } from '../services/vapi-client';
import { supabase } from '../services/supabase-client';
import { getUnifiedBookingTool } from '../config/unified-booking-tool';
import { log } from '../services/logger';

const SARA_ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';
const SARA_ASSISTANT_ID = 'd7c52ba1-c3ab-46d7-8a2d-85e7dc49e99e';

async function diagnose() {
  console.log('\n🔍 TOOL SYNC DIAGNOSTIC\n');

  try {
    const vapiKey = process.env.VAPI_PRIVATE_KEY;
    if (!vapiKey) {
      throw new Error('VAPI_PRIVATE_KEY not set');
    }

    const vapi = new VapiClient(vapiKey);
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

    // Step 1: Check org_tools database
    console.log('📋 Step 1: Checking org_tools table...');
    const { data: orgTools, error: toolsError } = await supabase
      .from('org_tools')
      .select('*')
      .eq('tool_name', 'bookClinicAppointment')
      .eq('org_id', SARA_ORG_ID);

    if (toolsError) {
      console.log(`   ❌ Error: ${toolsError.message}`);
    } else {
      console.log(`   ✅ Found ${orgTools?.length || 0} records`);
      if (orgTools && orgTools.length > 0) {
        console.log(`   Tool ID: ${orgTools[0].vapi_tool_id}`);
        console.log(`   Hash: ${orgTools[0].definition_hash?.substring(0, 16)}...`);
      }
    }

    // Step 2: Get tool definition
    console.log('\n📋 Step 2: Tool definition...');
    const toolDef = getUnifiedBookingTool(backendUrl);
    console.log(`   ✅ Tool name: ${toolDef.name}`);
    console.log(`   ✅ Tool URL: ${toolDef.server.url}`);

    // Step 3: Fetch Sara's assistant from Vapi
    console.log('\n📋 Step 3: Fetching Sara assistant from Vapi...');
    const assistant = await vapi.getAssistant(SARA_ASSISTANT_ID);
    console.log(`   ✅ Assistant found`);
    console.log(`   Current toolIds: ${JSON.stringify(assistant.model?.toolIds)}`);
    console.log(`   Current tools count: ${assistant.model?.tools?.length || 0}`);

    // Step 4: Manually link tools if org_tools has them
    if (orgTools && orgTools.length > 0) {
      const toolId = orgTools[0].vapi_tool_id;
      console.log('\n📋 Step 4: Attempting manual tool link...');
      console.log(`   Linking tool ID: ${toolId}`);
      console.log(`   To assistant: ${SARA_ASSISTANT_ID}`);

      const updateResult = await vapi.updateAssistant(SARA_ASSISTANT_ID, {
        model: {
          toolIds: [toolId]
        }
      });

      console.log(`   ✅ Update sent to Vapi API`);
      console.log(`   Result toolIds: ${JSON.stringify(updateResult.model?.toolIds)}`);
    } else {
      console.log('\n⚠️  Step 4: No tools in org_tools table - cannot link');
    }

    // Step 5: Verify linkage
    console.log('\n📋 Step 5: Verifying linkage...');
    const updatedAssistant = await vapi.getAssistant(SARA_ASSISTANT_ID);
    console.log(`   Final toolIds: ${JSON.stringify(updatedAssistant.model?.toolIds)}`);
    
    if (updatedAssistant.model?.toolIds && updatedAssistant.model.toolIds.length > 0) {
      console.log('\n✅ SUCCESS: Tools are now linked!');
    } else {
      console.log('\n❌ FAILURE: Tools still not linked');
    }

  } catch (error) {
    console.error('\n❌ Diagnostic error:', error instanceof Error ? error.message : error);
    console.error(error);
    process.exit(1);
  }
}

diagnose().then(() => {
  console.log('\n✅ Diagnostic complete\n');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
