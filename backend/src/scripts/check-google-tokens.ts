import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkTokens() {
  const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e';

  const tables = [
    'integration_tokens',
    'google_calendar_tokens',
    'org_integrations',
    'organizations'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('org_id', orgId)
        .limit(1);

      console.log(`\n${table}:`);
      if (error) {
        console.log(`  ❌ Table doesn't exist or error: ${error.message}`);
      } else {
        console.log(`  ✅ Found ${data?.length || 0} records`);
        if (data && data.length > 0) {
          console.log(`  Sample: ${JSON.stringify(data[0]).substring(0, 100)}...`);
        }
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e}`);
    }
  }

  // Also check what the org has
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  console.log('\nOrganization Details:');
  console.log(JSON.stringify(org, null, 2));
}

checkTokens();
