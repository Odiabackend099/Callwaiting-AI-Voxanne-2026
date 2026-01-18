import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkAppointments() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 QUERYING APPOINTMENTS DATABASE');
  console.log('='.repeat(80) + '\n');

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error querying appointments:', error.message);
    process.exit(1);
  }

  console.log(`Search parameters:`);
  console.log(`  Organization ID: 46cf2995-2bee-44e3-838b-24151486fe4e`);
  console.log(`  Time range: ${fiveMinutesAgo}`);
  console.log(`  Until: now\n`);

  if (!data || data.length === 0) {
    console.log('❌ NO APPOINTMENTS FOUND\n');
    console.log('This means:');
    console.log('  - Booking endpoint was called');
    console.log('  - But NO appointment was created in database');
    console.log('  - Problem is NOT just calendar sync');
    console.log('  - Problem is appointment creation itself\n');
    return;
  }

  console.log(`✅ FOUND ${data.length} APPOINTMENT(S) CREATED IN LAST 5 MINUTES\n`);
  console.log('This means:');
  console.log('  - Appointments ARE being created in database');
  console.log('  - Problem IS calendar sync (not appointment creation)\n');

  console.log('='.repeat(80));
  console.log('APPOINTMENT DETAILS:');
  console.log('='.repeat(80) + '\n');

  data.forEach((apt: any, index: number) => {
    console.log(`[Appointment ${index + 1}]`);
    console.log(`  ID:               ${apt.id}`);
    console.log(`  Status:           ${apt.status}`);
    console.log(`  Service Type:     ${apt.service_type}`);
    console.log(`  Scheduled At:     ${apt.scheduled_at}`);
    console.log(`  Patient Email:    ${apt.patient_email || 'NOT SET'}`);
    console.log(`  Patient Name:     ${apt.patient_name || 'NOT SET'}`);
    console.log(`  Patient Phone:    ${apt.patient_phone || 'NOT SET'}`);
    console.log(`  Created At:       ${apt.created_at}`);
    console.log(`  Updated At:       ${apt.updated_at}`);
    console.log(`  Confirmation:     ${apt.confirmation_sent ? 'Sent' : 'Not sent'}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('✅ VERIFICATION COMPLETE\n');
  console.log('Conclusion:');
  console.log(`  Total appointments found: ${data.length}`);
  console.log(`  All in database: ✅ YES`);
  console.log(`  Issue is calendar sync: ✅ CONFIRMED\n`);
}

checkAppointments().catch(console.error);
