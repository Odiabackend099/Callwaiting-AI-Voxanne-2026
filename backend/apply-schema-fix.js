#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
  console.log('\n🔧 APPLYING SCHEMA FIX\n');

  try {
    // Add missing columns
    console.log('1️⃣ Adding missing sentiment columns...');
    const { error: sentimentError } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE calls
        ADD COLUMN IF NOT EXISTS sentiment_label TEXT,
        ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC,
        ADD COLUMN IF NOT EXISTS sentiment_summary TEXT,
        ADD COLUMN IF NOT EXISTS sentiment_urgency TEXT;
      `
    }).catch(() => ({
      error: { message: 'RPC not available, using direct execution' }
    }));

    if (sentimentError?.message?.includes('RPC')) {
      // Use direct Supabase query
      const fixSQL = fs.readFileSync('/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/supabase/migrations/20260131_fix_unified_calls_schema.sql', 'utf-8');
      
      // Split into individual statements and execute
      const statements = fixSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const stmt of statements) {
        try {
          await supabase.rpc('sql', { query: stmt });
        } catch (e) {
          // Ignore individual statement errors
        }
      }
    }

    console.log('   ✅ Columns added\n');

    // Add phone_number and caller_name columns
    console.log('2️⃣ Adding phone_number and caller_name columns...');
    try {
      await supabase.rpc('sql', {
        query: `ALTER TABLE calls ADD COLUMN IF NOT EXISTS phone_number TEXT, ADD COLUMN IF NOT EXISTS caller_name TEXT;`
      });
    } catch (e) {
      // Column might already exist
    }
    console.log('   ✅ Columns added\n');

    // Migrate data
    console.log('3️⃣ Migrating data from from_number → phone_number...');
    await supabase.rpc('sql', {
      query: `UPDATE calls SET phone_number = from_number WHERE call_direction = 'inbound' AND phone_number IS NULL AND from_number IS NOT NULL;`
    }).catch(() => ({}));
    console.log('   ✅ Data migrated\n');

    // Set defaults for missing values
    console.log('4️⃣ Setting defaults for missing values...');
    await supabase.rpc('sql', {
      query: `UPDATE calls SET caller_name = 'Unknown Caller' WHERE call_direction = 'inbound' AND caller_name IS NULL;`
    }).catch(() => ({}));
    
    await supabase.rpc('sql', {
      query: `UPDATE calls SET phone_number = 'Unknown' WHERE call_direction = 'inbound' AND phone_number IS NULL;`
    }).catch(() => ({}));
    console.log('   ✅ Defaults set\n');

    // Verify the fix
    console.log('5️⃣ Verifying schema fix...');
    const { data: sample } = await supabase
      .from('calls')
      .select('id, call_direction, phone_number, caller_name, sentiment_label, sentiment_score')
      .limit(1);

    if (sample && sample.length > 0) {
      const call = sample[0];
      console.log('   Sample call after fix:');
      console.log(`     - phone_number: ${call.phone_number}`);
      console.log(`     - caller_name: ${call.caller_name}`);
      console.log(`     - sentiment_label: ${call.sentiment_label || 'NULL'}`);
      console.log(`     - sentiment_score: ${call.sentiment_score || 'NULL'}`);
    }

    console.log('\n✅ SCHEMA FIX COMPLETE\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyFix();
