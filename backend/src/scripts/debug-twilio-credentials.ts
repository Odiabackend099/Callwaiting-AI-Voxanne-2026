/**
 * Debug script to investigate Twilio credentials issue
 * Checks org_credentials, telephony_mode, and credential resolution
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
  console.log('🔍 TWILIO CREDENTIALS DEBUG\n');
  console.log('Org ID:', ORG_ID);
  console.log('');

  // Step 1: Check organization telephony_mode
  console.log('Step 1: Checking organization telephony_mode...\n');

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, telephony_mode')
    .eq('id', ORG_ID)
    .single();

  if (orgError) {
    console.error('❌ Error fetching organization:', orgError.message);
    process.exit(1);
  }

  console.log('✅ Organization found:');
  console.log('  - Name:', org.name);
  console.log('  - Telephony Mode:', org.telephony_mode);
  console.log('');

  // Step 2: Check org_credentials table
  console.log('Step 2: Checking org_credentials table...\n');

  const { data: credentials, error: credError } = await supabase
    .from('org_credentials')
    .select('*')
    .eq('org_id', ORG_ID);

  if (credError) {
    console.error('❌ Error fetching credentials:', credError.message);
  }

  if (!credentials || credentials.length === 0) {
    console.log('⚠️  No credentials found in org_credentials table');
    console.log('');
  } else {
    console.log(`✅ Found ${credentials.length} credential(s):`);
    credentials.forEach((cred, i) => {
      console.log(`\nCredential ${i + 1}:`);
      console.log('  - ID:', cred.id);
      console.log('  - Provider:', cred.provider);
      console.log('  - Created:', new Date(cred.created_at).toLocaleString());
      console.log('  - Has encrypted_credentials:', !!cred.encrypted_credentials);

      // Check for Twilio-specific fields
      if (cred.provider === 'twilio') {
        console.log('  - Twilio credential found ✅');
      }
    });
    console.log('');
  }

  // Step 3: Check twilio_subaccounts table (for managed mode)
  if (org.telephony_mode === 'managed') {
    console.log('Step 3: Checking twilio_subaccounts (managed mode)...\n');

    const { data: subaccounts, error: subError } = await supabase
      .from('twilio_subaccounts')
      .select('*')
      .eq('org_id', ORG_ID);

    if (subError) {
      console.error('❌ Error fetching subaccounts:', subError.message);
    }

    if (!subaccounts || subaccounts.length === 0) {
      console.log('⚠️  No subaccount found (expected for managed mode)');
      console.log('');
    } else {
      console.log(`✅ Found ${subaccounts.length} subaccount(s):`);
      subaccounts.forEach((sub, i) => {
        console.log(`\nSubaccount ${i + 1}:`);
        console.log('  - ID:', sub.id);
        console.log('  - Subaccount SID:', sub.subaccount_sid);
        console.log('  - Status:', sub.status);
        console.log('  - Created:', new Date(sub.created_at).toLocaleString());
      });
      console.log('');
    }
  }

  // Step 4: Summary and recommendations
  console.log('─'.repeat(60));
  console.log('DIAGNOSIS:\n');

  if (org.telephony_mode === 'managed') {
    console.log('📋 Telephony Mode: MANAGED');
    console.log('Expected: Credentials in twilio_subaccounts table');

    const { data: subaccounts } = await supabase
      .from('twilio_subaccounts')
      .select('*')
      .eq('org_id', ORG_ID);

    if (!subaccounts || subaccounts.length === 0) {
      console.log('❌ ISSUE: No subaccount found');
      console.log('');
      console.log('FIX: Create a Twilio subaccount for this org');
      console.log('OR: Change telephony_mode to "byoc" if user has own Twilio account');
    } else {
      console.log('✅ Subaccount exists - credentials should work');
    }
  } else if (org.telephony_mode === 'byoc') {
    console.log('📋 Telephony Mode: BYOC (Bring Your Own Credentials)');
    console.log('Expected: Credentials in org_credentials table with provider="twilio"');

    const twilioCredential = credentials?.find((c: any) => c.provider === 'twilio');

    if (!twilioCredential) {
      console.log('❌ ISSUE: No Twilio credentials in org_credentials');
      console.log('');
      console.log('FIX: User must connect their Twilio account');
      console.log('Path: Dashboard > Integrations > Connect Twilio');
    } else {
      console.log('✅ Twilio credentials exist in org_credentials');
      console.log('');
      console.log('⚠️  But getEffectiveTwilioCredentials still failing...');
      console.log('Possible issues:');
      console.log('1. Decryption failing (check encryption key)');
      console.log('2. Credentials malformed in database');
      console.log('3. Missing required fields (accountSid, authToken)');
    }
  } else {
    console.log('⚠️  Unknown telephony_mode:', org.telephony_mode);
    console.log('');
    console.log('FIX: Set telephony_mode to either "managed" or "byoc"');
  }

  console.log('');
  console.log('─'.repeat(60));

})();
