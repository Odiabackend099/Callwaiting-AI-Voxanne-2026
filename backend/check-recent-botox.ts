import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA',
  { auth: { persistSession: false } }
);

async function check() {
  console.log('\nChecking MOST RECENT appointments in last 5 minutes...\n');

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('NO APPOINTMENTS CREATED IN LAST 5 MINUTES');
    console.log(`Search window: ${fiveMinutesAgo} to now`);
    console.log('\nThis means:');
    console.log('  - Your booking from the live call did NOT create an appointment');
    process.exit(1);
  }

  console.log(`FOUND ${data.length} appointment(s) in last 5 minutes:\n`);
  data.forEach((apt: any) => {
    console.log(`Created: ${apt.created_at}`);
    console.log(`  ID: ${apt.id}`);
    console.log(`  Service: ${apt.service_type}`);
    console.log(`  Scheduled: ${apt.scheduled_at}`);
    console.log('');
  });
}

check().catch(console.error);
