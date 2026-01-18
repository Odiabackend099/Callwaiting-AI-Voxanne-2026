import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA',
  { auth: { persistSession: false } }
);

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function check() {
  console.log('\n=== CHECKING INBOUND SETUP ===\n');

  // Check phone numbers
  const { data: phoneNumbers } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('org_id', orgId)
    .limit(5);

  const phoneCount = phoneNumbers ? phoneNumbers.length : 0;
  console.log(`Phone Numbers for org: ${phoneCount}\n`);
  phoneNumbers?.forEach((pn: any) => {
    console.log(`Phone: ${pn.phone_number}`);
    console.log(`  Assistant ID (Vapi): ${pn.vapi_assistant_id || 'NOT SET'}`);
    console.log(`  Status: ${pn.status}`);
    console.log('');
  });

  // Check assistants
  const { data: assistants } = await supabase
    .from('assistants')
    .select('*')
    .eq('org_id', orgId)
    .limit(5);

  const asstCount = assistants ? assistants.length : 0;
  console.log(`\nAssistants for org: ${asstCount}\n`);
  assistants?.forEach((asst: any) => {
    console.log(`Name: ${asst.name}`);
    console.log(`  ID (Vapi): ${asst.vapi_id || 'NOT SET'}`);
    console.log(`  Type: ${asst.type || 'unknown'}`);
    console.log(`  Webhook: ${asst.webhook_url || 'NOT SET'}`);
    console.log('');
  });
}

check().catch(console.error);
