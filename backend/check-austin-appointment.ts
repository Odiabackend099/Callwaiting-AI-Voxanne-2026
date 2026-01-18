import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function findAustinAppointment() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 SEARCHING FOR AUSTIN APPOINTMENT (From Live Call)');
  console.log('='.repeat(80) + '\n');

  console.log('Searching for appointments with Austin Eguale...\n');

  // Search by patient name containing "austin"
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
    .ilike('patient_name', '%austin%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error querying:', error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('❌ NO APPOINTMENTS FOUND WITH NAME CONTAINING "AUSTIN"\n');
    console.log('Alternative search - by email containing "austyn"...\n');

    const { data: data2, error: error2 } = await supabase
      .from('appointments')
      .select('*')
      .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
      .ilike('patient_email', '%austyn%')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error2) {
      console.error('❌ Error querying:', error2.message);
      process.exit(1);
    }

    if (!data2 || data2.length === 0) {
      console.log('❌ NO APPOINTMENTS FOUND WITH EMAIL CONTAINING "AUSTYN"\n');
      console.log('CONCLUSION: Austin appointment was NOT created in database');
      console.log('           This means the booking tool was NEVER CALLED');
      console.log('           OR the call failed before reaching database\n');
      return;
    }

    console.log(`✅ FOUND ${data2.length} APPOINTMENTS BY EMAIL\n`);
    displayAppointments(data2);
    return;
  }

  console.log(`✅ FOUND ${data.length} APPOINTMENTS BY NAME\n`);
  displayAppointments(data);
}

function displayAppointments(appointments: any[]) {
  console.log('='.repeat(80));
  appointments.forEach((apt: any, index: number) => {
    console.log(`\n[Appointment ${index + 1}]`);
    console.log(`  ID:               ${apt.id}`);
    console.log(`  Status:           ${apt.status}`);
    console.log(`  Service Type:     ${apt.service_type}`);
    console.log(`  Scheduled At:     ${apt.scheduled_at}`);
    console.log(`  Patient Name:     ${apt.patient_name || '(NOT SET)'}`);
    console.log(`  Patient Email:    ${apt.patient_email || '(NOT SET)'}`);
    console.log(`  Patient Phone:    ${apt.patient_phone || '(NOT SET)'}`);
    console.log(`  Created At:       ${apt.created_at}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ VERIFICATION COMPLETE\n');
  console.log('CONCLUSION: Austin appointment WAS created in database');
  console.log('           Even though Sarah said "technical issue"');
  console.log('           The booking actually SUCCEEDED\n');
}

findAustinAppointment().catch(console.error);
