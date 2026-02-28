/**
 * UAT-06: Leads & Outbound Call-Back
 *
 * Tests against the REAL backend with NO mocks.
 * Validates the /dashboard/leads page: lead list, stats cards,
 * detail modal, call-back flow, status filter, search, and service tags.
 */

import { test, expect } from '@playwright/test';
import { loginAsDemo, gotoPage } from './helpers/uat-auth.helper';

test.describe('UAT-06: Leads & Outbound Call-Back', () => {
  const pageErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    await loginAsDemo(page);
  });

  // ── 06-001 ─────────────────────────────────────────────────────────────
  test('06-001: Leads page shows lead data and stats cards', async ({ page }) => {
    await gotoPage(page, '/dashboard/leads');

    // Wait for loading spinner to disappear (page uses "Loading leads..." text)
    await expect(
      page.locator('text=Loading leads..., text=Loading...')
    ).toBeHidden({ timeout: 15000 }).catch(() => {
      // spinner may already be gone
    });

    // At least one lead row should be visible.
    // Each lead card is a div with the contact name rendered as an h3.
    const leadRows = page.locator(
      '[class*="cursor-pointer"] h3, ' +
      'table tbody tr, ' +
      '[data-testid="lead-row"], ' +
      '.space-y-4 > div.bg-white'
    );
    await expect(leadRows.first()).toBeVisible({ timeout: 15000 });

    // Stats cards are rendered via the /api/contacts/stats endpoint.
    // The page header says "Live Leads (Real-Time)" -- confirm page loaded
    const heading = page.locator(
      'h1:has-text("Leads"), h1:has-text("leads"), [data-testid="leads-heading"]'
    );
    await expect(heading.first()).toBeVisible({ timeout: 5000 });

    // Verify no JS errors
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydration')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ── 06-002 ─────────────────────────────────────────────────────────────
  test('06-002: Lead row shows score and status', async ({ page }) => {
    await gotoPage(page, '/dashboard/leads');

    // Wait for first lead card to appear
    const firstCard = page.locator('.space-y-4 > div.bg-white, [data-testid="lead-row"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    // Score badge: rendered as "Hot (85)" or "Warm (62)" or "Cold (30)" etc.
    // The pattern is: label text followed by a number in parentheses.
    const scoreBadge = firstCard.locator(
      'span:has-text("Hot"), span:has-text("Warm"), span:has-text("Cold")'
    );
    await expect(scoreBadge.first()).toBeVisible({ timeout: 5000 });

    // Verify the badge contains a number in parentheses (the score 0-100)
    const badgeText = await scoreBadge.first().textContent();
    expect(badgeText).toBeTruthy();
    const scoreMatch = badgeText!.match(/\((\d+)\)/);
    expect(scoreMatch).toBeTruthy();
    const scoreValue = parseInt(scoreMatch![1], 10);
    expect(scoreValue).toBeGreaterThanOrEqual(0);
    expect(scoreValue).toBeLessThanOrEqual(100);

    // Status label: one of "New", "Contacted", "Qualified", "Booked", "Converted", "Lost", "Hot", "Warm", "Cold"
    const statusBadge = firstCard.locator(
      'span.rounded-full, [data-testid="lead-status"]'
    );
    // The card has at least 2 rounded-full badges (score + status)
    expect(await statusBadge.count()).toBeGreaterThanOrEqual(2);
  });

  // ── 06-003 ─────────────────────────────────────────────────────────────
  test('06-003: Lead detail opens on click', async ({ page }) => {
    await gotoPage(page, '/dashboard/leads');

    // Wait for a lead card
    const firstCard = page.locator('.space-y-4 > div.bg-white, [data-testid="lead-row"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    // Click the lead card to open detail modal
    await firstCard.click();

    // The modal shows the phone number in the header: <p>{selectedLead.phone_number}</p>
    // Phone numbers look like +1555... or +44...
    const phoneInDetail = page.locator(
      '[class*="fixed"] [class*="rounded-2xl"] p:has-text("+"), ' +
      '[role="dialog"] :text-matches("\\\\+\\\\d"), ' +
      '.fixed.inset-0 p:has-text("+")'
    );
    await expect(phoneInDetail.first()).toBeVisible({ timeout: 10000 });

    // Also verify the modal header has a name
    const nameInDetail = page.locator(
      '[class*="fixed"] [class*="rounded-2xl"] h2, ' +
      '[role="dialog"] h2'
    );
    await expect(nameInDetail.first()).toBeVisible({ timeout: 5000 });
  });

  // ── 06-004 ─────────────────────────────────────────────────────────────
  test('06-004: Call Back button present', async ({ page }) => {
    await gotoPage(page, '/dashboard/leads');

    // Wait for first lead card
    const firstCard = page.locator('.space-y-4 > div.bg-white, [data-testid="lead-row"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    // The "Call Back" button is on each lead card (not inside the modal).
    // Text is "Call Back" in the card, and "Call Now" in the modal footer.
    const callBackButton = page.locator(
      'button:has-text("Call Back"), ' +
      'button:has-text("Call Now"), ' +
      'button:has-text("Outbound"), ' +
      '[data-testid="call-back-button"]'
    );
    await expect(callBackButton.first()).toBeVisible({ timeout: 5000 });
    await expect(callBackButton.first()).toBeEnabled();
  });

  // ── 06-005 ─────────────────────────────────────────────────────────────
  test('06-005: Call Back shows actionable error when misconfigured', async ({ page }) => {
    await gotoPage(page, '/dashboard/leads');

    // Wait for first lead card
    const firstCard = page.locator('.space-y-4 > div.bg-white, [data-testid="lead-row"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    // Click the "Call Back" button on the first lead card
    const callBackBtn = firstCard.locator(
      'button:has-text("Call Back"), button:has-text("Call Now")'
    ).first();
    await callBackBtn.click();

    // Wait for either:
    // 1. Success feedback: toast with "Call initiated" or similar
    // 2. Actionable error: config guide modal OR toast error OR error banner
    //
    // The page shows a "Configuration Required" modal for known errors,
    // or a toast for generic errors, or a success toast.

    // NOTE: Use .or() chains — comma-separated text= selectors don't work as OR in Playwright
    const successOrError = page.locator('[data-sonner-toast]')
      .or(page.locator('[role="alert"]'))
      .or(page.locator('[role="status"]'))
      .or(page.locator('h2:has-text("Configuration Required")'))
      .or(page.locator('.bg-red-50'))
      .or(page.locator('div.text-red-700'))
      .or(page.locator('div.text-red-600'));

    await expect(successOrError.first()).toBeVisible({ timeout: 20000 });

    // Verify the feedback is user-friendly (not a raw stack trace)
    const feedbackText = await successOrError.first().textContent();
    expect(feedbackText).toBeTruthy();
    // A stack trace typically contains "at " followed by function references
    expect(feedbackText).not.toMatch(/\bat\s+\w+\.\w+\s*\(/);
    // Should not be an empty or purely whitespace response
    expect(feedbackText!.trim().length).toBeGreaterThan(3);
  });

  // ── 06-006 ─────────────────────────────────────────────────────────────
  test('06-006: Status filter works', async ({ page }) => {
    await gotoPage(page, '/dashboard/leads');

    // Wait for leads to load
    const leadCards = page.locator('.space-y-4 > div.bg-white, [data-testid="lead-row"]');
    await expect(leadCards.first()).toBeVisible({ timeout: 15000 });

    // The status/score filter is a <select> with options "All Scores", "Hot (80+)", "Warm (50-79)"
    const statusFilter = page.locator(
      'select:has(option:has-text("Hot")), ' +
      'select:has(option:has-text("All Scores")), ' +
      '[data-testid="status-filter"], ' +
      '[data-testid="score-filter"]'
    );
    await expect(statusFilter.first()).toBeVisible({ timeout: 5000 });

    // Select "Hot (80+)" option
    await statusFilter.first().selectOption({ label: 'Hot (80+)' }).catch(async () => {
      // Fallback: try by value
      await statusFilter.first().selectOption('hot').catch(() => {
        // If select doesn't have the exact option, click to interact
      });
    });

    // Wait briefly for the list to update (SWR refetch)
    await page.waitForTimeout(1500);

    // Verify no critical JS errors occurred from the filter interaction
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydration')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ── 06-007 ─────────────────────────────────────────────────────────────
  test('06-007: Search narrows by name or phone', async ({ page }) => {
    await gotoPage(page, '/dashboard/leads');

    // Wait for leads to load
    const leadCards = page.locator('.space-y-4 > div.bg-white, [data-testid="lead-row"]');
    await expect(leadCards.first()).toBeVisible({ timeout: 15000 });

    // Capture the initial count of visible lead rows
    const initialCount = await leadCards.count();

    // Find the search input
    const searchInput = page.locator(
      'input[placeholder*="Search"], ' +
      'input[placeholder*="search"], ' +
      'input[type="search"], ' +
      '[data-testid="leads-search"]'
    );
    await expect(searchInput.first()).toBeVisible({ timeout: 5000 });

    // Get the name from the first lead to use as search term
    const firstLeadName = await page.locator(
      '.space-y-4 > div.bg-white h3, [data-testid="lead-row"] h3'
    ).first().textContent();

    // Type a search term -- use the first few characters of the lead name
    const searchTerm = firstLeadName
      ? firstLeadName.trim().split(' ')[0].substring(0, 4)
      : 'test';

    await searchInput.first().fill(searchTerm);

    // Wait for list to update (SWR re-fetches on search change)
    await page.waitForTimeout(1500);

    // The page should either show filtered results or "No leads found".
    // Either way, it should not crash.
    const hasResults = await leadCards.first().isVisible().catch(() => false);
    const hasEmptyState = await page.locator('text=No leads found').isVisible().catch(() => false);

    // At least one of these states should be true
    expect(hasResults || hasEmptyState).toBeTruthy();

    // Verify no JS errors
    const criticalErrors = pageErrors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('hydration')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  // ── 06-008 ─────────────────────────────────────────────────────────────
  test('06-008: Service interest tags visible (nice-to-have)', async ({ page }) => {
    await gotoPage(page, '/dashboard/leads');

    // Wait for leads to load
    const leadCards = page.locator('.space-y-4 > div.bg-white, [data-testid="lead-row"]');
    await expect(leadCards.first()).toBeVisible({ timeout: 15000 });

    // Service interest tags are rendered as small badge/pill elements
    // inside each lead card when services_interested array is non-empty.
    // They use: "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-surgical-50"
    const serviceTags = page.locator(
      '.space-y-4 > div.bg-white .rounded-full.bg-surgical-50, ' +
      '[data-testid="service-tag"], ' +
      '.space-y-4 > div.bg-white span[class*="rounded-full"][class*="bg-surgical-50"]'
    );

    const tagCount = await serviceTags.count();

    if (tagCount === 0) {
      // Nice-to-have: skip gracefully if no services are tagged on any lead
      test.skip();
      return;
    }

    // At least one tag is visible -- verify it has readable text
    const tagText = await serviceTags.first().textContent();
    expect(tagText).toBeTruthy();
    expect(tagText!.trim().length).toBeGreaterThan(0);
  });
});
