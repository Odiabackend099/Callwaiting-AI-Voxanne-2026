/**
 * GSM Code Generator Service V2 (Database-Driven)
 *
 * Generates carrier-specific MMI (Man-Machine Interface) codes for call forwarding.
 * This version queries carrier_forwarding_rules table instead of hardcoded switch statements.
 *
 * Key Improvements:
 * - Single Source of Truth (SSOT): All GSM codes stored in database
 * - Multi-country support: Nigeria, Turkey, UK, US (easily extensible)
 * - No deployments needed: Update codes via SQL UPDATE
 * - Backward compatible: Existing API unchanged
 *
 * Reference: 3GPP TS 22.030 for GSM standard codes
 */

import { createClient } from '@supabase/supabase-js';
import { log } from './logger';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
    },
  }
);

// ============================================
// Type Definitions
// ============================================

export type ForwardingType = 'total_ai' | 'safety_net';

export interface GenerateCodeOptions {
  countryCode: string; // ISO 3166-1 alpha-2: 'NG', 'TR', 'GB', 'US'
  carrierName: string; // Carrier slug: 'glo', 'mtn', 'turkcell', 'att', etc.
  forwardingType: ForwardingType; // 'total_ai' or 'safety_net'
  destinationNumber: string; // E.164 format: '+15551234567'
  ringTimeSeconds?: number; // Only for safety_net mode (default: 25)
}

export interface GeneratedCodes {
  activationCode: string;
  deactivationCode: string;
  warning?: string; // Country-specific warning message
  notes?: string; // Additional setup instructions
  busyCode?: string; // Optional: Specific code for busy forwarding
  noAnswerCode?: string; // Optional: Specific code for no-answer forwarding
  unreachableCode?: string; // Optional: Specific code for unreachable forwarding
}

// ============================================
// Main Code Generation Function
// ============================================

/**
 * Generate GSM/CDMA forwarding codes by querying carrier_forwarding_rules table
 *
 * @param options - Code generation options with country, carrier, and forwarding type
 * @returns Generated activation/deactivation codes with warnings
 * @throws Error if country/carrier not supported or codes missing
 */
export async function generateForwardingCodes(
  options: GenerateCodeOptions
): Promise<GeneratedCodes> {
  const {
    countryCode,
    carrierName,
    forwardingType,
    destinationNumber,
    ringTimeSeconds = 25,
  } = options;

  try {
    log.info('GSMCodeGenerator', 'Generating forwarding codes', {
      countryCode,
      carrierName,
      forwardingType,
    });

    // Step 1: Validate destination number format (E.164)
    if (!validateE164PhoneNumber(destinationNumber)) {
      log.error('GSMCodeGenerator', 'Invalid phone number format', {
        destinationNumber,
        expectedFormat: 'E.164 (+1234567890)',
      });
      throw new Error(
        `Invalid phone number format: ${destinationNumber}. Must be E.164 format (e.g., +1234567890)`
      );
    }

    // Step 2: Fetch carrier rules from database
    const { data: countryRules, error } = await supabase
      .from('carrier_forwarding_rules')
      .select('carrier_codes, warning_message, setup_notes')
      .eq('country_code', countryCode)
      .eq('is_active', true)
      .single();

    if (error || !countryRules) {
      log.error('GSMCodeGenerator', 'Country not supported', {
        countryCode,
        error,
      });
      throw new Error(
        `Country ${countryCode} not supported or carrier rules missing. Please contact support.`
      );
    }

    // Step 3: Extract carrier-specific codes from JSONB
    const carrierData = countryRules.carrier_codes[carrierName];
    if (!carrierData) {
      log.error('GSMCodeGenerator', 'Carrier not found for country', {
        countryCode,
        carrierName,
        availableCarriers: Object.keys(countryRules.carrier_codes),
      });
      throw new Error(
        `Carrier ${carrierName} not found for country ${countryCode}. Available carriers: ${Object.keys(
          countryRules.carrier_codes
        ).join(', ')}`
      );
    }

    // Step 4: Get template for forwarding type
    let codeTemplate = carrierData[forwardingType];
    const deactivateTemplate = carrierData.deactivate;

    if (!codeTemplate || !deactivateTemplate) {
      log.error('GSMCodeGenerator', 'Missing code template', {
        countryCode,
        carrierName,
        forwardingType,
        carrierData,
      });
      throw new Error(
        `Missing ${forwardingType} code template for ${carrierName} in ${countryCode}`
      );
    }

    // Step 5: Replace placeholders with actual values
    // Supported placeholders: {number}, {ring_time}
    const cleanedNumber = destinationNumber.trim();
    const ringTime = Math.min(60, Math.max(5, ringTimeSeconds)); // Clamp to 5-60 seconds

    let activationCode = codeTemplate
      .replace('{number}', cleanedNumber)
      .replace('{ring_time}', String(ringTime));

    // Step 6: Handle special cases (CDMA carriers don't need * or #)
    // Verizon/Sprint use *72 format without terminators
    if (carrierName === 'verizon' || carrierName === 'sprint') {
      // Codes are already in correct format (e.g., "*72{number}" → "*72+15551234567")
      // No additional processing needed
    }

    log.info('GSMCodeGenerator', 'Codes generated successfully', {
      countryCode,
      carrierName,
      forwardingType,
      activationCodePreview: activationCode.substring(0, 10) + '...',
    });

    // Step 7: Return generated codes with warnings
    return {
      activationCode,
      deactivationCode: deactivateTemplate,
      warning: countryRules.warning_message || undefined,
      notes: countryRules.setup_notes || undefined,
    };
  } catch (error: any) {
    log.error('GSMCodeGenerator', 'Failed to generate codes', {
      countryCode,
      carrierName,
      error: error.message,
      stack: error.stack,
    });
    throw error; // Re-throw for caller to handle
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get available carriers for a specific country
 *
 * @param countryCode - ISO 3166-1 alpha-2 code (e.g., 'NG', 'US')
 * @returns Array of carrier objects with slug and display name
 */
export async function getAvailableCarriers(countryCode: string): Promise<
  Array<{
    slug: string;
    displayName: string;
  }>
> {
  const { data, error } = await supabase
    .from('carrier_forwarding_rules')
    .select('carrier_codes')
    .eq('country_code', countryCode)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    log.error('GSMCodeGenerator', 'Failed to get carriers for country', {
      countryCode,
      error,
    });
    return [];
  }

  // Extract carrier names from JSONB keys
  const carriers = Object.keys(data.carrier_codes).map((key) => ({
    slug: key,
    displayName: capitalizeFirst(key.replace(/_/g, ' ')),
  }));

  return carriers;
}

/**
 * Get country warning message
 *
 * @param countryCode - ISO 3166-1 alpha-2 code
 * @returns Warning message or null
 */
export async function getCountryWarning(
  countryCode: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('carrier_forwarding_rules')
    .select('warning_message')
    .eq('country_code', countryCode)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data.warning_message || null;
}

/**
 * Get supported countries
 *
 * @returns Array of country objects with code and name
 */
export async function getSupportedCountries(): Promise<
  Array<{
    code: string;
    name: string;
    recommendedProvisionCountry: string;
  }>
> {
  const { data, error } = await supabase
    .from('carrier_forwarding_rules')
    .select('country_code, country_name, recommended_twilio_country')
    .eq('is_active', true)
    .order('country_name', { ascending: true });

  if (error || !data) {
    log.error('GSMCodeGenerator', 'Failed to get supported countries', {
      error,
    });
    return [];
  }

  return data.map((row) => ({
    code: row.country_code,
    name: row.country_name,
    recommendedProvisionCountry: row.recommended_twilio_country,
  }));
}

/**
 * Check if a carrier supports ring time customization
 *
 * @param countryCode - ISO 3166-1 alpha-2 code
 * @param carrierName - Carrier slug
 * @returns True if ring time adjustment supported
 */
export async function supportsRingTimeAdjustment(
  countryCode: string,
  carrierName: string
): Promise<boolean> {
  // CDMA carriers (Verizon, Sprint) don't support ring time via MMI codes
  if (carrierName === 'verizon' || carrierName === 'sprint') {
    return false;
  }

  // Check if carrier's safety_net code template includes {ring_time} placeholder
  const { data, error } = await supabase
    .from('carrier_forwarding_rules')
    .select('carrier_codes')
    .eq('country_code', countryCode)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return false;
  }

  const carrierData = data.carrier_codes[carrierName];
  if (!carrierData?.safety_net) {
    return false;
  }

  // Check if safety_net code contains {ring_time} placeholder
  return carrierData.safety_net.includes('{ring_time}');
}

/**
 * Get recommended ring time based on carrier
 *
 * @param countryCode - ISO 3166-1 alpha-2 code
 * @param carrierName - Carrier slug
 * @returns Recommended ring time in seconds
 */
export async function getRecommendedRingTime(
  countryCode: string,
  carrierName: string
): Promise<number> {
  // For carriers that don't support customization, return typical default
  const supportsAdjustment = await supportsRingTimeAdjustment(
    countryCode,
    carrierName
  );
  if (!supportsAdjustment) {
    return 30; // Verizon/CDMA default
  }

  // For GSM carriers, 25 seconds is optimal
  // - Long enough to give user time to answer
  // - Short enough to forward before carrier voicemail (usually 30s)
  return 25;
}

/**
 * Validate E.164 phone number format
 *
 * @param phoneNumber - Phone number to validate
 * @returns True if phone number is valid E.164 format
 */
export function validateE164PhoneNumber(phoneNumber: string): boolean {
  // E.164 format: + followed by 1-15 digits
  // Examples: +1234567890, +442071234567, +234801234567
  const e164Pattern = /^\+[1-9]\d{1,14}$/;
  return e164Pattern.test(phoneNumber);
}

/**
 * Validate generated MMI code format
 *
 * @param code - Generated activation or deactivation code
 * @returns True if code format is valid
 */
export function validateCode(code: string): boolean {
  // Basic validation: should start with * or # and contain digits
  if (!code || code.length < 3) return false;

  // Check for valid MMI code patterns
  const gsmPattern = /^(\*|\*\*|##|\*#)[0-9*#+]+$/;
  const cdmaPattern = /^\*[0-9]+\+?[0-9]+$/;

  return gsmPattern.test(code) || cdmaPattern.test(code);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Capitalize first letter of a string
 */
function capitalizeFirst(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================
// Backward Compatibility Layer
// ============================================

/**
 * Legacy carrier type mapping (for backward compatibility)
 * Maps old CarrierType to new (countryCode, carrierName) format
 */
export type LegacyCarrierType =
  | 'att'
  | 'tmobile'
  | 'verizon'
  | 'sprint'
  | 'other_gsm'
  | 'other_cdma'
  | 'international';

export interface LegacyCarrierCodeConfig {
  carrier: LegacyCarrierType;
  forwardingType: ForwardingType;
  destinationNumber: string;
  ringTimeSeconds?: number;
}

/**
 * Legacy function for backward compatibility with existing code
 * @deprecated Use generateForwardingCodes() with countryCode and carrierName instead
 */
export async function generateForwardingCodesLegacy(
  config: LegacyCarrierCodeConfig
): Promise<GeneratedCodes> {
  const { carrier, forwardingType, destinationNumber, ringTimeSeconds } =
    config;

  // Map legacy carrier types to (countryCode, carrierName)
  let countryCode = 'US';
  let carrierName = carrier;

  // All legacy carriers are US carriers
  if (carrier === 'other_gsm' || carrier === 'international') {
    carrierName = 'tmobile'; // Default to T-Mobile for GSM
  } else if (carrier === 'other_cdma') {
    carrierName = 'verizon'; // Default to Verizon for CDMA
  }

  // Call new database-driven function
  return generateForwardingCodes({
    countryCode,
    carrierName,
    forwardingType,
    destinationNumber,
    ringTimeSeconds,
  });
}

// ============================================
// Exports
// ============================================

export default {
  generateForwardingCodes,
  generateForwardingCodesLegacy,
  getAvailableCarriers,
  getCountryWarning,
  getSupportedCountries,
  supportsRingTimeAdjustment,
  getRecommendedRingTime,
  validateCode,
  validateE164PhoneNumber,
};
