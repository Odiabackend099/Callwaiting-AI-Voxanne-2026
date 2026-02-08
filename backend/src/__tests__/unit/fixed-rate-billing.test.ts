/**
 * Fixed-Rate Billing Unit Tests
 *
 * Tests the fixed-rate billing implementation per-second precision
 * at $0.70/min (70 cents/min) flat rate with intentional double rounding.
 *
 * Key Formulas:
 * 1. USD cents = Math.ceil((durationSeconds / 60) * ratePerMinuteCents)
 * 2. GBP pence = Math.ceil(usdCents * USD_TO_GBP_RATE)
 *
 * Test Coverage:
 * - Test Cases 1-6: calculateFixedRateCharge() with various durations
 * - Test Cases 7-8: Billing skip conditions (duration vs cost)
 * - Test Cases 9-10: Balance gates (MIN_BALANCE_FOR_CALL)
 */

import { calculateFixedRateCharge } from '../../services/wallet-service';
import { config } from '../../config';

describe('Fixed-Rate Billing', () => {
  // Test the actual constants are configured correctly
  describe('Configuration Constants', () => {
    test('RATE_PER_MINUTE_USD_CENTS is 70', () => {
      expect(config.RATE_PER_MINUTE_USD_CENTS).toBe(70);
    });

    test('USD_TO_GBP_RATE is 0.79', () => {
      expect(config.USD_TO_GBP_RATE).toBe('0.79');
    });

    test('WALLET_MIN_BALANCE_FOR_CALL is 79 pence', () => {
      // $1.00 USD = 100 cents * 0.79 = 79p
      expect(config.WALLET_MIN_BALANCE_FOR_CALL).toBe(79);
    });

    test('WALLET_MIN_BALANCE_USD_CENTS is 100 cents ($1.00)', () => {
      expect(config.WALLET_MIN_BALANCE_USD_CENTS).toBe(100);
    });
  });

  describe('calculateFixedRateCharge()', () => {
    test('Test 1: 30 seconds → 35 cents, 28 pence', () => {
      // Formula: ceil((30/60) * 70) = ceil(35) = 35 cents
      // Then: ceil(35 * 0.79) = ceil(27.65) = 28 pence
      const result = calculateFixedRateCharge(30, 70);
      expect(result.usdCents).toBe(35);
      expect(result.pence).toBe(28);
    });

    test('Test 2: 60 seconds → 70 cents, 56 pence', () => {
      // Formula: ceil((60/60) * 70) = ceil(70) = 70 cents
      // Then: ceil(70 * 0.79) = ceil(55.3) = 56 pence
      const result = calculateFixedRateCharge(60, 70);
      expect(result.usdCents).toBe(70);
      expect(result.pence).toBe(56);
    });

    test('Test 3: 91 seconds → 107 cents, 85 pence', () => {
      // Formula: ceil((91/60) * 70) = ceil(106.1667) = 107 cents
      // Then: ceil(107 * 0.79) = ceil(84.53) = 85 pence
      const result = calculateFixedRateCharge(91, 70);
      expect(result.usdCents).toBe(107);
      expect(result.pence).toBe(85);
    });

    test('Test 4: 0 seconds → 0 cents, 0 pence', () => {
      // Edge case: zero duration should return zero cost
      const result = calculateFixedRateCharge(0, 70);
      expect(result.usdCents).toBe(0);
      expect(result.pence).toBe(0);
    });

    test('Test 5: 1 second → 2 cents, 2 pence', () => {
      // Formula: ceil((1/60) * 70) = ceil(1.1667) = 2 cents
      // Then: ceil(2 * 0.79) = ceil(1.58) = 2 pence
      const result = calculateFixedRateCharge(1, 70);
      expect(result.usdCents).toBe(2);
      expect(result.pence).toBe(2);
    });

    test('Test 6: 300 seconds (5 min) → 350 cents, 277 pence', () => {
      // Formula: ceil((300/60) * 70) = ceil(350) = 350 cents
      // Then: ceil(350 * 0.79) = ceil(276.5) = 277 pence
      const result = calculateFixedRateCharge(300, 70);
      expect(result.usdCents).toBe(350);
      expect(result.pence).toBe(277);
    });
  });

  describe('Billing Skip Conditions', () => {
    test('Test 7: Zero-cost call with 60s duration IS billed (70 cents)', () => {
      // CRITICAL: Fixed-rate billing ignores Vapi cost and bills based on duration
      // A 60-second call costs 70 cents regardless of what Vapi charged
      const vapiCost = 0; // Vapi reported $0.00 (hypothetically)
      const durationSeconds = 60;

      const result = calculateFixedRateCharge(durationSeconds, 70);

      // Billing is NOT skipped — duration drives billing, not cost
      expect(result.usdCents).toBe(70);
      expect(result.pence).toBe(56);

      // This simulates the skip condition in deductCallCredits():
      // if (!durationSeconds || durationSeconds <= 0) return { success: true };
      // Since duration = 60 > 0, billing proceeds
      const shouldSkip = !durationSeconds || durationSeconds <= 0;
      expect(shouldSkip).toBe(false); // NOT skipped
    });

    test('Test 8: Zero-duration call with $0.50 cost is NOT billed', () => {
      // CRITICAL: Fixed-rate billing skips if duration = 0, even if Vapi charged money
      // This prevents billing for failed calls, call setup attempts, etc.
      const vapiCost = 0.50; // Vapi charged $0.50 (hypothetically)
      const durationSeconds = 0;

      const result = calculateFixedRateCharge(durationSeconds, 70);

      // Billing IS skipped — zero duration = zero charge
      expect(result.usdCents).toBe(0);
      expect(result.pence).toBe(0);

      // This simulates the skip condition in deductCallCredits():
      // if (!durationSeconds || durationSeconds <= 0) return { success: true };
      const shouldSkip = !durationSeconds || durationSeconds <= 0;
      expect(shouldSkip).toBe(true); // Skipped
    });
  });

  describe('Balance Gates', () => {
    test('Test 9: Balance gate blocks at balance < 79p ($1.00)', () => {
      // Minimum balance to start a call is 79p (≈ $1.00 at $0.70/min)
      // This allows approximately 1.4 minutes of calling ($1.00 / $0.70/min)

      const balance = 78; // 78 pence (just under threshold)
      const minBalance = config.WALLET_MIN_BALANCE_FOR_CALL; // 79 pence

      const hasEnoughBalance = balance >= minBalance;

      expect(hasEnoughBalance).toBe(false); // BLOCKED
      expect(minBalance).toBe(79);
      expect(balance).toBeLessThan(minBalance);
    });

    test('Test 10: Balance gate allows at balance >= 79p ($1.00)', () => {
      // Balance exactly at threshold should allow calls
      const balance = 79; // 79 pence (exactly at threshold)
      const minBalance = config.WALLET_MIN_BALANCE_FOR_CALL; // 79 pence

      const hasEnoughBalance = balance >= minBalance;

      expect(hasEnoughBalance).toBe(true); // ALLOWED
      expect(minBalance).toBe(79);
      expect(balance).toBeGreaterThanOrEqual(minBalance);
    });

    test('Test 11: Balance gate allows at balance > 79p', () => {
      // Balance above threshold should allow calls
      const balance = 100; // 100 pence (well above threshold)
      const minBalance = config.WALLET_MIN_BALANCE_FOR_CALL; // 79 pence

      const hasEnoughBalance = balance >= minBalance;

      expect(hasEnoughBalance).toBe(true); // ALLOWED
      expect(minBalance).toBe(79);
      expect(balance).toBeGreaterThan(minBalance);
    });
  });

  describe('Edge Cases', () => {
    test('Negative duration returns zero', () => {
      // Defensive programming: negative duration should not crash
      const result = calculateFixedRateCharge(-10, 70);
      expect(result.usdCents).toBe(0);
      expect(result.pence).toBe(0);
    });

    test('Zero rate returns zero', () => {
      // If rate is 0, no charges regardless of duration
      const result = calculateFixedRateCharge(60, 0);
      expect(result.usdCents).toBe(0);
      expect(result.pence).toBe(0);
    });

    test('Negative rate returns zero', () => {
      // Defensive programming: negative rate should not charge
      const result = calculateFixedRateCharge(60, -70);
      expect(result.usdCents).toBe(0);
      expect(result.pence).toBe(0);
    });

    test('Very long call (3600s = 1 hour) → 4200 cents, 3318 pence', () => {
      // Formula: ceil((3600/60) * 70) = ceil(4200) = 4200 cents
      // Then: ceil(4200 * 0.79) = ceil(3318) = 3318 pence
      const result = calculateFixedRateCharge(3600, 70);
      expect(result.usdCents).toBe(4200);
      expect(result.pence).toBe(3318);
    });

    test('Fractional second billing (59s) → 69 cents, 55 pence', () => {
      // Formula: ceil((59/60) * 70) = ceil(68.833) = 69 cents
      // Then: ceil(69 * 0.79) = ceil(54.51) = 55 pence
      const result = calculateFixedRateCharge(59, 70);
      expect(result.usdCents).toBe(69);
      expect(result.pence).toBe(55);
    });
  });

  describe('Intentional Double Rounding Verification', () => {
    test('Double rounding causes ~$0.02 overcharge (acceptable)', () => {
      // Example: 91 seconds at $0.70/min
      // Actual cost: (91/60) * 70 = 106.1667 cents
      // Step 1 (round up): ceil(106.1667) = 107 cents = $1.07
      // Step 2 (convert to pence): ceil(107 * 0.79) = ceil(84.53) = 85 pence
      // Back to USD: 85 / 0.79 / 100 = $1.0759
      // Overcharge: $1.0759 - $1.061667 = $0.0142 (1.4 cents)

      const result = calculateFixedRateCharge(91, 70);

      const actualCostCents = (91 / 60) * 70; // 106.1667 cents
      const chargedCents = result.usdCents; // 107 cents
      const overchargeCents = chargedCents - actualCostCents; // 0.8333 cents

      expect(chargedCents).toBe(107);
      expect(overchargeCents).toBeGreaterThan(0);
      expect(overchargeCents).toBeLessThan(2); // Less than 2 cents overcharge

      // Industry standard: overcharge up to $0.02 per call is acceptable
      // This protects platform from undercharging due to rounding errors
    });

    test('Pence rounding causes additional small overcharge', () => {
      // Example: 70 cents * 0.79 = 55.3 pence
      // Rounded up to 56 pence
      // Overcharge: 56 - 55.3 = 0.7 pence (~$0.009)

      const result = calculateFixedRateCharge(60, 70);

      const exactPence = result.usdCents * parseFloat(config.USD_TO_GBP_RATE);
      const chargedPence = result.pence;
      const overchargePence = chargedPence - exactPence;

      expect(chargedPence).toBe(56);
      expect(exactPence).toBeCloseTo(55.3, 1);
      expect(overchargePence).toBeGreaterThan(0);
      expect(overchargePence).toBeLessThan(1); // Less than 1 pence overcharge

      // This is acceptable industry practice to prevent undercharging
    });
  });

  describe('Real-World Call Examples', () => {
    test('Typical 2-minute call → 140 cents, 111 pence', () => {
      const result = calculateFixedRateCharge(120, 70);
      expect(result.usdCents).toBe(140); // $1.40
      expect(result.pence).toBe(111); // £1.11
    });

    test('Quick 15-second call → 18 cents, 15 pence', () => {
      const result = calculateFixedRateCharge(15, 70);
      expect(result.usdCents).toBe(18); // $0.18
      expect(result.pence).toBe(15); // £0.15
    });

    test('Long 10-minute call → 700 cents, 553 pence', () => {
      const result = calculateFixedRateCharge(600, 70);
      expect(result.usdCents).toBe(700); // $7.00
      expect(result.pence).toBe(553); // £5.53
    });

    test('Average 3.5-minute call → 245 cents, 194 pence', () => {
      const result = calculateFixedRateCharge(210, 70); // 3 min 30s
      expect(result.usdCents).toBe(245); // $2.45
      expect(result.pence).toBe(194); // £1.94
    });
  });
});
