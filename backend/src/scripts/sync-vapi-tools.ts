#!/usr/bin/env ts-node
/**
 * Phoenix Protocol - Global Vapi Tool Synchronization
 *
 * MISSION: Remediate tool registration drift across ALL organizations
 *
 * What it does:
 * 1. Fetches all existing tools from the Vapi account
 * 2. DELETES all function tools (purges duplicates and stale tools)
 * 3. Re-registers the 5 Gold Standard tools with correct webhook URLs
 * 4. Links tools to ALL assistants via model.toolIds
 * 5. Saves tool references to org_tools table for tracking
 *
 * The 5 Gold Standard Tools:
 * 1. checkAvailability - Check calendar slots (MUST call before booking)
 * 2. bookClinicAppointment - Book confirmed appointments
 * 3. transferCall - Warm transfer to human agent
 * 4. lookupCaller - Search for existing patients
 * 5. endCall - Gracefully terminate calls
 *
 * Usage:
 *   npm run phoenix           # Live execution
 *   npm run phoenix:dry-run   # Preview changes without executing
 *
 * @author Phoenix Protocol - Critical Production Fix
 * @date 2026-01-26
 */

import axios, { AxiosInstance } from 'axios';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Tool config imports
import { getUnifiedBookingTool } from '../config/unified-booking-tool';
import {
  getTransferCallTool,
  getLookupCallerTool,
  getEndCallTool,
  getCheckAvailabilityTool
} from '../config/phase1-tools';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ==================== CONFIGURATION ====================

const VAPI_PRIVATE_KEY = (process.env.VAPI_PRIVATE_KEY || '').trim().replace(/[\r\n]/g, '');
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Validate required environment variables
if (!VAPI_PRIVATE_KEY) {
  console.error('❌ FATAL: VAPI_PRIVATE_KEY not configured');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ FATAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const vapiClient: AxiosInstance = axios.create({
  baseURL: 'https://api.vapi.ai',
  headers: {
    'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// ==================== TYPES ====================

interface VapiTool {
  id: string;
  type: string;
  function?: {
    name: string;
  };
  server?: {
    url: string;
  };
}

interface OrgAssistant {
  org_id: string;
  vapi_assistant_id: string;
  role: string;
}

interface GoldStandardTool {
  name: string;
  getDefinition: (backendUrl: string) => any;
}

// ==================== GOLD STANDARD TOOLS ====================

const GOLD_STANDARD_TOOLS: GoldStandardTool[] = [
  { name: 'checkAvailability', getDefinition: getCheckAvailabilityTool },
  { name: 'bookClinicAppointment', getDefinition: getUnifiedBookingTool },
  { name: 'transferCall', getDefinition: getTransferCallTool },
  { name: 'lookupCaller', getDefinition: getLookupCallerTool },
  { name: 'endCall', getDefinition: getEndCallTool }
];

// ==================== VAPI API FUNCTIONS ====================

async function fetchAllVapiTools(): Promise<VapiTool[]> {
  try {
    const response = await vapiClient.get('/tool');
    return response.data || [];
  } catch (error: any) {
    console.error('❌ Failed to fetch Vapi tools:', error.response?.data?.message || error.message);
    return [];
  }
}

async function deleteVapiTool(toolId: string, toolName: string): Promise<boolean> {
  try {
    await vapiClient.delete(`/tool/${toolId}`);
    return true;
  } catch (error: any) {
    console.warn(`  ⚠️  Failed to delete ${toolName} (${toolId}):`, error.response?.data?.message || error.message);
    return false;
  }
}

async function createVapiTool(toolDef: any): Promise<string | null> {
  try {
    const response = await vapiClient.post('/tool', toolDef);
    return response.data.id;
  } catch (error: any) {
    console.error(`  ❌ Failed to create tool:`, error.response?.data?.message || error.message);
    return null;
  }
}

async function linkToolsToAssistant(assistantId: string, toolIds: string[]): Promise<boolean> {
  try {
    await vapiClient.patch(`/assistant/${assistantId}`, {
      model: {
        toolIds: toolIds
      }
    });
    return true;
  } catch (error: any) {
    console.warn(`  ⚠️  Failed to link tools to assistant ${assistantId}:`, error.response?.data?.message || error.message);
    return false;
  }
}

// ==================== DATABASE FUNCTIONS ====================

async function fetchAllAssistants(): Promise<OrgAssistant[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('org_id, vapi_assistant_id, role')
    .not('vapi_assistant_id', 'is', null);

  if (error) {
    console.error('❌ Failed to fetch agents from database:', error.message);
    return [];
  }

  return data || [];
}

async function saveToolToDatabase(orgId: string, toolName: string, vapiToolId: string): Promise<void> {
  const { error } = await supabase
    .from('org_tools')
    .upsert({
      org_id: orgId,
      tool_name: toolName,
      vapi_tool_id: vapiToolId,
      enabled: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'org_id,tool_name' });

  if (error) {
    console.warn(`  ⚠️  Failed to save ${toolName} to org_tools:`, error.message);
  }
}

async function clearOrgTools(): Promise<void> {
  // Clear existing tool references to avoid stale data
  const { error } = await supabase
    .from('org_tools')
    .delete()
    .neq('org_id', '00000000-0000-0000-0000-000000000000'); // Delete all (dummy condition)

  if (error) {
    console.warn('  ⚠️  Failed to clear org_tools table:', error.message);
  }
}

// ==================== MAIN EXECUTION ====================

async function runPhoenixProtocol(dryRun: boolean = false): Promise<void> {
  const startTime = Date.now();

  console.log('\n' + '═'.repeat(70));
  console.log('🔥 PHOENIX PROTOCOL - Global Vapi Tool Remediation');
  console.log('═'.repeat(70));
  console.log(`Mode:        ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE EXECUTION'}`);
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Timestamp:   ${new Date().toISOString()}`);
  console.log('═'.repeat(70) + '\n');

  // ==================== PHASE 1: ANALYZE ====================
  console.log('📋 PHASE 1: Analyzing current Vapi tool registry\n');

  const existingTools = await fetchAllVapiTools();
  console.log(`   Total tools in Vapi account: ${existingTools.length}\n`);

  // Identify function tools (our custom tools vs native Vapi tools)
  const functionTools = existingTools.filter(t => t.type === 'function');
  const nativeTools = existingTools.filter(t => t.type !== 'function');

  console.log(`   Function tools (will be purged): ${functionTools.length}`);
  functionTools.forEach(t => {
    const name = t.function?.name || 'unnamed';
    const url = t.server?.url || 'no-url';
    console.log(`     - ${name.padEnd(25)} ${t.id.substring(0, 8)}... → ${url}`);
  });

  if (nativeTools.length > 0) {
    console.log(`\n   Native tools (will be preserved): ${nativeTools.length}`);
    nativeTools.forEach(t => {
      console.log(`     - ${t.type.padEnd(25)} ${t.id.substring(0, 8)}...`);
    });
  }

  // ==================== PHASE 2: PURGE ====================
  console.log('\n📋 PHASE 2: Purging duplicate/stale function tools\n');

  let deletedCount = 0;
  if (!dryRun) {
    for (const tool of functionTools) {
      const name = tool.function?.name || tool.id;
      const success = await deleteVapiTool(tool.id, name);
      if (success) {
        console.log(`   ✅ Deleted: ${name}`);
        deletedCount++;
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Clear database tool references
    console.log('\n   Clearing org_tools database table...');
    await clearOrgTools();
    console.log('   ✅ Database cleared');
  } else {
    console.log(`   [DRY RUN] Would delete ${functionTools.length} function tools`);
    deletedCount = functionTools.length;
  }

  // ==================== PHASE 3: REBUILD ====================
  console.log('\n📋 PHASE 3: Registering Gold Standard tools\n');

  const newToolIds: string[] = [];
  const toolIdMap: Map<string, string> = new Map();

  for (const tool of GOLD_STANDARD_TOOLS) {
    const toolDef = tool.getDefinition(BACKEND_URL);
    const webhookUrl = toolDef.server?.url || 'N/A';

    console.log(`   Registering: ${tool.name}`);
    console.log(`     Webhook: ${webhookUrl}`);

    if (!dryRun) {
      const toolId = await createVapiTool(toolDef);
      if (toolId) {
        newToolIds.push(toolId);
        toolIdMap.set(tool.name, toolId);
        console.log(`     ✅ Created: ${toolId}`);
      } else {
        console.log(`     ❌ Failed to create`);
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } else {
      console.log(`     [DRY RUN] Would create tool`);
    }
  }

  console.log(`\n   Total tools registered: ${newToolIds.length}/${GOLD_STANDARD_TOOLS.length}\n`);

  // ==================== PHASE 4: LINK ====================
  console.log('📋 PHASE 4: Linking tools to all assistants\n');

  const assistants = await fetchAllAssistants();
  console.log(`   Found ${assistants.length} assistant(s) in database\n`);

  const uniqueOrgs = new Set(assistants.map(a => a.org_id));
  let linkedCount = 0;

  if (!dryRun && newToolIds.length > 0) {
    for (const assistant of assistants) {
      const success = await linkToolsToAssistant(assistant.vapi_assistant_id, newToolIds);
      if (success) {
        console.log(`   ✅ Linked to: ${assistant.vapi_assistant_id.substring(0, 8)}... (${assistant.role})`);
        linkedCount++;
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Save tool references to database for each org
    console.log('\n   Saving tool references to org_tools table...\n');

    for (const orgId of Array.from(uniqueOrgs)) {
      for (const [toolName, toolId] of Array.from(toolIdMap.entries())) {
        await saveToolToDatabase(orgId, toolName, toolId);
      }
      console.log(`   ✅ Saved tools for org: ${orgId.substring(0, 8)}...`);
    }
  } else if (dryRun) {
    console.log(`   [DRY RUN] Would link tools to ${assistants.length} assistant(s)`);
    linkedCount = assistants.length;
  }

  // ==================== PHASE 5: SUMMARY ====================
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(70));
  console.log('🎉 PHOENIX PROTOCOL COMPLETE');
  console.log('═'.repeat(70));

  console.log('\n📊 Summary:');
  console.log(`   Tools purged:           ${deletedCount}`);
  console.log(`   Tools created:          ${newToolIds.length}`);
  console.log(`   Assistants updated:     ${linkedCount}`);
  console.log(`   Organizations affected: ${uniqueOrgs.size}`);
  console.log(`   Execution time:         ${duration}s`);

  console.log('\n🔍 Verification Steps:');
  console.log('   1. Go to Vapi Dashboard → Tools');
  console.log('   2. Verify exactly 5 function tools exist:');
  console.log('      ✓ checkAvailability');
  console.log('      ✓ bookClinicAppointment');
  console.log('      ✓ transferCall');
  console.log('      ✓ lookupCaller');
  console.log('      ✓ endCall');
  console.log('   3. Open any assistant → Model → Tools');
  console.log('   4. Verify all 5 tools are linked');
  console.log('   5. Make a test call: "What times are available tomorrow?"');
  console.log('   6. Check backend logs for [checkAvailability] invocation');

  if (dryRun) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made.');
    console.log('   Run without --dry-run to apply changes.\n');
  } else {
    console.log('\n✅ All changes have been applied.\n');
  }
}

// ==================== ENTRY POINT ====================

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

runPhoenixProtocol(dryRun)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  });
