#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('\n🔍 CHECKING CALLS TABLE SCHEMA\n');

  try {
    // Get all columns in calls table
    const { data, error } = await supabase
      .rpc('get_table_columns', { p_table_name: 'calls' });

    if (error) {
      console.log('RPC not available, trying direct query...');

      // Fallback: query information_schema
      const { data: columns, error: colError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'calls');

      if (colError) {
        // Try a different approach - select from calls and check what columns work
        const { data: sample } = await supabase
          .from('calls')
          .select()
          .limit(1);

        if (sample && sample.length > 0) {
          console.log('Available columns in calls table:');
          Object.keys(sample[0]).forEach(col => {
            console.log(`  - ${col}`);
          });
        }
      } else {
        console.log('Available columns in calls table:');
        columns?.forEach(col => {
          console.log(`  - ${col.column_name} (${col.data_type})`);
        });
      }
    } else {
      console.log('Available columns in calls table:');
      data?.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
