import { supabaseAdmin } from '../config/supabase';

const orgId = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';
const phoneNumber = '+16504595418';

(async () => {
  console.log('🎯 SCENE 3: SSOT VERIFICATION\n');
  console.log('═══════════════════════════════════════════════\n');
  
  // Check 1: managed_phone_numbers
  console.log('📋 Check 1: Verifying in managed_phone_numbers table...\n');
  const { data: managedNumbers } = await supabaseAdmin
    .from('managed_phone_numbers')
    .select('*')
    .eq('org_id', orgId)
    .eq('phone_number', phoneNumber);
  
  if (managedNumbers && managedNumbers.length > 0) {
    console.log('✅ FOUND in managed_phone_numbers');
    const n = managedNumbers[0];
    console.log(`   Phone: ${n.phone_number}`);
    console.log(`   Vapi Phone ID: ${n.vapi_phone_id}`);
    console.log(`   Status: ${n.status}`);
    console.log(`   Created: ${n.created_at}\n`);
  } else {
    console.log('❌ NOT found in managed_phone_numbers\n');
  }
  
  // Check 2: org_credentials (CRITICAL - SSOT)
  console.log('🎯 Check 2: CRITICAL - Verifying in org_credentials table (SSOT)...\n');
  const { data: credentials } = await supabaseAdmin
    .from('org_credentials')
    .select('*')
    .eq('org_id', orgId)
    .eq('provider', 'twilio')
    .eq('is_managed', true);
  
  if (credentials && credentials.length > 0) {
    console.log('✅ FOUND in org_credentials (SSOT WORKING)');
    const c = credentials[0];
    console.log(`   Provider: ${c.provider}`);
    console.log(`   Is Managed: ${c.is_managed}`);
    console.log(`   Is Active: ${c.is_active}`);
    console.log(`   Created: ${c.created_at}\n`);
  } else {
    console.log('❌ NOT found in org_credentials');
    console.log('   ⚠️ SSOT VIOLATION - Dual-write strategy failed!');
    console.log('   Phone number may not appear in agent dropdown\n');
  }
  
  // Summary
  console.log('═══════════════════════════════════════════════');
  console.log('📊 SCENE 3 RESULTS\n');
  
  const managed = (managedNumbers?.length || 0) > 0;
  const ssot = (credentials?.length || 0) > 0;
  
  console.log(`✅ Phone Provisioned: ${phoneNumber}`);
  console.log(`${managed ? '✅' : '❌'} managed_phone_numbers`);
  console.log(`${ssot ? '✅' : '❌'} org_credentials (SSOT)\n`);
  
  process.exit((managed && ssot) ? 0 : 1);
})();
