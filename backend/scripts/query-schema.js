#!/usr/bin/env node
/**
 * Query Supabase schema to diagnose agent config tables
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function querySchema() {
    console.log('=== QUERYING SUPABASE SCHEMA ===\n');

    // 1. Check agents table
    console.log('1. AGENTS TABLE:');
    const { data: agents, error: agentsError } = await supabase
        .from('agents')
        .select('id, role, vapi_assistant_id, system_prompt, first_message, voice, language')
        .limit(5);

    if (agentsError) {
        console.log('  ❌ Error:', agentsError.message);
    } else {
        console.log(`  ✅ Found ${agents.length} agents`);
        agents.forEach(a => {
            console.log(`    - ${a.role}: vapi_assistant_id = ${a.vapi_assistant_id ? a.vapi_assistant_id.slice(0, 20) + '...' : 'NULL'}`);
        });
    }

    // 2. Check outbound_agent_config table
    console.log('\n2. OUTBOUND_AGENT_CONFIG TABLE:');
    const { data: outboundConfig, error: outboundError } = await supabase
        .from('outbound_agent_config')
        .select('*')
        .limit(5);

    if (outboundError) {
        console.log('  ❌ Error:', outboundError.message);
        if (outboundError.code === '42P01') {
            console.log('  ⚠️  Table does NOT exist');
        }
    } else {
        console.log(`  ✅ Found ${outboundConfig.length} configs`);
        if (outboundConfig.length > 0) {
            const config = outboundConfig[0];
            console.log('    Columns:', Object.keys(config).join(', '));
            console.log('    Sample data:');
            console.log('      - vapi_api_key:', config.vapi_api_key ? '***MASKED***' : 'NULL');
            console.log('      - vapi_assistant_id:', config.vapi_assistant_id || 'NULL');
            console.log('      - twilio_account_sid:', config.twilio_account_sid || 'NULL');
            console.log('      - twilio_auth_token:', config.twilio_auth_token ? '***MASKED***' : 'NULL');
            console.log('      - twilio_phone_number:', config.twilio_phone_number || 'NULL');
        }
    }

    // 3. Check inbound_agent_config table
    console.log('\n3. INBOUND_AGENT_CONFIG TABLE:');
    const { data: inboundConfig, error: inboundError } = await supabase
        .from('inbound_agent_config')
        .select('*')
        .limit(5);

    if (inboundError) {
        console.log('  ❌ Error:', inboundError.message);
        if (inboundError.code === '42P01') {
            console.log('  ⚠️  Table does NOT exist');
        }
    } else {
        console.log(`  ✅ Found ${inboundConfig.length} configs`);
        if (inboundConfig.length > 0) {
            const config = inboundConfig[0];
            console.log('    Columns:', Object.keys(config).join(', '));
            console.log('    Sample data:');
            console.log('      - vapi_api_key:', config.vapi_api_key ? '***MASKED***' : 'NULL');
            console.log('      - vapi_assistant_id:', config.vapi_assistant_id || 'NULL');
            console.log('      - twilio_account_sid:', config.twilio_account_sid || 'NULL');
            console.log('      - twilio_auth_token:', config.twilio_auth_token ? '***MASKED***' : 'NULL');
            console.log('      - twilio_phone_number:', config.twilio_phone_number || 'NULL');
        }
    }

    // 4. Check integrations table
    console.log('\n4. INTEGRATIONS TABLE (for Vapi/Twilio keys):');
    const { data: integrations, error: integrationsError } = await supabase
        .from('integrations')
        .select('provider, config')
        .in('provider', ['vapi', 'twilio', 'twilio_inbound']);

    if (integrationsError) {
        console.log('  ❌ Error:', integrationsError.message);
    } else {
        console.log(`  ✅ Found ${integrations.length} integrations`);
        integrations.forEach(i => {
            console.log(`    - ${i.provider}:`, i.config ? Object.keys(i.config).join(', ') : 'NULL');
        });
    }

    console.log('\n=== DIAGNOSIS COMPLETE ===');
}

querySchema().catch(console.error);
