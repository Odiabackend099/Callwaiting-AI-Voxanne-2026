const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function queryDatabase() {
  console.log('\n=== ORGANIZATIONS ===');
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, created_at');
  if (orgError) console.error('Error fetching orgs:', orgError);
  else console.log(JSON.stringify(orgs, null, 2));

  console.log('\n=== API CREDENTIALS ===');
  const { data: creds, error: credsError } = await supabase
    .from('organization_api_credentials')
    .select('org_id, credential_type, created_at');
  if (credsError) console.error('Error fetching credentials:', credsError);
  else console.log(JSON.stringify(creds, null, 2));

  console.log('\n=== OAUTH TOKENS ===');
  const { data: tokens, error: tokenError } = await supabase
    .from('oauth_tokens')
    .select('org_id, provider, created_at');
  if (tokenError) console.error('Error fetching tokens:', tokenError);
  else console.log(JSON.stringify(tokens, null, 2));

  console.log('\n=== APPOINTMENTS (after cleanup) ===');
  const { data: appointments, error: appointmentError } = await supabase
    .from('appointments')
    .select('id, org_id, patient_phone, status, created_at');
  if (appointmentError) console.error('Error fetching appointments:', appointmentError);
  else console.log(JSON.stringify(appointments, null, 2));

  console.log('\n=== SARA ORG DETAILS ===');
  const { data: saraOrg, error: saraError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', '46cf2995-2bee-44e3-838b-24151486fe4e');
  if (saraError) console.error('Error fetching Sara org:', saraError);
  else console.log(JSON.stringify(saraOrg, null, 2));
}

queryDatabase().catch(console.error);
