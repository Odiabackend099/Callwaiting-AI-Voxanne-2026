/**
 * Phone Number Validation Service
 * Enforces per-direction number limits for managed telephony.
 *
 * Rule: Each organization may have at most ONE inbound and ONE outbound
 * managed (Voxanne-provisioned) number. BYOC numbers are only checked
 * against the inbound direction (BYOC inbound + managed outbound is allowed).
 *
 * Error policy: checkDirectionStatus is fail-open — on DB error it returns
 * {hasInbound: false, hasOutbound: false} to prevent transient DB issues from
 * blocking all provisioning. Trade-off: a DB outage during validation could
 * allow duplicate provisioning in the same direction.
 *
 * This service checks:
 * - managed_phone_numbers table (direction-aware, multi-number SSOT)
 * - org_credentials table (BYOC Twilio credential, inbound-direction only)
 */

import { supabaseAdmin } from '../config/supabase';
import { IntegrationDecryptor } from './integration-decryptor';
import { createLogger } from './logger';

const logger = createLogger('PhoneValidationService');

export type RoutingDirection = 'inbound' | 'outbound' | 'unassigned';

export interface PhoneNumberStatus {
  hasPhoneNumber: boolean;
  phoneNumberType: 'managed' | 'byoc' | 'none';
  phoneNumber?: string;
  details?: string;
}

export interface DirectionStatus {
  hasInbound: boolean;
  hasOutbound: boolean;
  inboundNumber?: string;
  outboundNumber?: string;
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
   * Check which routing directions already have active managed numbers.
   *
   * Fail-open: on any DB error, returns {hasInbound: false, hasOutbound: false} so
   * transient DB issues don't block all provisioning. See module-level doc for trade-off.
   *
   * @param orgId - Organization ID to check
   */
  static async checkDirectionStatus(orgId: string): Promise<DirectionStatus> {
    try {
      const { data: numbers, error } = await supabaseAdmin
        .from('managed_phone_numbers')
        .select('phone_number, routing_direction')
        .eq('org_id', orgId)
        .eq('status', 'active');

      if (error) {
        logger.warn('checkDirectionStatus: DB query error — treating as no managed numbers', {
          orgId,
          error: error.message,
        });
        return { hasInbound: false, hasOutbound: false };
      }

      const inbound = numbers?.find((n: any) => n.routing_direction === 'inbound');
      const outbound = numbers?.find((n: any) => n.routing_direction === 'outbound');

      return {
        hasInbound: !!inbound,
        hasOutbound: !!outbound,
        inboundNumber: inbound?.phone_number,
        outboundNumber: outbound?.phone_number,
      };
    } catch (err: any) {
      logger.error('checkDirectionStatus: unexpected error — treating as no managed numbers', {
        orgId,
        error: err.message,
      });
      return { hasInbound: false, hasOutbound: false };
    }
  }

  /**
   * Validate if organization can provision a new managed number
   *
   * Direction-aware: allows 1 inbound + 1 outbound per org.
   * Blocks if a number with the SAME direction already exists.
   *
   * @param orgId - Organization ID to validate
   * @param direction - Routing direction for the new number (default: 'inbound')
   * @returns ValidationResult indicating if provisioning is allowed
   */
  static async validateCanProvision(orgId: string, direction: RoutingDirection = 'inbound'): Promise<ValidationResult> {
    try {
      // Check per-direction limits for managed numbers
      const directionStatus = await this.checkDirectionStatus(orgId);

      if (direction === 'inbound' && directionStatus.hasInbound) {
        logger.warn('Provisioning blocked - existing inbound number', {
          orgId,
          existingNumber: directionStatus.inboundNumber?.slice(-4),
        });
        return {
          canProvision: false,
          reason: `Your organization already has an inbound number (${directionStatus.inboundNumber}). Please release it before provisioning a new one.`,
          existingNumber: {
            type: 'managed',
            phoneNumber: directionStatus.inboundNumber!,
            details: 'Active managed inbound number',
          },
        };
      }

      if (direction === 'outbound' && directionStatus.hasOutbound) {
        logger.warn('Provisioning blocked - existing outbound number', {
          orgId,
          existingNumber: directionStatus.outboundNumber?.slice(-4),
        });
        return {
          canProvision: false,
          reason: `Your organization already has an outbound number (${directionStatus.outboundNumber}). Please release it before provisioning a new one.`,
          existingNumber: {
            type: 'managed',
            phoneNumber: directionStatus.outboundNumber!,
            details: 'Active managed outbound number',
          },
        };
      }

      // For inbound direction only, also check BYOC — can't have BYOC inbound + managed inbound.
      // Outbound direction intentionally skips BYOC check: BYOC inbound + managed outbound is
      // a valid hybrid configuration (org uses their own carrier for receiving, managed for dialling).
      if (direction === 'inbound') {
        const status = await this.checkOrgPhoneStatus(orgId);
        if (status.hasPhoneNumber && status.phoneNumberType === 'byoc') {
          logger.warn('Provisioning blocked - existing BYOC number', {
            orgId,
            phoneLast4: status.phoneNumber?.slice(-4),
          });
          return {
            canProvision: false,
            reason: `Your organization already has a BYOC Twilio connection (${status.phoneNumber}). Please disconnect it in Settings > Integrations before provisioning a managed number.`,
            existingNumber: {
              type: 'byoc',
              phoneNumber: status.phoneNumber!,
              details: status.details!,
            },
          };
        }
      }

      logger.info('Provisioning allowed', { orgId, direction });
      return { canProvision: true };
    } catch (err: any) {
      logger.error('Error validating provisioning eligibility', {
        orgId,
        direction,
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }
}
