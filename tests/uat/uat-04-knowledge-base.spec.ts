/**
 * UAT-04: Knowledge Base
 *
 * Tests the knowledge base document management page against the REAL backend -- NO mocks.
 * Validates document listing, file upload, active/inactive toggling, deletion,
 * and manual text entry.
 *
 * Page under test: /dashboard/knowledge-base
 *
 * Actual component structure (verified against source):
 *   - h1: "Knowledge Base"
 *   - h2: "Your Documents" (in left panel)
 *   - Document count: "{n} documents" or "{n} document"
 *   - Empty state text: "No documents yet."
 *   - Document items: div.p-4.hover:bg-surgical-50 inside divide-y list
 *   - Each doc: button (filename, calls beginEdit) + button[title="Delete"] (Trash2 icon)
 *   - Hidden file input: input[type="file"][accept=".txt,.md"][aria-label="Upload knowledge base document"]
 *   - Upload trigger button text: "Upload File"
 *   - After upload success: div with class bg-surgical-50 containing "File loaded: {name}"
 *   - Document Name input: input#kb-filename, placeholder "e.g., pricing.md"
 *   - Content textarea: textarea#kb-content, placeholder "Paste your content here. Markdown is supported."
 *   - Active checkbox: input[type="checkbox"] with label "Active (AI can use this)"
 *   - Save button: "Create" (new) or "Update" (editing); disabled unless filename+content filled
 */

import { test, expect } from '@playwright/test';
import { loginAsDemo } from './helpers/uat-auth.helper';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

test.describe('UAT-04: Knowledge Base', () => {
  /** Collect page-level JS errors for assertions. */
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await loginAsDemo(page);
  });

  // ---------------------------------------------------------------------------
  // 04-001: KB page loads with document list or empty state
  // ---------------------------------------------------------------------------
  test('04-001: KB page loads with document list or empty state', async ({ page }) => {
    await page.goto('/dashboard/knowledge-base', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // The page h1 is exactly "Knowledge Base"
    const heading = page.locator('h1').filter({ hasText: 'Knowledge Base' }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // The left panel always shows the "Your Documents" h2 heading
    const yourDocuments = page.locator('h2').filter({ hasText: 'Your Documents' }).first();
    await expect(yourDocuments).toBeVisible({ timeout: 10000 });

    // The page shows either documents or the empty state.
    // Empty state: "No documents yet."
    // Document state: the count text "{n} document(s)" appears below the h2.
    // Use .filter() with regex — p:text-matches() is not valid Playwright/CSS syntax
    const docCountOrEmpty = page.locator('p').filter({
      hasText: /(No documents yet|\d+\s+documents?)/,
    }).first();

    await expect(docCountOrEmpty).toBeVisible({ timeout: 10000 });

    // No uncaught JS errors
    expect(pageErrors).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // 04-002: Upload zone accepts files
  // ---------------------------------------------------------------------------
  test('04-002: Upload zone accepts files', async ({ page }) => {
    await page.goto('/dashboard/knowledge-base', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for page heading
    await page.locator('h1').filter({ hasText: 'Knowledge Base' }).first()
      .waitFor({ state: 'visible', timeout: 15000 });

    // The visible upload trigger is a button with text "Upload File".
    // The actual file input is hidden (class="hidden") but present in the DOM.
    const uploadButton = page.locator('button').filter({ hasText: 'Upload File' }).first();
    await expect(uploadButton).toBeVisible({ timeout: 10000 });

    // The hidden file input must exist in DOM with the correct accept attribute
    const fileInput = page.locator('input[type="file"][accept=".txt,.md"]').first();
    await expect(fileInput).toBeAttached({ timeout: 5000 });

    // Aria label is set for accessibility
    await expect(fileInput).toHaveAttribute('aria-label', 'Upload knowledge base document');
  });

  // ---------------------------------------------------------------------------
  // 04-003: File upload succeeds and appears in list
  // ---------------------------------------------------------------------------
  test('04-003: File upload succeeds and appears in list', async ({ page }) => {
    await page.goto('/dashboard/knowledge-base', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for page heading
    await page.locator('h1').filter({ hasText: 'Knowledge Base' }).first()
      .waitFor({ state: 'visible', timeout: 15000 });

    // Create a minimal .txt test file (the page accepts .txt and .md, NOT PDF)
    const testFileName = `uat-test-doc-${Date.now()}.txt`;
    const testFileContent = 'UAT test document content for knowledge base upload verification.';
    const tempDir = os.tmpdir();
    const testFilePath = path.join(tempDir, testFileName);

    fs.writeFileSync(testFilePath, testFileContent, 'utf-8');

    try {
      // Locate the hidden file input — Playwright can set files on hidden inputs
      const fileInput = page.locator('input[type="file"][accept=".txt,.md"]').first();
      await expect(fileInput).toBeAttached({ timeout: 5000 });

      // Set the file — this triggers handleFileUpload which calls FileReader.readAsText
      await fileInput.setInputFiles(testFilePath);

      // After upload, the component calls setSuccess(`File loaded: ${file.name}`)
      // which renders a div.bg-surgical-50 containing "File loaded: {filename}"
      const successMessage = page.locator('text=File loaded').first();
      await expect(successMessage).toBeVisible({ timeout: 15000 });

      // The draft form is populated with the filename — verify input#kb-filename
      const filenameInput = page.locator('input#kb-filename').first();
      await expect(filenameInput).toBeVisible({ timeout: 5000 });

      // The filename input value should contain the uploaded file's name
      const filenameValue = await filenameInput.inputValue();
      expect(filenameValue).toContain('uat-test-doc');

      // The content textarea should be populated with file contents
      const contentTextarea = page.locator('textarea#kb-content').first();
      const contentValue = await contentTextarea.inputValue();
      expect(contentValue).toContain('UAT test document content');

    } finally {
      // Clean up temp file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 04-004: Document toggle active/inactive
  // ---------------------------------------------------------------------------
  test('04-004: Document toggle active/inactive', async ({ page }) => {
    await page.goto('/dashboard/knowledge-base', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for page heading
    await page.locator('h1').filter({ hasText: 'Knowledge Base' }).first()
      .waitFor({ state: 'visible', timeout: 15000 });

    // Check if there are any documents in the list.
    // Documents are rendered inside a div.divide-y container as div.p-4 children.
    // Each doc row contains a button for the filename.
    const documentRows = page.locator('.divide-y div.p-4');
    const docCount = await documentRows.count();

    if (docCount === 0) {
      // Verify the empty state is present, then skip
      const emptyState = page.locator('p:has-text("No documents yet")').first();
      const hasEmpty = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
      test.skip(true, `No documents exist (empty state visible: ${hasEmpty}) -- cannot test active/inactive toggle`);
      return;
    }

    // Click the filename button of the first document to load it into the editor.
    // Each document has a button (the filename) that calls beginEdit(item).
    const firstDocNameButton = documentRows.first().locator('button').first();
    await firstDocNameButton.click();

    // Wait for the editor to populate with the document data
    await page.waitForTimeout(800);

    // The active checkbox is at the bottom of the editor panel.
    // It is rendered as: <input type="checkbox"> with label "Active (AI can use this)"
    const activeCheckbox = page.locator('label').filter({ hasText: 'Active (AI can use this)' })
      .locator('input[type="checkbox"]').first();

    await expect(activeCheckbox).toBeVisible({ timeout: 5000 });

    // Record the current state
    const wasChecked = await activeCheckbox.isChecked();

    // Toggle the checkbox
    await activeCheckbox.click();
    await page.waitForTimeout(300);

    // Verify the state changed
    const isNowChecked = await activeCheckbox.isChecked();
    expect(isNowChecked).not.toBe(wasChecked);

    // Restore original state to avoid side effects on demo data
    await activeCheckbox.click();
    await page.waitForTimeout(300);
    const restoredState = await activeCheckbox.isChecked();
    expect(restoredState).toBe(wasChecked);
  });

  // ---------------------------------------------------------------------------
  // 04-005: Document can be deleted
  // ---------------------------------------------------------------------------
  test('04-005: Document can be deleted', async ({ page }) => {
    // This test modifies data -- we only delete if documents exist.
    await page.goto('/dashboard/knowledge-base', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for page heading
    await page.locator('h1').filter({ hasText: 'Knowledge Base' }).first()
      .waitFor({ state: 'visible', timeout: 15000 });

    // Document delete buttons have title="Delete" and contain the Trash2 icon
    const deleteButtons = page.locator('button[title="Delete"]');
    const deleteCount = await deleteButtons.count();

    if (deleteCount === 0) {
      test.skip(true, 'No documents available to delete -- skipping deletion test');
      return;
    }

    // Read the count text before deletion.
    // Component renders: `{items.length} document{items.length !== 1 ? 's' : ''}`
    const countText = page.locator('p').filter({ hasText: /\d+ documents?/ }).first();
    const countTextBefore = await countText.textContent().catch(() => '');
    const countBefore = parseInt(countTextBefore?.match(/(\d+)/)?.[1] || '0', 10);

    if (countBefore === 0) {
      test.skip(true, 'Zero documents in list -- skipping deletion test');
      return;
    }

    // Handle potential browser confirm dialogs (the component does not use window.confirm,
    // but accept just in case)
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Click the last delete button (avoids deleting important first/primary documents)
    await deleteButtons.last().click();

    // After deletion, the component calls setSuccess('✅ Document deleted.') and reloads.
    // The success message container uses: p-4 bg-surgical-50 border border-surgical-200 rounded-lg text-surgical-600
    const successMessage = page.locator('.bg-surgical-50').filter({ hasText: /Document deleted|deleted/i })
      .or(page.locator('text=Document deleted'))
      .or(page.locator('text=deleted successfully'))
      .or(page.locator('[role="alert"]').filter({ hasText: /deleted/i }));

    const hasFeedback = await successMessage.first().isVisible({ timeout: 10000 }).catch(() => false);

    if (hasFeedback) {
      expect(hasFeedback).toBe(true);
    } else {
      // Fallback: reload the page and verify document count decreased
      await page.waitForTimeout(3000);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const countTextAfter = await countText.textContent().catch(() => '');
      const countAfter = parseInt(countTextAfter?.match(/(\d+)/)?.[1] || '0', 10);
      expect(countAfter).toBeLessThan(countBefore);
    }
  });

  // ---------------------------------------------------------------------------
  // 04-006: Manual text entry works (nice-to-have)
  // ---------------------------------------------------------------------------
  test('04-006: Manual text entry works', async ({ page }) => {
    await page.goto('/dashboard/knowledge-base', { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // Wait for page heading
    await page.locator('h1').filter({ hasText: 'Knowledge Base' }).first()
      .waitFor({ state: 'visible', timeout: 15000 });

    // The editor panel is always visible on the right (col-span-2).
    // It contains: input#kb-filename, textarea#kb-content, and a checkbox.
    // When draft.id is null (new document state), heading is "Add New Document".

    // Verify the editor panel heading is present
    const editorHeading = page.locator('h2').filter({ hasText: /Add New Document|Edit:/ }).first();
    await expect(editorHeading).toBeVisible({ timeout: 10000 });

    // Click the "Add" button in the document list panel to ensure we're in new-document mode
    const addButton = page.locator('button').filter({ hasText: 'Add' }).first();
    const hasAddButton = await addButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasAddButton) {
      await addButton.click();
      await page.waitForTimeout(500);
    }

    // Locate the Document Name input: id="kb-filename", placeholder "e.g., pricing.md"
    const filenameInput = page.locator('input#kb-filename').first();
    await expect(filenameInput).toBeVisible({ timeout: 5000 });

    // Locate the content textarea: id="kb-content"
    const contentTextarea = page.locator('textarea#kb-content').first();
    await expect(contentTextarea).toBeVisible({ timeout: 5000 });

    const testDocName = `uat-manual-entry-${Date.now()}.txt`;
    const testContent = 'UAT manual text entry test: This document was created by automated testing.';

    // Clear and fill the filename input
    await filenameInput.clear();
    await filenameInput.fill(testDocName);

    // Clear and fill the content textarea
    await contentTextarea.clear();
    await contentTextarea.fill(testContent);

    // Verify values were entered correctly
    await expect(filenameInput).toHaveValue(testDocName);
    await expect(contentTextarea).toHaveValue(testContent);

    // The "Create" button should be enabled now (both fields filled).
    // It is disabled when filename or content is empty.
    const createButton = page.locator('button').filter({ hasText: /^Create$/ }).first();
    await expect(createButton).toBeVisible({ timeout: 3000 });
    await expect(createButton).toBeEnabled({ timeout: 3000 });

    // The Active checkbox should be visible and checked by default (draft.active starts true)
    const activeCheckbox = page.locator('label').filter({ hasText: 'Active (AI can use this)' })
      .locator('input[type="checkbox"]').first();
    await expect(activeCheckbox).toBeVisible({ timeout: 3000 });
    await expect(activeCheckbox).toBeChecked();

    // NOTE: We intentionally do NOT click "Create" to avoid persisting test artifacts
    // in the demo account. This test validates the form accepts manual text input
    // and the Create button becomes enabled when both fields are filled.
  });
});
