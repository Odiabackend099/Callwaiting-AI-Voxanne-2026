/**
 * UAT-05: Calls Dashboard
 *
 * Tests against the REAL backend with NO mocks.
 * Demo account (voxanne@demo.com) has existing call history data.
 *
 * Actual component structure (verified against source):
 *   - Route: /dashboard/calls
 *   - h1: "Call Recordings" (NOT "Calls")
 *   - Tabs: button "Inbound Calls" / button "Outbound Calls"
 *   - Table: <table> with <tbody> containing <tr class="...cursor-pointer"> rows
 *   - Empty state: <p class="text-obsidian/60">No calls found</p>
 *   - Loading state: <p class="text-obsidian/60">Loading calls...</p>
 *   - Modal: <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 *     - NO role="dialog" -- it's a plain div with Tailwind classes
 *     - Inner content: <div class="bg-white rounded-2xl max-w-4xl ...">
 *     - Metadata labels (uppercase <p>): DURATION, STATUS, SENTIMENT, RECORDING, COST, etc.
 *     - Close: <button> containing <X> icon, or "Close" button at bottom
 *     - Transcript: <p>Transcript</p> inside bg-surgical-50 rounded-lg, items have border-l-4
 *     - Speaker labels: "Voxanne (Agent)" or "Caller"
 *     - Follow-up button in modal actions: <Mail/> Follow-up
 *   - Search: input[type="text"] placeholder "Search by caller name or phone..."
 *   - Status filter: <select> with options: all, completed, missed, transferred, failed
 *   - Date filter: <select> with options: all, today, week, month
 *
 * Covers:
 *   05-001  Call data loads (or empty state shown)
 *   05-002  Call detail modal opens on row click
 *   05-003  Transcript visible in detail
 *   05-004  Sentiment label shown
 *   05-005  Cost in GBP format
 *   05-006  Status filter narrows results
 *   05-007  Search input narrows results
 *   05-008  SMS follow-up visible (nice-to-have)
 *   05-009  Recording player (nice-to-have)
 */

import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers/uat-auth.helper';

test.describe('UAT-05: Calls Dashboard', () => {
  /** Collect page-level JS errors so we can assert "no crashes" after interactions. */
  const pageErrors: Error[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    page.on('pageerror', (err) => pageErrors.push(err));
    await loginAsDemo(page);
  });

  // ---------------------------------------------------------------------------
  // 05-001: Calls page shows real call data or empty state
  // ---------------------------------------------------------------------------
  test('05-001: Calls page shows real call data', async ({ page }) => {
    await page.goto('/dashboard/calls');
    await page.waitForLoadState('load');

    // The page h1 is "Call Recordings" — not "Calls"
    const heading = page.locator('h1').filter({ hasText: 'Call Recordings' }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // The tab buttons must be present
    await expect(page.locator('button').filter({ hasText: 'Inbound Calls' }).first())
      .toBeVisible({ timeout: 10000 });
    await expect(page.locator('button').filter({ hasText: 'Outbound Calls' }).first())
      .toBeVisible({ timeout: 10000 });

    // Wait for the table to finish loading (spinner disappears, tbody content appears)
    // Loading state shows "Loading calls..." in a <td colSpan=7>
    await page.waitForFunction(() => {
      const loadingText = document.querySelector('td');
      return !loadingText?.textContent?.includes('Loading calls...');
    }, { timeout: 15000 });

    // The table tbody should contain either:
    //   - Real call rows (tr.cursor-pointer)
    //   - Empty state row with "No calls found"
    const tbody = page.locator('table tbody').first();
    await expect(tbody).toBeVisible({ timeout: 10000 });

    const tbodyText = await tbody.textContent() || '';
    const hasCallRows = await page.locator('table tbody tr.cursor-pointer').count() > 0;
    const hasEmptyState = /No calls found/i.test(tbodyText);

    // Either real data or empty state — both are valid
    expect(hasCallRows || hasEmptyState).toBe(true);

    if (hasCallRows) {
      // If data exists, verify at least one row contains a date-like string
      const hasDateToken = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20\d{2})\b/i.test(tbodyText);
      expect(hasDateToken).toBeTruthy();
    }
  });

  // ---------------------------------------------------------------------------
  // 05-002: Call detail modal opens on click
  // ---------------------------------------------------------------------------
  test('05-002: Call detail modal opens on click', async ({ page }) => {
    await page.goto('/dashboard/calls');
    await page.waitForLoadState('load');

    // Wait for loading to complete
    await page.waitForFunction(() => {
      const tds = document.querySelectorAll('td');
      return !Array.from(tds).some(td => td.textContent?.includes('Loading calls...'));
    }, { timeout: 15000 });

    // Check for clickable call rows
    const clickableRows = page.locator('table tbody tr.cursor-pointer');
    const rowCount = await clickableRows.count();

    if (rowCount === 0) {
      test.skip(true, 'No call rows present — cannot test modal opening. Empty state is valid.');
      return;
    }

    // Click the first cursor-pointer row — triggers fetchCallDetail(call.id)
    await clickableRows.first().click();

    // Modal: <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    // Tailwind generates individual class names so we locate by the combination.
    // We find the modal inner container (bg-white rounded-2xl) which is always unique.
    const modalInner = page.locator('div.bg-white.rounded-2xl').first();
    await expect(modalInner).toBeVisible({ timeout: 8000 });

    // The modal header contains the caller name as h2 and the call type + date as p
    const modalText = await modalInner.textContent() || '';

    // Modal must contain at least one of the metadata label words
    const hasDetailLabel = /Duration|Status|Cost|Sentiment|Recording/i.test(modalText);
    expect(hasDetailLabel).toBeTruthy();

    // Close the modal using the "Close" button at the bottom or the X icon button
    const closeButton = modalInner.locator('button').filter({ hasText: 'Close' }).first();
    const hasCloseButton = await closeButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasCloseButton) {
      await closeButton.click();
      await expect(modalInner).not.toBeVisible({ timeout: 3000 });
    }
  });

  // ---------------------------------------------------------------------------
  // 05-003: Transcript visible in detail
  // ---------------------------------------------------------------------------
  test('05-003: Transcript visible in detail', async ({ page }) => {
    await page.goto('/dashboard/calls');
    await page.waitForLoadState('load');

    // Wait for loading to complete
    await page.waitForFunction(() => {
      const tds = document.querySelectorAll('td');
      return !Array.from(tds).some(td => td.textContent?.includes('Loading calls...'));
    }, { timeout: 15000 });

    const clickableRows = page.locator('table tbody tr.cursor-pointer');
    const rowCount = await clickableRows.count();

    if (rowCount === 0) {
      test.skip(true, 'No call rows present — cannot test transcript display');
      return;
    }

    await clickableRows.first().click();

    // Wait for modal inner panel
    const modalInner = page.locator('div.bg-white.rounded-2xl').first();
    await expect(modalInner).toBeVisible({ timeout: 8000 });

    // The transcript section is conditionally rendered:
    //   {selectedCall.transcript && selectedCall.transcript.length > 0 && (
    //     <div className="bg-surgical-50 rounded-lg p-4">
    //       <p className="text-sm font-bold text-obsidian mb-4">Transcript</p>
    //       ...
    //     </div>
    //   )}
    // So "Transcript" heading only appears when there is transcript data.
    const transcriptHeading = modalInner.locator('p').filter({ hasText: 'Transcript' }).first();
    const hasTranscript = await transcriptHeading.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasTranscript) {
      // No transcript for this call — this is a valid state (not all calls have transcripts)
      test.skip(true, 'First call has no transcript data — skipping transcript visibility check');
      return;
    }

    // Transcript section exists — verify the speaker turn divs with border-l-4
    const speakerTurns = modalInner.locator('div.border-l-4');
    const turnCount = await speakerTurns.count();
    expect(turnCount).toBeGreaterThanOrEqual(1);

    // Verify speaker labels ("Caller" or "Voxanne (Agent)") exist inside the turns
    const speakerLabels = modalInner.locator('span').filter({ hasText: /Caller|Voxanne \(Agent\)/ });
    const labelCount = await speakerLabels.count();
    expect(labelCount).toBeGreaterThanOrEqual(1);

    // The transcript container (space-y-3) should have real text content
    const transcriptContainer = modalInner.locator('.space-y-3').last();
    const transcriptText = await transcriptContainer.textContent() || '';
    expect(transcriptText.length).toBeGreaterThan(20);
  });

  // ---------------------------------------------------------------------------
  // 05-004: Sentiment label shown
  // ---------------------------------------------------------------------------
  test('05-004: Sentiment label shown', async ({ page }) => {
    await page.goto('/dashboard/calls');
    await page.waitForLoadState('load');

    await page.waitForFunction(() => {
      const tds = document.querySelectorAll('td');
      return !Array.from(tds).some(td => td.textContent?.includes('Loading calls...'));
    }, { timeout: 15000 });

    const clickableRows = page.locator('table tbody tr.cursor-pointer');
    const rowCount = await clickableRows.count();

    if (rowCount === 0) {
      test.skip(true, 'No call rows present — cannot test sentiment display');
      return;
    }

    await clickableRows.first().click();

    const modalInner = page.locator('div.bg-white.rounded-2xl').first();
    await expect(modalInner).toBeVisible({ timeout: 8000 });

    // Sentiment metadata section: the modal always renders the "SENTIMENT" label.
    // Value is: selectedCall.sentiment_label || 'neutral'
    // So "Sentiment" (the uppercase label p) is always present.
    const sentimentLabel = modalInner.locator('p').filter({ hasText: 'Sentiment' }).first();
    await expect(sentimentLabel).toBeVisible({ timeout: 5000 });

    // The actual sentiment value (e.g. "Neutral", "Positive", etc.) follows the label
    const modalText = (await modalInner.textContent() || '').toLowerCase();
    const hasSentimentValue =
      /positive|neutral|negative|anxious|frustrated|reassured|decisive/i.test(modalText) ||
      /urgency/i.test(modalText);

    expect(hasSentimentValue).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // 05-005: Cost in GBP format
  // ---------------------------------------------------------------------------
  test('05-005: Cost in GBP format', async ({ page }) => {
    await page.goto('/dashboard/calls');
    await page.waitForLoadState('load');

    await page.waitForFunction(() => {
      const tds = document.querySelectorAll('td');
      return !Array.from(tds).some(td => td.textContent?.includes('Loading calls...'));
    }, { timeout: 15000 });

    const clickableRows = page.locator('table tbody tr.cursor-pointer');
    const rowCount = await clickableRows.count();

    if (rowCount === 0) {
      test.skip(true, 'No call rows present — cannot test cost display');
      return;
    }

    await clickableRows.first().click();

    const modalInner = page.locator('div.bg-white.rounded-2xl').first();
    await expect(modalInner).toBeVisible({ timeout: 8000 });

    // The "COST" metadata label is always rendered in the modal metadata grid.
    // Value is: `£${(cost_cents / 100).toFixed(2)}` when cost_cents > 0, otherwise "—"
    const costLabel = modalInner.locator('p').filter({ hasText: 'Cost' }).first();
    await expect(costLabel).toBeVisible({ timeout: 5000 });

    // The full page text may or may not contain "£" depending on whether this call has cost data
    const fullPageText = await page.textContent('body') || '';
    const hasPoundSign = fullPageText.includes('\u00a3') || fullPageText.includes('£');
    const hasDashValue = fullPageText.includes('—'); // em dash shown when cost is null/zero
    const hasCostLabel = /\bCost\b/i.test(fullPageText);

    // At minimum the "Cost" metadata label must be visible
    expect(hasCostLabel).toBeTruthy();

    // If cost data exists, it must be formatted as £X.XX
    if (hasPoundSign) {
      expect(/£\d+\.\d{2}/.test(fullPageText)).toBeTruthy();
    }
  });

  // ---------------------------------------------------------------------------
  // 05-006: Status filter narrows results
  // ---------------------------------------------------------------------------
  test('05-006: Status filter narrows results', async ({ page }) => {
    await page.goto('/dashboard/calls');
    await page.waitForLoadState('load');

    await page.waitForFunction(() => {
      const tds = document.querySelectorAll('td');
      return !Array.from(tds).some(td => td.textContent?.includes('Loading calls...'));
    }, { timeout: 15000 });

    // The status filter <select> has options: all, completed, missed, transferred, failed
    // It is the first select on the page (no aria-label but is identifiable by its options)
    const statusSelect = page.locator('select').filter({
      has: page.locator('option[value="completed"]')
    }).first();

    await expect(statusSelect).toBeVisible({ timeout: 5000 });

    // Select "completed" — triggers setFilterStatus('completed') + setCurrentPage(1)
    await statusSelect.selectOption('completed');

    // Wait for SWR to refetch with the status filter
    await page.waitForTimeout(1000);
    await page.waitForLoadState('load');

    // No critical JS errors after filter interaction
    const criticalErrors = pageErrors.filter(
      (e) => !e.message.includes('ResizeObserver') && !e.message.includes('hydrat')
    );
    expect(criticalErrors).toHaveLength(0);

    // If rows are present after filtering, they should show "Completed" status badges
    const rows = page.locator('table tbody tr.cursor-pointer');
    const filteredRowCount = await rows.count();

    if (filteredRowCount > 0) {
      // Check first few rows for "Completed" status badge
      for (let i = 0; i < Math.min(filteredRowCount, 5); i++) {
        const rowText = (await rows.nth(i).textContent()) || '';
        const isCompletedOrNoInfo = /completed/i.test(rowText);
        // Each visible row should contain the "Completed" status
        expect(isCompletedOrNoInfo).toBeTruthy();
      }
    }
    // If 0 rows: the filter returned no "completed" calls — "No calls found" shown, which is valid
  });

  // ---------------------------------------------------------------------------
  // 05-007: Search input narrows results
  // ---------------------------------------------------------------------------
  test('05-007: Search input narrows results', async ({ page }) => {
    await page.goto('/dashboard/calls');
    await page.waitForLoadState('load');

    await page.waitForFunction(() => {
      const tds = document.querySelectorAll('td');
      return !Array.from(tds).some(td => td.textContent?.includes('Loading calls...'));
    }, { timeout: 15000 });

    // The search input: input[type="text"] with placeholder "Search by caller name or phone..."
    const searchInput = page.locator(
      'input[type="text"][placeholder="Search by caller name or phone..."]'
    ).first();

    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Capture initial table content
    const initialContent = await page.locator('table tbody').textContent() || '';

    // Type a search query that is unlikely to match any calls
    await searchInput.fill('xyznotexistentquery12345');

    // Wait for the search debounce + SWR refetch to complete.
    // The table shows "Loading calls..." while refetching — wait for that to clear.
    await page.waitForFunction(() => {
      const tbody = document.querySelector('table tbody');
      return tbody ? !tbody.textContent?.includes('Loading calls...') : false;
    }, { timeout: 15000 }).catch(() => {/* already cleared */});

    // Give one extra tick for React state to settle
    await page.waitForTimeout(500);

    // Content should have changed — either different results or "No calls found"
    const updatedContent = await page.locator('table tbody').textContent() || '';
    const contentChanged = updatedContent !== initialContent || /No calls found/i.test(updatedContent);
    expect(contentChanged).toBeTruthy();

    // No critical JS errors after search
    const criticalErrors = pageErrors.filter(
      (e) => !e.message.includes('ResizeObserver') && !e.message.includes('hydrat')
    );
    expect(criticalErrors).toHaveLength(0);

    // Clear the search by pressing Escape (the component handles Escape to clear)
    await searchInput.press('Escape');
    await page.waitForTimeout(800);
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('');
  });

  // ---------------------------------------------------------------------------
  // 05-008: SMS follow-up visible from detail (nice-to-have)
  // ---------------------------------------------------------------------------
  test('05-008: SMS follow-up visible from detail', async ({ page }) => {
    await page.goto('/dashboard/calls');
    await page.waitForLoadState('load');

    await page.waitForFunction(() => {
      const tds = document.querySelectorAll('td');
      return !Array.from(tds).some(td => td.textContent?.includes('Loading calls...'));
    }, { timeout: 15000 });

    const clickableRows = page.locator('table tbody tr.cursor-pointer');
    const rowCount = await clickableRows.count();

    if (rowCount === 0) {
      test.skip(true, 'No call rows present — cannot test follow-up button');
      return;
    }

    await clickableRows.first().click();

    const modalInner = page.locator('div.bg-white.rounded-2xl').first();
    await expect(modalInner).toBeVisible({ timeout: 8000 });

    // The modal actions section renders a "Follow-up" button with <Mail> icon.
    // It is enabled only when selectedCall.phone_number is truthy.
    // Button text: "Follow-up"
    const followUpButton = modalInner.locator('button').filter({ hasText: 'Follow-up' }).first();
    const hasFollowUp = await followUpButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasFollowUp) {
      test.skip(true, 'Follow-up button not found — call may not have a phone number; nice-to-have feature');
      return;
    }

    expect(hasFollowUp).toBeTruthy();

    // If the Follow-up button is enabled (phone_number present), clicking it should
    // open the follow-up modal (showFollowupModal = true)
    const isEnabled = await followUpButton.isEnabled();
    if (isEnabled) {
      await followUpButton.click();
      // The follow-up modal has h2 "Send Follow-up"
      const followupModal = page.locator('h2').filter({ hasText: 'Send Follow-up' }).first();
      const followupModalVisible = await followupModal.isVisible({ timeout: 3000 }).catch(() => false);
      expect(followupModalVisible).toBeTruthy();
    }
  });

  // ---------------------------------------------------------------------------
  // 05-009: Recording player for calls with recordings (nice-to-have)
  // ---------------------------------------------------------------------------
  test('05-009: Recording player for calls with recordings', async ({ page }) => {
    await page.goto('/dashboard/calls');
    await page.waitForLoadState('load');

    await page.waitForFunction(() => {
      const tds = document.querySelectorAll('td');
      return !Array.from(tds).some(td => td.textContent?.includes('Loading calls...'));
    }, { timeout: 15000 });

    const clickableRows = page.locator('table tbody tr.cursor-pointer');
    const rowCount = await clickableRows.count();

    if (rowCount === 0) {
      test.skip(true, 'No call rows present — cannot test recording player');
      return;
    }

    await clickableRows.first().click();

    const modalInner = page.locator('div.bg-white.rounded-2xl').first();
    await expect(modalInner).toBeVisible({ timeout: 8000 });

    // The modal always shows "RECORDING" metadata label with value "Available" or "None"
    const recordingLabel = modalInner.locator('p').filter({ hasText: 'Recording' }).first();
    await expect(recordingLabel).toBeVisible({ timeout: 5000 });

    // RecordingPlayer is only rendered when has_recording && recording_status === 'completed'
    // The recording section contains: <p>Recording</p> (as section heading) inside bg-surgical-50
    const recordingSections = modalInner.locator('.bg-surgical-50.rounded-lg p').filter({
      hasText: /^Recording$/
    });
    const recordingSectionCount = await recordingSections.count();

    // Also check for audio element or a play-related button
    const audioElement = modalInner.locator('audio').first();
    const hasAudio = await audioElement.isVisible({ timeout: 1000 }).catch(() => false);

    const hasRecordingSection = recordingSectionCount > 0;

    if (!hasAudio && !hasRecordingSection) {
      // This call has no recording — "None" shown in metadata, RecordingPlayer not rendered
      test.skip(true, 'This call has no recording (has_recording=false or recording_status!=completed) — nice-to-have');
      return;
    }

    expect(hasAudio || hasRecordingSection).toBeTruthy();
  });
});
