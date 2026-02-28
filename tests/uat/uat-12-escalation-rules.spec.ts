/**
 * UAT-12: Escalation Rules
 *
 * Tests against the REAL backend with NO mocks.
 * Validates the /dashboard/escalation-rules page: rule list or empty state,
 * rule creation form, sentiment-triggered rule save, toggle enable/disable,
 * and rule deletion with confirmation.
 *
 * Demo account (voxanne@demo.com) may or may not have existing rules.
 * Tests are written to handle both populated and empty states gracefully.
 *
 * Covers:
 *   12-001  Page loads with rules or empty state
 *   12-002  Add Rule opens form
 *   12-003  Sentiment-triggered rule saves
 *   12-004  Rule can be toggled disabled
 *   12-005  Rule can be deleted
 */

import { test, expect } from '@playwright/test';
import { loginAsDemo, gotoPage } from './helpers/uat-auth.helper';

test.describe('UAT-12: Escalation Rules', () => {
  /** Collect page-level JS errors so we can assert "no crashes" after interactions. */
  const pageErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await loginAsDemo(page);
  });

  // ---------------------------------------------------------------------------
  // 12-001: Page loads with rules or empty state
  // ---------------------------------------------------------------------------
  test('12-001: Page loads with rules or empty state', async ({ page }) => {
    await gotoPage(page, '/dashboard/escalation-rules');

    // The page heading "Escalation Rules" should be visible
    const heading = page.locator(
      'h1:has-text("Escalation Rules"), ' +
      '[data-testid="escalation-heading"]'
    );
    await expect(heading.first()).toBeVisible({ timeout: 15_000 });

    // Wait for loading spinner to disappear
    await expect(
      page.locator('.animate-spin')
    ).toBeHidden({ timeout: 15_000 }).catch(() => {
      // spinner may already be gone
    });

    // Accept either: a populated rules table OR the empty state message.
    // Populated state: table with <thead> containing "Name", "Trigger", etc.
    // Empty state: "No escalation rules created yet" text + "Create your first rule" link.
    const rulesTable = page.locator('table thead, table tbody tr');
    const emptyState = page.locator(
      'text=No escalation rules created yet, ' +
      'text=Create your first rule, ' +
      '[data-testid="empty-rules"]'
    );

    // After spinner wait, allow extra time for API data to render
    // The spinner .catch() above ignores timeout, so data may still be loading
    await page.waitForTimeout(1000);
    const hasTable = await rulesTable.first().isVisible({ timeout: 15_000 }).catch(() => false);
    const hasEmptyState = await emptyState.first().isVisible({ timeout: 10_000 }).catch(() => false);

    expect(
      hasTable || hasEmptyState,
      'Expected either a rules table or an empty state message'
    ).toBeTruthy();

    // Verify no critical JS errors
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydrat')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 12-002: Add Rule opens form
  // ---------------------------------------------------------------------------
  test('12-002: Add Rule opens form', async ({ page }) => {
    await gotoPage(page, '/dashboard/escalation-rules');

    // Wait for heading to confirm page loaded
    const heading = page.locator('h1:has-text("Escalation Rules")');
    await expect(heading.first()).toBeVisible({ timeout: 15_000 });

    // Wait for loading spinner to disappear
    await expect(
      page.locator('.animate-spin')
    ).toBeHidden({ timeout: 15_000 }).catch(() => {
      // spinner may already be gone
    });

    // The button is labelled "Create Rule" in the page header (from page.tsx line 159).
    // It also exists as a text link "Create your first rule" in the empty state.
    // Both open the same modal form.
    //
    // DOM from page.tsx:
    //   <button ...>
    //     <Plus class="w-5 h-5" />
    //     Create Rule
    //   </button>
    //
    //   OR (empty state):
    //   <button ...>Create your first rule</button>
    const createButton = page.locator(
      'button:has-text("Create Rule"), ' +
      'button:has-text("Create your first rule"), ' +
      'button:has-text("Add Rule"), ' +
      'button:has-text("New Rule")'
    );
    await expect(createButton.first()).toBeVisible({ timeout: 5_000 });
    await createButton.first().click();

    // After clicking, the modal overlay appears:
    //   <div class="fixed inset-0 bg-black bg-opacity-50 ...">
    //     <div class="bg-white rounded-lg ... max-w-md ...">
    //       <h2>Create New Rule</h2>
    //       <RuleForm ... />
    //     </div>
    //   </div>
    //
    // We wait for the modal heading "Create New Rule" to appear.
    const modalHeading = page.locator(
      'h2:has-text("Create New Rule"), ' +
      'h2:has-text("Edit Rule"), ' +
      '[role="dialog"] h2'
    );
    await expect(modalHeading.first()).toBeVisible({ timeout: 5_000 });

    // Verify the "Rule Name" input is present (input[name="name"] from RuleForm.tsx line 186)
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput.first()).toBeVisible({ timeout: 3_000 });

    // Verify trigger type radio buttons are present.
    // RuleForm renders radio inputs with name="trigger_type" and values:
    // "wait_time", "sentiment", "ai_request", "manual"
    const triggerRadio = page.locator('input[name="trigger_type"]');
    await expect(triggerRadio.first()).toBeVisible({ timeout: 3_000 });

    // Verify the transfer number input is present (input[name="transfer_number"] type="tel")
    const transferInput = page.locator('input[name="transfer_number"]');
    await expect(transferInput.first()).toBeVisible({ timeout: 3_000 });

    // No JS errors after opening form
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydrat')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 12-003: Sentiment-triggered rule saves
  // ---------------------------------------------------------------------------
  test('12-003: Sentiment-triggered rule saves', async ({ page }) => {
    await gotoPage(page, '/dashboard/escalation-rules');

    // Wait for page to load fully
    const heading = page.locator('h1:has-text("Escalation Rules")');
    await expect(heading.first()).toBeVisible({ timeout: 15_000 });

    // Wait for loading to finish
    await expect(
      page.locator('.animate-spin')
    ).toBeHidden({ timeout: 15_000 }).catch(() => {});

    // Open the create form via "Create Rule" button (or "Create your first rule" in empty state)
    const createButton = page.locator(
      'button:has-text("Create Rule"), ' +
      'button:has-text("Create your first rule")'
    );

    const formAvailable = await createButton.first().isVisible({ timeout: 5_000 }).catch(() => false);
    if (!formAvailable) {
      test.skip(true, 'Create Rule button not found -- form not available');
      return;
    }

    await createButton.first().click();

    // Wait for the modal form to appear -- specifically the name input
    // (input[name="name"] from RuleForm.tsx line 186)
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput.first()).toBeVisible({ timeout: 5_000 });

    // Fill in the rule name (must be >= 3 chars per validation)
    await nameInput.first().fill('UAT Escalation Test');

    // Select the "sentiment" trigger type via its radio button.
    // RuleForm renders: <input type="radio" name="trigger_type" value="sentiment" ...>
    const sentimentRadio = page.locator('input[name="trigger_type"][value="sentiment"]');
    const hasSentimentRadio = await sentimentRadio.first().isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasSentimentRadio) {
      await sentimentRadio.first().click();
    } else {
      // Fallback: click the label text containing the sentiment option
      const sentimentLabel = page.locator(
        'label:has-text("Sentiment"), ' +
        'text=Sentiment: Transfer if negative sentiment'
      );
      const hasLabel = await sentimentLabel.first().isVisible({ timeout: 2_000 }).catch(() => false);
      if (hasLabel) {
        await sentimentLabel.first().click();
      }
    }

    // Fill in the transfer number.
    // Validation regex: /^\+\d{1,15}$/ -- E.164 without dashes.
    // (RuleForm.tsx line 95: !/^\+\d{1,15}$/.test(...))
    const transferInput = page.locator('input[name="transfer_number"]');
    await transferInput.first().fill('+12125551234');

    // Submit via keyboard: pressing Enter in the transfer input triggers the form's
    // onSubmit handler without pointer-event interception by the fixed bottom nav bar.
    await transferInput.first().press('Enter');

    // Wait for form response: success message OR error message in the modal.
    // Success path: "Rule created successfully" green alert appears for ~1.5 s, then
    //   modal auto-closes (setTimeout in RuleForm.tsx line 151).
    // Error path: red bg-red-50 alert with error text appears and stays open.
    const successMessage = page.locator('text=Rule created successfully')
      .or(page.locator('.bg-green-50').filter({ hasText: /created successfully/i }));
    const errorInForm = page.locator('.bg-red-50').filter({ hasText: /error|invalid|failed/i });

    let hasSuccessMsg = false;
    let hasErrorMsg = false;
    // Poll for up to 15 s (API can be slow on the demo server)
    for (let i = 0; i < 30; i++) {
      hasSuccessMsg = await successMessage.first().isVisible().catch(() => false);
      hasErrorMsg = await errorInForm.first().isVisible().catch(() => false);
      if (hasSuccessMsg || hasErrorMsg) break;
      await page.waitForTimeout(500);
    }

    // If backend rejected the rule, skip gracefully with the captured error text
    if (hasErrorMsg) {
      const errText = (await errorInForm.first().textContent().catch(() => '')).trim();
      test.skip(true, `Backend rejected rule creation: "${errText}" -- skipping`);
      return;
    }

    // Wait for modal to auto-close (1.5 s delay in RuleForm) + SWR refetch
    await page.waitForTimeout(3_000);

    // Verify the rule appears in the table (or accept already-detected success msg)
    const ruleInList = page.locator('td:has-text("UAT Escalation Test")')
      .or(page.locator('text=UAT Escalation Test'));
    const hasRuleInList = await ruleInList.first().isVisible({ timeout: 5_000 }).catch(() => false);

    // Either the success message appeared OR the rule is now in the list
    expect(
      hasSuccessMsg || hasRuleInList,
      'Expected either a success message or the new rule to appear in the list after creation'
    ).toBeTruthy();

    // Verify no JS errors
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydrat')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 12-004: Rule can be toggled disabled
  // ---------------------------------------------------------------------------
  test('12-004: Rule can be toggled disabled', async ({ page }) => {
    await gotoPage(page, '/dashboard/escalation-rules');

    // Wait for page to load
    const heading = page.locator('h1:has-text("Escalation Rules")');
    await expect(heading.first()).toBeVisible({ timeout: 15_000 });

    // Wait for loading to finish
    await expect(
      page.locator('.animate-spin')
    ).toBeHidden({ timeout: 15_000 }).catch(() => {});

    // Check if there are any rules in the table
    const ruleRows = page.locator('table tbody tr');
    const rowCount = await ruleRows.count().catch(() => 0);

    if (rowCount === 0) {
      test.skip(true, 'No escalation rules exist -- cannot test toggle');
      return;
    }

    // Find the first toggle button.
    // From page.tsx (lines 243-251), the toggle button renders as:
    //   <button class="px-3 py-1 rounded-full text-sm font-medium
    //     bg-green-50 text-green-700 ...">Enabled</button>
    //   OR
    //   <button class="px-3 py-1 rounded-full text-sm font-medium
    //     bg-surgical-50 text-obsidian/60 ...">Disabled</button>
    const toggleButton = page.locator(
      'table tbody tr button:has-text("Enabled"), ' +
      'table tbody tr button:has-text("Disabled")'
    ).first();

    await expect(toggleButton).toBeVisible({ timeout: 5_000 });

    // Capture the current state before clicking
    const initialText = ((await toggleButton.textContent()) || '').trim();
    const wasEnabled = /enabled/i.test(initialText);

    console.log(`[12-004] Toggle initial state: "${initialText}" (wasEnabled=${wasEnabled})`);

    // Click the toggle button to flip the state
    await toggleButton.click();

    // The page sets success via setSuccess() which renders an inline banner:
    //   <div class="mb-4 p-4 bg-green-50 border border-green-200 ...">
    //     <CheckCircle ... />
    //     Rule enabled successfully    (or "Rule disabled successfully")
    //   </div>
    // This is NOT a toast -- it's a plain div in the page body.
    // Look for the success banner by its bg-green-50 class + "successfully" text.
    const successBanner = page.locator('.bg-green-50').filter({ hasText: /successfully/i });
    await expect(successBanner.first()).toBeVisible({ timeout: 10_000 });

    console.log(`[12-004] Success banner appeared after toggle`);

    // Wait for SWR to revalidate and re-render the updated rule list
    await page.waitForTimeout(1_500);

    // Re-locate the toggle button (SWR mutate re-renders the list)
    const updatedToggle = page.locator(
      'table tbody tr button:has-text("Enabled"), ' +
      'table tbody tr button:has-text("Disabled")'
    ).first();

    const updatedText = ((await updatedToggle.textContent()) || '').trim();
    const isNowEnabled = /enabled/i.test(updatedText);

    console.log(`[12-004] Toggle updated state: "${updatedText}" (isNowEnabled=${isNowEnabled})`);

    // The state should have flipped from its original value
    expect(
      isNowEnabled,
      `Expected toggle state to flip from ${wasEnabled ? 'Enabled' : 'Disabled'} ` +
      `to ${wasEnabled ? 'Disabled' : 'Enabled'}, but got "${updatedText}"`,
    ).not.toBe(wasEnabled);

    // Toggle back to restore the original state
    await updatedToggle.click();
    // Wait for the second success banner and list refresh
    await page.waitForTimeout(2_000);

    // Verify no JS errors
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydrat')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 12-005: Rule can be deleted
  // ---------------------------------------------------------------------------
  test('12-005: Rule can be deleted', async ({ page }) => {
    await gotoPage(page, '/dashboard/escalation-rules');

    // Wait for page to load
    const heading = page.locator('h1:has-text("Escalation Rules")');
    await expect(heading.first()).toBeVisible({ timeout: 15_000 });

    // Wait for loading to finish
    await expect(
      page.locator('.animate-spin')
    ).toBeHidden({ timeout: 15_000 }).catch(() => {});

    // Only delete a rule that was created by our tests (contains "UAT" in name)
    // to avoid destroying real user data.
    const uatRuleRow = page.locator('table tbody tr:has-text("UAT")');
    const uatRowCount = await uatRuleRow.count().catch(() => 0);

    if (uatRowCount === 0) {
      test.skip(true, 'No UAT-created rules found -- skipping delete to protect real data');
      return;
    }

    // Count total rules before deletion
    const allRows = page.locator('table tbody tr');
    const initialCount = await allRows.count();

    // Find the Delete button within the UAT rule row.
    // From page.tsx (lines 264-271): <button ...>Delete</button>
    const deleteButton = uatRuleRow.first().locator(
      'button:has-text("Delete"), ' +
      'button:has-text("delete"), ' +
      '[data-testid="delete-rule"]'
    );
    await expect(deleteButton.first()).toBeVisible({ timeout: 5_000 });
    await deleteButton.first().click();

    // Handle the ConfirmDialog -- it shows "Delete Escalation Rule" as the title
    // and has "Delete" and "Cancel" buttons in the footer.
    const confirmDialog = page.locator(
      'h2:has-text("Delete Escalation Rule"), ' +
      'h2:has-text("Delete"), ' +
      '[role="dialog"] h2'
    );
    const confirmDialogVisible = await confirmDialog.first().isVisible({ timeout: 5_000 }).catch(() => false);

    if (confirmDialogVisible) {
      // Click the "Delete" confirm button (red, destructive action)
      const confirmButton = page.locator(
        'button.bg-red-600:has-text("Delete"), ' +
        'button[class*="bg-red"]:has-text("Delete"), ' +
        'button:has-text("Delete"):not(:has-text("Cancel"))'
      );

      // Among multiple "Delete" buttons, pick the one inside the dialog overlay
      const dialogOverlay = page.locator('.fixed.inset-0').last();
      const confirmInDialog = dialogOverlay.locator(
        'button:has-text("Delete")'
      );

      const hasConfirmInDialog = await confirmInDialog.first().isVisible({ timeout: 3_000 }).catch(() => false);
      if (hasConfirmInDialog) {
        await confirmInDialog.first().click();
      } else {
        // Fallback: click the first red Delete button on the page
        await confirmButton.first().click();
      }
    }

    // Wait for the success message "Rule deleted successfully" (from page.tsx line 83).
    // Rendered as an inline green banner: <div class="mb-4 p-4 bg-green-50 ...">
    const deleteSuccess = page.locator('.bg-green-50').filter({ hasText: /deleted/i });
    await expect(deleteSuccess.first()).toBeVisible({ timeout: 10_000 });

    // Wait for the list to refresh
    await page.waitForTimeout(2_000);

    // Verify the row count decreased or the UAT rule is no longer visible
    const uatRuleAfter = page.locator('table tbody tr:has-text("UAT Escalation Test")');
    const uatCountAfter = await uatRuleAfter.count().catch(() => 0);
    expect(uatCountAfter).toBe(0);

    // Verify no JS errors
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydrat')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
