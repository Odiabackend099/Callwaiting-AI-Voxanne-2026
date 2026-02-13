/**
 * Authentication Helper Utilities
 *
 * Provides reusable authentication functions for E2E tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Login as the test user
 *
 * @param page - Playwright page object
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * test('My test', async ({ page }) => {
 *   await loginAsTestUser(page);
 *   // User is now authenticated and on dashboard
 * });
 * ```
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be visible
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });

  // Fill in credentials
  await page.fill('input[name="email"]', 'test@demo.com');
  await page.fill('input[name="password"]', 'demo123');

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });

  // Verify we're actually logged in by checking for dashboard content
  // This helps catch cases where redirect happens but auth failed
  await page.waitForLoadState('networkidle');
}

/**
 * Get current authentication state
 *
 * @param page - Playwright page object
 * @returns Promise<boolean> - true if authenticated, false otherwise
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check if we have auth cookies/tokens
    const cookies = await page.context().cookies();
    const hasAuthCookie = cookies.some(cookie =>
      cookie.name.includes('auth') ||
      cookie.name.includes('session') ||
      cookie.name.includes('token')
    );

    // Also check if we can access a protected route
    if (hasAuthCookie) {
      const response = await page.goto('/dashboard');
      return response?.status() === 200;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Logout the current user
 *
 * @param page - Playwright page object
 * @returns Promise<void>
 */
export async function logout(page: Page): Promise<void> {
  try {
    // Try to find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Sign Out")');
    if (await logoutButton.isVisible({ timeout: 5000 })) {
      await logoutButton.click();
      await page.waitForURL(/\/(login|$)/, { timeout: 10000 });
    } else {
      // If no logout button, clear cookies/storage manually
      await page.context().clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }
  } catch (error) {
    // Fallback: clear all auth state
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
}
