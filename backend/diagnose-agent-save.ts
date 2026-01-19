#!/usr/bin/env ts-node

/**
 * DIAGNOSTIC: Agent Save Flow Debugging
 * 
 * This script audits:
 * 1. Database agents for MedSpa Aesthetics (1:00 PM - 13:00 timeframe)
 * 2. Vapi integration status
 * 3. Tool sync status
 * 4. Assistant sync status in Vapi
 */

import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnoseMedSpaAgents() {
  console.log('🔍 DIAGNOSTIC: Agent Save Flow for MedSpa Aesthetics\n');
  console.log('=' .repeat(70));

  try {
    // 1. Find MedSpa Aesthetics organization
    console.log('\n1️⃣ Finding MedSpa Aesthetics organization...\n');
    
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
      console.log('\nTrying exact search for "MedSpa Aesthetics"...');
      
      const { data: exactOrgs } = await supabase
        .from('organizations')
        .select('id, name, created_at')
        .eq('name', 'MedSpa Aesthetics');

      if (!exactOrgs || exactOrgs.length === 0) {
        console.log('❌ Still no match. Listing all organizations:');
        const { data: allOrgs } = await supabase
          .from('organizations')
          .select('id, name, created_at')
          .limit(20);
        
        allOrgs?.forEach((o, i) => {
          console.log(`  ${i + 1}. ${o.name} (${o.id.substring(0, 8)}...)`);
        });
        process.exit(1);
      }

      orgs?.push(...(exactOrgs || []));
    }

    console.log(`✅ Found ${orgs.length} organization(s):`);
    orgs.forEach((org) => {
      console.log(`   • ${org.name} (${org.id})`);
    });

    const orgId = orgs[0].id;
    console.log(`\n📌 Using org: ${orgs[0].name}\n`);

    // 2. Find agents for this org saved around 13:00 (1:00 PM)
    console.log('2️⃣ Querying agents saved around 13:00 (1:00 PM)...\n');

    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('id, name, role, system_prompt, voice, vapi_assistant_id, created_at, updated_at, status')
      .eq('org_id', orgId);

    if (agentError) {
      console.error('❌ Error querying agents:', agentError.message);
      process.exit(1);
    }

    if (!agents || agents.length === 0) {
      console.log('❌ No agents found for this organization');
    } else {
      console.log(`✅ Found ${agents.length} agent(s):\n`);
      
      agents.forEach((agent, i) => {
        const createdHour = new Date(agent.created_at).getHours();
        const updatedHour = new Date(agent.updated_at).getHours();
        
        console.log(`${i + 1}. Agent: ${agent.name || `(unnamed)`}`);
        console.log(`   ID: ${agent.id}`);
        console.log(`   Role: ${agent.role}`);
        console.log(`   Status: ${agent.status || 'unknown'}`);
        console.log(`   Created: ${agent.created_at} (hour: ${createdHour})`);
        console.log(`   Updated: ${agent.updated_at} (hour: ${updatedHour})`);
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
        console.log('✅ Inbound Agent Config Found:');
        console.log(`   System Prompt: ${inboundConfig.system_prompt?.substring(0, 50)}...`);
        console.log(`   Voice: ${inboundConfig.voice_id || 'default'}`);
        console.log(`   Language: ${inboundConfig.language || 'en'}`);
        console.log();
      } else {
        console.log('❌ No inbound agent config found\n');
      }

      if (outboundConfig) {
        console.log('✅ Outbound Agent Config Found:');
        console.log(`   System Prompt: ${outboundConfig.system_prompt?.substring(0, 50)}...`);
        console.log(`   Voice: ${outboundConfig.voice_id || 'default'}`);
        console.log();
      } else {
        console.log('❌ No outbound agent config found\n');
      }

      // 4. Check org tools (tool sync status)
      console.log('4️⃣ Checking tool sync status...\n');

      const { data: orgTools } = await supabase
        .from('org_tools')
        .select('tool_name, vapi_tool_id, definition_hash, created_at')
        .eq('org_id', orgId);

      if (orgTools && orgTools.length > 0) {
        console.log(`✅ Found ${orgTools.length} tool(s):`);
        orgTools.forEach((tool) => {
          console.log(`   • ${tool.tool_name}`);
          console.log(`     Vapi Tool ID: ${tool.vapi_tool_id || '❌ NOT SET'}`);
          console.log(`     Definition Hash: ${tool.definition_hash?.substring(0, 8) || '❌ NOT SET'}...`);
          console.log(`     Created: ${tool.created_at}`);
          console.log();
        });
      } else {
        console.log('❌ No tools registered for this org\n');
      }

      // 5. Check Vapi status if API key available
      if (VAPI_PRIVATE_KEY && agents.length > 0) {
        console.log('5️⃣ Checking Vapi assistant status...\n');

        const inboundAgent = agents.find(a => a.role === 'inbound');
        if (inboundAgent && inboundAgent.vapi_assistant_id) {
          try {
            const response = await fetch(`https://api.vapi.ai/assistant/${inboundAgent.vapi_assistant_id}`, {
              headers: { Authorization: `Bearer ${VAPI_PRIVATE_KEY}` }
            });

            if (response.ok) {
              const assistant = await response.json();
              console.log(`✅ Assistant exists in Vapi:`);
              console.log(`   Name: ${assistant.name}`);
              console.log(`   Status: ${assistant.status || 'active'}`);
              console.log(`   Tools: ${assistant.model?.toolIds?.length || 0} registered`);
              console.log();
            } else {
              console.log(`❌ Assistant NOT found in Vapi (HTTP ${response.status})`);
              console.log(`   ID: ${inboundAgent.vapi_assistant_id}`);
              console.log();
            }
          } catch (err: any) {
            console.error(`❌ Error checking Vapi:`, err.message);
          }
        }
      }

      // SUMMARY
      console.log('=' .repeat(70));
      console.log('\n📊 SUMMARY:\n');

      const hasAgents = agents.length > 0;
      const hasAssistantId = agents.some(a => a.vapi_assistant_id);
      const hasToolsRegistered = orgTools && orgTools.length > 0;
      const hasValidConfig = inboundConfig || outboundConfig;

      console.log(`✅/❌ Agents in database: ${hasAgents ? '✅ YES' : '❌ NO'}`);
      console.log(`✅/❌ Vapi Assistant ID saved: ${hasAssistantId ? '✅ YES' : '❌ NO'}`);
      console.log(`✅/❌ Tools registered: ${hasToolsRegistered ? '✅ YES' : '❌ NO'}`);
      console.log(`✅/❌ Agent config exists: ${hasValidConfig ? '✅ YES' : '❌ NO'}`);

      console.log('\n🔍 POSSIBLE ISSUES:\n');

      if (!hasAssistantId) {
        console.log('❌ CRITICAL: No Vapi Assistant ID in database');
        console.log('   → Agent was saved locally but NOT synced to Vapi');
        console.log('   → This explains why it doesn\'t show in Vapi dashboard');
      }

      if (!hasToolsRegistered) {
        console.log('⚠️  WARNING: No tools registered in org_tools table');
        console.log('   → Tool sync may have failed or skipped');
      }

      if (hasAssistantId && agents.find(a => a.vapi_assistant_id)) {
        console.log('✅ Agent is synced to Vapi, checking if issue is visibility...');
      }
    }

  } catch (err: any) {
    console.error('❌ Unexpected error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run diagnostic
diagnoseMedSpaAgents();
