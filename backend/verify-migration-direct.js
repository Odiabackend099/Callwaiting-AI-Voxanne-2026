#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('\n🔍 MIGRATION VERIFICATION\n');

  try {
    // Check if unified calls table exists
    console.log('1️⃣ Checking unified calls table...');
    const { count: callsCount, error: callsError } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true });

    if (callsError) {
      console.log(`   ❌ Error: ${callsError.message}`);
      return;
    }

    console.log(`   ✅ Table exists with ${callsCount || 0} rows\n`);

    // Check call_direction breakdown
    console.log('2️⃣ Checking call direction breakdown...');
    const { data: calls, error: detailError } = await supabase
      .from('calls')
      .select('id, call_direction, phone_number, caller_name, duration_seconds, sentiment_label');

    if (detailError) {
      console.log(`   ❌ Error: ${detailError.message}`);
      return;
    }

    const inboundCount = calls?.filter(c => c.call_direction === 'inbound').length || 0;
    const outboundCount = calls?.filter(c => c.call_direction === 'outbound').length || 0;
    console.log(`   ✅ Inbound: ${inboundCount}, Outbound: ${outboundCount}\n`);

    // Show sample calls
    if (calls && calls.length > 0) {
      console.log('3️⃣ Sample calls:\n');
      calls.slice(0, 3).forEach((call, i) => {
        console.log(`   Call ${i + 1}:`);
        console.log(`     - Direction: ${call.call_direction}`);
        console.log(`     - Phone: ${call.phone_number || 'N/A'}`);
        console.log(`     - Caller: ${call.caller_name || 'N/A'}`);
        console.log(`     - Duration: ${call.duration_seconds || 0}s`);
        console.log(`     - Sentiment: ${call.sentiment_label || 'Not set'}\n`);
      });
    } else {
      console.log('   ℹ️  No calls in database yet\n');
    }

    // Check legacy tables
    console.log('4️⃣ Checking legacy tables...');
    const { count: legacyCount, error: legacyError } = await supabase
      .from('call_logs_legacy')
      .select('*', { count: 'exact', head: true });

    if (legacyError) {
      console.log(`   ❌ call_logs_legacy not found (${legacyError.message})`);
    } else {
      console.log(`   ✅ call_logs_legacy exists with ${legacyCount || 0} rows`);
    }

    console.log('\n✅ MIGRATION VERIFICATION COMPLETE\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verify();
