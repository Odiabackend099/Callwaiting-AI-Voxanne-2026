/**
 * Billing Manager - Unit Tests
 *
 * Tests the pure calculateBilling() function with comprehensive edge cases.
 * All money values are in pence (integer arithmetic).
 */

import { calculateBilling } from '../../services/billing-manager';

describe('calculateBilling', () => {
  describe('Call entirely within allowance (Case A)', () => {
    it('should return no overage when usage is well under the limit', () => {
      const result = calculateBilling(
        120,    // 2 minutes (120 seconds)
        100,    // 100 minutes already used
        400,    // 400 minute allowance
        45      // 45p/min overage rate
      );

      expect(result.billableMinutes).toBe(2);
      expect(result.isOverage).toBe(false);
      expect(result.overageMinutes).toBe(0);
      expect(result.overagePence).toBe(0);
    });

    it('should handle exact limit without triggering overage', () => {
      const result = calculateBilling(
        60,     // 1 minute
        399,    // 399 used
        400,    // 400 allowance → 399 + 1 = 400, exactly at limit
        45
      );

      expect(result.billableMinutes).toBe(1);
      expect(result.isOverage).toBe(false);
      expect(result.overageMinutes).toBe(0);
      expect(result.overagePence).toBe(0);
    });

    it('should handle org with zero usage', () => {
      const result = calculateBilling(
        300,    // 5 minutes
        0,      // Fresh period
        1200,   // Professional tier
        40
      );

      expect(result.billableMinutes).toBe(5);
      expect(result.isOverage).toBe(false);
      expect(result.overageMinutes).toBe(0);
      expect(result.overagePence).toBe(0);
    });
  });

  describe('Call crossing the boundary (Case B)', () => {
    it('should calculate partial overage when call crosses the allowance limit', () => {
      const result = calculateBilling(
        120,    // 2 minutes
        399,    // 399 used, 400 allowance → 1 min within, 1 min overage
        400,
        45
      );

      expect(result.billableMinutes).toBe(2);
      expect(result.isOverage).toBe(true);
      expect(result.overageMinutes).toBe(1);
      expect(result.overagePence).toBe(45);   // 1 × 45p
    });

    it('should handle crossing with larger call', () => {
      const result = calculateBilling(
        600,    // 10 minutes
        395,    // 395 used, 400 allowance → 5 within, 5 overage
        400,
        45
      );

      expect(result.billableMinutes).toBe(10);
      expect(result.isOverage).toBe(true);
      expect(result.overageMinutes).toBe(5);
      expect(result.overagePence).toBe(225);  // 5 × 45p
    });

    it('should handle crossing at exactly one minute over', () => {
      const result = calculateBilling(
        60,     // 1 minute
        400,    // Exactly at limit → full minute is overage
        400,
        45
      );

      // This is actually Case C (already at limit)
      expect(result.billableMinutes).toBe(1);
      expect(result.isOverage).toBe(true);
      expect(result.overageMinutes).toBe(1);
      expect(result.overagePence).toBe(45);
    });
  });

  describe('Call entirely in overage (Case C)', () => {
    it('should bill entire call at overage rate when already over limit', () => {
      const result = calculateBilling(
        300,    // 5 minutes
        450,    // Already 50 over the 400 limit
        400,
        45
      );

      expect(result.billableMinutes).toBe(5);
      expect(result.isOverage).toBe(true);
      expect(result.overageMinutes).toBe(5);
      expect(result.overagePence).toBe(225);  // 5 × 45p
    });

    it('should handle large overage correctly', () => {
      const result = calculateBilling(
        1800,   // 30 minutes
        500,    // Already well over
        400,
        40      // Professional tier rate
      );

      expect(result.billableMinutes).toBe(30);
      expect(result.isOverage).toBe(true);
      expect(result.overageMinutes).toBe(30);
      expect(result.overagePence).toBe(1200); // 30 × 40p = £12.00
    });
  });

  describe('Minute rounding', () => {
    it('should round up partial minutes (61s = 2 minutes)', () => {
      const result = calculateBilling(61, 500, 400, 45);

      expect(result.billableMinutes).toBe(2);
      expect(result.overageMinutes).toBe(2);
      expect(result.overagePence).toBe(90);  // 2 × 45p
    });

    it('should round up 1 second to 1 minute', () => {
      const result = calculateBilling(1, 500, 400, 45);

      expect(result.billableMinutes).toBe(1);
    });

    it('should handle exactly 60 seconds as 1 minute', () => {
      const result = calculateBilling(60, 500, 400, 45);

      expect(result.billableMinutes).toBe(1);
    });

    it('should handle 119 seconds as 2 minutes', () => {
      const result = calculateBilling(119, 500, 400, 45);

      expect(result.billableMinutes).toBe(2);
    });

    it('should handle exactly 120 seconds as 2 minutes', () => {
      const result = calculateBilling(120, 500, 400, 45);

      expect(result.billableMinutes).toBe(2);
    });
  });

  describe('Zero and edge cases', () => {
    it('should handle zero-duration call', () => {
      const result = calculateBilling(0, 100, 400, 45);

      expect(result.billableMinutes).toBe(0);
      expect(result.isOverage).toBe(false);
      expect(result.overageMinutes).toBe(0);
      expect(result.overagePence).toBe(0);
    });

    it('should handle zero allowance (everything is overage)', () => {
      const result = calculateBilling(180, 0, 0, 45);

      expect(result.billableMinutes).toBe(3);
      expect(result.isOverage).toBe(true);
      expect(result.overageMinutes).toBe(3);
      expect(result.overagePence).toBe(135);
    });

    it('should handle zero overage rate', () => {
      const result = calculateBilling(600, 500, 400, 0);

      expect(result.billableMinutes).toBe(10);
      expect(result.isOverage).toBe(true);
      expect(result.overageMinutes).toBe(10);
      expect(result.overagePence).toBe(0); // 10 × 0p
    });
  });

  describe('Financial precision', () => {
    it('should use integer arithmetic only (Starter tier)', () => {
      // 7 overage minutes at 45p = 315 pence (not 3.15)
      const result = calculateBilling(420, 400, 400, 45);

      expect(result.overageMinutes).toBe(7);
      expect(result.overagePence).toBe(315);
      expect(Number.isInteger(result.overagePence)).toBe(true);
    });

    it('should use integer arithmetic only (Professional tier)', () => {
      // 15 overage minutes at 40p = 600 pence
      const result = calculateBilling(900, 1200, 1200, 40);

      expect(result.overageMinutes).toBe(15);
      expect(result.overagePence).toBe(600);
      expect(Number.isInteger(result.overagePence)).toBe(true);
    });

    it('should use integer arithmetic only (Enterprise tier)', () => {
      // 50 overage minutes at 35p = 1750 pence
      const result = calculateBilling(3000, 2000, 2000, 35);

      expect(result.overageMinutes).toBe(50);
      expect(result.overagePence).toBe(1750);
      expect(Number.isInteger(result.overagePence)).toBe(true);
    });

    it('should never produce fractional pence', () => {
      // Test many combinations
      const rates = [35, 40, 45];
      const durations = [1, 30, 59, 60, 61, 120, 300, 900, 1800, 3600];

      for (const rate of rates) {
        for (const dur of durations) {
          const result = calculateBilling(dur, 500, 400, rate);
          expect(Number.isInteger(result.overagePence)).toBe(true);
          expect(Number.isInteger(result.billableMinutes)).toBe(true);
          expect(Number.isInteger(result.overageMinutes)).toBe(true);
        }
      }
    });
  });

  describe('Tier-specific scenarios', () => {
    it('Starter tier: 400 min allowance, full period usage', () => {
      // Customer used 398 min, 5-minute call → 2 min within, 3 min overage
      const result = calculateBilling(300, 398, 400, 45);

      expect(result.billableMinutes).toBe(5);
      expect(result.isOverage).toBe(true);
      expect(result.overageMinutes).toBe(3);
      expect(result.overagePence).toBe(135); // 3 × 45p = £1.35
    });

    it('Professional tier: 1200 min allowance, heavy usage', () => {
      // Customer used 1195 min, 10-minute call → 5 within, 5 overage
      const result = calculateBilling(600, 1195, 1200, 40);

      expect(result.billableMinutes).toBe(10);
      expect(result.isOverage).toBe(true);
      expect(result.overageMinutes).toBe(5);
      expect(result.overagePence).toBe(200); // 5 × 40p = £2.00
    });

    it('Enterprise tier: 2000 min allowance, no overage', () => {
      const result = calculateBilling(1800, 500, 2000, 35);

      expect(result.billableMinutes).toBe(30);
      expect(result.isOverage).toBe(false);
      expect(result.overageMinutes).toBe(0);
      expect(result.overagePence).toBe(0);
    });
  });
});
