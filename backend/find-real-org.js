/**
 * Find the REAL voxanne@demo.com organization with Google Calendar credentials
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findRealOrg() {
  console.log('🔍 Finding real voxanne@demo.com organization...\n');

  // Query organizations with email voxanne@demo.com
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, email, name, timezone, created_at')
    .eq('email', 'voxanne@demo.com');

  if (orgError) {
    console.error('❌ Error querying organizations:', orgError.message);
    process.exit(1);
  }

  console.log(`Found ${orgs.length} organization(s) with email voxanne@demo.com:\n`);
  orgs.forEach((org, i) => {
    console.log(`Organization ${i + 1}:`);
    console.log(`  ID: ${org.id}`);
    console.log(`  Name: ${org.name}`);
    console.log(`  Timezone: ${org.timezone}`);
    console.log(`  Created: ${org.created_at}`);
    console.log('');
  });

  // Check which ones have google_calendar credentials
  console.log('Checking for Google Calendar credentials...\n');

  for (const org of orgs) {
    const { data: creds, error: credsError } = await supabase
      .from('org_credentials')
      .select('provider, is_active, last_verified_at, created_at')
      .eq('org_id', org.id)
      .eq('provider', 'google_calendar');

    if (creds && creds.length > 0) {
      console.log(`✅ Organization ${org.id} HAS google_calendar credentials:`);
      creds.forEach(cred => {
        console.log(`   Provider: ${cred.provider}`);
        console.log(`   Active: ${cred.is_active}`);
        console.log(`   Last Verified: ${cred.last_verified_at || 'Never'}`);
        console.log(`   Created: ${cred.created_at}`);
      });
      console.log('');
      console.log(`🎯 USE THIS ORG_ID FOR INTEGRATION TEST: ${org.id}`);
      console.log('');
    } else {
      console.log(`❌ Organization ${org.id} does NOT have google_calendar credentials`);
      console.log('');
    }
  }
}

findRealOrg().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
