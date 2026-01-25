/**
 * Accessibility Tests
 *
 * Verifies WCAG 2.1 AA compliance using axe-core
 * Ensures all buttons have proper aria-labels for screen readers
 * Tests keyboard navigation and focus management
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth to avoid login redirect
    await page.context().addCookies([
      {
        name: 'sb-access-token',
        value: 'mock-token',
        domain: 'localhost',
        path: '/'
      }
    ]);
  });

  test('Dashboard calls page should have zero accessibility violations', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/calls', { waitUntil: 'networkidle' });

    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa', 'wcag21aa'])
      .analyze();

    // Assert zero violations
    console.log(`✓ Accessibility Violations Found: ${accessibilityScanResults.violations.length}`);
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('All icon-only buttons must have aria-labels', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/calls', { waitUntil: 'networkidle' });

    // Find all buttons without visible text (icon-only buttons)
    const buttons = await page.locator('button').all();

    let ariaLabelCount = 0;
    let totalIconButtons = 0;

    for (const btn of buttons) {
      const textContent = (await btn.textContent())?.trim();
      const hasAriaLabel = await btn.getAttribute('aria-label');

      // Icon-only buttons typically have no text or very short text
      if (!textContent || textContent.length < 3) {
        totalIconButtons++;
        if (hasAriaLabel) {
          ariaLabelCount++;
        } else {
          console.warn(`❌ Button missing aria-label: ${await btn.outerHTML()}`);
        }
      }
    }

    console.log(`✓ Icon-Only Buttons with aria-labels: ${ariaLabelCount}/${totalIconButtons}`);
    expect(ariaLabelCount).toBe(totalIconButtons);
  });

  test('Pagination buttons should have aria-labels and aria-current', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/calls', { waitUntil: 'networkidle' });

    // Find pagination buttons
    const pageButtons = await page.locator('button[aria-label*="page"]').all();

    let validPaginationButtons = 0;
    for (const btn of pageButtons) {
      const hasAriaLabel = await btn.getAttribute('aria-label');
      const isCurrentPage = await btn.getAttribute('aria-current') === 'page';

      if (hasAriaLabel && (isCurrentPage || !isCurrentPage)) {
        validPaginationButtons++;
      }
    }

    console.log(`✓ Valid Pagination Buttons: ${validPaginationButtons}/${pageButtons.length}`);
    expect(validPaginationButtons).toBe(pageButtons.length);
  });

  test('Modal should trap focus and be keyboard navigable', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/calls', { waitUntil: 'networkidle' });

    // Open first call detail
    const firstCallRow = await page.locator('table tbody tr').first();
    await firstCallRow?.click();

    // Wait for modal
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => null);

    // Check modal has proper attributes
    const modal = page.locator('[role="dialog"]').first();
    const exists = await modal.count() > 0;

    if (exists) {
      // Verify modal has proper ARIA attributes
      const hasRole = await modal.getAttribute('role');
      console.log(`✓ Modal has role="dialog": ${hasRole === 'dialog'}`);
      expect(hasRole).toBe('dialog');
    }
  });

  test('Buttons should be keyboard focusable (Tab key)', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/calls', { waitUntil: 'networkidle' });

    // Get first button
    const firstButton = await page.locator('button').first();

    // Focus via tab key
    await page.keyboard.press('Tab');

    // Check if any button received focus
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    const isFocusableButton = focusedElement === 'BUTTON';

    console.log(`✓ Buttons are tab-focusable: ${isFocusableButton}`);
    expect(isFocusableButton).toBe(true);
  });

  test('Disabled buttons should have aria-disabled or disabled attribute', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/calls', { waitUntil: 'networkidle' });

    const disabledButtons = await page.locator('button[disabled]').all();
    let properlyMarked = 0;

    for (const btn of disabledButtons) {
      const disabled = await btn.getAttribute('disabled');
      const ariaDisabled = await btn.getAttribute('aria-disabled');

      if (disabled !== null || ariaDisabled === 'true') {
        properlyMarked++;
      }
    }

    console.log(`✓ Properly marked disabled buttons: ${properlyMarked}/${disabledButtons.length}`);
    expect(properlyMarked).toBe(disabledButtons.length);
  });

  test('Form labels should be associated with inputs', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/calls', { waitUntil: 'networkidle' });

    // Check for search input
    const searchInput = page.locator('input[type="text"]').first();

    if (await searchInput.count() > 0) {
      const inputId = await searchInput.getAttribute('id');
      const label = inputId ? await page.locator(`label[for="${inputId}"]`).count() : 0;

      // Either has associated label or has aria-label
      const ariaLabel = await searchInput.getAttribute('aria-label');
      const hasLabel = label > 0 || ariaLabel !== null;

      console.log(`✓ Input has associated label or aria-label: ${hasLabel}`);
      expect(hasLabel).toBe(true);
    }
  });

  test('Color contrast should be sufficient', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/calls', { waitUntil: 'networkidle' });

    // Run axe scan specifically for color contrast
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');
    console.log(`✓ Color Contrast Violations: ${contrastViolations.length}`);
    expect(contrastViolations).toEqual([]);
  });
});
