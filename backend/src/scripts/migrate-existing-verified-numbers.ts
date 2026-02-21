/**
 * Migration Script: Backfill vapi_phone_number_id for Existing Verified Numbers
 *
 * Run this ONCE after deploying the verified-caller-id Vapi import fix.
 * It finds any verified_caller_ids records that are verified but NOT yet
 * imported into Vapi, and imports them.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-existing-verified-numbers.ts
 *
 * Safe to re-run: skips records that already have vapi_phone_number_id.
 */

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';
import { VapiClient } from '../services/vapi-client';
import { IntegrationDecryptor } from '../services/integration-decryptor';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== Migrate Existing Verified Numbers to Vapi ===\n');

  // Find all verified numbers missing a Vapi link
  const { data: records, error } = await supabase
    .from('verified_caller_ids')
    .select('id, org_id, phone_number, status, vapi_phone_number_id, twilio_caller_id_sid')
    .eq('status', 'verified')
    .is('vapi_phone_number_id', null);

  if (error) {
    console.error('Failed to query verified_caller_ids:', error.message);
    process.exit(1);
  }

  if (!records || records.length === 0) {
    console.log('No verified numbers need migration. All done!');
    process.exit(0);
  }

  console.log(`Found ${records.length} verified number(s) to migrate:\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const record of records) {
    const label = `[${record.org_id.slice(0, 8)}] ${record.phone_number}`;

    try {
      // Get Twilio credentials for this org
      let credentials;
      try {
        credentials = await IntegrationDecryptor.getEffectiveTwilioCredentials(record.org_id);
      } catch {
        console.log(`  SKIP ${label} — no Twilio credentials for org`);
        skipped++;
        continue;
      }

      // Also backfill twilio_caller_id_sid if missing
      if (!record.twilio_caller_id_sid) {
        try {
          const twilio = require('twilio');
          const twilioClient = twilio(credentials.accountSid, credentials.authToken);
          const callerIds = await twilioClient.outgoingCallerIds.list({
            phoneNumber: record.phone_number,
            limit: 1
          });
          if (callerIds.length > 0) {
            await supabase
              .from('verified_caller_ids')
              .update({ twilio_caller_id_sid: callerIds[0].sid })
              .eq('id', record.id);
            console.log(`  BACKFILL ${label} — twilio_caller_id_sid = ${callerIds[0].sid}`);
          }
        } catch (err: any) {
          console.log(`  WARN ${label} — could not backfill twilio_caller_id_sid: ${err.message}`);
        }
      }

      // Import into Vapi
      const vapiClient = new VapiClient(process.env.VAPI_PRIVATE_KEY);
      const importResult = await vapiClient.importTwilioNumber({
        phoneNumber: record.phone_number,
        twilioAccountSid: credentials.accountSid,
        twilioAuthToken: credentials.authToken,
        name: `Verified Caller ID - ${record.phone_number}`
      });

      if (!importResult?.id) {
        console.log(`  FAIL ${label} — Vapi import returned no ID`);
        failed++;
        continue;
      }

      // Update DB with Vapi phone number ID
      const { error: updateError } = await supabase
        .from('verified_caller_ids')
        .update({ vapi_phone_number_id: importResult.id })
        .eq('id', record.id);

      if (updateError) {
        console.log(`  FAIL ${label} — DB update failed: ${updateError.message}`);
        // Clean up orphaned Vapi number
        try { await vapiClient.deletePhoneNumber(importResult.id); } catch { /* best-effort */ }
        failed++;
        continue;
      }

      // Update outbound agent
      const { data: agent } = await supabase
        .from('agents')
        .select('id')
        .eq('org_id', record.org_id)
        .eq('role', 'outbound')
        .maybeSingle();

      if (agent) {
        await supabase
          .from('agents')
          .update({ vapi_phone_number_id: importResult.id })
          .eq('id', agent.id);
        console.log(`  OK   ${label} → Vapi ID: ${importResult.id} (agent updated)`);
      } else {
        console.log(`  OK   ${label} → Vapi ID: ${importResult.id} (no outbound agent)`);
      }

      success++;
    } catch (err: any) {
      console.log(`  FAIL ${label} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`  Success: ${success}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${records.length}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration script failed:', err);
  process.exit(1);
});
