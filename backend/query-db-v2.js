require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('SUPABASE_URL exists:', !!supabaseUrl);
console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function queryDatabase() {
  try {
    console.log('\n=== ORGANIZATIONS ===');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, created_at');
    if (orgError) console.error('Error:', orgError);
    else console.log(JSON.stringify(orgs, null, 2));

    console.log('\n=== API CREDENTIALS ===');
    const { data: creds, error: credsError } = await supabase
      .from('organization_api_credentials')
      .select('org_id, credential_type, created_at');
    if (credsError) console.error('Error:', credsError);
    else console.log(JSON.stringify(creds, null, 2));

    console.log('\n=== OAUTH TOKENS ===');
    const { data: tokens, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('org_id, provider, created_at');
    if (tokenError) console.error('Error:', tokenError);
    else console.log(JSON.stringify(tokens, null, 2));

    console.log('\n=== APPOINTMENTS ===');
    const { data: appointments, error: appointmentError } = await supabase
      .from('appointments')
      .select('id, org_id, patient_phone, status, created_at');
    if (appointmentError) console.error('Error:', appointmentError);
    else console.log(JSON.stringify(appointments, null, 2));
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

queryDatabase();
