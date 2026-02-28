/**
 * UAT Wait/Polling Helpers
 *
 * Business-aware polling for async operations (balance updates, data refresh).
 */

import { Page } from '@playwright/test';

/**
 * Wait for page content matching a regex to appear.
 * Polls by reloading the page at intervals.
 */
export async function waitForContentAfterReload(
  page: Page,
  pattern: RegExp,
  options: { timeout?: number; pollInterval?: number } = {}
): Promise<string> {
  const { timeout = 30000, pollInterval = 3000 } = options;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const content = await page.textContent('body');
    if (content) {
      const match = content.match(pattern);
      if (match) return match[0];
    }
    await page.waitForTimeout(pollInterval);
    await page.reload({ waitUntil: 'networkidle' });
  }

  throw new Error(`Content matching ${pattern} did not appear within ${timeout}ms`);
}

/**
 * Wait for a locator to become visible, with periodic reload.
 */
export async function waitForElementAfterReload(
  page: Page,
  selector: string,
  options: { timeout?: number; pollInterval?: number } = {}
): Promise<void> {
  const { timeout = 30000, pollInterval = 3000 } = options;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }
    await page.waitForTimeout(pollInterval);
    await page.reload({ waitUntil: 'networkidle' });
  }

  throw new Error(`Element "${selector}" did not appear within ${timeout}ms`);
}

/**
 * Wait for navigation to settle (no more redirects for N ms).
 */
export async function waitForStableUrl(
  page: Page,
  stableMs: number = 2000
): Promise<string> {
  let lastUrl = page.url();
  let stableSince = Date.now();

  while (Date.now() - stableSince < stableMs) {
    await page.waitForTimeout(500);
    const currentUrl = page.url();
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      stableSince = Date.now();
    }
  }

  return lastUrl;
}
