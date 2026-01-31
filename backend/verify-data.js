#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('\n✅ PHASE 6 DATA VERIFICATION\n');

  try {
    // 1. Check table exists and has data
    const { count: totalCount, error: countError } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true });

    console.log('1️⃣ Unified calls table:');
    if (countError) {
      console.log(`   ❌ Error: ${countError.message}`);
    } else {
      console.log(`   ✅ Total rows: ${totalCount}`);
    }

    // 2. Get actual calls
    const { data: calls, error: dataError } = await supabase
      .from('calls')
      .select('id, org_id, call_direction, from_number, call_type, created_at')
      .limit(5);

    if (dataError) {
      console.log(`\n❌ Error fetching data: ${dataError.message}`);
    } else {
      console.log(`\n2️⃣ Sample calls (first ${calls?.length || 0}):`);
      calls?.forEach((call, i) => {
        console.log(`   Call ${i + 1}:`);
        console.log(`     - Direction: ${call.call_direction}`);
        console.log(`     - Org ID: ${call.org_id}`);
        console.log(`     - Phone: ${call.from_number || 'NULL'}`);
        console.log(`     - Created: ${call.created_at}`);
      });
    }

    // 3. Check legacy tables
    const { count: legacyCount, error: legacyError } = await supabase
      .from('call_logs_legacy')
      .select('*', { count: 'exact', head: true });

    console.log(`\n3️⃣ Legacy call_logs_legacy table:`);
    if (legacyError) {
      console.log(`   ⚠️ Not found: ${legacyError.message}`);
    } else {
      console.log(`   ✅ Rows: ${legacyCount}`);
    }

    // 4. Check call_direction distribution
    const { data: distribution } = await supabase
      .rpc('get_call_direction_breakdown')
      .catch(() => ({
        data: null
      }));

    if (distribution) {
      console.log(`\n4️⃣ Call direction breakdown:`);
      console.log(`   ${JSON.stringify(distribution)}`);
    } else {
      // Manual query
      const { data: inboundCalls } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('call_direction', 'inbound');

      const { data: outboundCalls } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('call_direction', 'outbound');

      console.log(`\n4️⃣ Call direction breakdown:`);
      console.log(`   Inbound: ${inboundCalls?.length || 0}`);
      console.log(`   Outbound: ${outboundCalls?.length || 0}`);
    }

    console.log('\n✅ VERIFICATION COMPLETE\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

verify();
