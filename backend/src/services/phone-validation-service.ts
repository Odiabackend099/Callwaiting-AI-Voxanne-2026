/**
 * Phone Number Validation Service
 * Enforces one-number-per-organization rule for managed telephony
 *
 * Rule: Each organization can have ONLY ONE phone number at a time,
 * either BYOC (Bring Your Own Carrier) or managed (Voxanne-provisioned).
 *
 * This service checks both:
 * - managed_phone_numbers table (Voxanne-provisioned numbers)
 * - org_credentials table (BYOC Twilio credentials)
 */

import { supabaseAdmin } from '../config/supabase';
import { IntegrationDecryptor } from './integration-decryptor';
import { createLogger } from './logger';

const logger = createLogger('PhoneValidationService');

export interface PhoneNumberStatus {
  hasPhoneNumber: boolean;
  phoneNumberType: 'managed' | 'byoc' | 'none';
  phoneNumber?: string;
  details?: string;
}

export interface ValidationResult {
  canProvision: boolean;
  reason?: string;
  existingNumber?: {
    type: 'managed' | 'byoc';
    phoneNumber: string;
    details: string;
  };
}

export class PhoneValidationService {
  /**
   * Check if organization has an existing phone number (managed or BYOC)
   *
   * @param orgId - Organization ID to check
   * @returns PhoneNumberStatus object with details about org's phone setup
   */
  static async checkOrgPhoneStatus(orgId: string): Promise<PhoneNumberStatus> {
    try {
      logger.info('Checking org phone status', { orgId });

      // UNIFIED CHECK: Query org_credentials table (single source of truth)
      // This table now stores both managed and BYOC credentials with is_managed flag
      const { data: credential } = await supabaseAdmin
        .from('org_credentials')
        .select('encrypted_config, is_managed')
        .eq('org_id', orgId)
        .eq('provider', 'twilio')
        .eq('is_active', true)
        .maybeSingle();

      if (!credential) {
        // No phone number found
        logger.info('Org has no active phone number', { orgId });
        return {
          hasPhoneNumber: false,
          phoneNumberType: 'none',
        };
      }

      // Decrypt credentials to get phone number
      try {
        const twilioCreds = await IntegrationDecryptor.getTwilioCredentials(orgId);

        if (!twilioCreds?.phoneNumber) {
          logger.warn('Org has credentials but no phone number', { orgId });
          return {
            hasPhoneNumber: false,
            phoneNumberType: 'none',
          };
        }

        const phoneType = credential.is_managed ? 'managed' : 'byoc';
        logger.info(`Org has active ${phoneType} number`, {
          orgId,
          phoneLast4: twilioCreds.phoneNumber?.slice(-4),
        });

        return {
          hasPhoneNumber: true,
          phoneNumberType: phoneType,
          phoneNumber: twilioCreds.phoneNumber,
          details: credential.is_managed
            ? 'Active managed number (Voxanne-provisioned)'
            : 'BYOC Twilio account connected',
        };
      } catch (decryptError: any) {
        logger.error('Failed to decrypt credentials', {
          orgId,
          error: decryptError.message,
        });
        throw new Error(`Failed to decrypt phone credentials: ${decryptError.message}`);
      }
    } catch (err: any) {
      logger.error('Error checking org phone status', {
        orgId,
        error: err.message,
        stack: err.stack,
      });
      throw new Error(`Failed to check phone number status: ${err.message}`);
    }
  }

  /**
   * Validate if organization can provision a new managed number
   *
   * Enforces one-number-per-org rule by checking for existing numbers
   *
   * @param orgId - Organization ID to validate
   * @returns ValidationResult indicating if provisioning is allowed
   */
  static async validateCanProvision(orgId: string): Promise<ValidationResult> {
    try {
      const status = await this.checkOrgPhoneStatus(orgId);

      // Allow provisioning if org has no existing phone number
      if (!status.hasPhoneNumber) {
        logger.info('Provisioning allowed - no existing phone', { orgId });
        return { canProvision: true };
      }

      // Block provisioning - org already has a phone number
      const errorMessage =
        status.phoneNumberType === 'managed'
          ? `Your organization already has a managed phone number (${status.phoneNumber}). Please delete it before provisioning a new one.`
          : `Your organization already has a BYOC Twilio connection (${status.phoneNumber}). Please disconnect it in Settings > Integrations before provisioning a managed number.`;

      logger.warn('Provisioning blocked - existing number detected', {
        orgId,
        type: status.phoneNumberType,
        phoneLast4: status.phoneNumber?.slice(-4),
      });

      return {
        canProvision: false,
        reason: errorMessage,
        existingNumber: {
          type: status.phoneNumberType as 'managed' | 'byoc',
          phoneNumber: status.phoneNumber!,
          details: status.details!,
        },
      };
    } catch (err: any) {
      logger.error('Error validating provisioning eligibility', {
        orgId,
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }
}
