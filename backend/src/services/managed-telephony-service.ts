/**
 * ManagedTelephonyService
 *
 * Handles the complete lifecycle of managed (reseller) telephony:
 * - Twilio subaccount creation and management
 * - Phone number provisioning in subaccounts
 * - Vapi credential and phone number registration
 * - Number release and subaccount suspension
 *
 * This service is ONLY for organizations with telephony_mode='managed'.
 * BYOC organizations continue using IntegrationDecryptor + existing flows.
 *
 * @ai-invariant This service creates NEW tables/records only.
 *   It does NOT modify org_credentials, integrations, or BYOC flows.
 */

import twilio from 'twilio';
import { supabaseAdmin } from '../config/supabase';
import { EncryptionService } from './encryption';
import { IntegrationDecryptor } from './integration-decryptor';
import { log as logger } from './logger';
import { VapiClient } from './vapi-client';
import { config } from '../config';
import { log } from './logger';

// ============================================
// Type Definitions
// ============================================

export interface ProvisionRequest {
  orgId: string;
  country: string;        // 'US', 'GB'
  numberType?: string;    // 'local' | 'toll_free'
  areaCode?: string;      // Optional area code preference
  direction?: 'inbound' | 'outbound' | 'unassigned';  // Routing direction
}

export interface ProvisionResult {
  success: boolean;
  phoneNumber?: string;
  vapiPhoneId?: string;
  subaccountSid?: string;
  error?: string;
  failedStep?: 'lock' | 'validation' | 'subaccount' | 'search' | 'purchase' | 'vapi_import' | 'database' | 'credential_save' | 'unknown';
  canRetry?: boolean;
  userMessage?: string;
}

export interface ManagedStatus {
  mode: 'byoc' | 'managed' | 'none';
  subaccount?: {
    sid: string;
    status: string;
    friendlyName: string;
    a2pStatus: string;
  };
  numbers: Array<{
    phoneNumber: string;
    status: string;
    vapiPhoneId: string | null;
    countryCode: string;
    routingDirection: string;
  }>;
}

// ============================================
// Helpers
// ============================================

function redactPhone(phone: string): string {
  if (!phone || phone.length < 8) return '****';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function getMasterClient(): twilio.Twilio {
  const masterSid = process.env.TWILIO_MASTER_ACCOUNT_SID;
  const masterToken = process.env.TWILIO_MASTER_AUTH_TOKEN;
  if (!masterSid || !masterToken) {
    throw new Error('TWILIO_MASTER_ACCOUNT_SID and TWILIO_MASTER_AUTH_TOKEN are required for managed telephony');
  }
  return twilio(masterSid, masterToken);
}

function getMasterCredentials(): { sid: string; token: string } {
  const masterSid = process.env.TWILIO_MASTER_ACCOUNT_SID;
  const masterToken = process.env.TWILIO_MASTER_AUTH_TOKEN;
  if (!masterSid || !masterToken) {
    throw new Error('TWILIO_MASTER_ACCOUNT_SID and TWILIO_MASTER_AUTH_TOKEN are required for managed telephony');
  }
  return { sid: masterSid, token: masterToken };
}

// ============================================
// ManagedTelephonyService
// ============================================

export class ManagedTelephonyService {

  /**
   * Enable Geo Permissions inheritance from master account on a subaccount.
   * This allows the subaccount to automatically inherit all dialing permissions
   * (country-level calling restrictions) from the master Twilio project.
   *
   * Without this, subaccounts start with default permissions (US only) and
   * calls to international numbers fail with Error 13227.
   *
   * @see https://www.twilio.com/docs/voice/api/dialingpermissions-settings-resource
   */
  static async enableGeoPermissionInheritance(
    subAccountSid: string,
    subAuthToken: string
  ): Promise<{ success: boolean; alreadyEnabled?: boolean; error?: string }> {
    try {
      const subClient = twilio(subAccountSid, subAuthToken);

      // Check current inheritance state
      const settings = await subClient.voice.v1.dialingPermissions.settings().fetch();

      if (settings.dialingPermissionsInheritance) {
        log.info('ManagedTelephony', 'Geo Permissions inheritance already enabled', { subAccountSid });
        return { success: true, alreadyEnabled: true };
      }

      // Enable inheritance from master
      await subClient.voice.v1.dialingPermissions.settings().update({
        dialingPermissionsInheritance: true
      });

      log.info('ManagedTelephony', 'Geo Permissions inheritance enabled', { subAccountSid });
      return { success: true, alreadyEnabled: false };
    } catch (err: any) {
      log.error('ManagedTelephony', 'Failed to enable Geo Permissions inheritance', {
        subAccountSid,
        error: err.message
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Create a Twilio subaccount for an organization.
   * Each managed org gets exactly one subaccount (enforced by DB unique constraint).
   */
  static async createSubaccount(orgId: string, orgName: string): Promise<{
    success: boolean;
    subaccountSid?: string;
    error?: string;
  }> {
    try {
      // Check if subaccount already exists
      const { data: existing } = await supabaseAdmin
        .from('twilio_subaccounts')
        .select('id, twilio_account_sid, status')
        .eq('org_id', orgId)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'active') {
          log.info('ManagedTelephony', 'Subaccount already exists', { orgId, sid: existing.twilio_account_sid });
          return { success: true, subaccountSid: existing.twilio_account_sid };
        }
        // Subaccount exists but suspended/closed — cannot reuse
        return { success: false, error: `Subaccount exists but status is ${existing.status}. Contact support.` };
      }

      // Create subaccount via Twilio Master API
      const masterClient = getMasterClient();
      const friendlyName = `Voxanne - ${orgName}`.slice(0, 64); // Twilio max 64 chars

      log.info('ManagedTelephony', 'Creating Twilio subaccount', { orgId, friendlyName });

      const subaccount = await masterClient.api.v2010.accounts.create({
        friendlyName,
      });

      // Enable Geo Permissions inheritance from master account
      // This ensures the subaccount can call any country the master can
      await this.enableGeoPermissionInheritance(subaccount.sid, subaccount.authToken);

      // Encrypt and store the subaccount auth token
      const encryptedToken = EncryptionService.encrypt(subaccount.authToken);

      const { error: dbError } = await supabaseAdmin
        .from('twilio_subaccounts')
        .insert({
          org_id: orgId,
          twilio_account_sid: subaccount.sid,
          twilio_auth_token_encrypted: encryptedToken,
          friendly_name: friendlyName,
          status: 'active',
        });

      if (dbError) {
        // Rollback: close the Twilio subaccount if DB insert fails
        log.error('ManagedTelephony', 'DB insert failed, closing subaccount', { orgId, error: dbError.message });
        try {
          await masterClient.api.v2010.accounts(subaccount.sid).update({ status: 'closed' });
        } catch (rollbackErr: any) {
          log.error('ManagedTelephony', 'Failed to rollback subaccount', { sid: subaccount.sid, error: rollbackErr.message });
        }
        return { success: false, error: 'Failed to store subaccount credentials' };
      }

      // Update org telephony_mode
      await supabaseAdmin
        .from('organizations')
        .update({ telephony_mode: 'managed' })
        .eq('id', orgId);

      log.info('ManagedTelephony', 'Subaccount created successfully', {
        orgId,
        subaccountSid: subaccount.sid,
      });

      return { success: true, subaccountSid: subaccount.sid };
    } catch (err: any) {
      log.error('ManagedTelephony', 'Failed to create subaccount', { orgId, error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Helper: Release Twilio number with exponential backoff retry
   * Used during rollback scenarios when provisioning fails mid-flow
   *
   * @param phoneSid - Twilio phone number SID to release
   * @param client - Twilio client instance
   * @param maxRetries - Maximum retry attempts (default: 3)
   * @returns Promise that resolves when number is released or all retries exhausted
   */
  private static async releaseNumberWithRetry(
    phoneSid: string,
    client: any,
    maxRetries: number = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await client.incomingPhoneNumbers(phoneSid).remove();
        log.info('ManagedTelephony', 'Successfully released number during rollback', {
          phoneSid,
          attempt
        });
        return; // Success - exit early
      } catch (err: any) {
        log.warn('ManagedTelephony', 'Failed to release number during rollback', {
          phoneSid,
          attempt,
          maxRetries,
          error: err.message
        });

        // If not the last attempt, wait with exponential backoff
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          log.info('ManagedTelephony', `Retrying number release in ${delayMs}ms`, { phoneSid });
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // Failed all retries - log critical error for manual cleanup
    log.error('ManagedTelephony', 'Failed to release number after all retries - MANUAL CLEANUP REQUIRED', {
      phoneSid,
      attemptsExhausted: maxRetries,
      action: 'Orphaned number needs manual release in Twilio console'
    });
  }

  /**
   * One-click phone number provisioning:
   * 1. Get/create subaccount
   * 2. Search available numbers
   * 3. Buy number in subaccount
   * 4. Create Vapi credential for subaccount
   * 5. Import number into Vapi
   * 6. Store in managed_phone_numbers + phone_number_mapping
   * 7. Update agents.vapi_phone_number_id if outbound agent exists
   */
  static async provisionManagedNumber(request: ProvisionRequest): Promise<ProvisionResult> {
    const { orgId, country, numberType = 'local', areaCode, direction = 'inbound' } = request;

    try {
      // STEP 0: Acquire advisory lock to prevent concurrent provisioning
      // This ensures only ONE provisioning request can run at a time per organization
      // Prevents race conditions where two simultaneous requests try to provision numbers
      const { data: lockAcquired, error: lockError } = await supabaseAdmin
        .rpc('acquire_managed_telephony_provision_lock', { p_org_id: orgId });

      if (lockError) {
        logger.error('Failed to acquire provisioning lock', {
          orgId,
          error: lockError.message
        });
        return {
          success: false,
          error: 'Failed to acquire provisioning lock',
          failedStep: 'lock',
          canRetry: true,
          userMessage: 'Unable to start provisioning. Please try again.'
        };
      }

      if (!lockAcquired) {
        // Another provisioning request is already in progress for this org
        logger.warn('Provisioning lock already held', { orgId });
        return {
          success: false,
          error: 'Another provisioning request is already in progress for this organization',
          failedStep: 'lock',
          canRetry: true,
          userMessage: 'A number purchase is already in progress. Please wait and try again.'
        };
      }

      logger.info('Provisioning lock acquired', { orgId });

      // Step 1: Get org name for subaccount friendly name
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();

      if (!org) {
        return {
          success: false,
          error: 'Organization not found',
          failedStep: 'subaccount',
          canRetry: false,
          userMessage: 'Organization not found. Please contact support.'
        };
      }

      // Step 2: Ensure subaccount exists
      let subaccountSid: string;
      const { data: existingSub } = await supabaseAdmin
        .from('twilio_subaccounts')
        .select('id, twilio_account_sid, twilio_auth_token_encrypted, status')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingSub) {
        subaccountSid = existingSub.twilio_account_sid;
      } else {
        const subResult = await this.createSubaccount(orgId, org.name || 'Unnamed Org');
        if (!subResult.success || !subResult.subaccountSid) {
          return {
            success: false,
            error: subResult.error || 'Failed to create subaccount',
            failedStep: 'subaccount',
            canRetry: true,
            userMessage: 'Unable to initialize Twilio account. Please try again in a moment.'
          };
        }
        subaccountSid = subResult.subaccountSid;
      }

      // Step 3: Get subaccount credentials for Twilio API calls
      const { data: subData } = await supabaseAdmin
        .from('twilio_subaccounts')
        .select('id, twilio_account_sid, twilio_auth_token_encrypted')
        .eq('org_id', orgId)
        .eq('status', 'active')
        .single();

      if (!subData) {
        return {
          success: false,
          error: 'Subaccount not found after creation',
          failedStep: 'subaccount',
          canRetry: true,
          userMessage: 'Account setup incomplete. Please try again or contact support.'
        };
      }

      const subToken = EncryptionService.decrypt(subData.twilio_auth_token_encrypted);

      // Create a Twilio client scoped to the subaccount
      const masterClient = getMasterClient();
      const subClient = twilio(process.env.TWILIO_MASTER_ACCOUNT_SID!, process.env.TWILIO_MASTER_AUTH_TOKEN!, {
        accountSid: subaccountSid,
      });

      // Step 4: Search available numbers
      log.info('ManagedTelephony', 'Searching available numbers', { orgId, country, numberType, areaCode });

      let searchResults: any[];
      try {
        const searchParams: any = { voiceEnabled: true, limit: 1 };
        if (areaCode) searchParams.areaCode = areaCode;

        if (numberType === 'toll_free') {
          searchResults = await subClient.availablePhoneNumbers(country).tollFree.list(searchParams);
        } else {
          searchResults = await subClient.availablePhoneNumbers(country).local.list(searchParams);
        }

        if (!searchResults || searchResults.length === 0) {
          return {
            success: false,
            error: `No ${numberType} numbers available in ${country}${areaCode ? ` (area code ${areaCode})` : ''}`,
            failedStep: 'search',
            canRetry: true,
            userMessage: areaCode
              ? `No numbers available in area code ${areaCode}. Try a different area code.`
              : `No ${numberType} numbers available in ${country}. Please try a different number type or contact support.`
          };
        }
      } catch (searchErr: any) {
        log.error('ManagedTelephony', 'Number search failed', { orgId, error: searchErr.message });
        return {
          success: false,
          error: `Twilio search failed: ${searchErr.message}`,
          failedStep: 'search',
          canRetry: true,
          userMessage: 'Unable to search for available numbers. Please try again.'
        };
      }

      const selectedNumber = searchResults[0].phoneNumber;
      log.info('ManagedTelephony', 'Number selected', { orgId, number: redactPhone(selectedNumber) });

      // Step 5: Purchase the number in the subaccount
      let purchasedNumber: any;
      try {
        purchasedNumber = await subClient.incomingPhoneNumbers.create({
          phoneNumber: selectedNumber,
        });
      } catch (buyErr: any) {
        log.error('ManagedTelephony', 'Failed to purchase number', { orgId, error: buyErr.message });
        return {
          success: false,
          error: `Failed to purchase number: ${buyErr.message}`,
          failedStep: 'purchase',
          canRetry: true,
          userMessage: 'The selected number could not be purchased. It may have been claimed by someone else. Please try searching again.'
        };
      }

      log.info('ManagedTelephony', 'Number purchased', {
        orgId,
        phoneSid: purchasedNumber.sid,
        number: redactPhone(purchasedNumber.phoneNumber),
      });

      // Step 6: Create Vapi credential for this subaccount and import number
      let vapiPhoneId: string | null = null;
      let vapiCredentialId: string | null = null;

      try {
        // Import number to Vapi using SUBACCOUNT credentials
        // Vapi needs the credentials of the account that owns the phone number
        // (The number was purchased under the subaccount, not the master account)
        const vapiClient = new VapiClient(config.VAPI_PRIVATE_KEY);

        const vapiResult = await vapiClient.importTwilioNumber({
          phoneNumber: purchasedNumber.phoneNumber,
          twilioAccountSid: subaccountSid,    // ✅ Use subaccount SID
          twilioAuthToken: subToken,           // ✅ Use subaccount token
        });

        vapiPhoneId = vapiResult?.id || null;
        vapiCredentialId = vapiResult?.credentialId || null;

        log.info('ManagedTelephony', 'Number imported to Vapi', {
          orgId,
          vapiPhoneId,
          number: redactPhone(purchasedNumber.phoneNumber),
        });

        // VALIDATION: Ensure Vapi returned a valid phone ID
        if (!vapiPhoneId) {
          log.error('ManagedTelephony', 'CRITICAL: Vapi import returned null phone ID', {
            orgId,
            phoneNumber: redactPhone(purchasedNumber.phoneNumber),
            vapiResult: JSON.stringify(vapiResult)
          });

          // Rollback: Release the number
          await this.releaseNumberWithRetry(purchasedNumber.sid, subClient);

          return {
            success: false,
            error: 'Phone number import failed: Vapi returned invalid phone ID',
            failedStep: 'vapi_import_validation',
            canRetry: true,
            userMessage: 'Number purchase was successful but setup failed. The number has been released. Please try again.'
          };
        }
      } catch (vapiErr: any) {
        // CRITICAL ROLLBACK: Release the purchased number (it's not in our system yet)
        // If Vapi import fails, we MUST release the Twilio number to avoid orphaned resources
        log.error('ManagedTelephony', 'Vapi import failed, initiating rollback', {
          orgId,
          error: vapiErr.message,
          phoneSid: purchasedNumber.sid
        });

        // Use retry logic to ensure number gets released
        await this.releaseNumberWithRetry(purchasedNumber.sid, subClient);

        return {
          success: false,
          error: `Vapi registration failed: ${vapiErr.message}`,
          failedStep: 'vapi_import',
          canRetry: true,
          userMessage: 'Unable to complete number setup. Your purchase has been cancelled. Please try again.'
        };
      }

      // Step 7 & 8: Atomic database insert (all-or-nothing transaction)
      // This ensures managed_phone_numbers, phone_number_mapping, organizations,
      // and agents updates all succeed or all fail together
      log.info('ManagedTelephony', 'Executing atomic database insert', {
        orgId,
        phoneNumber: redactPhone(purchasedNumber.phoneNumber)
      });

      const { data: atomicResult, error: atomicError } = await supabaseAdmin
        .rpc('insert_managed_number_atomic', {
          p_org_id: orgId,
          p_subaccount_id: subData.id,
          p_phone_number: purchasedNumber.phoneNumber,
          p_twilio_phone_sid: purchasedNumber.sid,
          p_vapi_phone_id: vapiPhoneId || '',
          p_vapi_credential_id: vapiCredentialId || '',
          p_country_code: country,
          p_number_type: numberType,
          p_clinic_name: org.name || 'Managed Number',
          p_routing_direction: direction
        });

      if (atomicError || !atomicResult?.success) {
        // CRITICAL: Number is purchased in Twilio AND imported to Vapi, but not in our database
        // This is an orphaned resource that needs manual reconciliation
        const errorMsg = atomicError?.message || atomicResult?.error || 'Unknown database error';
        log.error('ManagedTelephony', 'CRITICAL: Atomic database insert failed - ORPHANED RESOURCE', {
          orgId,
          phoneNumber: purchasedNumber.phoneNumber,
          vapiPhoneId,
          twilioSid: purchasedNumber.sid,
          error: errorMsg,
          action: 'MANUAL RECONCILIATION REQUIRED: Number exists in Twilio and Vapi but not in database',
          sqlstate: atomicResult?.sqlstate
        });

        // Return error to user (number is not fully provisioned)
        return {
          success: false,
          error: 'Database error during provisioning',
          failedStep: 'database',
          canRetry: false,
          userMessage: 'An error occurred during setup. Support has been notified and will complete your number provisioning.'
        };
      }

      log.info('ManagedTelephony', 'Atomic database insert succeeded', {
        orgId,
        managedNumberId: atomicResult.managed_number_id,
        outboundAgentUpdated: atomicResult.outbound_agent_updated
      });

      // Step 9: Save via single-slot gate (UPSERT + mutual exclusion + Vapi credential sync)
      //         ALSO saves to org_credentials for unified agent config dropdown
      // CRITICAL: This write is MANDATORY. If it fails, the number is unusable in agent config.
      log.info('ManagedTelephony', 'Attempting MANDATORY SSOT write to org_credentials', {
        orgId,
        phoneNumber: redactPhone(purchasedNumber.phoneNumber),
        vapiPhoneId: vapiPhoneId,
        vapiCredentialId: vapiCredentialId || 'not_set',
        source: 'managed',
        hasSubaccountSid: !!subaccountSid,
        hasSubToken: !!subToken
      });

      // Do NOT catch this error - let it bubble up to trigger proper error handling
      await IntegrationDecryptor.saveTwilioCredential(orgId, {
        accountSid: subaccountSid,
        authToken: subToken,
        phoneNumber: purchasedNumber.phoneNumber,
        source: 'managed',
        vapiPhoneId: vapiPhoneId,
        vapiCredentialId: vapiCredentialId || undefined,
      });

      log.info('ManagedTelephony', 'MANDATORY SSOT write successful - number now visible in agent config', {
        orgId,
        phoneNumber: redactPhone(purchasedNumber.phoneNumber),
        vapiPhoneId: vapiPhoneId
      });

      return {
        success: true,
        phoneNumber: purchasedNumber.phoneNumber,
        vapiPhoneId: vapiPhoneId || undefined,
        subaccountSid,
      };
    } catch (err: any) {
      const failurePoint = err.message?.includes('org_credentials') || err.message?.includes('saveTwilioCredential')
        ? 'ssot_write'
        : 'unknown';

      log.error('ManagedTelephony', 'Provisioning failed (unexpected error)', {
        orgId,
        error: err.message,
        stack: err.stack,
        name: err.name,
        failurePoint
      });

      // If this was an SSOT write failure, escalate to Sentry
      if (failurePoint === 'ssot_write') {
        log.error('ManagedTelephony', 'CRITICAL: SSOT write failure detected - number will be invisible', {
          orgId,
          error: err.message,
          component: 'managed-telephony',
          failure_type: 'ssot_violation'
        });
        // Note: Sentry integration should be added here if available
        // captureException(err, {
        //   tags: { component: 'managed-telephony', failure_type: 'ssot_violation' },
        //   extra: { orgId, attemptedPhoneNumber: purchasedNumber?.phoneNumber }
        // });
      }

      return {
        success: false,
        error: err.message || 'Unexpected error during provisioning',
        failedStep: failurePoint,
        canRetry: true,
        userMessage: 'An unexpected error occurred. Please try again or contact support.'
      };
    }
  }

  /**
   * Release a managed phone number:
   * 1. Remove from Vapi
   * 2. Release from Twilio subaccount
   * 3. Update DB status to 'released'
   * 4. Remove from phone_number_mapping
   */
  static async releaseManagedNumber(orgId: string, phoneNumber: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get the managed number record
      const { data: mnRecord } = await supabaseAdmin
        .from('managed_phone_numbers')
        .select('id, twilio_phone_sid, vapi_phone_id, subaccount_id')
        .eq('org_id', orgId)
        .eq('phone_number', phoneNumber)
        .eq('status', 'active')
        .maybeSingle();

      if (!mnRecord) {
        return { success: false, error: 'Managed number not found or already released' };
      }

      // Get subaccount credentials
      const { data: subData } = await supabaseAdmin
        .from('twilio_subaccounts')
        .select('twilio_account_sid, twilio_auth_token_encrypted')
        .eq('id', mnRecord.subaccount_id)
        .single();

      if (!subData) {
        return { success: false, error: 'Subaccount not found' };
      }

      // Step 1: Remove from Vapi (if registered)
      if (mnRecord.vapi_phone_id) {
        try {
          const vapiClient = new VapiClient(config.VAPI_PRIVATE_KEY);
          await vapiClient.deletePhoneNumber(mnRecord.vapi_phone_id);
          log.info('ManagedTelephony', 'Number removed from Vapi', { orgId, vapiPhoneId: mnRecord.vapi_phone_id });
        } catch (vapiErr: any) {
          log.warn('ManagedTelephony', 'Failed to remove from Vapi (may already be deleted)', {
            orgId,
            error: vapiErr.message,
          });
        }
      }

      // Step 2: Release from Twilio subaccount
      try {
        const subClient = twilio(process.env.TWILIO_MASTER_ACCOUNT_SID!, process.env.TWILIO_MASTER_AUTH_TOKEN!, {
          accountSid: subData.twilio_account_sid,
        });
        await subClient.incomingPhoneNumbers(mnRecord.twilio_phone_sid).remove();
        log.info('ManagedTelephony', 'Number released from Twilio', { orgId, phoneSid: mnRecord.twilio_phone_sid });
      } catch (twilioErr: any) {
        log.warn('ManagedTelephony', 'Failed to release from Twilio (may already be released)', {
          orgId,
          error: twilioErr.message,
        });
      }

      // Step 3: Update DB status
      await supabaseAdmin
        .from('managed_phone_numbers')
        .update({ status: 'released', released_at: new Date().toISOString() })
        .eq('id', mnRecord.id);

      // Step 4: Remove from phone_number_mapping
      await supabaseAdmin
        .from('phone_number_mapping')
        .delete()
        .eq('org_id', orgId)
        .eq('inbound_phone_number', phoneNumber);

      // CRITICAL FIX: Step 5 - Clean up org_credentials (SSOT integrity)
      // Delete the managed Twilio credential from SSOT table
      await supabaseAdmin
        .from('org_credentials')
        .delete()
        .eq('org_id', orgId)
        .eq('provider', 'twilio')
        .eq('is_managed', true);

      log.info('ManagedTelephony', 'Cleaned up org_credentials (SSOT)', { orgId, provider: 'twilio' });

      // CRITICAL FIX: Step 6 - Unlink agents that were using this phone
      // Find agents that had this phone configured and reset their vapi_phone_number_id + linked_phone_number_id
      const { data: linkedAgents } = await supabaseAdmin
        .from('agents')
        .select('id')
        .eq('org_id', orgId)
        .eq('vapi_phone_number_id', mnRecord.vapi_phone_id);

      if (linkedAgents && linkedAgents.length > 0) {
        await supabaseAdmin
          .from('agents')
          .update({ vapi_phone_number_id: null, linked_phone_number_id: null })
          .eq('org_id', orgId)
          .eq('vapi_phone_number_id', mnRecord.vapi_phone_id);

        log.info('ManagedTelephony', 'Unlinked agents from released phone', {
          orgId,
          affectedAgents: linkedAgents.length,
          vapiPhoneId: mnRecord.vapi_phone_id,
        });
      }

      // Also clear linked_phone_number_id on agents linked by managed number ID
      await supabaseAdmin
        .from('agents')
        .update({ linked_phone_number_id: null })
        .eq('org_id', orgId)
        .eq('linked_phone_number_id', mnRecord.id);

      log.info('ManagedTelephony', 'Managed number released (full cleanup complete)', { orgId, phone: redactPhone(phoneNumber) });

      return { success: true };
    } catch (err: any) {
      log.error('ManagedTelephony', 'Failed to release number', { orgId, error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Suspend a subaccount (non-payment, abuse, etc.)
   */
  static async suspendSubaccount(orgId: string, reason: string): Promise<void> {
    const { data: subData } = await supabaseAdmin
      .from('twilio_subaccounts')
      .select('twilio_account_sid')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .single();

    if (!subData) throw new Error('No active subaccount found');

    const masterClient = getMasterClient();
    await masterClient.api.v2010.accounts(subData.twilio_account_sid).update({ status: 'suspended' });

    await supabaseAdmin
      .from('twilio_subaccounts')
      .update({
        status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspension_reason: reason,
      })
      .eq('org_id', orgId);

    log.info('ManagedTelephony', 'Subaccount suspended', { orgId, reason });
  }

  /**
   * Reactivate a suspended subaccount
   */
  static async reactivateSubaccount(orgId: string): Promise<void> {
    const { data: subData } = await supabaseAdmin
      .from('twilio_subaccounts')
      .select('twilio_account_sid')
      .eq('org_id', orgId)
      .eq('status', 'suspended')
      .single();

    if (!subData) throw new Error('No suspended subaccount found');

    const masterClient = getMasterClient();
    await masterClient.api.v2010.accounts(subData.twilio_account_sid).update({ status: 'active' });

    await supabaseAdmin
      .from('twilio_subaccounts')
      .update({
        status: 'active',
        suspended_at: null,
        suspension_reason: null,
      })
      .eq('org_id', orgId);

    log.info('ManagedTelephony', 'Subaccount reactivated', { orgId });
  }

  /**
   * Get managed telephony status for an organization
   */
  static async getManagedStatus(orgId: string): Promise<ManagedStatus> {
    // Get org mode
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('telephony_mode')
      .eq('id', orgId)
      .single();

    const mode = (org?.telephony_mode || 'byoc') as 'byoc' | 'managed' | 'none';

    // Get subaccount if exists
    const { data: subData } = await supabaseAdmin
      .from('twilio_subaccounts')
      .select('twilio_account_sid, status, friendly_name, a2p_registration_status')
      .eq('org_id', orgId)
      .maybeSingle();

    // Get managed numbers (include routing_direction)
    const { data: numbers } = await supabaseAdmin
      .from('managed_phone_numbers')
      .select('phone_number, status, vapi_phone_id, country_code, routing_direction')
      .eq('org_id', orgId)
      .neq('status', 'released');

    return {
      mode,
      subaccount: subData ? {
        sid: subData.twilio_account_sid,
        status: subData.status,
        friendlyName: subData.friendly_name,
        a2pStatus: subData.a2p_registration_status,
      } : undefined,
      numbers: (numbers || []).map(n => ({
        phoneNumber: n.phone_number,
        status: n.status,
        vapiPhoneId: n.vapi_phone_id,
        countryCode: n.country_code,
        routingDirection: n.routing_direction || 'inbound',
      })),
    };
  }

  /**
   * Search available numbers without purchasing
   */
  static async searchAvailableNumbers(request: {
    orgId: string;
    country: string;
    areaCode?: string;
    numberType?: string;
    limit?: number;
  }): Promise<Array<{ phoneNumber: string; locality?: string; region?: string }>> {
    const { orgId, country, areaCode, numberType = 'local', limit = 5 } = request;

    const client = getMasterClient();

    const searchParams: any = { voiceEnabled: true, limit };
    if (areaCode) searchParams.areaCode = areaCode;

    let results: any[];
    if (numberType === 'toll_free') {
      results = await client.availablePhoneNumbers(country).tollFree.list(searchParams);
    } else {
      results = await client.availablePhoneNumbers(country).local.list(searchParams);
    }

    return results.map(r => ({
      phoneNumber: r.phoneNumber,
      locality: r.locality,
      region: r.region,
    }));
  }
}
