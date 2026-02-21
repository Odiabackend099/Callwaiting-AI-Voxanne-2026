/**
 * Detailed check of twilio_subaccounts table
 * to see what fields are missing
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://lbjymlodxprzqgtyqtcq.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const ORG_ID = '46cf2995-2bee-44e3-838b-24151486fe4e';

(async () => {
  console.log('🔍 DETAILED SUBACCOUNT CHECK\n');

  const { data: subaccounts, error } = await supabase
    .from('twilio_subaccounts')
    .select('*')
    .eq('org_id', ORG_ID);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  if (!subaccounts || subaccounts.length === 0) {
    console.log('⚠️  No subaccounts found');
    process.exit(0);
  }

  console.log(`Found ${subaccounts.length} subaccount(s)\n`);

  subaccounts.forEach((sub, i) => {
    console.log(`Subaccount ${i + 1}:`);
    console.log(JSON.stringify(sub, null, 2));
    console.log('');

    console.log('Field analysis:');
    console.log('  - subaccount_sid:', sub.subaccount_sid || '❌ MISSING');
    console.log('  - account_sid:', sub.account_sid || '❌ MISSING');
    console.log('  - auth_token:', sub.auth_token || '❌ MISSING');
    console.log('  - phone_number_sid:', sub.phone_number_sid || '⚠️  Missing (optional)');
    console.log('  - phone_number:', sub.phone_number || '⚠️  Missing (optional)');
    console.log('');
  });

  console.log('─'.repeat(60));
  console.log('REQUIRED FOR getEffectiveTwilioCredentials():\n');
  console.log('✅ Must have: account_sid (parent Twilio account)');
  console.log('✅ Must have: auth_token (to authenticate)');
  console.log('⚠️  Note: If subaccount_sid is null, it should use parent account credentials');
  console.log('');

  const missingFields = [];
  const sub = subaccounts[0];

  if (!sub.account_sid) missingFields.push('account_sid');
  if (!sub.auth_token) missingFields.push('auth_token');

  if (missingFields.length > 0) {
    console.log('❌ CRITICAL: Missing required fields:', missingFields.join(', '));
    console.log('');
    console.log('FIX: This subaccount record is incomplete');
    console.log('Options:');
    console.log('1. Delete this record and create a new subaccount via managed telephony flow');
    console.log('2. Update the record with correct Twilio credentials');
    console.log('3. Switch to BYOC mode and connect user own Twilio account');
  } else {
    console.log('✅ Required fields present - credentials should work');
    console.log('');
    console.log('⚠️  If still failing, check:');
    console.log('1. Credentials are valid (not revoked)');
    console.log('2. IntegrationDecryptor.getEffectiveTwilioCredentials() logic');
    console.log('3. Error logs when verification endpoint is called');
  }

})();
