/**
 * Verify Dropdown Visibility
 *
 * Simulates the /api/integrations/vapi/numbers endpoint
 * to verify the managed number appears in agent config dropdowns
 */

import { supabaseAdmin } from '../config/supabase';
import { EncryptionService } from '../services/encryption';

async function verifyDropdownVisibility() {
  const orgId = '46cf2995-2bee-44e3-838b-24151486fe4e'; // voxanne@demo.com

  console.log('🔍 Simulating /api/integrations/vapi/numbers endpoint...\n');

  // This is the EXACT query the endpoint uses
  const { data: credentials, error: credErr } = await supabaseAdmin
    .from('org_credentials')
    .select('encrypted_config, is_managed')
    .eq('org_id', orgId)
    .eq('provider', 'twilio')
    .eq('is_active', true);

  if (credErr) {
    console.error('❌ Error querying org_credentials:', credErr.message);
    process.exit(1);
  }

  console.log(`📋 Found ${credentials?.length || 0} credential(s) in SSOT\n`);

  // Decrypt and format (same logic as endpoint)
  const numbers = [];
  for (const cred of credentials || []) {
    try {
      const decrypted = EncryptionService.decryptObject(cred.encrypted_config);

      console.log('🔓 Decrypted credential:');
      console.log('   Phone Number:', decrypted.phoneNumber || 'NULL');
      console.log('   Vapi Phone ID:', decrypted.vapiPhoneId || 'NULL');
      console.log('   Account SID:', decrypted.accountSid ? `${decrypted.accountSid.slice(0, 10)}...` : 'NULL');
      console.log('   Is Managed:', cred.is_managed);
      console.log();

      // This is the filter the endpoint uses
      if (decrypted.phoneNumber && decrypted.vapiPhoneId) {
        numbers.push({
          id: decrypted.vapiPhoneId,
          number: decrypted.phoneNumber,
          name: cred.is_managed ? 'Managed' : 'Your Twilio',
          type: cred.is_managed ? 'managed' : 'byoc',
        });
      } else {
        console.log('⚠️  Credential filtered out (missing phoneNumber or vapiPhoneId)');
      }
    } catch (decErr: any) {
      console.error('❌ Decryption failed:', decErr.message);
    }
  }

  console.log('📊 DROPDOWN VISIBILITY RESULT:\n');
  console.log(`   Numbers that would appear: ${numbers.length}`);
  if (numbers.length > 0) {
    console.log('   ✅ Numbers visible in dropdown:');
    numbers.forEach((num, i) => {
      console.log(`      [${i+1}] ${num.number} (${num.name})`);
      console.log(`          ID: ${num.id}`);
      console.log(`          Type: ${num.type}`);
    });
    console.log();
    console.log('✅ SUCCESS: Number would appear in agent config dropdowns');
    process.exit(0);
  } else {
    console.log('   ❌ NO numbers would appear in dropdown');
    console.log('   Issue: Either missing phoneNumber or vapiPhoneId in encrypted data');
    process.exit(1);
  }
}

verifyDropdownVisibility().catch((err) => {
  console.error('💥 Verification failed:', err.message);
  process.exit(1);
});
