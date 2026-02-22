/**
 * Repair Script: Patch org_credentials.encrypted_config to include vapiPhoneId
 *
 * Root Cause: Historical managed number provisioning either:
 *   (a) Wrote org_credentials without vapiPhoneId in the encrypted_config, OR
 *   (b) Encrypted config is undecryptable (different ENCRYPTION_KEY at provisioning time)
 *
 * Both cases cause the Agent Config dropdown to show 0 numbers for affected orgs.
 *
 * Fix Strategy:
 *   - Case A: Decryption succeeds but vapiPhoneId missing → patch in place from managed_phone_numbers
 *   - Case B: Decryption fails → fetch Twilio auth token from Twilio REST API using master
 *             credentials, then rebuild via IntegrationDecryptor.saveTwilioCredential()
 *
 * Idempotency: Safe to run multiple times. Already-correct records are skipped on re-run.
 *
 * Usage:
 *   ts-node src/scripts/repair-org-credentials-vapi-phone-id.ts          # live run
 *   ts-node src/scripts/repair-org-credentials-vapi-phone-id.ts --dry-run # preview only
 */

import { supabaseAdmin } from '../config/supabase';
import { EncryptionService } from '../services/encryption';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { createLogger } from '../services/logger';

const logger = createLogger('RepairOrgCredentials');

const DRY_RUN = process.argv.includes('--dry-run');

interface ManagedPhoneNumber {
  org_id: string;
  phone_number: string;
  vapi_phone_id: string | null;
  status: string;
}

interface TwilioSubaccount {
  org_id: string;
  twilio_account_sid: string;
}

async function repairOrgCredentials() {
  if (DRY_RUN) {
    logger.info('*** DRY RUN MODE — no changes will be written ***\n');
  }

  logger.info('Starting org_credentials vapiPhoneId repair...\n');

  // Read master credentials once — not inside the loop
  const masterSid = process.env.TWILIO_MASTER_ACCOUNT_SID;
  const masterToken = process.env.TWILIO_MASTER_AUTH_TOKEN;

  // ── Batch fetch all data upfront to avoid N+1 queries ──

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

  const orgIds = (credentials || []).map((c) => c.org_id);

  // Batch fetch all managed phone numbers for the relevant orgs, ordered by created_at
  // so [0] is the oldest/primary number — consistent across runs
  const { data: allManagedNums } = await supabaseAdmin
    .from('managed_phone_numbers')
    .select('org_id, phone_number, vapi_phone_id, status')
    .in('org_id', orgIds)
    .neq('status', 'released')
    .order('created_at', { ascending: true });

  // Batch fetch all twilio subaccounts for the relevant orgs
  const { data: allSubaccounts } = await supabaseAdmin
    .from('twilio_subaccounts')
    .select('org_id, twilio_account_sid')
    .in('org_id', orgIds)
    .eq('status', 'active');

  // Build lookup maps for O(1) access
  const managedNumsByOrg = new Map<string, ManagedPhoneNumber[]>();
  for (const mn of allManagedNums || []) {
    if (!managedNumsByOrg.has(mn.org_id)) managedNumsByOrg.set(mn.org_id, []);
    managedNumsByOrg.get(mn.org_id)!.push(mn);
  }

  const subaccountByOrg = new Map<string, TwilioSubaccount>();
  for (const sub of allSubaccounts || []) {
    subaccountByOrg.set(sub.org_id, sub);
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

      // Case A patch: vapiPhoneId missing — find matching number from managed_phone_numbers.
      // Prefer exact match on phoneNumber; fall back to first number for the org (oldest by created_at).
      const orgNums = managedNumsByOrg.get(cred.org_id) || [];
      const numsWithVapiId = orgNums.filter((mn) => mn.vapi_phone_id);

      const matching =
        numsWithVapiId.find((mn) => mn.phone_number === decrypted!.phoneNumber) ||
        numsWithVapiId[0]; // oldest number if no exact match

      if (!matching?.vapi_phone_id) {
        logger.warn(`org ${orgShort}: ⚠️  no vapi_phone_id in managed_phone_numbers — skip`);
        failed++;
        continue;
      }

      if (DRY_RUN) {
        logger.info(`org ${orgShort}: [DRY RUN] would patch vapiPhoneId=${matching.vapi_phone_id.slice(0, 8)}...`);
        repaired++;
        continue;
      }

      const patched = { ...decrypted, vapiPhoneId: matching.vapi_phone_id };
      const newEncrypted = EncryptionService.encryptObject(patched);

      const { error: updateErr } = await supabaseAdmin
        .from('org_credentials')
        .update({ encrypted_config: newEncrypted })
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

    const sub = subaccountByOrg.get(cred.org_id);
    if (!sub?.twilio_account_sid) {
      logger.error(`org ${orgShort}: ❌ no active twilio_subaccount — cannot rebuild`);
      failed++;
      continue;
    }

    if (!masterSid || !masterToken) {
      logger.error(`org ${orgShort}: ❌ TWILIO_MASTER_ACCOUNT_SID/AUTH_TOKEN not set in env`);
      failed++;
      continue;
    }

    let authToken: string;
    try {
      const basicAuth = Buffer.from(`${masterSid}:${masterToken}`).toString('base64');
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sub.twilio_account_sid}.json`,
        {
          headers: { Authorization: `Basic ${basicAuth}` },
          signal: AbortSignal.timeout(10_000), // 10s — prevents infinite hang on Twilio API
        }
      );
      if (!resp.ok) throw new Error(`Twilio API responded with ${resp.status} ${resp.statusText}`);
      const data: any = await resp.json();
      authToken = data.auth_token;
      if (!authToken) throw new Error('auth_token missing from Twilio response');
    } catch (err: any) {
      logger.error(`org ${orgShort}: ❌ Twilio API fetch failed — ${err.message}`);
      failed++;
      continue;
    }

    // Pick the primary managed number for this org (oldest by created_at — consistent ordering)
    const orgNums = managedNumsByOrg.get(cred.org_id) || [];
    if (orgNums.length === 0) {
      logger.error(`org ${orgShort}: ❌ no managed_phone_numbers row — cannot rebuild`);
      failed++;
      continue;
    }

    if (orgNums.length > 1) {
      // Log a warning so multi-number orgs are visible — they may need manual review
      logger.warn(
        `org ${orgShort}: has ${orgNums.length} managed numbers — using oldest (${orgNums[0].phone_number}). Others may need manual repair.`
      );
    }

    const primaryNumber = orgNums[0];

    if (DRY_RUN) {
      logger.info(
        `org ${orgShort}: [DRY RUN] would rebuild — phone=${primaryNumber.phone_number} vapiPhoneId=${primaryNumber.vapi_phone_id?.slice(0, 8) ?? 'none'}...`
      );
      repaired++;
      continue;
    }

    try {
      await IntegrationDecryptor.saveTwilioCredential(cred.org_id, {
        accountSid: sub.twilio_account_sid,
        authToken,
        phoneNumber: primaryNumber.phone_number,
        source: 'managed',
        vapiPhoneId: primaryNumber.vapi_phone_id || undefined,
      });
      logger.info(
        `org ${orgShort}: ✅ REBUILT (Case B) — phone=${primaryNumber.phone_number} vapiPhoneId=${(primaryNumber.vapi_phone_id || 'none').slice(0, 8)}...`
      );
      repaired++;
    } catch (err: any) {
      logger.error(`org ${orgShort}: ❌ rebuild failed — ${err.message}`);
      failed++;
    }
  }

  const total = credentials?.length ?? 0;
  logger.info('\n=== REPAIR SUMMARY ===');
  logger.info(`Total credentials:  ${total}`);
  logger.info(`Already correct:    ${alreadyOk}`);
  logger.info(`Repaired:           ${repaired}${DRY_RUN ? ' (dry run — not written)' : ''}`);
  logger.info(`Failed:             ${failed}`);
  logger.info('======================\n');

  if (DRY_RUN) {
    logger.info('Dry run complete. Re-run without --dry-run to apply changes.');
  } else if (repaired > 0) {
    logger.info('✅ Repair complete. Restart backend — Agent Config dropdown will now show managed numbers.');
  } else if (failed === 0) {
    logger.info('ℹ️  All records are already correct. No action needed.');
  } else {
    logger.warn('⚠️  Some records could not be repaired. Check logs above.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

repairOrgCredentials().catch((err) => {
  logger.error('Repair script crashed', { error: err.message });
  process.exit(1);
});
