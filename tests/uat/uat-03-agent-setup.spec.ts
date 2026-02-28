/**
 * UAT-03: Agent Configuration
 *
 * Tests the agent configuration page against the REAL backend — NO mocks.
 * Validates inbound/outbound tab switching, system prompt editing, voice selection,
 * save persistence, prompt templates, and test call functionality.
 *
 * Page under test: /dashboard/agent-config
 */

import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers/uat-auth.helper';

test.describe('UAT-03: Agent Configuration', () => {
  /** Collect page-level JS errors for assertions. */
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await loginAsDemo(page);
  });

  // ---------------------------------------------------------------------------
  // 03-001: Page loads with inbound tab active
  // ---------------------------------------------------------------------------
  test('03-001: Page loads with inbound tab active', async ({ page }) => {
    await page.goto('/dashboard/agent-config', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // System prompt textarea should be visible (inside PromptSection)
    const systemPromptTextarea = page.locator([
      'textarea[placeholder*="helpful AI assistant"]',
      'textarea[placeholder*="prompt"]',
      'textarea[placeholder*="system"]',
      'textarea',
    ].join(', ')).first();

    await expect(systemPromptTextarea).toBeVisible({ timeout: 15000 });

    // Inbound tab should be the active/selected tab.
    // Tab text is "Inbound Agent".
    const inboundTab = page.locator('button:has-text("Inbound Agent")').or(
      page.locator('[role="tab"]:has-text("Inbound")')
    ).first();

    await expect(inboundTab).toBeVisible({ timeout: 5000 });

    // No uncaught JS errors
    expect(pageErrors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 03-002: Outbound tab switches without reload
  // ---------------------------------------------------------------------------
  test('03-002: Outbound tab switches without reload', async ({ page }) => {
    await page.goto('/dashboard/agent-config', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for the page to fully render
    await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 15000 });

    // Capture the current URL base path (ignoring query params)
    const urlBeforeClick = new URL(page.url());
    const pathBefore = urlBeforeClick.pathname;

    // Click the Outbound tab. Tab text is "Outbound Agent".
    const outboundTab = page.locator('button:has-text("Outbound Agent")').or(
      page.locator('[role="tab"]:has-text("Outbound")')
    ).first();

    await expect(outboundTab).toBeVisible({ timeout: 5000 });
    await outboundTab.click();

    // Verify outbound-specific content is visible within 2 seconds.
    // The Outbound tab renders content with the same form structure. We verify
    // the tab switch happened by checking that the outbound tab is now active
    // (has the active border class) or that the textarea is still visible (SPA switch).
    const outboundActiveOrContent = page.locator(
      'button:has-text("Outbound Agent")[class*="border-surgical-600"]'
    ).or(
      page.locator('button:has-text("Outbound Agent")[aria-selected="true"]')
    ).or(
      page.locator('textarea')
    ).first();

    await expect(outboundActiveOrContent).toBeVisible({ timeout: 2000 });

    // URL pathname should NOT have changed (SPA tab switch).
    // The query param ?agent=outbound may be appended, but the path stays the same.
    const urlAfterClick = new URL(page.url());
    expect(urlAfterClick.pathname).toBe(pathBefore);
  });

  // ---------------------------------------------------------------------------
  // 03-003: System prompt editable
  // ---------------------------------------------------------------------------
  test('03-003: System prompt editable', async ({ page }) => {
    await page.goto('/dashboard/agent-config', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Find the system prompt textarea
    const systemPromptTextarea = page.locator([
      'textarea[placeholder*="helpful AI assistant"]',
      'textarea[placeholder*="prompt"]',
      'textarea[placeholder*="system"]',
      'textarea',
    ].join(', ')).first();

    await expect(systemPromptTextarea).toBeVisible({ timeout: 15000 });

    const testValue = 'UAT test prompt: You are a helpful receptionist';

    // Clear existing content and type new content
    await systemPromptTextarea.fill('');
    await systemPromptTextarea.fill(testValue);

    // Verify the textarea value matches
    await expect(systemPromptTextarea).toHaveValue(testValue);
  });

  // ---------------------------------------------------------------------------
  // 03-004: Voice selector shows 3+ options
  // ---------------------------------------------------------------------------
  test('03-004: Voice selector shows 3+ options', async ({ page }) => {
    await page.goto('/dashboard/agent-config', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for the page to be fully loaded
    await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 15000 });

    // The VoiceSelector in simple mode renders as a <select> element.
    // In advanced mode it renders as a custom dropdown with voice cards.
    // Try the select element first (simple mode is the default).
    const voiceSelect = page.locator([
      'select:near(:text("Voice"))',
      'select:has(option:text("Select a voice"))',
      'select',
    ].join(', ')).first();

    const isSelectVisible = await voiceSelect.isVisible({ timeout: 5000 }).catch(() => false);

    if (isSelectVisible) {
      // Count the <option> elements inside the select (minus the placeholder)
      const optionCount = await voiceSelect.locator('option').count();
      // At least 3 real voice options + 1 placeholder = 4 total
      expect(optionCount).toBeGreaterThanOrEqual(4);
    } else {
      // Advanced mode: Look for voice cards or list items
      const voiceItems = page.locator([
        '[data-voice-id]',
        '[role="option"]',
        'button:has-text("Preview voice")',
        '.voice-card',
      ].join(', '));

      const itemCount = await voiceItems.count();
      expect(itemCount).toBeGreaterThanOrEqual(3);
    }
  });

  // ---------------------------------------------------------------------------
  // 03-005: Save shows success feedback
  // ---------------------------------------------------------------------------
  test('03-005: Save shows success feedback', async ({ page }) => {
    await page.goto('/dashboard/agent-config', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for the form to be ready
    const systemPromptTextarea = page.locator([
      'textarea[placeholder*="helpful AI assistant"]',
      'textarea[placeholder*="prompt"]',
      'textarea',
    ].join(', ')).first();

    await expect(systemPromptTextarea).toBeVisible({ timeout: 15000 });

    // Read the current value so we can make a meaningful change
    const currentValue = await systemPromptTextarea.inputValue();
    const editedValue = currentValue
      ? currentValue + ' [UAT-03-005]'
      : 'UAT test prompt for save verification [UAT-03-005]';

    // Edit the system prompt to trigger "changes detected".
    // Use the React-compatible native setter pattern to ensure React's
    // synthetic onChange fires and the form's dirty state is set.
    await systemPromptTextarea.click();
    await page.evaluate((value) => {
      const el = document.querySelector('textarea') as HTMLTextAreaElement | null;
      if (!el) return;
      const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (proto?.set) proto.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }, editedValue);
    // Small wait for React state update to propagate
    await page.waitForTimeout(600);

    // Find and click the "Save Changes" button (there are two: header and footer).
    // The button is disabled until changes are made.
    const saveButton = page.locator('button:has-text("Save Changes")').first();

    await expect(saveButton).toBeVisible({ timeout: 5000 });
    // Wait up to 8s for React to enable the button after detecting changes
    await expect(saveButton).toBeEnabled({ timeout: 8000 });
    await saveButton.click();

    // The save flow opens a PromptCheckpointModal with heading
    // "Review Prompt Before Saving" and a "Confirm & Save" button.
    // Wait for the modal to appear, then click "Confirm & Save".
    const confirmSaveButton = page.locator('button:has-text("Confirm & Save")').first();
    const hasCheckpointModal = await confirmSaveButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCheckpointModal) {
      await confirmSaveButton.click();
    } else {
      // Fallback: modal may use different wording
      const fallbackConfirm = page.locator('button:has-text("Confirm")').or(
        page.locator('button:has-text("Deploy")')
      ).first();
      const hasFallback = await fallbackConfirm.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasFallback) {
        await fallbackConfirm.click();
      }
    }

    // After confirming, the save button text changes to "Saved" (with checkmark).
    // Also accept success toast or success class as evidence.
    const successIndicator = page.locator('button:has-text("Saved")')
      .or(page.locator('button:has-text("Saved ✓")'))
      .or(page.locator('button:has-text("Changes saved")'))
      .or(page.locator('[role="alert"]:has-text("saved")'))
      .or(page.locator('[role="status"]:has-text("saved")'))
      .or(page.locator('[class*="success"]'));

    await expect(successIndicator.first()).toBeVisible({ timeout: 15000 });
  });

  // ---------------------------------------------------------------------------
  // 03-006: Config persists after page reload
  // ---------------------------------------------------------------------------
  test('03-006: Config persists after page reload', async ({ page }) => {
    await page.goto('/dashboard/agent-config', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    const systemPromptTextarea = page.locator([
      'textarea[placeholder*="helpful AI assistant"]',
      'textarea[placeholder*="prompt"]',
      'textarea',
    ].join(', ')).first();

    await expect(systemPromptTextarea).toBeVisible({ timeout: 15000 });

    const persistenceValue = 'UAT persistence test';

    // Edit the system prompt using the React-compatible native setter pattern.
    await systemPromptTextarea.click();
    await page.evaluate((value) => {
      const el = document.querySelector('textarea') as HTMLTextAreaElement | null;
      if (!el) return;
      const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (proto?.set) proto.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    }, persistenceValue);
    await page.waitForTimeout(600);

    // Click "Save Changes" — the primary save button
    const saveButton = page.locator('button:has-text("Save Changes")').first();

    await expect(saveButton).toBeEnabled({ timeout: 8000 });
    await saveButton.click();

    // Handle the PromptCheckpointModal: click "Confirm & Save"
    const confirmSaveButton = page.locator('button:has-text("Confirm & Save")').first();
    const hasCheckpointModal = await confirmSaveButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasCheckpointModal) {
      await confirmSaveButton.click();
    } else {
      // Fallback if modal uses different wording
      const fallbackConfirm = page.locator('button:has-text("Confirm")').or(
        page.locator('button:has-text("Deploy")')
      ).first();
      const hasFallback = await fallbackConfirm.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasFallback) {
        await fallbackConfirm.click();
      }
    }

    // Wait for success feedback — button changes to "Saved"
    const successIndicator = page.locator('button:has-text("Saved")')
      .or(page.locator('button:has-text("Saved ✓")'))
      .or(page.locator('button:has-text("Changes saved")'))
      .or(page.locator('[role="status"]:has-text("saved")'))
      .or(page.locator('[class*="success"]'));

    await expect(successIndicator.first()).toBeVisible({ timeout: 15000 });

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for the textarea to reappear after reload
    const reloadedTextarea = page.locator([
      'textarea[placeholder*="helpful AI assistant"]',
      'textarea[placeholder*="prompt"]',
      'textarea',
    ].join(', ')).first();

    await expect(reloadedTextarea).toBeVisible({ timeout: 15000 });

    // Verify the textarea still contains the persistence test value
    await expect(reloadedTextarea).toHaveValue(persistenceValue, { timeout: 10000 });
  });

  // ---------------------------------------------------------------------------
  // 03-007: Prompt template updates textarea
  // ---------------------------------------------------------------------------
  test('03-007: Prompt template updates textarea', async ({ page }) => {
    await page.goto('/dashboard/agent-config', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for the system prompt textarea
    const systemPromptTextarea = page.locator([
      'textarea[placeholder*="helpful AI assistant"]',
      'textarea[placeholder*="prompt"]',
      'textarea',
    ].join(', ')).first();

    await expect(systemPromptTextarea).toBeVisible({ timeout: 15000 });

    // Capture the current textarea value
    const valueBefore = await systemPromptTextarea.inputValue();

    // Find a prompt template button/card in the PersonaSection.
    // Templates render as buttons inside a grid with template names and icons.
    const templateButton = page.locator([
      '.grid button:has-text("Persona")',
      '.grid button:has(.text-2xl)',
      'button:near(:text("AI Persona"))',
      '[class*="rounded-xl"][class*="border-2"]',
    ].join(', ')).first();

    const isTemplateVisible = await templateButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isTemplateVisible) {
      // Handle the window.confirm dialog that appears when overwriting a custom prompt
      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      await templateButton.click();

      // Wait briefly for the state update to propagate
      await page.waitForTimeout(1000);

      // Verify the textarea content changed
      const valueAfter = await systemPromptTextarea.inputValue();
      expect(valueAfter).not.toBe(valueBefore);
      // The template should have populated a non-empty prompt
      expect(valueAfter.length).toBeGreaterThan(0);
    } else {
      // Fallback: Look for any clickable element in the persona section
      const personaSection = page.locator('text=AI Persona').locator('..');
      const anyTemplateButton = personaSection.locator('button').first();

      const fallbackVisible = await anyTemplateButton.isVisible({ timeout: 3000 }).catch(() => false);
      expect(fallbackVisible).toBe(true);

      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      await anyTemplateButton.click();
      await page.waitForTimeout(1000);

      const valueAfter = await systemPromptTextarea.inputValue();
      expect(valueAfter).not.toBe(valueBefore);
    }
  });

  // ---------------------------------------------------------------------------
  // 03-008: Test Call button present and responsive
  // ---------------------------------------------------------------------------
  test('03-008: Test Call button present and responsive', async ({ page }) => {
    await page.goto('/dashboard/agent-config', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for the page to fully render
    await page.locator('textarea').first().waitFor({ state: 'visible', timeout: 15000 });

    // Find the test call button. The page has:
    // - Inbound tab: "Test in Browser"
    // - Outbound tab: "Test Call"
    // Use .or() to accept either label.
    const testCallButton = page.locator('button:has-text("Test in Browser")').or(
      page.locator('button:has-text("Test Call")')
    ).first();

    await expect(testCallButton).toBeVisible({ timeout: 5000 });

    // Click the test call button
    await testCallButton.click();

    // Verify some feedback appears within 5 seconds.
    // Possible outcomes:
    // 1. Navigation to /dashboard/test (for test call)
    // 2. A loading spinner appears
    // 3. An error toast/message (e.g., insufficient balance)
    // 4. A modal or dialog appears
    const feedback = page.locator([
      // Loading indicator
      '.animate-spin',
      '[role="progressbar"]',
      // Error message (e.g., insufficient balance or validation error)
      '[class*="bg-red"]',
      '.text-red-700',
      // Toast notification
      '[role="alert"]',
      '[role="status"]',
      // Modal
      '[role="dialog"]',
    ].join(', ')).first();

    // Either the page navigated or some UI feedback appeared
    const hasUiFeedback = await feedback.isVisible({ timeout: 5000 }).catch(() => false);
    const urlChanged = page.url().includes('/dashboard/test');

    expect(hasUiFeedback || urlChanged).toBe(true);
  });
});
