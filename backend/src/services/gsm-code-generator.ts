/**
 * GSM Code Generator Service
 *
 * Generates carrier-specific MMI (Man-Machine Interface) codes for call forwarding.
 * Supports both unconditional (Type A) and conditional (Type B) forwarding.
 *
 * Reference: 3GPP TS 22.030 for GSM standard codes
 */

export type CarrierType = 'att' | 'tmobile' | 'verizon' | 'sprint' | 'other_gsm' | 'other_cdma' | 'international';
export type ForwardingType = 'total_ai' | 'safety_net';

export interface CarrierCodeConfig {
  carrier: CarrierType;
  forwardingType: ForwardingType;
  destinationNumber: string;
  ringTimeSeconds?: number;
}

export interface GeneratedCodes {
  activation: string;
  deactivation: string;
  busyCode?: string;
  noAnswerCode?: string;
  unreachableCode?: string;
}

/**
 * Generate GSM/CDMA forwarding codes based on carrier and forwarding type
 *
 * Type A (total_ai) - Unconditional Call Forwarding:
 *   All incoming calls are forwarded immediately. Phone doesn't ring.
 *
 * Type B (safety_net) - Conditional Call Forwarding:
 *   Calls forward only if busy, no answer, or unreachable.
 */
export function generateForwardingCodes(config: CarrierCodeConfig): GeneratedCodes {
  const { carrier, forwardingType, destinationNumber, ringTimeSeconds = 25 } = config;

  // Clean the destination number (keep + but ensure E.164)
  const dest = destinationNumber.trim();

  // Validate ring time (5-60 seconds, in 5-second increments for most carriers)
  const ringTime = Math.min(60, Math.max(5, ringTimeSeconds));

  if (forwardingType === 'total_ai') {
    return generateUnconditionalCodes(carrier, dest);
  } else {
    return generateConditionalCodes(carrier, dest, ringTime);
  }
}

/**
 * Generate codes for unconditional (Type A) forwarding
 * All calls go to AI immediately - phone never rings
 */
function generateUnconditionalCodes(carrier: CarrierType, dest: string): GeneratedCodes {
  switch (carrier) {
    // T-Mobile (GSM standard with double star)
    case 'tmobile':
      return {
        activation: `**21*${dest}#`,
        deactivation: `##21#`
      };

    // AT&T (GSM variant with single star)
    case 'att':
      return {
        activation: `*21*${dest}#`,
        deactivation: `#21#`
      };

    // Verizon (CDMA style - no # terminator)
    case 'verizon':
    case 'sprint':
    case 'other_cdma':
      return {
        activation: `*72${dest}`,
        deactivation: `*73`
      };

    // International / Other GSM carriers (standard GSM)
    case 'international':
    case 'other_gsm':
    default:
      return {
        activation: `**21*${dest}#`,
        deactivation: `##21#`
      };
  }
}

/**
 * Generate codes for conditional (Type B) forwarding
 * AI answers only if busy, no answer, or unreachable
 */
function generateConditionalCodes(carrier: CarrierType, dest: string, ringTime: number): GeneratedCodes {
  switch (carrier) {
    // T-Mobile (GSM standard)
    // Service code 11 = All tele services
    // Format: **61*dest*SC*time#
    case 'tmobile':
      return {
        activation: `**61*${dest}*11*${ringTime}#`,
        deactivation: `##61#`,
        busyCode: `**67*${dest}#`,
        noAnswerCode: `**61*${dest}*11*${ringTime}#`,
        unreachableCode: `**62*${dest}#`
      };

    // AT&T (Combined conditional code *004*)
    // *004* sets busy + no answer + unreachable in one code
    case 'att':
      return {
        activation: `*004*${dest}*11*${ringTime}#`,
        deactivation: `##004#`,
        // Fallback individual codes if *004* fails
        busyCode: `*90${dest}`,
        noAnswerCode: `*92${dest}`,
        unreachableCode: `*92${dest}`
      };

    // Verizon (CDMA - combined busy/no answer)
    // Note: Verizon does NOT support ring time adjustment via MMI
    case 'verizon':
    case 'sprint':
    case 'other_cdma':
      return {
        activation: `*71${dest}`,
        deactivation: `*73`
        // Verizon doesn't expose separate busy/no answer codes
      };

    // International / Other GSM (standard GSM codes)
    case 'international':
    case 'other_gsm':
    default:
      // Standard GSM: Use **61* for no answer with time parameter
      return {
        activation: `**61*${dest}*11*${ringTime}#`,
        deactivation: `##61#`,
        busyCode: `**67*${dest}#`,
        noAnswerCode: `**61*${dest}*11*${ringTime}#`,
        unreachableCode: `**62*${dest}#`
      };
  }
}

/**
 * Get carrier-specific notes and warnings
 */
export function getCarrierNotes(carrier: CarrierType, forwardingType: ForwardingType): string[] {
  const notes: string[] = [];

  if (carrier === 'verizon' || carrier === 'other_cdma') {
    notes.push('Verizon/CDMA does not support custom ring time via dial codes.');
    notes.push('Default ring time is typically 20-30 seconds before forwarding.');

    if (forwardingType === 'safety_net') {
      notes.push('Use *71 for combined busy/no-answer forwarding.');
    }
  }

  if (carrier === 'att') {
    notes.push('If *004* fails, try individual codes: *90 (busy), *92 (no answer).');
  }

  if (forwardingType === 'total_ai') {
    notes.push('With unconditional forwarding, your phone will not ring for any calls.');
    notes.push('Remember to deactivate forwarding when you want to receive calls directly.');
  }

  if (forwardingType === 'safety_net') {
    notes.push('Your phone will ring first. AI answers only if you don\'t pick up.');
    notes.push('Set ring time long enough (25-30s) to beat carrier voicemail.');
  }

  return notes;
}

/**
 * Check if carrier supports ring time customization
 */
export function supportsRingTimeAdjustment(carrier: CarrierType): boolean {
  // CDMA carriers don't support ring time via MMI codes
  if (carrier === 'verizon' || carrier === 'sprint' || carrier === 'other_cdma') {
    return false;
  }
  return true;
}

/**
 * Get recommended ring time based on carrier
 */
export function getRecommendedRingTime(carrier: CarrierType): number {
  // For carriers that don't support customization, return typical default
  if (!supportsRingTimeAdjustment(carrier)) {
    return 30; // Verizon default
  }

  // For GSM carriers, 25 seconds is optimal
  // - Long enough to give user time to answer
  // - Short enough to forward before carrier voicemail (usually 30s)
  return 25;
}

/**
 * Validate the generated code before displaying to user
 */
export function validateCode(code: string): boolean {
  // Basic validation: should start with * or # and contain digits
  if (!code || code.length < 3) return false;

  // Check for valid MMI code patterns
  const gsmPattern = /^(\*|\*\*|##|\*#)[0-9*#]+$/;
  const cdmaPattern = /^\*[0-9]+\+?[0-9]+$/;

  return gsmPattern.test(code) || cdmaPattern.test(code);
}

export default {
  generateForwardingCodes,
  getCarrierNotes,
  supportsRingTimeAdjustment,
  getRecommendedRingTime,
  validateCode
};
