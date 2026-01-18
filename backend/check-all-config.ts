import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://lbjymlodxprzqgtyqtcq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA',
  { auth: { persistSession: false } }
);

const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function check() {
  console.log('\n=== SEARCHING FOR INBOUND CONFIG ===\n');

  // Check org_credentials
  const { data: creds } = await supabase
    .from('org_credentials')
    .select('*')
    .eq('org_id', orgId);

  const credCount = creds ? creds.length : 0;
  console.log(`Org Credentials: ${credCount}\n`);
  creds?.forEach((c: any) => {
    console.log(`Provider: ${c.provider}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Active: ${c.is_active}`);
    console.log('');
  });

  // Check organizations
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (org) {
    console.log('Organization Info:');
    console.log(`  Name: ${org.name}`);
    console.log(`  Vapi Key: ${org.vapi_key_id || 'NOT SET'}`);
    console.log(`  Webhook URL: ${org.webhook_url || 'NOT SET'}`);
  }
}

check().catch(console.error);
