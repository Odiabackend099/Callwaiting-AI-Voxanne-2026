import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA',
  { auth: { persistSession: false } }
);

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function check() {
  console.log('\n=== CONTACTS TABLE STRUCTURE ===\n');

  const { data: all } = await supabase
    .from('contacts')
    .select('*')
    .eq('org_id', orgId);

  const count = all ? all.length : 0;
  console.log(`Total contacts in org: ${count}\n`);

  if (all && all.length > 0) {
    console.log('All contacts:\n');
    all.forEach((c: any) => {
      console.log(`Name: ${c.name}`);
      console.log(`Email: ${c.email}`);
      console.log(`Phone: ${c.phone}`);
      console.log(`ID: ${c.id}`);
      console.log(`Created: ${c.created_at}`);
      console.log('---');
    });
  }

  // Find which appointments ARE linked
  const { data: linked } = await supabase
    .from('appointments')
    .select('id, contact_id, service_type, scheduled_at')
    .eq('org_id', orgId)
    .not('contact_id', 'is', null);

  const linkedCount = linked ? linked.length : 0;
  console.log(`\nAppointments WITH contact_id: ${linkedCount}\n`);
  if (linked && linked.length > 0) {
    linked.slice(0, 3).forEach((apt: any) => {
      console.log(`Service: ${apt.service_type}`);
      console.log(`Contact ID: ${apt.contact_id}`);
      console.log('---');
    });
  }
}

check().catch(console.error);
