/**
 * Tool Chain Verification Script
 *
 * Verifies that all 5 Vapi tools are correctly:
 * 1. Registered in org_tools with distinct tool_name values
 * 2. Registered with Vapi API (valid vapi_tool_id)
 * 3. Linked to the assistant via model.toolIds
 * 4. Pointing to the correct BACKEND_URL in their server.url
 *
 * Run: npx ts-node src/scripts/verify-tool-chain.ts
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VAPI_KEY = process.env.VAPI_PRIVATE_KEY!;
const BACKEND_URL = process.env.BACKEND_URL
  || process.env.RENDER_EXTERNAL_URL
  || process.env.BASE_URL
  || 'http://localhost:3001';

const EXPECTED_TOOLS = [
  'checkAvailability',
  'bookClinicAppointment',
  'transferCall',
  'lookupCaller',
  'endCall'
];

interface CheckResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
}

const results: CheckResult[] = [];

function pass(check: string, details: string) {
  results.push({ check, status: 'PASS', details });
}

function fail(check: string, details: string) {
  results.push({ check, status: 'FAIL', details });
}

function warn(check: string, details: string) {
  results.push({ check, status: 'WARN', details });
}

async function main() {
  console.log('\n====================================================');
  console.log('  VAPI TOOL CHAIN VERIFICATION');
  console.log('====================================================\n');

  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!VAPI_KEY) {
    console.error('Missing VAPI_PRIVATE_KEY');
    process.exit(1);
  }

  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Supabase: ${SUPABASE_URL.substring(0, 30)}...`);
  console.log('');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Check 1: Backend URL health
  if (BACKEND_URL.includes('localhost')) {
    warn('Backend URL', `Resolves to localhost (${BACKEND_URL}) - Vapi cannot reach this in production`);
  } else if (BACKEND_URL.includes('ngrok')) {
    warn('Backend URL', `Using ngrok tunnel (${BACKEND_URL}) - ephemeral, will break`);
  } else {
    pass('Backend URL', BACKEND_URL);
  }

  // Check 2: Get all orgs with agents
  const { data: agents, error: agentsErr } = await supabase
    .from('agents')
    .select('id, org_id, role, vapi_assistant_id, vapi_phone_number_id')
    .not('vapi_assistant_id', 'is', null);

  if (agentsErr) {
    fail('Agents query', agentsErr.message);
    printResults();
    return;
  }

  if (!agents || agents.length === 0) {
    warn('Agents query', 'No agents with vapi_assistant_id found');
    printResults();
    return;
  }

  pass('Agents query', `Found ${agents.length} agents with Vapi assistants`);

  // Check 3: Per-org tool verification
  const orgIds = Array.from(new Set(agents.map(a => a.org_id)));

  for (const orgId of orgIds) {
    const orgLabel = orgId.substring(0, 8) + '...';
    console.log(`\n--- Org: ${orgLabel} ---`);

    // 3a: Check org_tools count
    const { data: orgTools, error: toolsErr } = await supabase
      .from('org_tools')
      .select('tool_name, vapi_tool_id, definition_hash, updated_at')
      .eq('org_id', orgId);

    if (toolsErr) {
      fail(`[${orgLabel}] org_tools query`, toolsErr.message);
      continue;
    }

    const toolCount = orgTools?.length || 0;
    if (toolCount === 0) {
      fail(`[${orgLabel}] Tool count`, 'No tools registered - run agent save to trigger sync');
    } else if (toolCount < EXPECTED_TOOLS.length) {
      warn(`[${orgLabel}] Tool count`, `${toolCount}/${EXPECTED_TOOLS.length} tools (expected ${EXPECTED_TOOLS.length})`);
    } else {
      pass(`[${orgLabel}] Tool count`, `${toolCount} tools registered`);
    }

    // 3b: Check for expected tool names
    const registeredNames = (orgTools || []).map(t => t.tool_name);
    for (const expected of EXPECTED_TOOLS) {
      if (registeredNames.includes(expected)) {
        pass(`[${orgLabel}] Tool: ${expected}`, 'Present in org_tools');
      } else {
        fail(`[${orgLabel}] Tool: ${expected}`, 'MISSING from org_tools');
      }
    }

    // 3c: Check for the old bug (all tools named 'bookClinicAppointment')
    const allSameName = registeredNames.length > 0 && registeredNames.every(n => n === registeredNames[0]);
    if (allSameName && registeredNames.length > 1) {
      fail(`[${orgLabel}] Name collision`, `All ${registeredNames.length} tools have same name: "${registeredNames[0]}" - data corruption from old bug`);
    }

    // 3d: Verify Vapi tool IDs exist
    for (const tool of orgTools || []) {
      try {
        const response = await axios.get(`https://api.vapi.ai/tool/${tool.vapi_tool_id}`, {
          headers: { Authorization: `Bearer ${VAPI_KEY}` },
          timeout: 5000
        });

        if (response.status === 200) {
          const vapiTool = response.data;
          const serverUrl = vapiTool?.server?.url || vapiTool?.function?.server?.url || 'unknown';

          // Check if server URL matches current BACKEND_URL
          if (serverUrl.startsWith(BACKEND_URL)) {
            pass(`[${orgLabel}] Vapi tool ${tool.tool_name}`, `URL matches backend: ${serverUrl}`);
          } else {
            fail(`[${orgLabel}] Vapi tool ${tool.tool_name}`, `URL MISMATCH: registered=${serverUrl}, expected prefix=${BACKEND_URL}`);
          }
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          fail(`[${orgLabel}] Vapi tool ${tool.tool_name}`, `vapi_tool_id ${tool.vapi_tool_id} NOT FOUND in Vapi`);
        } else {
          warn(`[${orgLabel}] Vapi tool ${tool.tool_name}`, `API check failed: ${err.message}`);
        }
      }
    }

    // 3e: Verify assistant has toolIds linked
    const orgAgents = agents.filter(a => a.org_id === orgId);
    for (const agent of orgAgents) {
      try {
        const response = await axios.get(`https://api.vapi.ai/assistant/${agent.vapi_assistant_id}`, {
          headers: { Authorization: `Bearer ${VAPI_KEY}` },
          timeout: 5000
        });

        if (response.status === 200) {
          const assistant = response.data;
          const linkedToolIds = assistant?.model?.toolIds || [];
          const toolCount = linkedToolIds.length;

          if (toolCount >= EXPECTED_TOOLS.length) {
            pass(`[${orgLabel}] ${agent.role} assistant tools`, `${toolCount} tools linked`);
          } else if (toolCount > 0) {
            warn(`[${orgLabel}] ${agent.role} assistant tools`, `Only ${toolCount}/${EXPECTED_TOOLS.length} tools linked`);
          } else {
            fail(`[${orgLabel}] ${agent.role} assistant tools`, 'No tools linked to assistant');
          }

          // Check serverUrl
          const serverUrl = assistant?.serverUrl;
          if (serverUrl && serverUrl.startsWith(BACKEND_URL)) {
            pass(`[${orgLabel}] ${agent.role} webhook URL`, serverUrl);
          } else if (serverUrl) {
            fail(`[${orgLabel}] ${agent.role} webhook URL`, `MISMATCH: ${serverUrl} (expected prefix: ${BACKEND_URL})`);
          }
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          fail(`[${orgLabel}] ${agent.role} assistant`, `vapi_assistant_id NOT FOUND in Vapi`);
        } else {
          warn(`[${orgLabel}] ${agent.role} assistant`, `API check failed: ${err.message}`);
        }
      }
    }
  }

  printResults();
}

function printResults() {
  console.log('\n====================================================');
  console.log('  RESULTS SUMMARY');
  console.log('====================================================\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  for (const r of results) {
    const icon = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'WARN';
    console.log(`  [${icon}] ${r.check}: ${r.details}`);
  }

  console.log(`\n  Total: ${results.length} checks`);
  console.log(`  PASS: ${passed} | FAIL: ${failed} | WARN: ${warned}`);

  if (failed > 0) {
    console.log('\n  STATUS: UNHEALTHY - Tool chain has failures');
    process.exit(1);
  } else if (warned > 0) {
    console.log('\n  STATUS: DEGRADED - Tool chain has warnings');
    process.exit(0);
  } else {
    console.log('\n  STATUS: HEALTHY - All checks passed');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\nScript failed:', err.message);
  process.exit(1);
});
