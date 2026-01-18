import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA',
  { auth: { persistSession: false } }
);

async function verify() {
  console.log('\nSearching for appointment ID: 7ae515d2-b591-4acf-8642-128f33c0a9aa\n');

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('id', '7ae515d2-b591-4acf-8642-128f33c0a9aa');

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('❌ APPOINTMENT NOT FOUND IN SUPABASE');
    console.log('The log says it was created, but it is NOT in the database!');
    process.exit(1);
  }

  console.log('✅ FOUND IN SUPABASE:');
  console.log(JSON.stringify(data[0], null, 2));
}

verify().catch(console.error);
