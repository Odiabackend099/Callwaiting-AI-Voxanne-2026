#!/usr/bin/env node

/**
 * DIAGNOSTIC: Agent Save Flow Debugging (Node.js version)
 */

const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnoseMedSpaAgents() {
  console.log('\n🔍 DIAGNOSTIC: Agent Save Flow for MedSpa Aesthetics\n');
  console.log('=' .repeat(70) + '\n');

  try {
    // 1. Find MedSpa Aesthetics organization
    console.log('1️⃣ Finding MedSpa Aesthetics organization...\n');
    
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .ilike('name', '%medspa%');

    if (orgError) {
      console.error('❌ Error querying organizations:', orgError.message);
      process.exit(1);
    }

    if (!orgs || orgs.length === 0) {
      console.log('❌ No organization found matching "medspa"');
      process.exit(1);
    }

    console.log(`✅ Found ${orgs.length} organization(s):`);
    orgs.forEach((org) => {
      console.log(`   • ${org.name} (${org.id.substring(0, 8)}...)`);
    });

    const orgId = orgs[0].id;
    console.log(`\n📌 Using org: ${orgs[0].name}\n`);

    // 2. Find agents for this org
    console.log('2️⃣ Querying agents...\n');

    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('id, name, role, system_prompt, voice, vapi_assistant_id, created_at, updated_at, status')
      .eq('org_id', orgId);

    if (agentError) {
      console.error('❌ Error querying agents:', agentError.message);
      process.exit(1);
    }

    if (!agents || agents.length === 0) {
      console.log('❌ No agents found for this organization\n');
    } else {
      console.log(`✅ Found ${agents.length} agent(s):\n`);
      
      agents.forEach((agent, i) => {
        console.log(`${i + 1}. Agent: ${agent.name || `(unnamed)`}`);
        console.log(`   ID: ${agent.id}`);
        console.log(`   Role: ${agent.role}`);
        console.log(`   Status: ${agent.status || 'unknown'}`);
        console.log(`   Created: ${agent.created_at}`);
        console.log(`   Updated: ${agent.updated_at}`);
        console.log(`   Vapi Assistant ID: ${agent.vapi_assistant_id || '❌ NOT SET'}`);
        console.log(`   System Prompt: ${agent.system_prompt?.substring(0, 50) || '(none)'}...`);
        console.log(`   Voice: ${agent.voice || 'default'}`);
        console.log();
      });

      // 3. Check agent config
      console.log('3️⃣ Checking agent configuration...\n');

      const { data: inboundConfig } = await supabase
        .from('inbound_agent_config')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

      const { data: outboundConfig } = await supabase
        .from('outbound_agent_config')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

      if (inboundConfig) {
        console.log('✅ Inbound Agent Config Found');
      } else {
        console.log('❌ No inbound agent config found');
      }

      if (outboundConfig) {
        console.log('✅ Outbound Agent Config Found');
      } else {
        console.log('❌ No outbound agent config found');
      }
      console.log();

      // 4. Check org tools
      console.log('4️⃣ Checking tool sync status...\n');

      const { data: orgTools } = await supabase
        .from('org_tools')
        .select('tool_name, vapi_tool_id, definition_hash, created_at')
        .eq('org_id', orgId);

      if (orgTools && orgTools.length > 0) {
        console.log(`✅ Found ${orgTools.length} tool(s)`);
      } else {
        console.log('❌ No tools registered for this org');
      }
      console.log();

      // SUMMARY
      console.log('=' .repeat(70));
      console.log('\n📊 SUMMARY:\n');

      const hasAgents = agents.length > 0;
      const hasAssistantId = agents.some(a => a.vapi_assistant_id);

      console.log(`• Agents in database: ${hasAgents ? '✅ YES' : '❌ NO'}`);
      console.log(`• Vapi Assistant ID saved: ${hasAssistantId ? '✅ YES' : '❌ NO'}`);
      console.log(`• Tools registered: ${orgTools && orgTools.length > 0 ? '✅ YES' : '❌ NO'}`);

      if (!hasAssistantId) {
        console.log('\n🔴 CRITICAL ISSUE:');
        console.log('   Agent was saved locally but NOT synced to Vapi');
        console.log('   → Vapi Assistant ID is NULL in database');
        console.log('   → This explains why it doesn\'t show in Vapi dashboard');
      }
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

// Run diagnostic
diagnoseMedSpaAgents().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
