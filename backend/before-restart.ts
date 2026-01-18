import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA',
  { auth: { persistSession: false } }
);

async function checkBeforeRestart() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 APPOINTMENTS BEFORE BACKEND RESTART (before 8:35 PM)');
  console.log('='.repeat(80) + '\n');

  const beforeRestart = new Date('2026-01-17T20:35:00Z');

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('org_id', '46cf2995-2bee-44e3-838b-24151486fe4e')
    .lt('created_at', beforeRestart.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log(`Before restart cutoff: ${beforeRestart.toISOString()}\n`);

  if (!data || data.length === 0) {
    console.log('❌ NO APPOINTMENTS CREATED BEFORE 8:35 PM UTC\n');
    console.log('CRITICAL FINDING:');
    console.log('  - Austin appointment was NOT created during live call');
    console.log('  - Booking tool was NEVER invoked');
    console.log('  - This is NOT a calendar sync issue');
    console.log('  - This is a webhook/tool invocation issue\n');
    return;
  }

  console.log(`✅ FOUND ${data.length} APPOINTMENTS BEFORE RESTART\n`);

  data.forEach((apt: any, idx: number) => {
    const ts = apt.created_at;
    console.log(`[${idx + 1}] ${ts}`);
    console.log(`     Service: ${apt.service_type}`);
    console.log(`     Status: ${apt.status}`);
    console.log('');
  });
}

checkBeforeRestart().catch(console.error);
