import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA',
  { auth: { persistSession: false } }
);

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function verify() {
  console.log('\n=== VERIFYING NEW BOOKING ===\n');

  // Find most recent appointment (should be the test one)
  const { data: latest } = await supabase
    .from('appointments')
    .select('id, contact_id, service_type, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('Latest 3 appointments:\n');
  latest?.forEach((apt: any, idx: number) => {
    const created = new Date(apt.created_at).toLocaleTimeString();
    console.log(`[${idx + 1}] ${created}`);
    console.log(`    Service: ${apt.service_type}`);
    console.log(`    Contact ID: ${apt.contact_id || 'NULL'}`);
    console.log(`    ID: ${apt.id}`);
    console.log('');
  });

  // Also check all contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, email, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  const contactCount = contacts ? contacts.length : 0;
  console.log(`\nTotal contacts: ${contactCount}\n`);
  console.log('Recent contacts:\n');
  contacts?.slice(0, 5).forEach((c: any) => {
    const created = new Date(c.created_at).toLocaleTimeString();
    console.log(`${created} - ${c.name} (${c.email})`);
  });
}

verify().catch(console.error);
