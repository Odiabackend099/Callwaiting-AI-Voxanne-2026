import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function listAllAppointments() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 ALL APPOINTMENTS - LAST 2 HOURS (Checking for Austin)');
  console.log('='.repeat(80) + '\n');

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error querying appointments:', error.message);
    process.exit(1);
  }

  console.log(`Time range: ${twoHoursAgo} to now\n`);

  if (!data || data.length === 0) {
    console.log('❌ NO APPOINTMENTS FOUND IN LAST 2 HOURS\n');
    console.log('This means:');
    console.log('  - NO bookings have been created (neither Austin nor test)');
    console.log('  - The booking endpoint is NOT creating appointments');
    console.log('  - This is a CRITICAL issue - not just calendar sync\n');
    return;
  }

  console.log(`✅ FOUND ${data.length} APPOINTMENT(S) CREATED IN LAST 2 HOURS\n`);
  console.log('Appointments (newest first):');
  console.log('='.repeat(80) + '\n');

  data.forEach((apt: any, index: number) => {
    const createdTime = new Date(apt.created_at).toLocaleTimeString();
    const scheduledTime = new Date(apt.scheduled_at).toLocaleString();

    console.log(`[${index + 1}] Created: ${createdTime}`);
    console.log(`    ID:                 ${apt.id}`);
    console.log(`    Service Type:       ${apt.service_type}`);
    console.log(`    Scheduled:          ${scheduledTime}`);
    console.log(`    Status:             ${apt.status}`);
    console.log(`    Contact ID:         ${apt.contact_id || 'NULL'}`);
    console.log(`    Calendar Event ID:  ${apt.google_calendar_event_id || 'NOT SET'}`);
    console.log(`    Duration:           ${apt.duration_minutes} min`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('\nCONCLUSION:');
  console.log(`  - Total appointments: ${data.length}`);

  // Check if we have the test appointment
  const testApt = data.find((apt: any) => apt.service_type === 'Consultation');
  if (testApt) {
    console.log(`  - ✅ Test appointment found (Consultation)`);
    console.log(`     Confirms booking endpoint IS creating appointments`);
  }

  // Check for Botox appointments (likely Austin's)
  const botoxApts = data.filter((apt: any) => apt.service_type === 'Botox');
  if (botoxApts.length > 0) {
    console.log(`  - ✅ Found ${botoxApts.length} Botox appointment(s) (likely Austin)`);
    console.log(`     This confirms Austin's appointment WAS created`);
  } else {
    console.log(`  - ❌ NO Botox appointments found`);
    console.log(`     Austin's appointment was NOT created in database`);
    console.log(`     Problem is NOT just calendar sync`);
  }

  console.log('');
}

listAllAppointments().catch(console.error);
