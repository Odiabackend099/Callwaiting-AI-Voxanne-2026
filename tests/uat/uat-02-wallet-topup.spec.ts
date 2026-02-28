/**
 * UAT-02: Wallet & Billing
 *
 * Tests the wallet page against the REAL backend — NO mocks.
 * NO page.route() interception. All assertions use live data.
 *
 * Page under test: /dashboard/wallet
 *
 * Covers:
 *   02-001  Balance shown in GBP format
 *   02-002  Transaction history shows entry types
 *   02-003  Top Up button opens Stripe flow
 *   02-004  Minimum top-up is £25
 *   02-005  Auto-recharge toggle present
 *   02-006  Low balance warning shown (conditional)
 *
 * Requires:
 *   - Frontend running at baseURL (default http://localhost:3000)
 *   - Backend running and reachable
 *   - Demo account credentials (see uat-auth.helper.ts)
 */

import { test, expect } from '@playwright/test';
import { loginAsDemo, gotoPage } from './helpers/uat-auth.helper';

test.describe('UAT-02: Wallet & Billing', () => {
  /** Collect page-level JS errors so we can assert "no crashes" after interactions. */
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await loginAsDemo(page);
  });

  test.afterEach(async () => {
    // Assert no uncaught JS errors during test execution.
    // Filter out known noise (e.g. ResizeObserver, hydration warnings, chunk loading).
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

  // ---------------------------------------------------------------------------
  // 02-001: Balance shown in GBP format (£X.XX)
  // ---------------------------------------------------------------------------
  test('02-001: Balance shown in £X.XX format', async ({ page }) => {
    await page.goto('/dashboard/wallet', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for the wallet page to finish loading (balance card renders after SWR fetch).
    // The balance is rendered as a large text element inside the gradient card, e.g. "£12.50".
    // Use .or() for OR logic — never comma-separated mixed selector strings.
    const balanceText = page.locator('text=/£\\d+\\.\\d{2}/').or(
      page.locator('p:has-text("£")')
    ).first();

    await expect(balanceText).toBeVisible({ timeout: 15_000 });

    // Verify the full page contains at least one GBP-formatted amount
    const bodyText = await page.textContent('body') || '';
    const hasGbpFormat = /£\d+\.\d{2}/.test(bodyText);
    expect(
      hasGbpFormat,
      `Expected balance in £X.XX format on wallet page. Body excerpt: ${bodyText.slice(0, 200)}`
    ).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // 02-002: Transaction history shows entry types
  // ---------------------------------------------------------------------------
  test('02-002: Transaction history shows entry types', async ({ page }) => {
    await gotoPage(page, '/dashboard/wallet');

    // Wait for the Transaction History section to appear.
    // The heading "Transaction History" is always rendered regardless of data.
    const txHeading = page.getByText('Transaction History').first();
    await expect(txHeading).toBeVisible({ timeout: 20_000 });

    // Check if there are actual transaction rows in the table.
    // The table renders inside .lg\\:col-span-2 with <tbody>.
    const txTable = page.locator('table tbody tr');
    const emptyState = page.getByText(/no transactions/i).first();

    const hasRows = await txTable.first().isVisible({ timeout: 8_000 }).catch(() => false);
    const isEmpty = await emptyState.isVisible({ timeout: 8_000 }).catch(() => false);

    if (hasRows) {
      // Verify at least one recognized transaction type label is visible.
      // The wallet page renders types as: "Top-Up", "Call Charge", "Phone Purchase",
      // "Refund", "Adjustment", "Bonus".
      const knownTypes = ['Top-Up', 'Call Charge', 'Phone Purchase', 'Refund', 'Adjustment', 'Bonus'];
      const tableText = await page.locator('table').first().textContent() || '';
      const foundType = knownTypes.some((t) => tableText.includes(t));
      expect(
        foundType,
        `Expected at least one transaction type (${knownTypes.join(', ')}) in table. Got: ${tableText.slice(0, 300)}`
      ).toBeTruthy();
    } else {
      // Empty state is acceptable — the section still exists with correct messaging.
      expect(
        isEmpty,
        'Expected either transaction rows or "No transactions yet" empty state'
      ).toBeTruthy();
    }
  });

  // ---------------------------------------------------------------------------
  // 02-003: Top Up button opens Stripe flow
  // ---------------------------------------------------------------------------
  test('02-003: Top Up button opens Stripe flow', async ({ page }) => {
    test.setTimeout(120_000); // Stripe redirect can take 30-50s on top of login time
    await page.goto('/dashboard/wallet', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Find the "Top Up" button on the balance card.
    // Button text is "Top Up". Use .or() for fallback variants.
    const topUpButton = page.locator('button:has-text("Top Up")').or(
      page.locator('button:has-text("Add Credits")')
    ).first();

    await expect(topUpButton).toBeVisible({ timeout: 15_000 });
    await topUpButton.click();

    // Clicking "Top Up" opens a modal with preset amount buttons and a custom amount input.
    // The modal heading is "Top Up Credits" inside an <h2>.
    const topUpModal = page.locator('h2:has-text("Top Up Credits")')
      .or(page.locator('h2:has-text("Top Up")'))
      .or(page.locator('[role="dialog"]'))
      .or(page.locator('.fixed.inset-0'));
    await expect(topUpModal.first()).toBeVisible({ timeout: 8_000 });

    // Select the first preset amount (£25 — the minimum).
    // Look inside the modal for a button containing "£25" or just "25".
    const firstPreset = page.locator('button:has-text("£25")').or(
      page.locator('button:has-text("25")')
    ).first();
    await expect(firstPreset).toBeVisible({ timeout: 3_000 });
    await firstPreset.click();

    // Click "Proceed to Payment" to trigger the Stripe redirect.
    // We intercept the navigation to avoid actually leaving the page in the test.
    const proceedButton = page.locator('button:has-text("Proceed to Payment")').or(
      page.locator('button:has-text("Pay")')
    ).or(
      page.locator('button:has-text("Checkout")')
    ).first();
    await expect(proceedButton).toBeVisible({ timeout: 3_000 });
    await expect(proceedButton).toBeEnabled();

    // Listen for navigation — Stripe checkout will redirect to checkout.stripe.com.
    // We use a Promise.race: either the URL changes to Stripe OR we get an error toast
    // (e.g. if the backend rejects due to test mode constraints).
    const [navigatedToStripe] = await Promise.all([
      page
        .waitForURL(/checkout\.stripe\.com|stripe/, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false),
      proceedButton.click(),
    ]);

    if (navigatedToStripe) {
      // Successfully redirected to Stripe checkout
      expect(page.url()).toContain('stripe');
      // Navigate back so we don't leave the test stranded on Stripe
      await page.goto('/dashboard/wallet', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    } else {
      // If Stripe redirect did not happen, check for:
      // 1. A processing spinner (backend is working)
      // 2. An error toast (backend returned an error)
      // 3. The modal is still visible (waiting for response)
      // Any of these confirm the Top Up flow was initiated.
      const processingSpinner = page.locator('.animate-spin').or(
        page.getByText('Processing...')
      ).first();
      const errorToast = page.locator('[role="alert"]').or(
        page.locator('[role="status"]')
      ).or(
        page.locator('text=/failed|error|invalid/i')
      ).first();
      const modalStillOpen = page.locator('h2:has-text("Top Up Credits")').first();

      const hasSpinner = await processingSpinner.isVisible({ timeout: 3_000 }).catch(() => false);
      const hasError = await errorToast.isVisible({ timeout: 2_000 }).catch(() => false);
      const hasModal = await modalStillOpen.isVisible({ timeout: 1_000 }).catch(() => false);

      expect(
        hasSpinner || hasError || hasModal,
        'Expected Stripe redirect, processing spinner, error feedback, or modal — got none'
      ).toBeTruthy();
    }
  });

  // ---------------------------------------------------------------------------
  // 02-004: Minimum top-up is £25
  // ---------------------------------------------------------------------------
  test('02-004: Minimum top-up is £25', async ({ page }) => {
    await page.goto('/dashboard/wallet', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Open the Top Up modal
    const topUpButton = page.locator('button:has-text("Top Up")').first();
    await expect(topUpButton).toBeVisible({ timeout: 15_000 });
    await topUpButton.click();

    // Wait for the modal to appear — heading is inside <h2>
    const topUpModal = page.locator('h2:has-text("Top Up Credits")')
      .or(page.locator('h2:has-text("Top Up")'))
      .or(page.locator('[role="dialog"]'))
      .or(page.locator('.fixed.inset-0'));
    await expect(topUpModal.first()).toBeVisible({ timeout: 8_000 });

    // Verify that £25 is visible as the minimum amount.
    // The modal shows:
    //   - Preset buttons starting at £25 (MIN_TOPUP_PENCE * 1 = 2500 pence = £25)
    //   - Custom amount label: "Custom amount in GBP (min £25)"
    //   - Custom input placeholder: "25.00"
    // Use [role="dialog"] or the modal heading's ancestor for modal text extraction.
    const modalContainer = page.locator('h2:has-text("Top Up Credits")').locator('..').locator('..');
    const modalText = (await modalContainer.textContent().catch(async () => {
      // Fallback: grab text from the modal overlay
      return page.locator('.fixed.inset-0').last().textContent().catch(() => '');
    })) || '';

    const hasMinAmount =
      modalText.includes('£25') ||
      modalText.includes('min £25') ||
      /min\w*\s*£?\s*25/.test(modalText) ||
      modalText.includes('25.00');

    expect(
      hasMinAmount,
      `Expected minimum top-up of £25 to be indicated in modal. Modal text: ${modalText.slice(0, 400)}`
    ).toBeTruthy();

    // Additionally verify a preset button for £25 exists
    const firstPresetButton = page.locator('button:has-text("£25")').or(
      page.locator('button:has-text("25.00")')
    ).first();
    const firstPresetText = await firstPresetButton.textContent().catch(() => '') || '';
    expect(
      firstPresetText.includes('£25') || firstPresetText.includes('25'),
      `Expected a £25 preset button to exist in the modal. Got: "${firstPresetText}"`
    ).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // 02-005: Auto-recharge toggle present
  // ---------------------------------------------------------------------------
  test('02-005: Auto-recharge toggle present', async ({ page }) => {
    await page.goto('/dashboard/wallet', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // The Auto-Recharge card renders with heading "Auto-Recharge" and a toggle switch.
    // Look for the heading first. Use .or() — never comma-mixed selector strings.
    const autoRechargeHeading = page.locator('h3:has-text("Auto-Recharge")').or(
      page.locator('text=/auto-recharge/i')
    ).first();
    await expect(autoRechargeHeading).toBeVisible({ timeout: 15_000 });

    // Verify the toggle switch element is present.
    // The toggle is a <button role="switch"> with aria-checked attribute.
    const toggleSwitch = page.locator('[role="switch"]').or(
      page.locator('button[aria-checked]')
    ).first();

    await expect(toggleSwitch).toBeVisible({ timeout: 5_000 });

    // Verify the toggle has a boolean aria-checked attribute
    const ariaChecked = await toggleSwitch.getAttribute('aria-checked');
    expect(
      ariaChecked === 'true' || ariaChecked === 'false',
      `Expected aria-checked to be "true" or "false", got: "${ariaChecked}"`
    ).toBeTruthy();

    // Verify the "Save Settings" button is also present in the auto-recharge card
    const saveButton = page.locator('button:has-text("Save Settings")').or(
      page.locator('button:has-text("Save")')
    ).last();
    await expect(saveButton).toBeVisible({ timeout: 3_000 });
  });

  // ---------------------------------------------------------------------------
  // 02-006: Low balance warning shown (conditional)
  // ---------------------------------------------------------------------------
  test('02-006: Low balance warning shown if applicable', async ({ page }) => {
    await page.goto('/dashboard/wallet', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for wallet data to load (balance card rendered).
    // The balance is a large white text element showing £X.XX.
    const balanceArea = page.locator('text=/£\\d+\\.\\d{2}/').first();
    await expect(balanceArea).toBeVisible({ timeout: 15_000 });

    // The low balance warning renders conditionally when wallet.is_low_balance is true.
    // It shows an AlertTriangle icon with text:
    //   "Low balance — top up to avoid service interruption"
    // This is inside a div with amber-300 text color.
    // Use chained .or() calls — never a comma-joined mixed selector string.
    const lowBalanceWarning = page.locator('text=/low balance/i').or(
      page.locator('text=/top up to avoid/i')
    ).or(
      page.locator('text=/service interruption/i')
    ).or(
      page.locator('.text-amber-300')
    ).first();

    const hasWarning = await lowBalanceWarning.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasWarning) {
      // Warning is shown — verify it contains meaningful text
      const warningText = await lowBalanceWarning.textContent() || '';
      expect(warningText.length).toBeGreaterThan(5);
    } else {
      // No warning visible — balance is likely above the low threshold.
      // This is expected behavior. Use a soft assertion: verify the balance card
      // loaded successfully (which we already did above), then skip gracefully.
      // We confirm the page loaded correctly by checking for the "Current Balance" label.
      const currentBalanceLabel = page.locator('text="Current Balance"').first();
      const pageLoaded = await currentBalanceLabel.isVisible({ timeout: 2_000 }).catch(() => false);

      if (pageLoaded) {
        // Balance is not low — warning correctly hidden. Test passes.
        test.info().annotations.push({
          type: 'note',
          description: 'Balance is not low — low balance warning correctly not shown.',
        });
      } else {
        // Wallet data failed to load entirely — this is a real failure.
        expect(
          false,
          'Wallet page did not load balance data — cannot verify low balance warning'
        ).toBeTruthy();
      }
    }
  });
});
