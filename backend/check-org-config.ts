/**
 * Check organization configuration (webhook_url, vapi_key_id)
 * Run with: npx ts-node check-org-config.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

async function run() {
  try {
    console.log('\n=== ORG CONFIG CHECK ===\n');

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', ORG_ID)
      .single();

    if (orgErr) {
      console.error('Error fetching organization:', orgErr.message || orgErr);
    } else if (!org) {
      console.log('Organization not found for id', ORG_ID);
    } else {
      console.log('Organization:');
      console.log(`  id: ${org.id}`);
      console.log(`  name: ${org.name}`);
      console.log(`  webhook_url: ${org.webhook_url || 'NOT SET'}`);
      console.log(`  vapi_key_id: ${org.vapi_key_id || 'NOT SET'}`);
    }

    // Check org_credentials for Vapi keys
    const { data: creds, error: credErr } = await supabase
      .from('org_credentials')
      .select('*')
      .eq('org_id', ORG_ID);

    if (credErr) {
      console.error('Error fetching org_credentials:', credErr.message || credErr);
    } else {
      console.log('\nOrg Credentials:');
      if (!creds || creds.length === 0) {
        console.log('  NONE FOUND');
      } else {
        creds.forEach((c: any) => {
          console.log(`  id: ${c.id}`);
          console.log(`    provider: ${c.provider}`);
          console.log(`    active: ${c.is_active}`);
          console.log(`    fields: ${JSON.stringify(c)}`);
        });
      }
    }

    process.exit(0);
  } catch (err: any) {
    console.error('Unexpected error:', err.message || err);
    process.exit(1);
  }
}

run();
