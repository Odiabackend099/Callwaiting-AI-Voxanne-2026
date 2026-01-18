import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function getSchema() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 CHECKING APPOINTMENTS TABLE SCHEMA');
  console.log('='.repeat(80) + '\n');

  // Query one appointment to see its structure
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('❌ No appointments found to check schema');
    process.exit(1);
  }

  const appointment = data[0];

  console.log('Actual columns in appointments table:');
  console.log('=====================================\n');

  Object.keys(appointment).forEach(key => {
    const value = (appointment as any)[key];
    const valueType = typeof value;
    console.log(`  ${key}: ${valueType}`);
    if (valueType === 'string' && value) {
      console.log(`    Example: ${value.substring(0, 50)}...`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('\nSample Appointment Data:');
  console.log('=====================================\n');
  console.log(JSON.stringify(appointment, null, 2));
}

getSchema().catch(console.error);
