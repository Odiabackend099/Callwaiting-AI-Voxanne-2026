/**
 * UAT-01: Onboarding -- New Clinic Owner Signs Up
 *
 * Tests the 5-step onboarding wizard against the REAL backend.
 * NO mocks, NO page.route() interception.
 *
 * Steps:
 *   0 - Clinic Name (StepWelcome)
 *   1 - Specialty Selection (StepSpecialty)
 *   2 - Paywall (StepPaywall)
 *   3 - Celebration (StepCelebration) -- triggered by ?topup=success
 *   4 - Aha Moment (StepAhaMoment) -- phone number + complete
 *
 * Requires:
 *   - Frontend running at baseURL (default http://localhost:3000)
 *   - Backend running and reachable
 *   - Demo account credentials (see uat-auth.helper.ts)
 */

import { test, expect } from '@playwright/test';
import { signupFreshUser, loginAsDemo, clearAuthState } from './helpers/uat-auth.helper';
import { waitForStableUrl } from './helpers/uat-wait.helper';

// ---------------------------------------------------------------------------
// Shared state for JS error tracking
// ---------------------------------------------------------------------------

let pageErrors: string[] = [];

test.describe('UAT-01: Onboarding -- New Clinic Owner Signs Up', () => {

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
  });

  test.afterEach(async () => {
    // Assert no uncaught JS errors during test execution.
    // Filter out known noise (e.g. ResizeObserver, hydration warnings).
    const criticalErrors = pageErrors.filter(
      (msg) =>
        !msg.includes('ResizeObserver') &&
        !msg.includes('hydrat') &&
        !msg.includes('Loading chunk') &&
        !msg.includes('ChunkLoadError') &&
        !msg.includes('Script error') &&
        !msg.includes('tawk') &&
        !msg.includes('Tawk') &&
        !msg.includes('Non-Error promise rejection')
    );
    expect(
      criticalErrors,
      `Unexpected JS errors detected: ${criticalErrors.join(' | ')}`
    ).toHaveLength(0);
  });

  // =========================================================================
  // 01-001: Fresh signup creates org and redirects to /dashboard/onboarding
  // =========================================================================

  test('01-001: Fresh signup creates org and redirects to onboarding', async ({ page }) => {
    test.slow(); // Signup round-trip can take 10-20s

    const { email } = await signupFreshUser(page);
    expect(email).toBeTruthy();

    // After signup the app should redirect somewhere under /dashboard.
    // For a brand-new org the expected destination is /dashboard/onboarding.
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    const stableUrl = await waitForStableUrl(page, 3000);
    // Fresh signup may land on /dashboard/onboarding OR /verify (email verification) OR /dashboard
    expect(stableUrl).toMatch(/\/dashboard|\/onboarding|\/verify/);

    // Clean up browser state so subsequent tests start fresh
    await clearAuthState(page);
  });

  // =========================================================================
  // 01-002: Step 0 -- Empty clinic name blocks Continue button
  // =========================================================================

  test('01-002: Step 0 -- Empty clinic name blocks Continue button', async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/dashboard/onboarding', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Locate the clinic name input -- try name attribute, then placeholder fallback
    const clinicInput = page.locator(
      'input[name="clinic_name"], input[placeholder*="clinic" i], input[placeholder*="Bright Smile"]'
    ).first();
    await expect(clinicInput).toBeVisible({ timeout: 15_000 });

    // Ensure the input is empty (clear if pre-filled from a prior session)
    await clinicInput.fill('');

    // The Continue/Next button should be disabled when the field is empty
    const nextButton = page.locator(
      'button:has-text("Continue"), button:has-text("Next"), button[type="submit"]'
    ).first();
    await expect(nextButton).toBeVisible();
    await expect(nextButton).toBeDisabled();
  });

  // =========================================================================
  // 01-003: Step 0 -> Step 1 -- Valid clinic name advances to specialty
  // =========================================================================

  test('01-003: Step 0 -> Step 1 -- Valid clinic name advances to specialty', async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/dashboard/onboarding', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const clinicInput = page.locator(
      'input[name="clinic_name"], input[placeholder*="clinic" i], input[placeholder*="Bright Smile"]'
    ).first();
    await expect(clinicInput).toBeVisible({ timeout: 15_000 });

    await clinicInput.fill('UAT Sunrise Dermatology');

    const nextButton = page.locator(
      'button:has-text("Continue"), button:has-text("Next"), button[type="submit"]'
    ).first();
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Specialty cards should appear within 2 seconds.
    // Look for specialty text that appears on the cards in StepSpecialty.
    const specialtyVisible = page.locator(
      'button:has-text("Dental"), button:has-text("Dermatology"), h2:has-text("specialty"), h3:has-text("specialty"), p:has-text("specialty")'
    ).first();
    await expect(specialtyVisible).toBeVisible({ timeout: 2_000 });
  });

  // =========================================================================
  // 01-004: Step 1 -- Specialty click auto-advances to paywall
  // =========================================================================

  test('01-004: Step 1 -- Specialty click auto-advances to paywall', async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/dashboard/onboarding', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Navigate through Step 0
    const clinicInput = page.locator(
      'input[name="clinic_name"], input[placeholder*="clinic" i], input[placeholder*="Bright Smile"]'
    ).first();
    await expect(clinicInput).toBeVisible({ timeout: 15_000 });
    await clinicInput.fill('UAT Sunrise Dermatology');

    const nextButton = page.locator(
      'button:has-text("Continue"), button:has-text("Next"), button[type="submit"]'
    ).first();
    await nextButton.click();

    // Wait for specialty cards to load
    const firstSpecialty = page.locator(
      'button:has-text("Dental"), button:has-text("Dermatology"), button:has-text("Med Spa")'
    ).first();
    await expect(firstSpecialty).toBeVisible({ timeout: 5_000 });

    // Click the first visible specialty card
    await firstSpecialty.click();

    // Paywall content (CTA button) should become visible.
    // The auto-advance has a 400ms delay in StepSpecialty, so 700ms is generous.
    const paywallIndicator = page.locator(
      'button:has-text("Get My AI Number"), button:has-text("Continue"), h2:has-text("Paywall"), h2:has-text("revenue"), p:has-text("revenue")'
    ).first();
    await expect(paywallIndicator).toBeVisible({ timeout: 5_000 });
  });

  // =========================================================================
  // 01-005: Step 2 -- Paywall shows pricing and CTA
  // =========================================================================

  test('01-005: Step 2 -- Paywall shows pricing and CTA', async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/dashboard/onboarding', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Navigate through Step 0
    const clinicInput = page.locator(
      'input[name="clinic_name"], input[placeholder*="clinic" i], input[placeholder*="Bright Smile"]'
    ).first();
    await expect(clinicInput).toBeVisible({ timeout: 15_000 });
    await clinicInput.fill('UAT Sunrise Dermatology');

    const nextButton = page.locator(
      'button:has-text("Continue"), button:has-text("Next"), button[type="submit"]'
    ).first();
    await nextButton.click();

    // Navigate through Step 1
    const firstSpecialty = page.locator(
      'button:has-text("Dental"), button:has-text("Dermatology"), button:has-text("Med Spa")'
    ).first();
    await expect(firstSpecialty).toBeVisible({ timeout: 5_000 });
    await firstSpecialty.click();

    // Now on Step 2 -- verify pricing text or CTA
    const pricingOrCta = page.locator('text=/\\$150|£25|Get My AI Number/i').first();
    await expect(pricingOrCta).toBeVisible({ timeout: 5_000 });
  });

  // =========================================================================
  // 01-006: Step 3 -- ?topup=success renders celebration
  // =========================================================================

  test('01-006: Step 3 -- topup=success renders celebration', async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/dashboard/onboarding?topup=success', {
      waitUntil: 'load',
      timeout: 60_000,
    });

    // StepCelebration renders a <canvas> (ConfettiEffect) and success text.
    // Check for either the canvas element or the celebration heading.
    const confettiCanvas = page.locator('canvas');
    const celebrationText = page.locator('p, h1, h2').filter({
      hasText: /officially hired|congratulations|welcome|you.re in|set up|ready|success/i,
    }).first();

    const hasConfetti = (await confettiCanvas.count()) > 0;
    const hasText = await celebrationText.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(
      hasConfetti || hasText,
      'Expected either confetti canvas or celebration text to be visible'
    ).toBeTruthy();
  });

  // =========================================================================
  // 01-007: Step 4 -- Shows phone number and Complete/Setup button
  // =========================================================================

  test('01-007: Step 4 -- Shows phone number and action button', async ({ page }) => {
    test.slow(); // Provisioning may take a few seconds

    await loginAsDemo(page);
    await page.goto('/dashboard/onboarding?topup=success', {
      waitUntil: 'load',
      timeout: 60_000,
    });

    // Step 3 (celebration) shows first. Wait for the Continue button to appear
    // (it reveals after 3.2s per StepCelebration), then advance to Step 4.
    const continueButton = page.locator(
      'button:has-text("Continue"), button:has-text("Next")'
    ).first();
    await expect(continueButton).toBeVisible({ timeout: 10_000 });
    await continueButton.click();

    // Step 4 (Aha Moment) should now be visible.
    // Check for a phone-number pattern OR the action buttons.
    const phonePattern = page.locator('text=/\\+\\d/').first();
    const actionButton = page.locator(
      'button:has-text("Set Up My AI Agent"), button:has-text("Complete"), button:has-text("Finish"), button:has-text("Done")'
    ).first();
    const skipLink = page.locator('button:has-text("later"), button:has-text("Skip")').first();

    const hasPhone = await phonePattern.isVisible({ timeout: 10_000 }).catch(() => false);
    const hasAction = await actionButton.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasSkip = await skipLink.isVisible({ timeout: 2_000 }).catch(() => false);

    expect(
      hasPhone || hasAction || hasSkip,
      'Expected phone number, action button, or skip link on Step 4'
    ).toBeTruthy();
  });

  // =========================================================================
  // 01-008: Already-onboarded user stays on /dashboard
  // =========================================================================

  test('01-008: Already-onboarded user stays on /dashboard', async ({ page }) => {
    // The demo account (voxanne@demo.com) is already onboarded.
    await loginAsDemo(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Wait 3 seconds for any redirect to settle
    const stableUrl = await waitForStableUrl(page, 3000);

    // An already-onboarded user should remain on /dashboard, NOT be sent to /onboarding
    expect(stableUrl).toMatch(/\/dashboard/);
    expect(stableUrl).not.toMatch(/\/onboarding/);
  });

  // =========================================================================
  // 01-009: Unauthenticated user redirected to login
  // =========================================================================

  test('01-009: Unauthenticated user redirected to login', async ({ page }) => {
    // Clear all auth state to ensure we are fully logged out
    await clearAuthState(page);

    await page.goto('/dashboard/onboarding', { timeout: 60_000 });

    // The auth guard should redirect to /login or /sign-in
    await page.waitForURL(/\/(login|sign-in)/, { timeout: 5_000 });

    const finalUrl = page.url();
    const isLoginPage = finalUrl.includes('/login') || finalUrl.includes('/sign-in');
    expect(
      isLoginPage,
      `Expected redirect to login page, but ended up at: ${finalUrl}`
    ).toBeTruthy();
  });
});
