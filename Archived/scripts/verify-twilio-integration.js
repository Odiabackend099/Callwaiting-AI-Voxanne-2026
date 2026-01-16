#!/usr/bin/env node
/**
 * Verification script to test Twilio agent integration fix
 * Run this after executing the migration and saving API keys
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verify() {
    console.log('=== TWILIO AGENT INTEGRATION VERIFICATION ===\n');

    let allPassed = true;

    // Test 1: Check inbound_agent_config table exists
    console.log('1. Checking inbound_agent_config table...');
    const { data: inboundConfig, error: inboundError } = await supabase
        .from('inbound_agent_config')
        .select('*')
        .limit(1);

    if (inboundError) {
        if (inboundError.code === '42P01') {
            console.log('   ❌ FAIL: Table does not exist');
            console.log('   → Run migration: backend/migrations/20251218_create_inbound_agent_config.sql');
            allPassed = false;
        } else {
            console.log('   ❌ FAIL: Error querying table:', inboundError.message);
            allPassed = false;
        }
    } else {
        console.log('   ✅ PASS: Table exists');
    }

    // Test 2: Check inbound_agent_config has credentials
    console.log('\n2. Checking inbound_agent_config credentials...');
    const { data: inboundCreds } = await supabase
        .from('inbound_agent_config')
        .select('vapi_api_key, vapi_assistant_id, twilio_account_sid, twilio_phone_number')
        .maybeSingle();

    if (!inboundCreds) {
        console.log('   ⚠️  WARN: No inbound config found');
        console.log('   → Save API keys in dashboard to populate');
    } else if (!inboundCreds.vapi_api_key || !inboundCreds.vapi_assistant_id) {
        console.log('   ❌ FAIL: Missing credentials');
        console.log('      - vapi_api_key:', inboundCreds.vapi_api_key ? '✅' : '❌ NULL');
        console.log('      - vapi_assistant_id:', inboundCreds.vapi_assistant_id ? '✅' : '❌ NULL');
        console.log('      - twilio_account_sid:', inboundCreds.twilio_account_sid ? '✅' : '❌ NULL');
        console.log('      - twilio_phone_number:', inboundCreds.twilio_phone_number ? '✅' : '❌ NULL');
        console.log('   → Save API keys in dashboard to populate');
        allPassed = false;
    } else {
        console.log('   ✅ PASS: Credentials populated');
        console.log('      - vapi_api_key: ***MASKED***');
        console.log('      - vapi_assistant_id:', inboundCreds.vapi_assistant_id.slice(0, 20) + '...');
        console.log('      - twilio_account_sid:', inboundCreds.twilio_account_sid || 'NULL');
        console.log('      - twilio_phone_number:', inboundCreds.twilio_phone_number || 'NULL');
    }

    // Test 3: Check outbound_agent_config has credentials
    console.log('\n3. Checking outbound_agent_config credentials...');
    const { data: outboundCreds } = await supabase
        .from('outbound_agent_config')
        .select('vapi_api_key, vapi_assistant_id, twilio_account_sid, twilio_phone_number')
        .maybeSingle();

    if (!outboundCreds) {
        console.log('   ⚠️  WARN: No outbound config found');
        console.log('   → Save API keys in dashboard to populate');
    } else if (!outboundCreds.vapi_api_key || !outboundCreds.vapi_assistant_id) {
        console.log('   ❌ FAIL: Missing credentials');
        console.log('      - vapi_api_key:', outboundCreds.vapi_api_key ? '✅' : '❌ NULL');
        console.log('      - vapi_assistant_id:', outboundCreds.vapi_assistant_id ? '✅' : '❌ NULL');
        console.log('      - twilio_account_sid:', outboundCreds.twilio_account_sid ? '✅' : '❌ NULL');
        console.log('      - twilio_phone_number:', outboundCreds.twilio_phone_number ? '✅' : '❌ NULL');
        console.log('   → Save API keys in dashboard to populate');
        allPassed = false;
    } else {
        console.log('   ✅ PASS: Credentials populated');
        console.log('      - vapi_api_key: ***MASKED***');
        console.log('      - vapi_assistant_id:', outboundCreds.vapi_assistant_id.slice(0, 20) + '...');
        console.log('      - twilio_account_sid:', outboundCreds.twilio_account_sid || 'NULL');
        console.log('      - twilio_phone_number:', outboundCreds.twilio_phone_number || 'NULL');
    }

    // Test 4: Verify agents table still has vapi_assistant_id
    console.log('\n4. Checking agents table...');
    const { data: agents } = await supabase
        .from('agents')
        .select('role, vapi_assistant_id')
        .in('role', ['inbound', 'outbound']);

    if (!agents || agents.length === 0) {
        console.log('   ❌ FAIL: No agents found');
        allPassed = false;
    } else {
        console.log('   ✅ PASS: Agents found');
        agents.forEach(a => {
            console.log(`      - ${a.role}: ${a.vapi_assistant_id ? a.vapi_assistant_id.slice(0, 20) + '...' : '❌ NULL'}`);
        });
    }

    // Summary
    console.log('\n=== VERIFICATION SUMMARY ===');
    if (allPassed) {
        console.log('✅ All tests passed! System is ready.');
        console.log('\nNext steps:');
        console.log('1. Test inbound call: Call your Twilio number');
        console.log('2. Test outbound call: Trigger outbound call from dashboard');
        console.log('3. Verify web test still works');
    } else {
        console.log('❌ Some tests failed. Review errors above.');
        console.log('\nRequired actions:');
        console.log('1. Run migration if table doesn\'t exist');
        console.log('2. Save API keys in dashboard to populate config tables');
    }
}

verify().catch(console.error);
