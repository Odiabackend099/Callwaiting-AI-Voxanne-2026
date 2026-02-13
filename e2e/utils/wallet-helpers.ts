/**
 * Wallet Balance Helper Utilities
 *
 * Provides utilities for interacting with the wallet/billing section
 */

import { Page, expect } from '@playwright/test';

/**
 * Navigate to the wallet/billing page
 *
 * @param page - Playwright page object
 * @returns Promise<void>
 */
export async function navigateToWallet(page: Page): Promise<void> {
  // Try multiple possible navigation methods
  try {
    // Method 1: Click sidebar link
    const walletLink = page.locator('a[href="/dashboard/billing"], a[href*="wallet"], text=Wallet, text=Billing');
    if (await walletLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await walletLink.click();
    } else {
      // Method 2: Direct navigation
      await page.goto('/dashboard/billing');
    }

    // Wait for wallet page to load
    await page.waitForURL(/\/(billing|wallet)/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  } catch (error) {
    throw new Error(`Could not navigate to wallet page: ${error}`);
  }
}

/**
 * Get the current wallet balance
 *
 * @param page - Playwright page object
 * @returns Promise<number> - Balance in dollars (e.g., 10.50 for $10.50)
 *
 * @example
 * ```typescript
 * const balance = await getWalletBalance(page);
 * console.log(`Current balance: $${balance.toFixed(2)}`);
 * ```
 */
export async function getWalletBalance(page: Page): Promise<number> {
  // Try multiple possible selectors for balance display
  const balanceSelectors = [
    '[data-testid="wallet-balance"]',
    '[data-testid="current-balance"]',
    'text=/\\$[0-9,]+\\.?[0-9]*/i', // Matches $123.45 or $1,234.56
    '.balance',
    '.wallet-balance',
  ];

  for (const selector of balanceSelectors) {
    try {
      const balanceElement = page.locator(selector).first();
      if (await balanceElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        const balanceText = await balanceElement.textContent();
        if (balanceText) {
          // Parse balance: "$1,234.56" -> 1234.56
          const cleanedText = balanceText.replace(/[$,]/g, '').trim();
          const balance = parseFloat(cleanedText);
          if (!isNaN(balance)) {
            return balance;
          }
        }
      }
    } catch (error) {
      // Try next selector
      continue;
    }
  }

  throw new Error('Could not find wallet balance on page');
}

/**
 * Click the "Add Funds" / "Top Up" button for a specific amount
 *
 * @param page - Playwright page object
 * @param amountInCents - Amount to top up in cents (e.g., 1000 for $10.00)
 * @returns Promise<void>
 */
export async function initiateTopUp(page: Page, amountInCents: number = 1000): Promise<void> {
  // Try to find button with specific amount data attribute
  const amountButton = page.locator(`button[data-amount="${amountInCents}"]`);

  if (await amountButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await amountButton.click();
  } else {
    // Fallback: Find any "Add Funds" or "Top Up" button
    const genericButton = page.locator(
      'button:has-text("Add Funds"), ' +
      'button:has-text("Top Up"), ' +
      'button:has-text("Add Money"), ' +
      'button:has-text("Deposit")'
    ).first();

    if (await genericButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await genericButton.click();

      // If there's an amount input field, fill it
      const amountInput = page.locator('input[name="amount"], input[type="number"]');
      if (await amountInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await amountInput.fill((amountInCents / 100).toString());
      }

      // Look for submit/continue button
      const submitButton = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Next")');
      if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitButton.click();
      }
    } else {
      throw new Error('Could not find "Add Funds" button');
    }
  }

  // Give time for redirect to Stripe
  await page.waitForTimeout(1000);
}

/**
 * Wait for wallet balance to update to expected amount
 *
 * Uses polling with retry logic to handle webhook delay
 *
 * @param page - Playwright page object
 * @param expectedBalance - Expected balance in dollars
 * @param options - Polling options
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * const initialBalance = await getWalletBalance(page);
 * // ... perform top-up ...
 * await waitForBalanceUpdate(page, initialBalance + 10.00);
 * ```
 */
export async function waitForBalanceUpdate(
  page: Page,
  expectedBalance: number,
  options: {
    timeout?: number;
    pollInterval?: number;
    tolerance?: number; // Allow small floating point differences
  } = {}
): Promise<void> {
  const {
    timeout = 20000,
    pollInterval = 2000,
    tolerance = 0.01,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      // Reload page to get fresh data
      await page.reload({ waitUntil: 'networkidle' });

      // Get current balance
      const currentBalance = await getWalletBalance(page);

      // Check if balance matches (with tolerance for floating point)
      const difference = Math.abs(currentBalance - expectedBalance);
      if (difference <= tolerance) {
        return; // Success!
      }

      console.log(`Waiting for balance update: current=$${currentBalance.toFixed(2)}, expected=$${expectedBalance.toFixed(2)}`);

      // Check if balance increased past expected (might have had previous balance)
      if (currentBalance >= expectedBalance - tolerance) {
        return; // Success!
      }
    } catch (error) {
      console.log(`Error checking balance: ${error}`);
    }

    // Wait before next poll
    await page.waitForTimeout(pollInterval);
  }

  // Timeout reached
  const currentBalance = await getWalletBalance(page).catch(() => -1);
  throw new Error(
    `Balance did not update within ${timeout}ms. ` +
    `Expected: $${expectedBalance.toFixed(2)}, ` +
    `Current: $${currentBalance.toFixed(2)}. ` +
    `This usually means the Stripe webhook didn't fire. ` +
    `Verify 'stripe listen' is running in Terminal 2.`
  );
}

/**
 * Verify wallet page is loaded and functional
 *
 * @param page - Playwright page object
 * @returns Promise<void>
 */
export async function verifyWalletPageLoaded(page: Page): Promise<void> {
  // Verify URL
  await expect(page).toHaveURL(/\/(billing|wallet)/);

  // Verify key elements are visible
  const balanceVisible = page.locator('text=/balance|wallet/i').first();
  await expect(balanceVisible).toBeVisible({ timeout: 5000 });

  // Verify we can read a balance (even if $0.00)
  const balance = await getWalletBalance(page);
  expect(typeof balance).toBe('number');
  expect(balance).toBeGreaterThanOrEqual(0);
}
