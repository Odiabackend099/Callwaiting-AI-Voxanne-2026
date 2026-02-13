/**
 * Stripe Billing E2E Test
 *
 * Tests the complete billing flow:
 * 1. User authentication
 * 2. Navigate to wallet
 * 3. Initiate top-up
 * 4. Complete Stripe checkout
 * 5. Verify balance increase
 *
 * PREREQUISITES:
 * - Backend server running on localhost:3001
 * - Frontend server running on localhost:3000
 * - Stripe CLI webhook listener: `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
 * - Test user exists: test@demo.com / demo123
 * - Stripe test mode enabled
 *
 * RUN COMMAND:
 * npx playwright test e2e/billing.spec.ts --headed --project=chromium
 */

import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth-helpers';
import { completeStripeCheckout, waitForStripeRedirectBack } from './utils/stripe-helpers';
import {
  navigateToWallet,
  getWalletBalance,
  initiateTopUp,
  waitForBalanceUpdate,
  verifyWalletPageLoaded,
} from './utils/wallet-helpers';

test.describe('Stripe Billing Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for E2E tests (includes Stripe redirect)
    test.setTimeout(90000); // 90 seconds

    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });

    // Log page errors
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });
  });

  test('User can top up wallet and verify balance increase', async ({ page }) => {
    // ============================================================================
    // STEP 1: AUTHENTICATION
    // ============================================================================
    console.log('Step 1: Authenticating as test user...');
    await loginAsTestUser(page);
    console.log('✅ Authenticated successfully');

    // ============================================================================
    // STEP 2: NAVIGATE TO WALLET
    // ============================================================================
    console.log('Step 2: Navigating to wallet...');
    await navigateToWallet(page);
    await verifyWalletPageLoaded(page);
    console.log('✅ Wallet page loaded');

    // ============================================================================
    // STEP 3: CAPTURE INITIAL BALANCE
    // ============================================================================
    console.log('Step 3: Capturing initial balance...');
    const initialBalance = await getWalletBalance(page);
    console.log(`Initial balance: $${initialBalance.toFixed(2)}`);

    // ============================================================================
    // STEP 4: INITIATE TOP-UP
    // ============================================================================
    console.log('Step 4: Initiating $10.00 top-up...');
    const topUpAmountCents = 1000; // $10.00
    const topUpAmountDollars = topUpAmountCents / 100;

    await initiateTopUp(page, topUpAmountCents);
    console.log('✅ Top-up initiated');

    // ============================================================================
    // STEP 5: WAIT FOR STRIPE REDIRECT
    // ============================================================================
    console.log('Step 5: Waiting for Stripe checkout redirect...');
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20000 });
    console.log('✅ Redirected to Stripe');

    // Take a screenshot for debugging (optional)
    await page.screenshot({ path: 'test-results/stripe-checkout-before.png' });

    // ============================================================================
    // STEP 6: COMPLETE STRIPE CHECKOUT
    // ============================================================================
    console.log('Step 6: Filling Stripe checkout form...');
    await completeStripeCheckout(page);
    console.log('✅ Stripe form filled and submitted');

    // ============================================================================
    // STEP 7: WAIT FOR REDIRECT BACK TO APP
    // ============================================================================
    console.log('Step 7: Waiting for redirect back to app...');
    await waitForStripeRedirectBack(page);
    console.log('✅ Redirected back to dashboard');

    // ============================================================================
    // STEP 8: VERIFY BALANCE INCREASED
    // ============================================================================
    console.log('Step 8: Verifying balance increased...');
    const expectedBalance = initialBalance + topUpAmountDollars;

    console.log(`Waiting for balance to update from $${initialBalance.toFixed(2)} to $${expectedBalance.toFixed(2)}...`);
    console.log('⏳ This may take up to 15 seconds (webhook processing time)');

    await waitForBalanceUpdate(page, expectedBalance, {
      timeout: 20000,
      pollInterval: 2000,
    });

    // Verify final balance
    const finalBalance = await getWalletBalance(page);
    console.log(`✅ Balance updated successfully: $${finalBalance.toFixed(2)}`);

    // Assert balance increased by expected amount
    expect(finalBalance).toBeGreaterThanOrEqual(expectedBalance - 0.01); // Allow 1 cent tolerance

    // Take final screenshot
    await page.screenshot({ path: 'test-results/billing-final-state.png' });

    console.log('🎉 Test completed successfully!');
  });

  test('Wallet page displays current balance', async ({ page }) => {
    // Simple test to verify wallet page basics
    console.log('Testing wallet page display...');

    await loginAsTestUser(page);
    await navigateToWallet(page);
    await verifyWalletPageLoaded(page);

    const balance = await getWalletBalance(page);
    expect(typeof balance).toBe('number');
    expect(balance).toBeGreaterThanOrEqual(0);

    console.log(`✅ Wallet displays balance: $${balance.toFixed(2)}`);
  });

  test('Add Funds button is visible and clickable', async ({ page }) => {
    // Test that the UI elements are present
    console.log('Testing Add Funds button...');

    await loginAsTestUser(page);
    await navigateToWallet(page);

    // Find the Add Funds button
    const addFundsButton = page.locator(
      'button[data-amount], ' +
      'button:has-text("Add Funds"), ' +
      'button:has-text("Top Up")'
    ).first();

    await expect(addFundsButton).toBeVisible({ timeout: 10000 });
    await expect(addFundsButton).toBeEnabled();

    console.log('✅ Add Funds button is visible and enabled');
  });
});

/**
 * TROUBLESHOOTING GUIDE
 *
 * If test fails, check these common issues:
 *
 * 1. "Timeout waiting for Stripe redirect"
 *    - Check STRIPE_SECRET_KEY in backend/.env
 *    - Verify backend is running: curl http://localhost:3001/health
 *    - Check backend logs for Stripe API errors
 *
 * 2. "Balance didn't update"
 *    - Verify 'stripe listen' is running in Terminal 2
 *    - Check Stripe CLI output for webhook events
 *    - Check backend logs for webhook processing errors
 *    - Verify webhook signature secret matches: STRIPE_WEBHOOK_SECRET
 *
 * 3. "Cannot find iframe" or "Cannot fill Stripe form"
 *    - Stripe may have changed their DOM structure
 *    - Run test with --headed flag to visually inspect
 *    - Update iframe selectors in stripe-helpers.ts
 *
 * 4. "Test user doesn't exist"
 *    - Create user manually via signup flow
 *    - Or add seed script to create test users
 *
 * 5. "Payment declined"
 *    - Verify using correct test card: 4242 4242 4242 4242
 *    - Check Stripe account is in test mode
 *    - Verify STRIPE_SECRET_KEY starts with 'sk_test_'
 *
 * DEBUG COMMANDS:
 *
 * Run with browser visible:
 * npx playwright test e2e/billing.spec.ts --headed
 *
 * Run with debug mode (step through):
 * npx playwright test e2e/billing.spec.ts --debug
 *
 * Run specific test:
 * npx playwright test e2e/billing.spec.ts -g "top up wallet"
 *
 * View test report:
 * npx playwright show-report
 */
