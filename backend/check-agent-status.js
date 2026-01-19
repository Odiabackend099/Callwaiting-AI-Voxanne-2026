#!/usr/bin/env node

/**
 * Agent Sync Status Checker
 * Queries Supabase to verify agent sync status
 * Usage: node check-agent-status.js [org_name_filter]
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  try {
    console.log('🔍 Querying organization and agent status...\n');

    // Step 1: Get organizations
    console.log('📋 Organizations:');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (orgError) {
      console.error('❌ Failed to query organizations:', orgError.message);
      process.exit(1);
    }

    if (!orgs || orgs.length === 0) {
      console.error('❌ No organizations found');
      process.exit(1);
    }

    orgs.forEach(org => {
      const filter = process.argv[2];
      const matches = !filter || org.name.toLowerCase().includes(filter.toLowerCase());
      const marker = matches ? '👉' : '  ';
      console.log(`${marker} ${org.name}`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Created: ${new Date(org.created_at).toISOString().split('T')[0]}\n`);
    });

    // Step 2: Get agents for each org
    console.log('\n📊 Agent Sync Status by Organization:\n');

    for (const org of orgs) {
      const { data: agents, error: agentError } = await supabase
        .from('agents')
        .select('id, role, name, vapi_assistant_id, created_at, updated_at')
        .eq('org_id', org.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (agentError) {
        console.error(`❌ Failed to query agents for ${org.name}:`, agentError.message);
        continue;
      }

      if (!agents || agents.length === 0) {
        console.log(`${org.name}: No agents found\n`);
        continue;
      }

      console.log(`${org.name} (${org.id}):`);
      console.log(`  Total agents: ${agents.length}\n`);

      agents.forEach((agent, idx) => {
        const synced = agent.vapi_assistant_id ? '✅ SYNCED' : '❌ NOT SYNCED';
        const assistantId = agent.vapi_assistant_id || '(NULL)';

        console.log(`  [${idx + 1}] ${agent.role.toUpperCase()}`);
        console.log(`      Name: ${agent.name}`);
        console.log(`      Status: ${synced}`);
        console.log(`      Vapi ID: ${assistantId}`);
        console.log(`      Updated: ${new Date(agent.updated_at).toISOString()}\n`);
      });
    }

    // Step 3: Summary
    const allAgents = [];
    for (const org of orgs) {
      const { data: agents } = await supabase
        .from('agents')
        .select('id, vapi_assistant_id')
        .eq('org_id', org.id);
      allAgents.push(...(agents || []));
    }

    const synced = allAgents.filter(a => a.vapi_assistant_id).length;
    const notSynced = allAgents.filter(a => !a.vapi_assistant_id).length;

    console.log('\n📈 Summary:');
    console.log(`   Total agents: ${allAgents.length}`);
    console.log(`   ✅ Synced to Vapi: ${synced}`);
    console.log(`   ❌ Not synced: ${notSynced}`);
    console.log(`   Sync rate: ${allAgents.length > 0 ? ((synced / allAgents.length) * 100).toFixed(1) : 0}%\n`);

    // Step 4: Identify problems
    if (notSynced > 0) {
      console.log('⚠️  Issues Found:');
      console.log(`   ${notSynced} agent(s) have NOT synced to Vapi`);
      console.log('   Possible causes:');
      console.log('   1. VAPI_PRIVATE_KEY is missing or invalid');
      console.log('   2. Vapi API error (check backend logs)');
      console.log('   3. Database update failed');
      console.log('\n   Next steps:');
      console.log('   1. Check backend logs: grep "failed to sync\|Vapi assistant creation failed" logs');
      console.log('   2. Verify VAPI_PRIVATE_KEY in backend/.env');
      console.log('   3. Try saving an agent again and monitor backend logs\n');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

main();
