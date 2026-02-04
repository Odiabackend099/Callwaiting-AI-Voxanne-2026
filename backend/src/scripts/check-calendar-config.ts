import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkConfig() {
  const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

  // Check integration_credentials
  const { data: creds, error: credsError } = await supabase
    .from('integration_credentials')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider_type', 'google_calendar');

  console.log('Google Calendar Credentials:');
  console.log(credsError ? `Error: ${credsError.message}` : `Found: ${creds?.length || 0} records`);
  if (creds && creds.length > 0) {
    console.log(JSON.stringify(creds[0], null, 2));
  }

  // Check agents
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, vapi_assistant_id')
    .eq('org_id', orgId);

  console.log('\nAgents:');
  console.log(`Found: ${agents?.length || 0} agents`);
  if (agents && agents.length > 0) {
    console.log(JSON.stringify(agents[0], null, 2));
  }
}

checkConfig();
