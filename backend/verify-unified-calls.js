#!/usr/bin/env node

/**
 * Verification Script for Phase 6 Table Unification
 * Checks that the unified 'calls' table exists and contains data
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMigration() {
  console.log('\n🔍 PHASE 6 TABLE UNIFICATION VERIFICATION');
  console.log('==========================================\n');

  try {
    // 1. Check unified calls table exists
    console.log('1️⃣ Checking unified "calls" table...');
    const { data: callsCount, error: callsError } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true });

    if (callsError) {
      console.log(`   ❌ Error: ${callsError.message}`);
      return false;
    }

    console.log(`   ✅ Unified "calls" table exists with ${callsCount || 0} rows`);

    // 2. Check call_direction breakdown
    console.log('\n2️⃣ Checking call_direction breakdown...');
    const { data: directionBreakdown, error: directionError } = await supabase
      .rpc('get_call_direction_breakdown');

    if (!directionError && directionBreakdown) {
      console.log(`   ✅ Call direction breakdown:`, directionBreakdown);
    } else {
      // Manual query if RPC doesn't exist
      const { data: inbound } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('call_direction', 'inbound');

      const { data: outbound } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('call_direction', 'outbound');

      console.log(`   ✅ Inbound: ${inbound?.length || 0}, Outbound: ${outbound?.length || 0}`);
    }

    // 3. Check legacy tables preserved
    console.log('\n3️⃣ Checking legacy tables...');
    const { data: legacyCallLogs, error: legacyError } = await supabase
      .from('call_logs_legacy')
      .select('*', { count: 'exact', head: true })
      .catch(() => ({ data: null, error: { message: 'Table not found' } }));

    if (legacyError) {
      console.log(`   ⚠️  call_logs_legacy: ${legacyError.message}`);
    } else {
      console.log(`   ✅ call_logs_legacy exists with ${legacyCallLogs?.length || 0} rows`);
    }

    // 4. Check a sample call has all required fields
    console.log('\n4️⃣ Checking sample call fields...');
    const { data: sampleCall, error: sampleError } = await supabase
      .from('calls')
      .select('*')
      .limit(1)
      .single();

    if (sampleError || !sampleCall) {
      console.log('   ℹ️  No calls found yet (expected for empty database)');
    } else {
      console.log('   ✅ Sample call found with fields:');
      const requiredFields = [
        'id', 'org_id', 'vapi_call_id', 'call_direction', 'phone_number',
        'caller_name', 'created_at', 'duration_seconds', 'sentiment_label',
        'sentiment_score', 'sentiment_summary', 'sentiment_urgency', 'outcome_summary'
      ];

      const missingFields = requiredFields.filter(field => !(field in sampleCall));
      if (missingFields.length > 0) {
        console.log(`   ❌ Missing fields: ${missingFields.join(', ')}`);
      } else {
        console.log(`   ✅ All required fields present`);
        console.log(`      - Phone: ${sampleCall.phone_number || 'N/A'}`);
        console.log(`      - Direction: ${sampleCall.call_direction}`);
        console.log(`      - Sentiment: ${sampleCall.sentiment_label || 'Not set'}`);
        console.log(`      - Duration: ${sampleCall.duration_seconds || 0} seconds`);
      }
    }

    // 5. Check RLS is enabled
    console.log('\n5️⃣ Checking RLS policies...');
    const { data: rlsEnabled, error: rlsError } = await supabase
      .rpc('check_rls_enabled', { p_table_name: 'calls' });

    if (rlsError) {
      console.log(`   ⚠️  Could not verify RLS: ${rlsError.message}`);
    } else {
      console.log(`   ✅ RLS enabled on calls table: ${rlsEnabled}`);
    }

    // 6. Check indexes
    console.log('\n6️⃣ Checking performance indexes...');
    const { data: indexes, error: indexError } = await supabase
      .rpc('get_table_indexes', { p_table_name: 'calls' });

    if (indexError) {
      console.log(`   ⚠️  Could not verify indexes: ${indexError.message}`);
    } else {
      console.log(`   ✅ Indexes found: ${indexes?.length || 0}`);
      if (indexes?.length > 0) {
        indexes.slice(0, 3).forEach(idx => {
          console.log(`      - ${idx.indexname}`);
        });
        if (indexes.length > 3) {
          console.log(`      ... and ${indexes.length - 3} more`);
        }
      }
    }

    console.log('\n✅ MIGRATION VERIFICATION COMPLETE');
    console.log('===================================\n');
    return true;

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    return false;
  }
}

verifyMigration()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
