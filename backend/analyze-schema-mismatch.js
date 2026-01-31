#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  console.log('\n🔍 SCHEMA MISMATCH ANALYSIS\n');

  try {
    // Get actual calls table structure
    const { data: actualCalls } = await supabase
      .from('calls')
      .select()
      .limit(1);

    const actualColumns = actualCalls && actualCalls.length > 0
      ? Object.keys(actualCalls[0]).sort()
      : [];

    // Expected columns from migration
    const expectedColumns = [
      'id', 'org_id', 'vapi_call_id', 'contact_id',
      'call_direction', 'call_type',
      'phone_number', 'caller_name',
      'call_sid', 'created_at', 'updated_at',
      'duration_seconds', 'status',
      'recording_url', 'recording_storage_path',
      'transcript',
      'sentiment', 'sentiment_label', 'sentiment_score',
      'sentiment_summary', 'sentiment_urgency',
      'outcome', 'outcome_summary', 'notes', 'metadata'
    ].sort();

    console.log('Expected columns (from migration):');
    expectedColumns.forEach(col => console.log(`  ✓ ${col}`));

    console.log('\n\nActual columns (in database):');
    actualColumns.forEach(col => console.log(`  ✓ ${col}`));

    console.log('\n\nMISSING columns (expected but not present):');
    const missing = expectedColumns.filter(col => !actualColumns.includes(col));
    if (missing.length > 0) {
      missing.forEach(col => console.log(`  ❌ ${col}`));
    } else {
      console.log('  ✓ None - all columns present');
    }

    console.log('\n\nEXTRA columns (present but not expected):');
    const extra = actualColumns.filter(col => !expectedColumns.includes(col));
    if (extra.length > 0) {
      extra.forEach(col => console.log(`  ⚠️  ${col}`));
    } else {
      console.log('  ✓ None - no unexpected columns');
    }

    // Check what data is in the calls table
    console.log('\n\nDATA IN CALLS TABLE:');
    const { data: allCalls } = await supabase
      .from('calls')
      .select('id, org_id, call_direction, from_number, to_number, sentiment, created_at');

    console.log(`  Total rows: ${allCalls?.length || 0}`);
    if (allCalls && allCalls.length > 0) {
      allCalls.slice(0, 2).forEach((call, i) => {
        console.log(`\n  Row ${i + 1}:`);
        console.log(`    - call_direction: ${call.call_direction}`);
        console.log(`    - from_number: ${call.from_number}`);
        console.log(`    - to_number: ${call.to_number}`);
        console.log(`    - sentiment: ${call.sentiment}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

analyze();
