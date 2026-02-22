/**
 * Repair Script: Patch org_credentials.encrypted_config to include vapiPhoneId
 *
 * Root Cause: Historical managed number provisioning either:
 *   (a) Wrote org_credentials without vapiPhoneId in the encrypted_config, OR
 *   (b) Encrypted config is undecryptable (different key at time of provisioning)
 *
 * Both cases cause the Agent Config dropdown to show 0 numbers for affected orgs.
 *
 * Fix Strategy:
 *   - For orgs where decryption succeeds but vapiPhoneId is missing → patch in place
 *   - For orgs where decryption fails → rebuild encrypted_config from:
 *       * twilio_subaccounts (has auth_token_encrypted + account_sid)
 *       * managed_phone_numbers (has phone_number + vapi_phone_id)
 */

import { supabaseAdmin } from '../config/supabase';
import { EncryptionService } from '../services/encryption';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { createLogger } from '../services/logger';

const logger = createLogger('RepairOrgCredentials');

async function repairOrgCredentials() {
  logger.info('Starting org_credentials vapiPhoneId repair...\n');

  // 1. Get all managed org_credentials entries
  const { data: credentials, error: credErr } = await supabaseAdmin
    .from('org_credentials')
    .select('id, org_id, encrypted_config')
    .eq('provider', 'twilio')
    .eq('is_managed', true)
    .eq('is_active', true);

  if (credErr) {
    logger.error('Failed to fetch org_credentials', { error: credErr.message });
    process.exit(1);
  }

  logger.info(`Found ${credentials?.length ?? 0} managed org_credentials entries`);

  let repaired = 0;
  let alreadyOk = 0;
  let failed = 0;

  for (const cred of credentials || []) {
    const orgShort = cred.org_id.slice(0, 8);

    // ── Case A: Try to decrypt existing config ──
    let decrypted: Record<string, any> | null = null;
    try {
      decrypted = EncryptionService.decryptObject(cred.encrypted_config);
    } catch (_) {
      // Decryption failed — fall through to Case B
    }

    if (decrypted) {
      // Decryption succeeded — check if vapiPhoneId is already present
      if (decrypted.vapiPhoneId) {
        logger.info(`org ${orgShort}: ✅ already has vapiPhoneId=${decrypted.vapiPhoneId.slice(0, 8)}...`);
        alreadyOk++;
        continue;
      }

      // Patch: vapiPhoneId missing — look it up from managed_phone_numbers
      const { data: managedNums } = await supabaseAdmin
        .from('managed_phone_numbers')
        .select('phone_number, vapi_phone_id')
        .eq('org_id', cred.org_id)
        .neq('status', 'released')
        .not('vapi_phone_id', 'is', null);

      const matching = (managedNums || []).find(
        (mn) => mn.phone_number === decrypted!.phoneNumber
      ) || (managedNums || [])[0];

      if (!matching?.vapi_phone_id) {
        logger.warn(`org ${orgShort}: ⚠️  no vapi_phone_id in managed_phone_numbers — skip`);
        failed++;
        continue;
      }

      const patched = { ...decrypted, vapiPhoneId: matching.vapi_phone_id };
      const newEncrypted = EncryptionService.encryptObject(patched);

      const { error: updateErr } = await supabaseAdmin
        .from('org_credentials')
        .update({ encrypted_config: newEncrypted, updated_at: new Date().toISOString() })
        .eq('id', cred.id);

      if (updateErr) {
        logger.error(`org ${orgShort}: ❌ update failed`, { error: updateErr.message });
        failed++;
        continue;
      }

      logger.info(`org ${orgShort}: ✅ PATCHED (Case A) — added vapiPhoneId=${matching.vapi_phone_id.slice(0, 8)}...`);
      repaired++;
      continue;
    }

    // ── Case B: Decryption failed — rebuild from Twilio API + managed_phone_numbers ──
    logger.info(`org ${orgShort}: ⚠️  Decryption failed — rebuilding via Twilio API`);

    // Get subaccount SID from twilio_subaccounts
    const { data: sub } = await supabaseAdmin
      .from('twilio_subaccounts')
      .select('twilio_account_sid')
      .eq('org_id', cred.org_id)
      .eq('status', 'active')
      .maybeSingle();

    if (!sub?.twilio_account_sid) {
      logger.error(`org ${orgShort}: ❌ no active twilio_subaccount — cannot rebuild`);
      failed++;
      continue;
    }

    // Fetch auth token from Twilio using master credentials
    const masterSid = process.env.TWILIO_MASTER_ACCOUNT_SID;
    const masterToken = process.env.TWILIO_MASTER_AUTH_TOKEN;
    if (!masterSid || !masterToken) {
      logger.error(`org ${orgShort}: ❌ TWILIO_MASTER_ACCOUNT_SID/AUTH_TOKEN not set`);
      failed++;
      continue;
    }

    let authToken: string;
    try {
      const basicAuth = Buffer.from(`${masterSid}:${masterToken}`).toString('base64');
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sub.twilio_account_sid}.json`,
        { headers: { Authorization: `Basic ${basicAuth}` } }
      );
      if (!resp.ok) throw new Error(`Twilio API ${resp.status}`);
      const data: any = await resp.json();
      authToken = data.auth_token;
      if (!authToken) throw new Error('auth_token not in Twilio response');
    } catch (err: any) {
      logger.error(`org ${orgShort}: ❌ Twilio API fetch failed — ${err.message}`);
      failed++;
      continue;
    }

    // Get managed phone number + vapi_phone_id
    const { data: managedNums } = await supabaseAdmin
      .from('managed_phone_numbers')
      .select('phone_number, vapi_phone_id')
      .eq('org_id', cred.org_id)
      .neq('status', 'released');

    if (!managedNums || managedNums.length === 0) {
      logger.error(`org ${orgShort}: ❌ no managed_phone_numbers row — cannot rebuild`);
      failed++;
      continue;
    }

    const mn = managedNums[0];

    // Re-write org_credentials with correct data
    try {
      await IntegrationDecryptor.saveTwilioCredential(cred.org_id, {
        accountSid: sub.twilio_account_sid,
        authToken,
        phoneNumber: mn.phone_number,
        source: 'managed',
        vapiPhoneId: mn.vapi_phone_id || undefined,
      });
      logger.info(`org ${orgShort}: ✅ REBUILT (Case B) — phone=${mn.phone_number} vapiPhoneId=${(mn.vapi_phone_id || 'none').slice(0, 8)}...`);
      repaired++;
    } catch (err: any) {
      logger.error(`org ${orgShort}: ❌ rebuild failed — ${err.message}`);
      failed++;
    }
  }

  console.log('\n=== REPAIR SUMMARY ===');
  console.log(`Total credentials:  ${credentials?.length ?? 0}`);
  console.log(`Already correct:    ${alreadyOk}`);
  console.log(`Repaired:           ${repaired}`);
  console.log(`Failed:             ${failed}`);
  console.log('======================\n');

  if (repaired > 0) {
    console.log('✅ Repair complete. Restart backend — Agent Config dropdown will now show managed numbers.');
  } else if (failed === 0) {
    console.log('ℹ️  All records are already correct. No action needed.');
  } else {
    console.log('⚠️  Some records could not be repaired. Check logs above.');
  }
}

repairOrgCredentials().catch((err) => {
  console.error('Repair script failed:', err.message);
  process.exit(1);
});
