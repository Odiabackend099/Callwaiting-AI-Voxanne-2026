/**
 * Migration Script: Enable Geo Permissions Inheritance on ALL Existing Subaccounts
 *
 * Problem: Existing managed telephony subaccounts were created without
 * enabling DialingPermissionsInheritance from the master account.
 * This means they can only call countries in their default Geo Permissions
 * (typically US only), causing Error 13227 for international calls.
 *
 * Solution: Enable inheritance on all active subaccounts so they automatically
 * inherit the master account's Geo Permissions.
 *
 * Usage: cd backend && npx ts-node scripts/fix-subaccount-geo-permissions.ts
 *
 * @see https://www.twilio.com/docs/voice/api/dialingpermissions-settings-resource
 */

import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';
import { EncryptionService } from '../src/services/encryption';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAllSubaccountGeoPermissions() {
  console.log('=== Fix Subaccount Geo Permissions ===');
  console.log('');

  // Step 1: Fetch all active subaccounts
  const { data: subaccounts, error } = await supabase
    .from('twilio_subaccounts')
    .select('id, org_id, twilio_account_sid, twilio_auth_token_encrypted, friendly_name, status')
    .eq('status', 'active');

  if (error) {
    console.error('Failed to fetch subaccounts:', error.message);
    return;
  }

  if (!subaccounts || subaccounts.length === 0) {
    console.log('No active subaccounts found.');
    return;
  }

  console.log(`Found ${subaccounts.length} active subaccount(s)`);
  console.log('');

  let fixed = 0;
  let alreadyOk = 0;
  let failed = 0;

  for (const sub of subaccounts) {
    console.log(`--- Subaccount: ${sub.friendly_name || sub.twilio_account_sid} ---`);
    console.log(`  Org ID: ${sub.org_id}`);
    console.log(`  SID: ${sub.twilio_account_sid}`);

    try {
      // Decrypt auth token
      const authToken = EncryptionService.decrypt(sub.twilio_auth_token_encrypted);
      const subClient = twilio(sub.twilio_account_sid, authToken);

      // Check current settings
      const settings = await subClient.voice.v1.dialingPermissions.settings().fetch();
      console.log(`  Current inheritance: ${settings.dialingPermissionsInheritance}`);

      if (settings.dialingPermissionsInheritance) {
        console.log('  Status: Already enabled');
        alreadyOk++;
      } else {
        // Enable inheritance
        await subClient.voice.v1.dialingPermissions.settings().update({
          dialingPermissionsInheritance: true
        });
        console.log('  Status: ENABLED (was disabled)');
        fixed++;
      }

      // Verify Nigeria specifically
      try {
        const ngPerms = await subClient.voice.v1.dialingPermissions
          .countries('NG')
          .fetch();
        console.log(`  Nigeria Low Risk: ${ngPerms.lowRiskNumbersEnabled}`);
      } catch {
        console.log('  Nigeria: Unable to check (may need propagation time)');
      }

    } catch (err: any) {
      console.error(`  ERROR: ${err.message}`);
      failed++;
    }

    console.log('');
  }

  // Summary
  console.log('=== Summary ===');
  console.log(`Total subaccounts: ${subaccounts.length}`);
  console.log(`Fixed (inheritance enabled): ${fixed}`);
  console.log(`Already OK: ${alreadyOk}`);
  console.log(`Failed: ${failed}`);

  if (fixed > 0) {
    console.log('');
    console.log('Geo Permissions inheritance has been enabled.');
    console.log('Changes may take up to 5 minutes to propagate.');
    console.log('After propagation, subaccounts will inherit all master account permissions.');
  }
}

fixAllSubaccountGeoPermissions().catch(console.error);
