/**
 * Check managed_phone_numbers table for this org
 * This is the likely cause of "Twilio credentials not configured" error
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
  console.log('🔍 MANAGED PHONE NUMBERS CHECK\n');
  console.log('Org ID:', ORG_ID);
  console.log('');

  // Check for managed phone numbers
  const { data: numbers, error } = await supabase
    .from('managed_phone_numbers')
    .select('*')
    .eq('org_id', ORG_ID);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  if (!numbers || numbers.length === 0) {
    console.log('❌ PROBLEM FOUND: No managed phone numbers exist for this org\n');
    console.log('This is why getEffectiveTwilioCredentials() fails!');
    console.log('');
    console.log('The function flow:');
    console.log('1. ✅ Checks telephony_mode → "managed"');
    console.log('2. ✅ Gets subaccount credentials from twilio_subaccounts');
    console.log('3. ❌ Tries to get active managed phone number → NOT FOUND');
    console.log('4. ❌ Throws error: "No active managed phone number for org"');
    console.log('');
    console.log('─'.repeat(60));
    console.log('FIX OPTIONS:\n');
    console.log('Option 1: Create a managed phone number');
    console.log('  - Go to Dashboard > Telephony');
    console.log('  - Purchase a phone number');
    console.log('  - Will create entry in managed_phone_numbers table');
    console.log('');
    console.log('Option 2: Switch to BYOC mode');
    console.log('  - Change telephony_mode to "byoc"');
    console.log('  - Connect personal Twilio account');
    console.log('  - Verify caller ID will use user Twilio credentials');
    console.log('');
    console.log('RECOMMENDED: Option 2 (BYOC mode)');
    console.log('  - Faster (no need to purchase number)');
    console.log('  - Uses existing Twilio account with credentials in org_credentials');
    console.log('  - Caller ID verification works immediately');
    process.exit(0);
  }

  console.log(`✅ Found ${numbers.length} managed phone number(s):\n`);

  numbers.forEach((num, i) => {
    console.log(`Number ${i + 1}:`);
    console.log('  - Phone:', num.phone_number);
    console.log('  - Status:', num.status);
    console.log('  - Created:', new Date(num.created_at).toLocaleString());
    if (num.status !== 'active') {
      console.log('  - ⚠️  WARNING: Status is not "active"');
    }
    console.log('');
  });

  const activeNumbers = numbers.filter((n: any) => n.status === 'active');

  if (activeNumbers.length === 0) {
    console.log('❌ PROBLEM: No ACTIVE managed phone numbers');
    console.log('   getEffectiveTwilioCredentials() requires status="active"');
    console.log('');
    console.log('FIX: Update status to "active" OR purchase new number');
  } else {
    console.log(`✅ ${activeNumbers.length} active number(s) - credentials should work`);
  }

})();
