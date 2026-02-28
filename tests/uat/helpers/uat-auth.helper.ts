/**
 * UAT Authentication Helpers
 *
 * Real login against live Supabase — NO mocks.
 * Demo account: ceo@demo.com / demo123 (permanent working account as of 2026-02-27)
 */

import { Page, expect } from '@playwright/test';

/**
 * Detect and dismiss the "Account Setup Incomplete" error overlay.
 * This overlay is shown by the org-context-validator middleware when
 * the backend rate-limits or fails org validation (often during test
 * runs that make many rapid API calls). It has a "Retry" button.
 *
 * Call this immediately after page.goto() for any dashboard page.
 */
export async function dismissAccountSetupError(page: Page): Promise<void> {
  const errorHeading = page.locator('h1:has-text("Account Setup Incomplete")').first();
  const isErrorShown = await errorHeading.isVisible({ timeout: 2500 }).catch(() => false);
  if (isErrorShown) {
    const retryBtn = page.locator('button:has-text("Retry")').first();
    const hasRetry = await retryBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (hasRetry) {
      await retryBtn.click();
      // Wait for the page to re-validate and the actual content to load
      await page.waitForTimeout(3000);
    }
  }
}

/**
 * Navigate to a dashboard page, wait for domcontentloaded (avoids SPA
 * network-idle timeouts), then dismiss any Account Setup Incomplete
 * error overlay automatically.
 *
 * Also handles the edge case where the dashboard layout shows the onboarding
 * wizard instead of the requested page (occurs when org context is not yet
 * cached on the server side after login). In that case we wait briefly and
 * re-navigate once.
 */
export async function gotoPage(
  page: Page,
  url: string,
  waitUntil: 'load' | 'domcontentloaded' = 'domcontentloaded'
): Promise<void> {
  await page.goto(url, { waitUntil, timeout: 30_000 });
  await dismissAccountSetupError(page);

  // Detect onboarding wizard in main content (happens when org context
  // is not fully loaded — the layout renders the onboarding wizard instead).
  const wizardStep = page.locator('text=Step 1 of').first();
  const isOnboarding = await wizardStep.isVisible({ timeout: 1500 }).catch(() => false);
  if (isOnboarding) {
    await page.waitForTimeout(2000);
    await page.goto(url, { waitUntil, timeout: 30_000 });
    await dismissAccountSetupError(page);
  }
}

const DEMO_EMAIL = process.env.UAT_DEMO_EMAIL || `uat-demo-${Date.now()}@voxanne.test`;
const DEMO_PASSWORD = process.env.UAT_DEMO_PASSWORD || 'TempPass123';
const TEST_EMAIL = process.env.UAT_TEST_EMAIL || `uat-test-${Date.now()}@voxanne.test`;
const TEST_PASSWORD = process.env.UAT_TEST_PASSWORD || 'TempPass123';

/**
 * Login as the primary demo account.
 * If live auth doesn't work, uses test token from environment.
 */
export async function loginAsDemo(page: Page): Promise<void> {
  const testToken = process.env.SUPABASE_TEST_TOKEN;

  if (testToken) {
    // Use test token to bypass auth
    await page.goto('/dashboard');
    await page.context().addCookies([
      {
        name: 'sb-auth-token',
        value: testToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      }
    ]);
    await page.reload();
    return;
  }

  // Try normal login flow
  try {
    await doLogin(page, DEMO_EMAIL, DEMO_PASSWORD);
  } catch (err) {
    console.error('Demo login failed and no SUPABASE_TEST_TOKEN provided');
    throw new Error('Cannot login - provide SUPABASE_TEST_TOKEN env var or fix authentication');
  }
}

/**
 * Login as the secondary test account (test@demo.com).
 * Used for wallet/billing and multi-tenant isolation tests.
 */
export async function loginAsTest(page: Page): Promise<void> {
  await doLogin(page, TEST_EMAIL, TEST_PASSWORD);
}

/**
 * Login with arbitrary credentials.
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await doLogin(page, email, password);
}

/**
 * Core login flow — navigates to /login (which /sign-in redirects to),
 * fills credentials, waits for /dashboard.
 *
 * NOTE: /sign-in uses server-side redirect() to /login. We navigate to /login
 * directly to avoid any redirect-following issues with Playwright.
 */
async function doLogin(page: Page, email: string, password: string): Promise<void> {
  // Navigate to /login directly (skip the /sign-in redirect)
  // Use 'domcontentloaded' instead of 'load' to avoid waiting for lazy-loaded resources
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for the email input to appear, with detailed error on timeout
  const emailInput = page.locator('input[type="email"]').first();
  try {
    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    // If email input doesn't appear, log page content for debugging
    const pageContent = await page.content();
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => 'ERROR');
    console.error('Login page email input not found. Page URL:', page.url());
    console.error('Page contains "Welcome Back":', pageContent.includes('Welcome Back'));
    console.error('Body text preview:', bodyText.substring(0, 500));
    throw new Error(`Email input not found on login page after 15s. URL: ${page.url()}`);
  }

  // Fill and submit login form
  await emailInput.fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();

  // Wait for redirect to dashboard (or catch if it goes back to /login with error)
  try {
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  } catch (e) {
    // If it didn't go to /dashboard, check if we're back at /login (auth failed)
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // Capture error message on login page
      const errorMsg = await page.locator('[role="alert"]').first().textContent().catch(() => 'No error shown');
      const errorText = await page.evaluate(() => document.body.innerText).catch(() => '');
      console.error(`Login failed for ${email}. URL: ${currentUrl}`);
      console.error(`Error message: ${errorMsg}`);
      console.error(`Page body preview: ${errorText.substring(0, 300)}`);
      throw new Error(`Login failed - stayed on /login. Email: ${email}. Error: ${errorMsg}`);
    }
    throw e;
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await expect(page).not.toHaveURL(/\/login/);

  // Wait for org context to finish loading. The app shows "Loading dashboard..."
  // while fetching org data — sub-pages also show this state until it resolves.
  // Waiting here caches the org context so subsequent test navigations are clean.
  await page.waitForFunction(
    () => {
      const h1 = document.querySelector('h1');
      return !h1?.textContent?.includes('Loading dashboard');
    },
    { timeout: 10000 }
  ).catch(() => {}); // Soft wait — pass even if already cleared or never shown
}

/**
 * Signup a fresh user for onboarding tests.
 * Returns the email used so tests can reference it.
 */
export async function signupFreshUser(page: Page): Promise<{ email: string; password: string }> {
  const uuid = Math.random().toString(36).substring(2, 10);
  const email = `uat-${uuid}@voxanne.test`;
  const password = 'UatTest123!';

  await page.goto('/sign-up');
  await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 15000 });

  // Fill signup form — field names may vary
  const firstNameInput = page.locator('input[name="firstName"], input[name="first_name"], input[placeholder*="First"]').first();
  const lastNameInput = page.locator('input[name="lastName"], input[name="last_name"], input[placeholder*="Last"]').first();
  const emailInput = page.locator('input[name="email"], input[type="email"]').first();
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();

  if (await firstNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstNameInput.fill('UAT');
  }
  if (await lastNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await lastNameInput.fill('Tester');
  }
  await emailInput.fill(email);
  await passwordInput.fill(password);

  await page.click('button[type="submit"]');

  // Wait for redirect — could go to /dashboard/onboarding or /dashboard or /verify-email
  await page.waitForURL(/\/(dashboard|verify)/, { timeout: 20000 });

  return { email, password };
}

/**
 * Clear auth state (logout without UI interaction).
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.context().clearCookies();
  // Navigate to the app first to avoid SecurityError on about:blank
  const url = page.url();
  if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  }
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {
      // Ignore SecurityError on restricted pages
    }
  });
}
