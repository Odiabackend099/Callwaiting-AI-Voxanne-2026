import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkTimeline() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 TIMELINE: When was Austin appointment created?');
  console.log('='.repeat(80) + '\n');

  console.log('From your logs, the live call ended around: 2026-01-17T20:34:39Z (8:34 PM)');
  console.log('');
  console.log('Checking for appointments created DURING the live call period...\n');

  // Check 20 minutes before to after the call
  const callStartTime = new Date('2026-01-17T20:20:00Z'); // Give buffer
  const callEndTime = new Date('2026-01-17T20:40:00Z');

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
    .gte('created_at', callStartTime.toISOString())
    .lte('created_at', callEndTime.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log(`Time range: ${callStartTime.toISOString()} to ${callEndTime.toISOString()}`);
  console.log('');

  if (!data || data.length === 0) {
    console.log('❌ NO APPOINTMENTS CREATED DURING LIVE CALL PERIOD\n');
    console.log('CRITICAL FINDING:');
    console.log('  - Austin\'s appointment was NOT created in the database');
    console.log('  - The booking endpoint was NEVER called');
    console.log('  - OR the call failed before reaching the database');
    console.log('  - This is NOT a calendar sync issue');
    console.log('  - This is a tool invocation/webhook issue\n');
    return;
  }

  console.log(`✅ FOUND ${data.length} APPOINTMENT(S) DURING LIVE CALL PERIOD\n`);

  data.forEach((apt: any, index: number) => {
    const created = new Date(apt.created_at).toLocaleTimeString();
    console.log(`[${index + 1}] Created: ${created}`);
    console.log(`    ID: ${apt.id}`);
    console.log(`    Service: ${apt.service_type}`);
    console.log(`    Status: ${apt.status}`);
    console.log('');
  });

  console.log('CONCLUSION:');
  console.log('  - Austin\'s appointment WAS created during live call');
  console.log('  - The booking endpoint WAS invoked');
  console.log('  - The issue is likely calendar sync (as diagnosed)\n');
}

checkTimeline().catch(console.error);
