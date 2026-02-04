import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

(async () => {
  console.log('Checking org_credentials table for Google Calendar tokens...\n');

  const { data: creds, error } = await supabase
    .from('org_credentials')
    .select('*')
    .eq('org_id', ORG_ID);

  if (error) {
    console.log('❌ Error:', error.message);
  } else if (creds && creds.length > 0) {
    console.log('✅ Found ' + creds.length + ' credential(s):\n');
    creds.forEach((c: any, i: number) => {
      console.log('[' + (i+1) + '] Provider: ' + c.provider_type);
      console.log('    ID: ' + c.id);
      console.log('    Has encrypted_data: ' + (c.encrypted_data ? '✅ YES' : '❌ NO'));
      console.log('    Created: ' + c.created_at);
    });
  } else {
    console.log('❌ NO CREDENTIALS FOUND - Google Calendar not configured for this org');
  }
})();
