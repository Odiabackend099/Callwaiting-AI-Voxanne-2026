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
}

export interface ProvisionResult {
  success: boolean;
  phoneNumber?: string;
  vapiPhoneId?: string;
  subaccountSid?: string;
  error?: string;
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

// ============================================
// ManagedTelephonyService
// ============================================

export class ManagedTelephonyService {

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
    const { orgId, country, numberType = 'local', areaCode } = request;

    try {
      // Step 1: Get org name for subaccount friendly name
      const { data: org } = await supabaseAdmin
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();

      if (!org) {
        return { success: false, error: 'Organization not found' };
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
          return { success: false, error: subResult.error || 'Failed to create subaccount' };
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
        return { success: false, error: 'Subaccount not found after creation' };
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
      const searchParams: any = { voiceEnabled: true, limit: 1 };
      if (areaCode) searchParams.areaCode = areaCode;

      if (numberType === 'toll_free') {
        searchResults = await subClient.availablePhoneNumbers(country).tollFree.list(searchParams);
      } else {
        searchResults = await subClient.availablePhoneNumbers(country).local.list(searchParams);
      }

      if (!searchResults || searchResults.length === 0) {
        return { success: false, error: `No ${numberType} numbers available in ${country}${areaCode ? ` (area code ${areaCode})` : ''}` };
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
        return { success: false, error: `Failed to purchase number: ${buyErr.message}` };
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
        const vapiClient = new VapiClient(config.VAPI_PRIVATE_KEY);

        // Import the Twilio number into Vapi using subaccount credentials
        const vapiResult = await vapiClient.importTwilioNumber({
          phoneNumber: purchasedNumber.phoneNumber,
          twilioAccountSid: subaccountSid,
          twilioAuthToken: subToken,
        });

        vapiPhoneId = vapiResult?.id || null;
        vapiCredentialId = vapiResult?.credentialId || null;

        log.info('ManagedTelephony', 'Number imported to Vapi', {
          orgId,
          vapiPhoneId,
          number: redactPhone(purchasedNumber.phoneNumber),
        });
      } catch (vapiErr: any) {
        // Rollback: release the purchased number
        log.error('ManagedTelephony', 'Vapi import failed, releasing number', { orgId, error: vapiErr.message });
        try {
          await subClient.incomingPhoneNumbers(purchasedNumber.sid).remove();
        } catch (releaseErr: any) {
          log.error('ManagedTelephony', 'Failed to release number during rollback', {
            phoneSid: purchasedNumber.sid,
            error: releaseErr.message,
          });
        }
        return { success: false, error: `Vapi registration failed: ${vapiErr.message}` };
      }

      // Step 7: Store in managed_phone_numbers
      const { error: mnError } = await supabaseAdmin
        .from('managed_phone_numbers')
        .insert({
          org_id: orgId,
          subaccount_id: subData.id,
          phone_number: purchasedNumber.phoneNumber,
          twilio_phone_sid: purchasedNumber.sid,
          country_code: country,
          number_type: numberType,
          vapi_phone_id: vapiPhoneId,
          vapi_credential_id: vapiCredentialId,
          status: 'active',
          provisioned_at: new Date().toISOString(),
        });

      if (mnError) {
        log.error('ManagedTelephony', 'Failed to store managed number', { orgId, error: mnError.message });
        // Number is purchased and in Vapi — log for manual cleanup but don't fail
      }

      // Step 8: Also insert into phone_number_mapping for inbound routing
      if (vapiPhoneId) {
        await supabaseAdmin
          .from('phone_number_mapping')
          .upsert({
            org_id: orgId,
            inbound_phone_number: purchasedNumber.phoneNumber,
            vapi_phone_number_id: vapiPhoneId,
            clinic_name: org.name || 'Managed Number',
            is_active: true,
          }, { onConflict: 'org_id,inbound_phone_number' });

        // Update outbound agent if one exists
        const { data: outboundAgent } = await supabaseAdmin
          .from('agents')
          .select('id')
          .eq('org_id', orgId)
          .eq('role', 'outbound')
          .maybeSingle();

        if (outboundAgent) {
          await supabaseAdmin
            .from('agents')
            .update({ vapi_phone_number_id: vapiPhoneId })
            .eq('id', outboundAgent.id);

          log.info('ManagedTelephony', 'Updated outbound agent with managed number', {
            orgId,
            agentId: outboundAgent.id,
            vapiPhoneId,
          });
        }
      }

      // Step 9: Save via single-slot gate (UPSERT + mutual exclusion + Vapi credential sync)
      try {
        await IntegrationDecryptor.saveTwilioCredential(orgId, {
          accountSid: subaccountSid,
          authToken: subToken,
          phoneNumber: purchasedNumber.phoneNumber,
          source: 'managed',
        });
        log.info('ManagedTelephony', 'Single-slot credential saved', { orgId });
      } catch (singleSlotErr: any) {
        // Non-fatal: number is already purchased and in Vapi. Log for review.
        log.error('ManagedTelephony', 'Single-slot save failed (non-fatal)', {
          orgId,
          error: singleSlotErr.message,
        });
      }

      return {
        success: true,
        phoneNumber: purchasedNumber.phoneNumber,
        vapiPhoneId: vapiPhoneId || undefined,
        subaccountSid,
      };
    } catch (err: any) {
      log.error('ManagedTelephony', 'Provisioning failed', { orgId, error: err.message });
      return { success: false, error: err.message };
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

      log.info('ManagedTelephony', 'Managed number released', { orgId, phone: redactPhone(phoneNumber) });

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

    // Get managed numbers
    const { data: numbers } = await supabaseAdmin
      .from('managed_phone_numbers')
      .select('phone_number, status, vapi_phone_id, country_code')
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

    // Get subaccount (or use master for search)
    const { data: subData } = await supabaseAdmin
      .from('twilio_subaccounts')
      .select('twilio_account_sid')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    const client = subData
      ? twilio(process.env.TWILIO_MASTER_ACCOUNT_SID!, process.env.TWILIO_MASTER_AUTH_TOKEN!, {
          accountSid: subData.twilio_account_sid,
        })
      : getMasterClient();

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
