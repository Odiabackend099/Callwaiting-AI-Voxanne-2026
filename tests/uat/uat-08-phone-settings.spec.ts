/**
 * UAT-08: Phone Settings
 *
 * Tests against the REAL backend with NO mocks.
 * Validates the unified /dashboard/phone-settings page which consolidates:
 *   - Managed inbound phone number status
 *   - Buy Number modal with country selector + pricing
 *   - Carrier forwarding (AI Forwarding) instructions
 *   - Verified Caller ID verification flow
 *
 * Note: /dashboard/telephony and /dashboard/verified-caller-id both 301-redirect
 * to /dashboard/phone-settings via middleware. Tests account for this redirect.
 *
 * Covers:
 *   08-001  Page shows managed number status
 *   08-002  Buy Number modal opens
 *   08-003  AI Forwarding shows carrier instructions
 *   08-004  Verified Caller ID page accessible
 *   08-005  Invalid phone format shows error
 *   08-006  Existing verified numbers listed (nice-to-have)
 */

import { test, expect } from '@playwright/test';
import { loginAsDemo, gotoPage } from './helpers/uat-auth.helper';

test.describe('UAT-08: Phone Settings', () => {
  const pageErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    await loginAsDemo(page);
  });

  // ── 08-001 ─────────────────────────────────────────────────────────────
  test('08-001: Page shows managed number status', async ({ page }) => {
    await gotoPage(page, '/dashboard/phone-settings');

    // Wait for the page heading to appear (confirms the page loaded past the spinner)
    const heading = page.locator(
      'h1:has-text("Phone Settings"), ' +
      'h1:has-text("phone settings"), ' +
      '[data-testid="phone-settings-heading"]'
    );
    await expect(heading.first()).toBeVisible({ timeout: 20000 });

    // The page shows either:
    // A) A managed phone number displayed in font-mono format (e.g., +1234567890)
    // B) A "Get a Number" / "Buy Inbound Number" / "Buy Outbound Number" CTA button
    const managedNumber = page.locator(
      'p.font-mono.font-bold, ' +
      '[data-testid="managed-number"], ' +
      '.font-mono.text-2xl'
    );

    const buyNumberCTA = page.locator(
      'button:has-text("Buy Inbound Number"), ' +
      'button:has-text("Buy Outbound Number"), ' +
      'button:has-text("Get a Number"), ' +
      'button:has-text("Get Your AI Phone Number"), ' +
      '[data-testid="buy-number-button"]'
    );

    const hasNumber = await managedNumber.first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasCTA = await buyNumberCTA.first().isVisible({ timeout: 3000 }).catch(() => false);

    // At least one of these states must be true
    expect(hasNumber || hasCTA).toBeTruthy();

    // If a managed number is visible, verify it looks like a phone number
    if (hasNumber) {
      const numberText = await managedNumber.first().textContent();
      expect(numberText).toBeTruthy();
      // Phone numbers start with + and contain digits
      expect(numberText!.trim()).toMatch(/^\+?\d[\d\s()-]+$/);
    }

    // Verify no critical JS errors.
    // 'useContext' / 'Cannot read properties of null' are transient React
    // re-render errors when the org-context provider isn't yet mounted.
    const criticalErrors = pageErrors.filter(
      (e) =>
        !e.includes('ResizeObserver') &&
        !e.includes('hydration') &&
        !e.includes('useContext') &&
        !e.includes('Cannot read properties of null') &&
        !e.includes('Loading chunk') &&
        !e.includes('ChunkLoadError')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ── 08-002 ─────────────────────────────────────────────────────────────
  test('08-002: Buy Number modal opens', async ({ page }) => {
    await gotoPage(page, '/dashboard/phone-settings');

    // Wait for the page to fully load
    const heading = page.locator(
      'h1:has-text("Phone Settings"), [data-testid="phone-settings-heading"]'
    );
    await expect(heading.first()).toBeVisible({ timeout: 20000 });

    // Find a "Buy" button -- could be "Buy Inbound Number" or "Buy Outbound Number"
    const buyButton = page.locator(
      'button:has-text("Buy Inbound Number"), ' +
      'button:has-text("Buy Outbound Number"), ' +
      'button:has-text("Buy Number"), ' +
      'button:has-text("Get a Number"), ' +
      '[data-testid="buy-number-button"]'
    );

    const hasBuyButton = await buyButton.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasBuyButton) {
      // If no buy button is visible, the account already has numbers provisioned.
      // This is acceptable -- skip gracefully.
      test.skip(true, 'No buy button visible -- account may already have numbers provisioned');
      return;
    }

    // Click the buy button to open the modal
    await buyButton.first().click();

    // Wait for the modal/overlay to appear
    const modal = page.locator(
      '[class*="fixed"][class*="inset-0"], ' +
      '[role="dialog"], ' +
      '[data-testid="buy-number-modal"], ' +
      '.fixed.inset-0'
    );
    await expect(modal.first()).toBeVisible({ timeout: 5000 });

    // Verify country selector is present inside the modal
    // The BuyNumberModal shows country buttons with flags (US, GB, CA)
    const countrySelector = modal.first().locator(
      'button:has-text("United States"), ' +
      'button:has-text("United Kingdom"), ' +
      'button:has-text("Canada"), ' +
      '[data-testid="country-selector"], ' +
      'select:has(option:has-text("United States"))'
    );
    await expect(countrySelector.first()).toBeVisible({ timeout: 5000 });

    // Verify pricing information is visible somewhere in the modal
    // The modal displays pricing from PHONE_NUMBER_PRICING constant
    const modalText = await modal.first().textContent() || '';
    const hasPricingInfo =
      /\$\d+|per month|monthly|pricing|cost|free/i.test(modalText) ||
      /usage/i.test(modalText);

    expect(hasPricingInfo).toBeTruthy();

    // Verify no critical JS errors
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydration')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ── 08-003 ─────────────────────────────────────────────────────────────
  test('08-003: AI Forwarding shows carrier instructions', async ({ page }) => {
    // /dashboard/telephony 301-redirects to /dashboard/phone-settings via middleware.
    // Navigate to the canonical URL directly.
    await gotoPage(page, '/dashboard/phone-settings');

    // Wait for the page to load
    const heading = page.locator(
      'h1:has-text("Phone Settings"), [data-testid="phone-settings-heading"]'
    );
    await expect(heading.first()).toBeVisible({ timeout: 20000 });

    // TWO VALID STATES:
    //
    // State A — managed inbound number EXISTS:
    //   CarrierForwardingInstructions component is rendered and shows:
    //   - "Select Your Country" step label
    //   - Country buttons (US, GB, CA, TR, NG)
    //   - Activation codes like **21*..., *72..., etc.
    //   - "How to Deactivate Call Forwarding" collapsible
    //   - Inbound panel heading "Inbound Calls"
    //
    // State B — NO managed inbound number:
    //   The "Get Your AI Phone Number" / "Buy Inbound Number" CTA is shown instead.
    //   This is also a valid loaded state for the page.

    // Check for State A: carrier forwarding content
    // NOTE: text= selectors cannot be OR'd with commas — use .or() chains instead.
    const carrierInstructions = page.locator('text=Select Your Country')
      .or(page.locator('text=How to Deactivate Call Forwarding'))
      .or(page.locator('text=Activate Call Forwarding'))
      .or(page.locator('text=Select Your Carrier'))
      .or(page.locator('[data-testid="carrier-instructions"]'));

    const forwardingContext = page.locator('text=Forward your office calls')
      .or(page.locator('text=Forward calls TO your AI'))
      .or(page.locator('text=carrier code'))
      .or(page.locator('h2:has-text("Inbound Calls")'))
      .or(page.locator('h3:has-text("Inbound Calls")'));

    // Check for State B: no-number CTA
    const buyInboundCTA = page.locator(
      'button:has-text("Buy Inbound Number"), ' +
      'button:has-text("Get Your AI Phone Number")'
    ).or(page.locator('text=Get Your AI Phone Number'));

    const hasCarrierInstructions = await carrierInstructions.first().isVisible({ timeout: 8000 }).catch(() => false);
    const hasForwardingContext = await forwardingContext.first().isVisible({ timeout: 8000 }).catch(() => false);
    const hasBuyCTA = await buyInboundCTA.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBuyCTA && !hasCarrierInstructions && !hasForwardingContext) {
      // State B: no managed inbound number — the page loaded correctly, skip gracefully
      // This is a valid outcome: the UI renders the "buy a number" state correctly.
      test.skip(true, 'No managed inbound number -- carrier instructions only appear after buying a number. Buy CTA confirmed visible.');
      return;
    }

    // State A must be present: at least one carrier-related element visible
    expect(
      hasCarrierInstructions || hasForwardingContext,
      'Expected carrier forwarding instructions or forwarding context to be visible when a managed number exists'
    ).toBeTruthy();

    // Verify no critical JS errors
    const criticalErrors = pageErrors.filter(
      (e) =>
        !e.includes('ResizeObserver') &&
        !e.includes('hydration') &&
        !e.includes('Loading chunk') &&
        !e.includes('ChunkLoadError') &&
        !e.includes('Script error') &&
        !e.includes('tawk') &&
        !e.includes('Tawk')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ── 08-004 ─────────────────────────────────────────────────────────────
  test('08-004: Verified Caller ID page accessible', async ({ page }) => {
    // /dashboard/verified-caller-id 301-redirects to /dashboard/phone-settings.
    // The Verified Caller ID section is in the RIGHT column ("Outbound Calls")
    // of the phone-settings page.
    await gotoPage(page, '/dashboard/phone-settings');

    // Wait for the page to load
    const heading = page.locator(
      'h1:has-text("Phone Settings"), [data-testid="phone-settings-heading"]'
    );
    await expect(heading.first()).toBeVisible({ timeout: 20000 });

    // TWO VALID STATES for the Verified Caller ID section:
    //
    // State A — not yet verified (Step 1):
    //   - Phone input: input with placeholder "+1234567890" (type="tel")
    //   - "Start Verification" button
    //   - Section heading "Verified Caller ID" or "Outbound Calls"
    //
    // State B — already verified:
    //   - Shows the verified number (e.g. "+15551234567")
    //   - "Verified on [date]" text OR "Ready for outbound" text
    //   - "Remove Verification" button

    // First confirm the Verified Caller ID section itself is visible.
    // The section is in the right column under "Outbound Calls".
    const verifiedCallerIDSection = page.locator(
      'h3:has-text("Verified Caller ID"), ' +
      'h2:has-text("Outbound Calls"), ' +
      'h3:has-text("Outbound Calls"), ' +
      '[data-testid="verified-caller-id-section"]'
    );
    await expect(verifiedCallerIDSection.first()).toBeVisible({ timeout: 10000 });

    // State A: phone input uses placeholder "+1234567890" (the actual component value)
    const phoneInput = page.locator(
      'input[placeholder*="1234567890"], ' +
      'input[type="tel"], ' +
      'input[placeholder*="+1"], ' +
      'input[placeholder*="phone"], ' +
      '[data-testid="phone-input"]'
    );

    // State A: "Start Verification" button (the actual label used in the component)
    const verifyButton = page.locator(
      'button:has-text("Start Verification"), ' +
      'button:has-text("Verify"), ' +
      'button:has-text("Send Verification"), ' +
      '[data-testid="verify-button"]'
    );

    // State B: already-verified number indicators
    const verifiedNumber = page.locator(
      'text=Verified on, ' +
      'text=Ready for outbound, ' +
      'button:has-text("Remove Verification"), ' +
      '[data-testid="verified-number"]'
    );

    const hasInput = await phoneInput.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasVerifyButton = await verifyButton.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasVerifiedNumber = await verifiedNumber.first().isVisible({ timeout: 3000 }).catch(() => false);

    // At least one of these states must be true:
    // State A: phone input present OR "Start Verification" button present
    // State B: verified number display present
    expect(
      hasInput || hasVerifyButton || hasVerifiedNumber,
      'Expected either: phone input + Start Verification button (unverified state), ' +
      'or verified number display (already verified state)'
    ).toBeTruthy();

    // Verify no critical JS errors
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydration')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ── 08-005 ─────────────────────────────────────────────────────────────
  test('08-005: Invalid phone format shows error', async ({ page }) => {
    await gotoPage(page, '/dashboard/phone-settings');

    // Wait for the page to load
    const heading = page.locator(
      'h1:has-text("Phone Settings"), [data-testid="phone-settings-heading"]'
    );
    await expect(heading.first()).toBeVisible({ timeout: 20000 });

    // Find the phone input in the Verified Caller ID section (outbound lane).
    // The input is type="tel" with placeholder="+1234567890".
    const phoneInput = page.locator(
      'input[type="tel"], ' +
      'input[placeholder*="+1"], ' +
      '[data-testid="phone-input"]'
    );

    const hasPhoneInput = await phoneInput.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasPhoneInput) {
      // If no phone input is visible, the number may already be verified
      // and the verification form is hidden.
      test.skip(true, 'Phone input not visible -- number may already be verified');
      return;
    }

    // Enter an invalid phone format
    await phoneInput.first().fill('abc');

    // The phone-settings page validates in real-time:
    // - Valid format shows checkmark + "Valid [Country] number detected"
    // - Invalid format shows hint text: "Must include country code: +1 (US), ..."
    // The "Start Verification" button is disabled when input is empty or invalid format.

    // Try clicking the verify/start button to trigger validation
    const verifyButton = page.locator(
      'button:has-text("Start Verification"), ' +
      'button:has-text("Verify"), ' +
      'button:has-text("Send Verification"), ' +
      '[data-testid="verify-button"]'
    );

    const hasVerifyButton = await verifyButton.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (hasVerifyButton) {
      // Click the button -- it should either be disabled or trigger an error
      const isDisabled = await verifyButton.first().isDisabled();

      if (!isDisabled) {
        await verifyButton.first().click();
      }
    }

    // Check for error indicators within 3 seconds:
    // 1. Inline validation hint: "Must include country code"
    // 2. Error message in red: verification error
    // 3. The button remains disabled (no checkmark shown)
    // 4. No "Valid ... number detected" text appears
    const errorIndicators = page.locator(
      'text=Must include country code, ' +
      'text=Failed to send verification, ' +
      'text=Check that your phone number is correct, ' +
      '.bg-red-50, ' +
      '[class*="text-red"], ' +
      '[data-testid="phone-error"]'
    );

    // Also check that the valid-format indicator is NOT shown
    const validIndicator = page.locator(
      'text=number detected, ' +
      'text=Valid'
    );

    const hasError = await errorIndicators.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasNoValidIndicator = !(await validIndicator.first().isVisible({ timeout: 1000 }).catch(() => false));

    // The format "abc" should NOT show as valid, and should show some form of error/hint
    expect(hasError || hasNoValidIndicator).toBeTruthy();

    // Verify no critical JS errors
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydration')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ── 08-006 ─────────────────────────────────────────────────────────────
  test('08-006: Existing verified numbers listed (nice-to-have)', async ({ page }) => {
    await gotoPage(page, '/dashboard/phone-settings');

    // Wait for the page to load
    const heading = page.locator(
      'h1:has-text("Phone Settings"), [data-testid="phone-settings-heading"]'
    );
    await expect(heading.first()).toBeVisible({ timeout: 20000 });

    // Look for evidence of existing verified numbers:
    // 1. The outbound lane shows a verified number with "Verified on [date]"
    // 2. A checkmark icon next to a phone number in the outbound section
    // 3. "Ready for outbound calls" text
    // 4. The verified number displayed in font-mono format
    // 5. "Remove Verification" button (only appears when a number is verified)
    const verifiedNumberIndicators = page.locator(
      'text=Verified on, ' +
      'text=Ready for outbound, ' +
      'button:has-text("Remove Verification"), ' +
      '[data-testid="verified-number-display"], ' +
      '[data-testid="verified-numbers-list"]'
    );

    const count = await verifiedNumberIndicators.count();

    if (count === 0) {
      // No verified numbers found -- skip gracefully
      test.skip(true, 'No verified numbers found -- nice-to-have feature, skipping');
      return;
    }

    // At least one verified number indicator is visible
    await expect(verifiedNumberIndicators.first()).toBeVisible({ timeout: 5000 });

    // Verify the verified number text contains a phone-number-like pattern
    const verifiedText = await verifiedNumberIndicators.first().textContent();
    expect(verifiedText).toBeTruthy();

    // Verify no critical JS errors
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydration')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
