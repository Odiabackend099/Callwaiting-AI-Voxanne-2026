/**
 * SSOT Violation Investigation Script
 *
 * Checks if voxanne@demo.com has provisioned managed numbers
 * and verifies if they were properly saved to org_credentials (SSOT)
 */

import { supabaseAdmin } from '../config/supabase';

async function investigate() {
  console.log('🔍 Step 1: Finding organization ID for voxanne@demo.com...\n');

  // Find org
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, email')
    .eq('email', 'voxanne@demo.com')
    .single();

  if (orgError || !org) {
    console.error('❌ Organization not found:', orgError?.message);
    process.exit(1);
  }

  console.log('✅ Organization found:');
  console.log('   ID:', org.id);
  console.log('   Name:', org.name);
  console.log('   Email:', org.email);
  console.log();

  // Check managed_phone_numbers table
  console.log('🔍 Step 2: Checking managed_phone_numbers table...\n');
  const { data: managedNumbers, error: managedError } = await supabaseAdmin
    .from('managed_phone_numbers')
    .select('*')
    .eq('org_id', org.id)
    .eq('status', 'active');

  if (managedError) {
    console.error('❌ Error querying managed_phone_numbers:', managedError.message);
  } else {
    console.log('📋 Managed numbers found:', managedNumbers?.length || 0);
    if (managedNumbers && managedNumbers.length > 0) {
      managedNumbers.forEach((num: any, i: number) => {
        console.log(`   [${i+1}] Phone: ${num.phone_number}`);
        console.log(`       Vapi Phone ID: ${num.vapi_phone_id || 'NULL'}`);
        console.log(`       Vapi Credential ID: ${num.vapi_credential_id || 'NULL'}`);
        console.log(`       Twilio SID: ${num.twilio_phone_sid}`);
        console.log(`       Subaccount ID: ${num.twilio_subaccount_id}`);
        console.log(`       Created: ${num.created_at}`);
        console.log();
      });
    }
  }

  // Check org_credentials table (SSOT)
  console.log('🔍 Step 3: Checking org_credentials table (SSOT)...\n');
  const { data: credentials, error: credError } = await supabaseAdmin
    .from('org_credentials')
    .select('*')
    .eq('org_id', org.id)
    .eq('provider', 'twilio')
    .eq('is_active', true);

  if (credError) {
    console.error('❌ Error querying org_credentials:', credError.message);
  } else {
    console.log('📋 Credentials in SSOT:', credentials?.length || 0);
    if (credentials && credentials.length > 0) {
      credentials.forEach((cred: any, i: number) => {
        console.log(`   [${i+1}] Provider: ${cred.provider}`);
        console.log(`       Is Managed: ${cred.is_managed || false}`);
        console.log(`       Metadata: ${JSON.stringify(cred.metadata || {})}`);
        console.log(`       Created: ${cred.created_at}`);
        console.log();
      });
    }
  }

  // Analysis
  console.log('📊 ANALYSIS:\n');
  const hasManagedNumbers = managedNumbers && managedNumbers.length > 0;
  const hasCredentials = credentials && credentials.length > 0;

  if (hasManagedNumbers && !hasCredentials) {
    console.log('❌ SSOT VIOLATION DETECTED!');
    console.log(`   - Managed numbers exist: YES (${managedNumbers!.length} number(s))`);
    console.log('   - Credentials in SSOT: NO');
    console.log('   - Issue: Numbers provisioned but NOT saved to org_credentials');
    console.log('   - Impact: Numbers invisible in agent config dropdowns');
    console.log('   - Remedy: Backfill script needed to sync to org_credentials\n');

    console.log('📋 Numbers needing backfill:');
    managedNumbers!.forEach((num: any, i: number) => {
      console.log(`   [${i+1}] ${num.phone_number} (Vapi ID: ${num.vapi_phone_id})`);
    });
    console.log();

    return { violation: true, org, managedNumbers };
  } else if (hasManagedNumbers && hasCredentials) {
    console.log('✅ SSOT COMPLIANT');
    console.log('   - Managed numbers exist: YES');
    console.log('   - Credentials in SSOT: YES');
    console.log('   - All numbers should be visible in agent config\n');

    return { violation: false, org, managedNumbers, credentials };
  } else if (!hasManagedNumbers) {
    console.log('ℹ️  NO MANAGED NUMBERS');
    console.log('   - This organization has not provisioned any managed numbers yet\n');

    return { violation: false, org, managedNumbers: [] };
  }

  return { violation: false, org };
}

// Run investigation
investigate()
  .then((result) => {
    if (result.violation) {
      console.log('⚠️  ACTION REQUIRED: Run backfill script to fix SSOT violation');
      process.exit(1);
    } else {
      console.log('✅ No action required');
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error('💥 Investigation failed:', err.message);
    process.exit(1);
  });
