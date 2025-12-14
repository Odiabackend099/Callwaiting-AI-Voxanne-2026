/**
 * Phone number validation and normalization utilities
 * Single source of truth for phone validation logic across endpoints
 */

import { maskPhone } from './sanitize';

/**
 * Normalizes a phone number by removing formatting characters
 * @param phone - Raw phone number input
 * @returns Normalized phone number (digits and + only)
 */
export function normalizePhoneNumber(phone: string): string {
  return (phone || '')
    .trim()
    .replace(/[\s\-()]/g, '');
}

/**
 * Validates phone number format and structure
 * @param phone - Phone number to validate
 * @returns Validation result with error message if invalid
 */
export function validateE164Format(phone: string): { valid: boolean; error?: string; normalized?: string } {
  const normalized = normalizePhoneNumber(phone);

  // Check if empty
  if (!normalized) {
    return { valid: false, error: 'Phone number is required' };
  }

  // Check for invalid characters (only + and digits allowed)
  if (!/^[+\d]+$/.test(normalized)) {
    return {
      valid: false,
      error: 'Phone contains invalid characters. Only digits and + allowed.',
      normalized
    };
  }

  // E.164 format validation: + followed by 1-3 digit country code + 4-12 digit number
  // Total: 7-15 digits after the +
  const E164_REGEX = /^\+[1-9]\d{6,14}$/;
  if (!E164_REGEX.test(normalized)) {
    return {
      valid: false,
      error: `Invalid E.164 format. Expected +15551234567, got ${maskPhone(normalized)}`,
      normalized
    };
  }

  return { valid: true, normalized };
}

/**
 * Validates a phone number and returns normalized version
 * Throws error if validation fails
 * @param phone - Phone number to validate
 * @returns Normalized phone number
 * @throws Error with validation message
 */
export function validateAndNormalizePhone(phone: string): string {
  const validation = validateE164Format(phone);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return validation.normalized || '';
}
