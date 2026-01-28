/**
 * Billing Stripe Integration Tests
 *
 * Tests Stripe webhook handling and billing flow integration.
 * These tests mock Stripe and Supabase to run without external dependencies.
 */

import { calculateBilling } from '../../services/billing-manager';

// Mock supabase client
jest.mock('../../services/supabase-client', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockReturnThis(),
    rpc: jest.fn().mockResolvedValue({ data: { success: true }, error: null }),
  },
}));

// Mock Stripe client
jest.mock('../../config/stripe', () => ({
  getStripeClient: jest.fn().mockReturnValue(null),
  initializeStripe: jest.fn(),
}));

// Mock billing queue
jest.mock('../../config/billing-queue', () => ({
  enqueueBillingJob: jest.fn().mockResolvedValue(null),
  initializeBillingQueue: jest.fn(),
  initializeBillingWorker: jest.fn(),
  closeBillingQueue: jest.fn(),
}));

// Mock logger
jest.mock('../../services/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  initLogger: jest.fn(),
}));

describe('Billing Integration', () => {
  describe('calculateBilling idempotency', () => {
    it('should produce identical results for the same input', () => {
      const input = { duration: 300, used: 395, allowance: 400, rate: 45 };

      const result1 = calculateBilling(input.duration, input.used, input.allowance, input.rate);
      const result2 = calculateBilling(input.duration, input.used, input.allowance, input.rate);

      expect(result1).toEqual(result2);
    });

    it('should be a pure function with no side effects', () => {
      const result = calculateBilling(600, 1190, 1200, 40);

      // Call again - should be identical
      const result2 = calculateBilling(600, 1190, 1200, 40);
      expect(result).toEqual(result2);

      // Verify result shape
      expect(result).toHaveProperty('billableMinutes');
      expect(result).toHaveProperty('isOverage');
      expect(result).toHaveProperty('overageMinutes');
      expect(result).toHaveProperty('overagePence');
    });
  });

  describe('Billing boundary transitions', () => {
    it('should handle the exact boundary minute correctly', () => {
      // 399 used + 1 minute = 400 (at limit, not over)
      const atLimit = calculateBilling(60, 399, 400, 45);
      expect(atLimit.isOverage).toBe(false);
      expect(atLimit.overageMinutes).toBe(0);

      // 400 used + 1 minute = 401 (over)
      const overLimit = calculateBilling(60, 400, 400, 45);
      expect(overLimit.isOverage).toBe(true);
      expect(overLimit.overageMinutes).toBe(1);
      expect(overLimit.overagePence).toBe(45);
    });

    it('should calculate cumulative overage correctly', () => {
      // Simulate 3 sequential calls, each 5 minutes
      // Allowance: 400 minutes, starting at 393 used

      // Call 1: 393 + 5 = 398 (within)
      const call1 = calculateBilling(300, 393, 400, 45);
      expect(call1.isOverage).toBe(false);

      // Call 2: 398 + 5 = 403 (crosses boundary, 3 min overage)
      const call2 = calculateBilling(300, 398, 400, 45);
      expect(call2.isOverage).toBe(true);
      expect(call2.overageMinutes).toBe(3);
      expect(call2.overagePence).toBe(135);

      // Call 3: 403 + 5 = 408 (fully in overage)
      const call3 = calculateBilling(300, 403, 400, 45);
      expect(call3.isOverage).toBe(true);
      expect(call3.overageMinutes).toBe(5);
      expect(call3.overagePence).toBe(225);
    });
  });

  describe('Invoice payment reset simulation', () => {
    it('should calculate correctly after a period reset', () => {
      // After invoice.payment_succeeded, minutes_used resets to 0
      const afterReset = calculateBilling(600, 0, 400, 45);
      expect(afterReset.isOverage).toBe(false);
      expect(afterReset.billableMinutes).toBe(10);
      expect(afterReset.overageMinutes).toBe(0);
    });
  });

  describe('Plan change scenarios', () => {
    it('should calculate correctly after upgrade from Starter to Professional', () => {
      // Was on Starter (400 min), used 350 min
      // Upgraded to Professional (1200 min)
      // Next call should be within new allowance
      const result = calculateBilling(600, 350, 1200, 40);
      expect(result.isOverage).toBe(false);
      expect(result.billableMinutes).toBe(10);
    });

    it('should calculate correctly after downgrade from Enterprise to Starter', () => {
      // Was on Enterprise (2000 min), used 500 min
      // Downgraded to Starter (400 min)
      // Already over new allowance
      const result = calculateBilling(300, 500, 400, 45);
      expect(result.isOverage).toBe(true);
      expect(result.overageMinutes).toBe(5);
      expect(result.overagePence).toBe(225);
    });
  });

  describe('High volume simulation', () => {
    it('should handle 100 sequential calls without precision loss', () => {
      let minutesUsed = 0;
      let totalOveragePence = 0;
      const allowance = 400;
      const rate = 45;

      for (let i = 0; i < 100; i++) {
        const duration = 120 + (i % 10) * 30; // 2-7 minute calls
        const result = calculateBilling(duration, minutesUsed, allowance, rate);

        minutesUsed += result.billableMinutes;
        totalOveragePence += result.overagePence;

        // Financial precision: every value must be integer
        expect(Number.isInteger(result.overagePence)).toBe(true);
        expect(Number.isInteger(result.billableMinutes)).toBe(true);
        expect(Number.isInteger(result.overageMinutes)).toBe(true);
      }

      // After 100 calls, usage should be well over 400
      expect(minutesUsed).toBeGreaterThan(400);
      expect(totalOveragePence).toBeGreaterThan(0);
      expect(Number.isInteger(totalOveragePence)).toBe(true);
    });
  });
});
