/**
 * Unit Tests for Date Validation Utility
 *
 * Tests the "time travel bug" fix that prevents AI from booking appointments in past years
 */

import {
  validateAndCorrectDate,
  validateBookingDate,
  isDateInPast,
  getCurrentDateISO,
  normalizeAndValidateDate,
  getDateCorrectionStats,
  clearCorrectionHistory
} from '../../utils/date-validation';

describe('Date Validation - Time Travel Bug Fix', () => {
  const currentYear = new Date().getFullYear();

  beforeEach(() => {
    // Clear correction history before each test
    clearCorrectionHistory();
  });

  describe('validateAndCorrectDate', () => {
    test('Valid current year date is accepted without correction', () => {
      const result = validateAndCorrectDate(`${currentYear}-03-15`, true);

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('accepted');
      expect(result.correctedDate).toBeUndefined();
      expect(result.correctedYear).toBeUndefined();
    });

    test('2024 date is auto-corrected to current year', () => {
      const result = validateAndCorrectDate('2024-02-03', true);

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('corrected');
      expect(result.correctedDate).toBe(`${currentYear}-02-03`);
      expect(result.correctedYear).toBe(currentYear);
      expect(result.reason).toContain('2024');
      expect(result.reason).toContain(currentYear.toString());
    });

    test('2025 date is auto-corrected to current year', () => {
      const result = validateAndCorrectDate('2025-12-25', true);

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('corrected');
      expect(result.correctedDate).toBe(`${currentYear}-12-25`);
      expect(result.correctedYear).toBe(currentYear);
    });

    test('Past year date is rejected when auto-correction is disabled', () => {
      const result = validateAndCorrectDate('2024-02-03', false);

      expect(result.isValid).toBe(false);
      expect(result.action).toBe('rejected');
      expect(result.correctedDate).toBeUndefined();
      expect(result.reason).toContain('2024');
      expect(result.reason).toContain('past');
    });

    test('Invalid date format is rejected', () => {
      const result = validateAndCorrectDate('02/03/2024', true);

      expect(result.isValid).toBe(false);
      expect(result.action).toBe('rejected');
      expect(result.reason).toContain('Invalid date format');
      expect(result.reason).toContain('YYYY-MM-DD');
    });

    test('Far future year is rejected', () => {
      const farFuture = currentYear + 15;
      const result = validateAndCorrectDate(`${farFuture}-01-01`, true);

      expect(result.isValid).toBe(false);
      expect(result.action).toBe('rejected');
      expect(result.reason).toContain('too far in the future');
    });

    test('Next year date is accepted (reasonable future)', () => {
      const nextYear = currentYear + 1;
      const result = validateAndCorrectDate(`${nextYear}-06-15`, true);

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('accepted');
      expect(result.correctedDate).toBeUndefined();
    });

    test('ISO 8601 format with time is supported', () => {
      const result = validateAndCorrectDate(`${currentYear}-03-15T14:30:00`, true);

      expect(result.isValid).toBe(true);
      expect(result.action).toBe('accepted');
    });

    test('Correction is tracked in statistics', () => {
      // Perform correction
      validateAndCorrectDate('2024-02-03', true, 'America/New_York', 'org-123');

      // Check stats
      const stats = getDateCorrectionStats();
      expect(stats.total).toBe(1);
      expect(stats.last24Hours).toBe(1);
      expect(stats.correctionsByYear[2024]).toBe(1);
      expect(stats.correctionsByOrg['org-123']).toBe(1);
    });

    test('Multiple corrections are tracked separately', () => {
      validateAndCorrectDate('2024-02-03', true, 'America/New_York', 'org-123');
      validateAndCorrectDate('2025-03-15', true, 'America/Los_Angeles', 'org-456');
      validateAndCorrectDate('2024-12-25', true, 'America/Chicago', 'org-123');

      const stats = getDateCorrectionStats();
      expect(stats.total).toBe(3);
      expect(stats.correctionsByYear[2024]).toBe(2);
      expect(stats.correctionsByYear[2025]).toBe(1);
      expect(stats.correctionsByOrg['org-123']).toBe(2);
      expect(stats.correctionsByOrg['org-456']).toBe(1);
    });
  });

  describe('validateBookingDate', () => {
    test('Returns valid: true for current year dates', () => {
      const result = validateBookingDate(`${currentYear}-05-20`, 'America/New_York');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.correctedDate).toBeUndefined();
    });

    test('Returns corrected date for past year', () => {
      const result = validateBookingDate('2024-02-03', 'America/New_York', 'org-123');

      expect(result.valid).toBe(true);
      expect(result.correctedDate).toBe(`${currentYear}-02-03`);
      expect(result.wasAutoCorrected).toBe(true);
    });

    test('Returns error for invalid format', () => {
      const result = validateBookingDate('02/03/2024', 'America/New_York');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid date format');
      expect(result.correctedDate).toBeUndefined();
    });

    test('Accepts timezone parameter', () => {
      const result = validateBookingDate(`${currentYear}-08-10`, 'America/Los_Angeles');

      expect(result.valid).toBe(true);
    });
  });

  describe('isDateInPast', () => {
    test('Returns true for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = yesterday.toLocaleDateString('en-CA');

      const result = isDateInPast(yesterdayISO);
      expect(result).toBe(true);
    });

    test('Returns false for today', () => {
      const today = new Date().toLocaleDateString('en-CA');

      const result = isDateInPast(today);
      expect(result).toBe(false);
    });

    test('Returns false for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = tomorrow.toLocaleDateString('en-CA');

      const result = isDateInPast(tomorrowISO);
      expect(result).toBe(false);
    });

    test('Respects timezone parameter', () => {
      const today = new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/New_York'
      });

      const result = isDateInPast(today, 'America/New_York');
      expect(result).toBe(false);
    });
  });

  describe('getCurrentDateISO', () => {
    test('Returns date in YYYY-MM-DD format', () => {
      const result = getCurrentDateISO();

      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('Returns current year', () => {
      const result = getCurrentDateISO();
      const year = parseInt(result.substring(0, 4), 10);

      expect(year).toBe(currentYear);
    });

    test('Respects timezone parameter', () => {
      const nyDate = getCurrentDateISO('America/New_York');
      const laDate = getCurrentDateISO('America/Los_Angeles');

      // Both should be valid ISO dates
      expect(nyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(laDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // They might differ by 1 day depending on time of day
      // Just verify format and current year
      expect(nyDate.substring(0, 4)).toBe(currentYear.toString());
      expect(laDate.substring(0, 4)).toBe(currentYear.toString());
    });
  });

  describe('normalizeAndValidateDate', () => {
    test('Accepts YYYY-MM-DD format', () => {
      const result = normalizeAndValidateDate(`${currentYear}-03-15`);

      expect(result).toBe(`${currentYear}-03-15`);
    });

    test('Converts MM/DD/YYYY to YYYY-MM-DD', () => {
      const result = normalizeAndValidateDate(`03/15/${currentYear}`);

      expect(result).toBe(`${currentYear}-03-15`);
    });

    test('Converts M/D/YY to YYYY-MM-DD (assumes 20xx)', () => {
      const yearShort = currentYear.toString().substring(2);
      const result = normalizeAndValidateDate(`3/15/${yearShort}`);

      expect(result).toBe(`${currentYear}-03-15`);
    });

    test('Auto-corrects past year after normalization', () => {
      const result = normalizeAndValidateDate('03/15/2024');

      expect(result).toBe(`${currentYear}-03-15`);
    });

    test('Throws error for invalid format', () => {
      expect(() => normalizeAndValidateDate('not-a-date')).toThrow('Invalid date');
    });

    test('Throws error for far future date', () => {
      const farFuture = currentYear + 15;
      expect(() => normalizeAndValidateDate(`01/01/${farFuture}`)).toThrow();
    });
  });

  describe('getDateCorrectionStats', () => {
    test('Returns zero stats initially', () => {
      const stats = getDateCorrectionStats();

      expect(stats.total).toBe(0);
      expect(stats.last24Hours).toBe(0);
      expect(stats.last7Days).toBe(0);
      expect(Object.keys(stats.correctionsByYear)).toHaveLength(0);
      expect(stats.recentCorrections).toHaveLength(0);
    });

    test('Tracks correction count accurately', () => {
      validateAndCorrectDate('2024-01-01', true);
      validateAndCorrectDate('2024-02-01', true);
      validateAndCorrectDate('2025-03-01', true);

      const stats = getDateCorrectionStats();

      expect(stats.total).toBe(3);
      expect(stats.last24Hours).toBe(3);
      expect(stats.correctionsByYear[2024]).toBe(2);
      expect(stats.correctionsByYear[2025]).toBe(1);
    });

    test('Recent corrections are ordered newest first', () => {
      validateAndCorrectDate('2024-01-01', true);
      validateAndCorrectDate('2024-02-01', true);
      validateAndCorrectDate('2024-03-01', true);

      const stats = getDateCorrectionStats();

      expect(stats.recentCorrections).toHaveLength(3);
      expect(stats.recentCorrections[0].originalDate).toBe('2024-03-01');
      expect(stats.recentCorrections[2].originalDate).toBe('2024-01-01');
    });

    test('Limits recent corrections to last 10', () => {
      for (let i = 1; i <= 15; i++) {
        validateAndCorrectDate(`2024-01-${i.toString().padStart(2, '0')}`, true);
      }

      const stats = getDateCorrectionStats();

      expect(stats.total).toBe(15);
      expect(stats.recentCorrections).toHaveLength(10);
    });
  });

  describe('Edge Cases', () => {
    test('Handles leap year dates correctly', () => {
      const result = validateAndCorrectDate(`${currentYear}-02-29`, true);

      // If current year is leap year, accept; otherwise, let Date handle it
      expect(result.isValid).toBe(true);
    });

    test('Handles end of year dates', () => {
      const result = validateAndCorrectDate('2024-12-31', true);

      expect(result.isValid).toBe(true);
      expect(result.correctedDate).toBe(`${currentYear}-12-31`);
    });

    test('Handles start of year dates', () => {
      const result = validateAndCorrectDate('2024-01-01', true);

      expect(result.isValid).toBe(true);
      expect(result.correctedDate).toBe(`${currentYear}-01-01`);
    });

    test('Handles date with timezone offset', () => {
      const result = validateAndCorrectDate(`${currentYear}-03-15T14:30:00-05:00`, true);

      expect(result.isValid).toBe(true);
    });

    test('Handles date with Z (UTC) indicator', () => {
      const result = validateAndCorrectDate(`${currentYear}-03-15T14:30:00Z`, true);

      expect(result.isValid).toBe(true);
    });
  });
});
