/**
 * Date Validation & Auto-Correction Utility
 *
 * Purpose: Prevent "time travel" bug where AI books appointments in past years
 *
 * Features:
 * - Validates date formats (ISO 8601 / YYYY-MM-DD)
 * - Auto-corrects past years to current year (2024 → 2026)
 * - Tracks corrections for monitoring
 * - Provides clear error messages for AI tools
 *
 * Example:
 * - Input: "2024-02-03"
 * - Output: { isValid: true, correctedDate: "2026-02-03", action: "corrected" }
 */

import { logger } from '../config/logger';

export interface DateValidationResult {
  isValid: boolean;
  originalDate: string;
  correctedDate?: string;
  correctedYear?: number;
  reason?: string;
  action: 'accepted' | 'corrected' | 'rejected';
}

export interface DateCorrectionRecord {
  timestamp: Date;
  originalDate: string;
  correctedDate: string;
  originalYear: number;
  correctedYear: number;
  orgId?: string;
}

// In-memory tracking (last 100 corrections)
const dateCorrections: DateCorrectionRecord[] = [];
const MAX_CORRECTIONS_LOG = 100;

/**
 * Validates date and auto-corrects year if in the past
 *
 * @param dateString - Date in YYYY-MM-DD or ISO 8601 format
 * @param autoCorrect - If true, auto-corrects year to current year (default: true)
 * @param orgTimezone - Organization timezone for validation (optional)
 * @returns Validation result with corrected date if needed
 *
 * @example
 * validateAndCorrectDate('2024-02-03', true)
 * // Returns: { isValid: true, correctedDate: '2026-02-03', action: 'corrected' }
 */
export function validateAndCorrectDate(
  dateString: string,
  autoCorrect: boolean = true,
  orgTimezone: string = 'America/New_York',
  orgId?: string
): DateValidationResult {
  // Validate format (must start with YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    return {
      isValid: false,
      originalDate: dateString,
      reason: 'Invalid date format. Expected YYYY-MM-DD (ISO 8601)',
      action: 'rejected'
    };
  }

  // Extract year from date string
  const year = parseInt(dateString.substring(0, 4), 10);
  const currentYear = new Date().getFullYear();

  // Validate year is not in future (too far)
  if (year > currentYear + 10) {
    return {
      isValid: false,
      originalDate: dateString,
      reason: `Year ${year} is too far in the future. Maximum: ${currentYear + 10}`,
      action: 'rejected'
    };
  }

  // Check if year is in the past
  if (year < currentYear) {
    if (autoCorrect) {
      // Auto-correct: replace year with current year
      const correctedDate = dateString.replace(/^\d{4}/, currentYear.toString());

      // Log correction with context
      logger.warn('⚠️ Date Auto-Correction Applied', {
        originalDate: dateString,
        correctedDate,
        originalYear: year,
        correctedYear: currentYear,
        timezone: orgTimezone,
        orgId,
        yearDifference: currentYear - year
      });

      // Track correction for monitoring
      recordDateCorrection(dateString, correctedDate, year, currentYear, orgId);

      return {
        isValid: true,
        originalDate: dateString,
        correctedDate,
        correctedYear: currentYear,
        reason: `Year ${year} is in the past. Auto-corrected to ${currentYear}.`,
        action: 'corrected'
      };
    } else {
      // Reject without correction
      return {
        isValid: false,
        originalDate: dateString,
        reason: `Year ${year} is in the past. Current year is ${currentYear}.`,
        action: 'rejected'
      };
    }
  }

  // Valid date (current year or acceptable future year)
  return {
    isValid: true,
    originalDate: dateString,
    action: 'accepted'
  };
}

/**
 * Records date correction for monitoring dashboard
 * Keeps in-memory log of last 100 corrections
 */
function recordDateCorrection(
  originalDate: string,
  correctedDate: string,
  originalYear: number,
  correctedYear: number,
  orgId?: string
) {
  dateCorrections.push({
    timestamp: new Date(),
    originalDate,
    correctedDate,
    originalYear,
    correctedYear,
    orgId
  });

  // Keep only last 100 entries
  if (dateCorrections.length > MAX_CORRECTIONS_LOG) {
    dateCorrections.shift();
  }
}

/**
 * Get date correction statistics for monitoring endpoint
 *
 * @returns Statistics about date corrections
 */
export function getDateCorrectionStats() {
  const now = new Date();
  const last24h = dateCorrections.filter(
    c => (now.getTime() - c.timestamp.getTime()) < 24 * 60 * 60 * 1000
  );

  const last7d = dateCorrections.filter(
    c => (now.getTime() - c.timestamp.getTime()) < 7 * 24 * 60 * 60 * 1000
  );

  // Group by original year
  const yearCounts: Record<number, number> = {};
  last24h.forEach(c => {
    yearCounts[c.originalYear] = (yearCounts[c.originalYear] || 0) + 1;
  });

  // Group by organization (if available)
  const orgCounts: Record<string, number> = {};
  last24h.forEach(c => {
    if (c.orgId) {
      orgCounts[c.orgId] = (orgCounts[c.orgId] || 0) + 1;
    }
  });

  return {
    total: dateCorrections.length,
    last24Hours: last24h.length,
    last7Days: last7d.length,
    correctionsByYear: yearCounts,
    correctionsByOrg: orgCounts,
    recentCorrections: dateCorrections.slice(-10).reverse() // Last 10, newest first
  };
}

/**
 * Validate booking date and return user-friendly error for AI
 *
 * This is the main function to use in booking endpoints
 *
 * @param date - Date string to validate (YYYY-MM-DD)
 * @param orgTimezone - Organization timezone
 * @param orgId - Organization ID (for tracking)
 * @returns Validation result with error message if invalid
 *
 * @example
 * const validation = validateBookingDate('2024-02-03', 'America/New_York', 'org-123');
 * if (!validation.valid) {
 *   return res.json({ error: validation.error });
 * }
 * const dateToUse = validation.correctedDate || date;
 */
export function validateBookingDate(
  date: string,
  orgTimezone: string,
  orgId?: string
): { valid: boolean; error?: string; correctedDate?: string; wasAutoCorrected?: boolean } {
  const result = validateAndCorrectDate(date, true, orgTimezone, orgId);

  if (!result.isValid) {
    return {
      valid: false,
      error: result.reason
    };
  }

  if (result.action === 'corrected') {
    return {
      valid: true,
      correctedDate: result.correctedDate,
      wasAutoCorrected: true
    };
  }

  return { valid: true };
}

/**
 * Check if date is in the past (for rejecting historical bookings)
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @param timezone - Timezone to use for "today" calculation
 * @returns True if date is before today
 */
export function isDateInPast(dateString: string, timezone: string = 'America/New_York'): boolean {
  const date = new Date(dateString + 'T00:00:00');
  const now = new Date();

  // Get today's date in the specified timezone
  const todayString = now.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone
  });
  const today = new Date(todayString + 'T00:00:00');

  return date < today;
}

/**
 * Get current date in ISO format for a specific timezone
 *
 * @param timezone - IANA timezone (e.g., "America/Los_Angeles")
 * @returns ISO date string (YYYY-MM-DD)
 *
 * @example
 * getCurrentDateISO('America/New_York') // "2026-02-02"
 */
export function getCurrentDateISO(timezone: string = 'America/New_York'): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone
  });
}

/**
 * Validate and normalize date for calendar operations
 *
 * @param dateString - Date string in various formats
 * @param timezone - Timezone for validation
 * @returns Normalized date in YYYY-MM-DD format or throws error
 */
export function normalizeAndValidateDate(
  dateString: string,
  timezone: string = 'America/New_York'
): string {
  // Try to parse various date formats
  let normalizedDate = dateString;

  // Handle MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
    const [month, day, year] = dateString.split('/');
    normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Handle M/D/YY format
  if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateString)) {
    const [month, day, yearShort] = dateString.split('/');
    const year = `20${yearShort}`; // Assume 20xx
    normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Validate and auto-correct
  const validation = validateAndCorrectDate(normalizedDate, true, timezone);

  if (!validation.isValid) {
    throw new Error(validation.reason || 'Invalid date');
  }

  return validation.correctedDate || validation.originalDate;
}

/**
 * Clear correction history (for testing or reset)
 */
export function clearCorrectionHistory() {
  dateCorrections.length = 0;
}
