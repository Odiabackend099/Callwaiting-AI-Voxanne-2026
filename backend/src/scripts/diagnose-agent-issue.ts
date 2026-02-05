/**
 * Diagnostic Script: Identify why wrong agent is being used
 *
 * Usage: npx ts-node src/scripts/diagnose-agent-issue.ts voxanne@demo.com
 *
 * Checks:
 * 1. Find org_id for email
 * 2. Count outbound agents for that org
 * 3. Check vapi_assistant_id and vapi_phone_number_id values
 * 4. List all agents to identify duplicates/stale agents
 * 5. Recommend fixes
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseAgentIssue(userEmail: string) {
  console.log(`\n🔍 DIAGNOSING AGENT ISSUE FOR: ${userEmail}\n`);

  try {
    // Step 1: Find org_id for the email
    console.log('📍 Step 1: Finding organization...');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, email, created_at')
      .eq('email', userEmail);

    if (orgError) {
      console.error('❌ Database error:', orgError);
      return;
    }

    if (!orgs || orgs.length === 0) {
      console.error(`❌ No organization found with email: ${userEmail}`);
      return;
    }

    if (orgs.length > 1) {
      console.warn(`⚠️  WARNING: ${orgs.length} organizations found with this email!`);
    }

    const org = orgs[0];
    const orgId = org.id;

    console.log(`✅ Found org: ${org.email}`);
    console.log(`   Org ID: ${orgId}`);
    console.log(`   Created: ${org.created_at}\n`);

    // Step 2: Find all agents for this org
    console.log('📊 Step 2: Finding agents for this organization...');
    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('id, name, role, vapi_assistant_id, vapi_phone_number_id, system_prompt, created_at, updated_at')
      .eq('org_id', orgId)
      .order('role', { ascending: true })
      .order('created_at', { ascending: false });

    if (agentError) {
      console.error('❌ Database error:', agentError);
      return;
    }

    if (!agents || agents.length === 0) {
      console.error(`❌ No agents found for org ${orgId}`);
      return;
    }

    console.log(`✅ Found ${agents.length} total agents\n`);

    // Group by role
    const agentsByRole: Record<string, any[]> = {};
    agents.forEach(agent => {
      if (!agentsByRole[agent.role]) {
        agentsByRole[agent.role] = [];
      }
      agentsByRole[agent.role].push(agent);
    });

    // Step 3: Analyze outbound agents
    console.log('🎯 Step 3: Analyzing OUTBOUND agents...');
    const outboundAgents = agentsByRole['outbound'] || [];

    if (outboundAgents.length === 0) {
      console.error('❌ NO OUTBOUND AGENT CONFIGURED');
      console.log('   Action: User must configure an outbound agent first\n');
    } else if (outboundAgents.length === 1) {
      console.log(`✅ Found 1 outbound agent (GOOD)\n`);
      printAgentDetails(outboundAgents[0]);
    } else {
      console.error(`❌ FOUND ${outboundAgents.length} OUTBOUND AGENTS (DATA CORRUPTION!)`);
      console.log('   This is the PROBLEM - multiple agents with same role\n');
      outboundAgents.forEach((agent, index) => {
        console.log(`   Agent ${index + 1}:`);
        printAgentDetails(agent, '   ');
      });
      console.log('\n   FIX: Keep most recent one, delete others');
      console.log(`   Most recent ID: ${outboundAgents[0].id}\n`);
    }

    // Step 4: Analyze inbound agents
    console.log('🎯 Step 4: Analyzing INBOUND agents...');
    const inboundAgents = agentsByRole['inbound'] || [];

    if (inboundAgents.length === 0) {
      console.log('⚠️  No inbound agent configured');
    } else if (inboundAgents.length === 1) {
      console.log(`✅ Found 1 inbound agent (GOOD)\n`);
      printAgentDetails(inboundAgents[0]);
    } else {
      console.error(`⚠️  Found ${inboundAgents.length} inbound agents`);
      inboundAgents.forEach((agent, index) => {
        console.log(`   Agent ${index + 1}:`);
        printAgentDetails(agent, '   ');
      });
    }

    // Step 5: Check for NULL assistant IDs
    console.log('\n🚨 Step 5: Checking for NULL vapi_assistant_id...');
    const nullAssistantAgents = agents.filter(a => !a.vapi_assistant_id);
    if (nullAssistantAgents.length === 0) {
      console.log('✅ All agents have vapi_assistant_id populated (GOOD)\n');
    } else {
      console.error(`❌ ${nullAssistantAgents.length} agents have NULL vapi_assistant_id`);
      nullAssistantAgents.forEach(agent => {
        console.log(`   - ${agent.role} agent (ID: ${agent.id.slice(0, 8)}...)`);
      });
      console.log('   These will use legacy ensureAssistantSynced() fallback\n');
    }

    // Step 6: Check for NULL phone numbers
    console.log('📱 Step 6: Checking for NULL vapi_phone_number_id...');
    const nullPhoneAgents = agents.filter(a => !a.vapi_phone_number_id);
    if (nullPhoneAgents.length === 0) {
      console.log('✅ All agents have vapi_phone_number_id populated (GOOD)\n');
    } else {
      console.warn(`⚠️  ${nullPhoneAgents.length} agents have NULL vapi_phone_number_id`);
      nullPhoneAgents.forEach(agent => {
        console.log(`   - ${agent.role} agent will auto-resolve phone number`);
      });
      console.log();
    }

    // Step 7: Summary and recommendations
    console.log('📋 DIAGNOSTIC SUMMARY\n');
    console.log(`Organization: ${org.email}`);
    console.log(`Org ID: ${orgId}`);
    console.log(`Total Agents: ${agents.length}`);
    console.log(`Outbound Agents: ${outboundAgents.length}`);
    console.log(`Inbound Agents: ${inboundAgents.length}`);

    const hasIssues =
      outboundAgents.length !== 1 ||
      nullAssistantAgents.length > 0 ||
      nullPhoneAgents.length > 0;

    if (hasIssues) {
      console.log('\n⚠️  ISSUES DETECTED:\n');

      if (outboundAgents.length === 0) {
        console.log('1. ❌ No outbound agent configured');
        console.log('   FIX: User must save outbound agent in dashboard\n');
      } else if (outboundAgents.length > 1) {
        console.log(`1. ❌ ${outboundAgents.length} outbound agents found (should be 1)`);
        console.log(`   FIX: Delete stale agent(s), keep most recent:\n`);
        console.log(`   npx ts-node src/scripts/cleanup-duplicate-agents.ts --org-id ${orgId}\n`);
      }

      if (nullAssistantAgents.length > 0) {
        console.log(`2. ❌ ${nullAssistantAgents.length} agent(s) have NULL vapi_assistant_id`);
        console.log('   FIX: Save agent config again in dashboard\n');
      }

      if (nullPhoneAgents.length > 0) {
        console.log(`3. ⚠️  ${nullPhoneAgents.length} agent(s) have NULL vapi_phone_number_id`);
        console.log('   FIX: Select phone number in agent config and save\n');
      }
    } else {
      console.log('\n✅ NO ISSUES DETECTED');
      console.log('Database state looks correct. Issue may be elsewhere.');
      console.log('Check: JWT token org_id, user permissions, etc.\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

function printAgentDetails(agent: any, prefix = '') {
  const truncateId = (id: string) => id ? id.slice(0, 8) + '...' : 'NULL';

  console.log(`${prefix}  ID: ${truncateId(agent.id)}`);
  console.log(`${prefix}  Name: ${agent.name || '(no name)'}`);
  console.log(`${prefix}  Role: ${agent.role}`);
  console.log(`${prefix}  System Prompt: ${agent.system_prompt ? '✅ set' : '❌ NULL'}`);
  console.log(`${prefix}  Assistant ID: ${agent.vapi_assistant_id ? '✅ ' + truncateId(agent.vapi_assistant_id) : '❌ NULL'}`);
  console.log(`${prefix}  Phone ID: ${agent.vapi_phone_number_id ? '✅ ' + truncateId(agent.vapi_phone_number_id) : '❌ NULL'}`);
  console.log(`${prefix}  Created: ${new Date(agent.created_at).toLocaleString()}`);
  console.log(`${prefix}  Updated: ${new Date(agent.updated_at).toLocaleString()}`);
  console.log();
}

// Main execution
const userEmail = process.argv[2];
if (!userEmail) {
  console.error('Usage: npx ts-node src/scripts/diagnose-agent-issue.ts <email>');
  console.error('Example: npx ts-node src/scripts/diagnose-agent-issue.ts voxanne@demo.com');
  process.exit(1);
}

diagnoseAgentIssue(userEmail).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
