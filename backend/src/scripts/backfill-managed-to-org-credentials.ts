/**
 * Backfill Script: Migrate Existing Managed Numbers to org_credentials
 *
 * Purpose: Migrate existing managed phone numbers from managed_phone_numbers table
 *          to org_credentials table for unified credential access.
 *
 * This script:
 * 1. Queries all active managed numbers
 * 2. For each number, retrieves subaccount credentials
 * 3. Saves to org_credentials via IntegrationDecryptor (with is_managed=true)
 * 4. Skips already-migrated numbers
 * 5. Reports success/failure counts
 *
 * Run: npx ts-node src/scripts/backfill-managed-to-org-credentials.ts
 */

import { createClient } from '@supabase/supabase-js';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { EncryptionService } from '../services/encryption';
import { log } from '../services/logger';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  }
);

interface ManagedNumber {
  id: string;
  org_id: string;
  phone_number: string;
  vapi_phone_id: string | null;
  vapi_credential_id: string | null;
  subaccount_id: string;
  status: string;
}

interface Subaccount {
  id: string;
  twilio_account_sid: string;
  twilio_auth_token_encrypted: string;
}

async function backfillManagedNumbersToOrgCredentials() {
  console.log('========================================');
  console.log('Backfill: managed_phone_numbers → org_credentials');
  console.log('========================================\n');

  log.info('BackfillScript', 'Starting backfill migration');

  // Step 1: Get all active managed numbers
  const { data: managedNumbers, error: queryError } = await supabaseAdmin
    .from('managed_phone_numbers')
    .select('*')
    .eq('status', 'active');

  if (queryError) {
    log.error('BackfillScript', 'Failed to query managed_phone_numbers', { error: queryError });
    throw queryError;
  }

  console.log(`📊 Found ${managedNumbers?.length || 0} active managed numbers\n`);
  log.info('BackfillScript', `Found ${managedNumbers?.length || 0} managed numbers`);

  if (!managedNumbers || managedNumbers.length === 0) {
    console.log('✅ No managed numbers to backfill. Migration complete.\n');
    log.info('BackfillScript', 'No managed numbers found');
    return {
      total: 0,
      success: 0,
      skipped: 0,
      errors: 0,
    };
  }

  // Step 2: Process each managed number
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errorDetails: Array<{ phoneNumber: string; error: string }> = [];

  for (const managedNum of managedNumbers as ManagedNumber[]) {
    try {
      console.log(`\n📞 Processing: ${managedNum.phone_number}`);
      log.info('BackfillScript', `Processing managed number ${managedNum.phone_number}`, {
        orgId: managedNum.org_id,
        subaccountId: managedNum.subaccount_id,
      });

      // Check if already migrated
      const { data: existing } = await supabaseAdmin
        .from('org_credentials')
        .select('id')
        .eq('org_id', managedNum.org_id)
        .eq('provider', 'twilio')
        .eq('is_managed', true)
        .single();

      if (existing) {
        console.log(`   ⏭️  Already migrated (skipping)`);
        log.info('BackfillScript', `Already migrated: ${managedNum.phone_number}`);
        skipCount++;
        continue;
      }

      // Get subaccount credentials
      const { data: subaccount, error: subError } = await supabaseAdmin
        .from('twilio_subaccounts')
        .select('twilio_account_sid, twilio_auth_token_encrypted')
        .eq('id', managedNum.subaccount_id)
        .single();

      if (subError || !subaccount) {
        const errMsg = `Subaccount not found for ${managedNum.phone_number}`;
        console.log(`   ❌ ${errMsg}`);
        log.error('BackfillScript', errMsg, {
          subaccountId: managedNum.subaccount_id,
          error: subError,
        });
        errorDetails.push({
          phoneNumber: managedNum.phone_number,
          error: errMsg,
        });
        errorCount++;
        continue;
      }

      // Decrypt auth token using EncryptionService
      let authToken: string;
      try {
        authToken = EncryptionService.decrypt(
          (subaccount as Subaccount).twilio_auth_token_encrypted
        );
        if (!authToken) {
          throw new Error('Decrypted token is empty');
        }
      } catch (decryptError: any) {
        const errMsg = `Failed to decrypt auth token`;
        console.log(`   ❌ ${errMsg}`);
        log.error('BackfillScript', errMsg, {
          phoneNumber: managedNum.phone_number,
          error: decryptError.message,
        });
        errorDetails.push({
          phoneNumber: managedNum.phone_number,
          error: errMsg,
        });
        errorCount++;
        continue;
      }

      // Save to org_credentials via IntegrationDecryptor
      await IntegrationDecryptor.saveTwilioCredential(
        managedNum.org_id,
        {
          accountSid: (subaccount as Subaccount).twilio_account_sid,
          authToken,
          phoneNumber: managedNum.phone_number,
          source: 'managed',
          vapiPhoneId: managedNum.vapi_phone_id || undefined,
          vapiCredentialId: managedNum.vapi_credential_id || undefined,
        }
      );

      console.log(`   ✅ Migrated successfully`);
      log.info('BackfillScript', `Migrated: ${managedNum.phone_number}`);
      successCount++;

    } catch (error: any) {
      console.log(`   ❌ Migration failed: ${error.message}`);
      log.error('BackfillScript', `Failed to migrate ${managedNum.phone_number}`, { error });
      errorDetails.push({
        phoneNumber: managedNum.phone_number,
        error: error.message,
      });
      errorCount++;
    }
  }

  // Final summary
  console.log('\n========================================');
  console.log('Backfill Complete');
  console.log('========================================');
  console.log(`📊 Total numbers:    ${managedNumbers.length}`);
  console.log(`✅ Successfully migrated: ${successCount}`);
  console.log(`⏭️  Skipped (already migrated): ${skipCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  if (errorCount > 0) {
    console.log('\n❌ Error Details:');
    errorDetails.forEach((err) => {
      console.log(`   - ${err.phoneNumber}: ${err.error}`);
    });
  }

  console.log('\n========================================\n');

  log.info('BackfillScript', 'Backfill complete', {
    total: managedNumbers.length,
    success: successCount,
    skipped: skipCount,
    errors: errorCount,
  });

  if (errorCount > 0) {
    throw new Error(`Backfill completed with ${errorCount} errors`);
  }

  return {
    total: managedNumbers.length,
    success: successCount,
    skipped: skipCount,
    errors: errorCount,
  };
}

// Run if called directly
if (require.main === module) {
  backfillManagedNumbersToOrgCredentials()
    .then((result) => {
      console.log('✅ Backfill script finished successfully');
      log.info('BackfillScript', 'Script finished successfully', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backfill script failed:', error.message);
      log.error('BackfillScript', 'Script failed', { error });
      process.exit(1);
    });
}

export { backfillManagedNumbersToOrgCredentials };
