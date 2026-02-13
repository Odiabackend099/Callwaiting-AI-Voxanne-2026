/**
 * Stripe Checkout Helper Utilities
 *
 * Provides utilities for interacting with Stripe Checkout forms
 * Handles the complexity of iframe interactions for PCI-compliant card input
 */

import { Page, expect, FrameLocator } from '@playwright/test';

/**
 * Test card numbers for different scenarios
 */
export const STRIPE_TEST_CARDS = {
  SUCCESS: '4242424242424242',
  DECLINED: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  EXPIRED: '4000000000000069',
  INCORRECT_CVC: '4000000000000127',
} as const;

/**
 * Fill the Stripe Checkout form with test card details
 *
 * This function handles the complexity of interacting with Stripe's
 * iframe-based card input fields (required for PCI compliance)
 *
 * @param page - Playwright page object
 * @param options - Optional card details override
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * test('Payment flow', async ({ page }) => {
 *   // Navigate to Stripe checkout
 *   await page.waitForURL(/checkout\.stripe\.com/);
 *
 *   // Fill form with test card
 *   await fillStripeCheckoutForm(page);
 *
 *   // Form is filled and ready to submit
 * });
 * ```
 */
export async function fillStripeCheckoutForm(
  page: Page,
  options: {
    cardNumber?: string;
    expiry?: string;
    cvc?: string;
    email?: string;
    postalCode?: string;
  } = {}
): Promise<void> {
  const {
    cardNumber = STRIPE_TEST_CARDS.SUCCESS,
    expiry = '12/34', // Future date in MM/YY format
    cvc = '123',
    email = 'test@demo.com',
    postalCode = '10001',
  } = options;

  // Wait for Stripe checkout to fully load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // Give Stripe time to initialize

  try {
    // Fill email if visible (sometimes pre-filled)
    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(email);
    }
  } catch (error) {
    // Email might be pre-filled or not required, continue
    console.log('Email input not found or already filled');
  }

  // CRITICAL: Stripe card fields are in iframes for PCI compliance
  // We need to interact with them differently than regular inputs

  // Strategy 1: Try to find the card element iframe
  try {
    // Wait for card element iframe to be present
    await page.waitForSelector('iframe[name^="__privateStripeFrame"]', {
      timeout: 10000,
      state: 'attached'
    });

    // Get the first iframe (card number)
    const cardFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();

    // Fill card number
    const cardInput = cardFrame.locator('input[name="cardnumber"], input[name="number"]');
    await cardInput.waitFor({ timeout: 5000 });
    await cardInput.fill(cardNumber);
    await page.waitForTimeout(500); // Let Stripe validate

    // Fill expiry
    const expiryInput = cardFrame.locator('input[name="exp-date"], input[name="expiry"]');
    await expiryInput.waitFor({ timeout: 5000 });
    await expiryInput.fill(expiry);
    await page.waitForTimeout(500);

    // Fill CVC
    const cvcInput = cardFrame.locator('input[name="cvc"], input[name="cvv"]');
    await cvcInput.waitFor({ timeout: 5000 });
    await cvcInput.fill(cvc);
    await page.waitForTimeout(500);

  } catch (iframeError) {
    console.error('Iframe strategy failed, trying alternative approach:', iframeError);

    // Strategy 2: Try direct input (Stripe Elements embedded mode)
    try {
      await page.fill('[data-testid="card-number"]', cardNumber);
      await page.fill('[data-testid="card-expiry"]', expiry);
      await page.fill('[data-testid="card-cvc"]', cvc);
    } catch (directError) {
      throw new Error(`Could not fill Stripe card form. Both iframe and direct strategies failed.
        Iframe error: ${iframeError}
        Direct error: ${directError}`);
    }
  }

  // Fill postal code (usually outside iframe)
  try {
    const postalInput = page.locator('input[name="billingPostalCode"], input[name="postal"], input[placeholder*="ZIP"]');
    if (await postalInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await postalInput.fill(postalCode);
    }
  } catch (error) {
    // Postal code might not be required, continue
    console.log('Postal code input not found or not required');
  }

  // Give Stripe time to validate all fields
  await page.waitForTimeout(1000);
}

/**
 * Submit the Stripe checkout form
 *
 * @param page - Playwright page object
 * @returns Promise<void>
 */
export async function submitStripeCheckout(page: Page): Promise<void> {
  // Find and click the submit button
  // Stripe uses different button texts: "Pay", "Subscribe", "Complete payment", etc.
  const submitButton = page.locator(
    'button[type="submit"]:has-text("Pay"), ' +
    'button[type="submit"]:has-text("Complete"), ' +
    'button[type="submit"]:has-text("Submit"), ' +
    'button[type="submit"]'
  ).first();

  await submitButton.waitFor({ timeout: 5000 });
  await submitButton.click();

  // Wait for processing (Stripe shows loading state)
  await page.waitForTimeout(2000);
}

/**
 * Complete the full Stripe checkout flow
 *
 * Combines filling the form and submitting in one function
 *
 * @param page - Playwright page object
 * @param options - Optional card details override
 * @returns Promise<void>
 */
export async function completeStripeCheckout(
  page: Page,
  options?: Parameters<typeof fillStripeCheckoutForm>[1]
): Promise<void> {
  await fillStripeCheckoutForm(page, options);
  await submitStripeCheckout(page);
}

/**
 * Wait for redirect back to app after successful payment
 *
 * @param page - Playwright page object
 * @param expectedUrl - Expected URL pattern after redirect (default: /dashboard)
 * @param timeout - Maximum wait time in ms (default: 20000)
 * @returns Promise<void>
 */
export async function waitForStripeRedirectBack(
  page: Page,
  expectedUrl: string | RegExp = /\/dashboard/,
  timeout: number = 20000
): Promise<void> {
  await page.waitForURL(expectedUrl, { timeout });
  await page.waitForLoadState('networkidle');
}

/**
 * Verify Stripe checkout page is loaded
 *
 * @param page - Playwright page object
 * @returns Promise<boolean>
 */
export async function isStripeCheckoutPage(page: Page): Promise<boolean> {
  const url = page.url();
  return url.includes('checkout.stripe.com');
}
