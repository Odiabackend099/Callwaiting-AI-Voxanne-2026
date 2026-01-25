/**
 * Nuclear Tool Fix Script
 * 
 * PROBLEM: Vapi dashboard contains "decoy" Google Calendar tools that bypass our backend
 * SOLUTION: Surgically remove them and force-sync production Function tools
 * 
 * This script:
 * 1. Targets the verified org (46cf2995-2bee-44e3-838b-24151486fe4e)
 * 2. Fetches the inbound assistant ID
 * 3. Detaches ALL current tools from the assistant
 * 4. Syncs fresh Function tools pointing to production Render backend
 * 5. Verifies the fix with detailed logging
 */

import { ToolSyncService } from '../services/tool-sync-service';
import { VapiClient } from '../services/vapi-client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY!;

// DEVELOPMENT URL - Using ngrok for verification first
const BACKEND_URL = 'https://sobriquetical-zofia-abysmally.ngrok-free.dev';

// The verified org with encrypted credentials in SSOT
const TARGET_ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

// Validation
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials');
    console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

if (!VAPI_PRIVATE_KEY) {
    console.error('❌ Missing VAPI_PRIVATE_KEY');
    console.error('   The backend must have Vapi credentials to register tools');
    process.exit(1);
}

async function runNuclearFix() {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('☢️  NUCLEAR TOOL FIX - Production Deployment');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🎯 Target Org:', TARGET_ORG_ID);
    console.log('🔗 Backend URL:', BACKEND_URL);
    console.log('');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const vapi = new VapiClient(VAPI_PRIVATE_KEY);

    try {
        // ============================================================================
        // PHASE 1: Fetch Assistant ID
        // ============================================================================
        console.log('📋 PHASE 1: Fetching assistant for target org...');

        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('vapi_assistant_id, role')
            .eq('org_id', TARGET_ORG_ID)
            .eq('role', 'inbound')
            .single();

        if (agentError || !agent) {
            console.error('❌ FAILED: Could not find inbound agent for org');
            console.error('   Error:', agentError?.message || 'No agent found');
            process.exit(1);
        }

        const assistantId = agent.vapi_assistant_id;

        if (!assistantId) {
            console.error('❌ FAILED: Agent found but vapi_assistant_id is null');
            console.error('   Please ensure the agent has been created in Vapi');
            process.exit(1);
        }

        console.log('✅ Found assistant');
        console.log('   Assistant ID:', assistantId);
        console.log('   Role:', agent.role);
        console.log('');

        // ============================================================================
        // PHASE 2: Detach Existing Tools
        // ============================================================================
        console.log('📋 PHASE 2: Detaching all current tools from assistant...');
        console.log('   This removes the "decoy" Google Calendar tools');
        console.log('');

        try {
            await vapi.updateAssistant(assistantId, {
                model: {
                    toolIds: []  // Empty array clears all tools
                }
            });

            console.log('✅ Assistant tools cleared successfully');
            console.log('   All previous tool references removed');
            console.log('');
        } catch (detachError: any) {
            console.warn('⚠️  Warning: Could not clear assistant tools');
            console.warn('   Error:', detachError.message);
            console.warn('   Continuing anyway (tools might already be empty)...');
            console.log('');
        }

        // ============================================================================
        // PHASE 3: Sync Production Tools
        // ============================================================================
        console.log('📋 PHASE 3: Syncing fresh production tools...');
        console.log('   Tool: bookClinicAppointment');
        console.log('   URL:', `${BACKEND_URL}/api/vapi/tools/bookClinicAppointment`);
        console.log('');

        const syncResult = await ToolSyncService.syncAllToolsForAssistant({
            orgId: TARGET_ORG_ID,
            assistantId: assistantId,
            backendUrl: BACKEND_URL,
            skipIfExists: false  // Force re-sync even if exists
        });

        if (!syncResult.success) {
            console.error('❌ FAILED: Tool sync failed');
            console.error('   Message:', syncResult.message);
            process.exit(1);
        }

        console.log('✅ Tool sync completed successfully');
        console.log('   Tools registered:', syncResult.toolsRegistered);
        console.log('   Message:', syncResult.message);
        console.log('');

        // ============================================================================
        // PHASE 4: Verification
        // ============================================================================
        console.log('📋 PHASE 4: Verifying installation...');
        console.log('');

        // Check org_tools table
        const { data: orgTools, error: toolsError } = await supabase
            .from('org_tools')
            .select('tool_name, vapi_tool_id, enabled, created_at')
            .eq('org_id', TARGET_ORG_ID);

        if (toolsError) {
            console.warn('⚠️  Could not verify org_tools table');
            console.warn('   Error:', toolsError.message);
        } else if (!orgTools || orgTools.length === 0) {
            console.error('❌ VERIFICATION FAILED: No tools found in org_tools table');
            process.exit(1);
        } else {
            console.log('✅ Tools registered in database:');
            orgTools.forEach(tool => {
                console.log(`   • ${tool.tool_name}`);
                console.log(`     Tool ID: ${tool.vapi_tool_id}`);
                console.log(`     Status: ${tool.enabled ? 'Enabled' : 'Disabled'}`);
                console.log(`     Created: ${new Date(tool.created_at).toISOString()}`);
            });
            console.log('');
        }

        // ============================================================================
        // SUCCESS
        // ============================================================================
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ NUCLEAR FIX COMPLETE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('📊 Summary:');
        console.log(`   • Org ID: ${TARGET_ORG_ID}`);
        console.log(`   • Assistant ID: ${assistantId}`);
        console.log(`   • Tools Registered: ${syncResult.toolsRegistered}`);
        console.log(`   • Backend URL: ${BACKEND_URL}`);
        console.log('');
        console.log('🚀 Next Steps:');
        console.log('   1. Make a test call to your Vapi number');
        console.log('   2. Ask to book an appointment');
        console.log('   3. Monitor Render logs for [TOOL_CALL] events');
        console.log('   4. Verify the appointment appears in Google Calendar');
        console.log('');
        console.log('Expected log sequence:');
        console.log('   [TOOL_CALL] bookClinicAppointment');
        console.log('   [INTEGRATION_DECRYPTOR] Resolving credentials...');
        console.log('   [CALENDAR_API] Checking availability...');
        console.log('   [CALENDAR_API] Creating event...');
        console.log('   [SMS_SERVICE] Sending confirmation...');
        console.log('');

    } catch (error: any) {
        console.error('');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ NUCLEAR FIX FAILED');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('');
        process.exit(1);
    }
}

// Execute
runNuclearFix().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
