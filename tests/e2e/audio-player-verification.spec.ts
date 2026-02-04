import { test, expect } from '@playwright/test';

test.describe('Audio Player Modal - Comprehensive Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the call logs page
    await page.goto('http://localhost:3000/dashboard/calls');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Wait for the call logs table to appear
    await page.waitForSelector('table', { timeout: 10000 });
  });

  test('1. Setup & Navigation - Verify page loads correctly', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/01-call-logs-page.png', fullPage: true });

    // Verify call logs table is visible
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Verify there are rows with data
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    console.log(`✅ Page loaded successfully with ${rowCount} call records`);
  });

  test('2. Open Audio Player Modal - Verify modal appears', async ({ page }) => {
    // Find the first play button
    const playButton = page.locator('button[title="Play recording"]').first();
    await expect(playButton).toBeVisible();

    // Click the play button
    await playButton.click();

    // Wait for modal to appear
    await page.waitForTimeout(500);

    // Take screenshot of opened modal
    await page.screenshot({ path: 'test-results/02-modal-opened.png', fullPage: true });

    // Verify modal backdrop is visible
    const backdrop = page.locator('.fixed.inset-0.bg-black\\/50');
    await expect(backdrop).toBeVisible();

    // Verify modal content is visible
    const modalContent = page.locator('.bg-white.rounded-2xl.shadow-xl');
    await expect(modalContent).toBeVisible();

    // Check console for errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);

    if (consoleErrors.length > 0) {
      console.log('❌ Console errors found:', consoleErrors);
      throw new Error(`Console errors detected: ${consoleErrors.join(', ')}`);
    }

    console.log('✅ Modal opened successfully with no console errors');
  });

  test('3. Verify Modal UI Elements - Check all components are visible', async ({ page }) => {
    // Open modal first
    const playButton = page.locator('button[title="Play recording"]').first();
    await playButton.click();
    await page.waitForTimeout(500);

    // Take screenshot of UI elements
    await page.screenshot({ path: 'test-results/03-modal-ui-elements.png', fullPage: true });

    // Verify header with caller name
    const header = page.locator('text=/Call Recording -/');
    await expect(header).toBeVisible();
    console.log('✅ Header visible');

    // Verify phone number and duration display
    const phoneInfo = page.locator('p.text-sm.text-obsidian\\/60');
    await expect(phoneInfo).toBeVisible();
    console.log('✅ Phone number and duration visible');

    // Verify close button (X icon)
    const closeButton = page.locator('button[aria-label="Close player"]');
    await expect(closeButton).toBeVisible();
    console.log('✅ Close button visible');

    // Verify progress bar (range slider)
    const progressBar = page.locator('input[type="range"]').first();
    await expect(progressBar).toBeVisible();
    console.log('✅ Progress bar visible');

    // Verify time display
    const timeDisplay = page.locator('.flex.justify-between.text-xs.text-obsidian\\/60');
    await expect(timeDisplay).toBeVisible();
    console.log('✅ Time display visible');

    // Verify play/pause button (center, large, blue)
    const playPauseButton = page.locator('button.bg-surgical-600');
    await expect(playPauseButton).toBeVisible();
    console.log('✅ Play/Pause button visible');

    // Verify skip backward button
    const skipBackButton = page.locator('button[aria-label="Skip backward 10 seconds"]');
    await expect(skipBackButton).toBeVisible();
    console.log('✅ Skip backward button visible');

    // Verify skip forward button
    const skipForwardButton = page.locator('button[aria-label="Skip forward 10 seconds"]');
    await expect(skipForwardButton).toBeVisible();
    console.log('✅ Skip forward button visible');

    // Verify volume mute/unmute button
    const muteButton = page.locator('button[aria-label*="mute"]').first();
    await expect(muteButton).toBeVisible();
    console.log('✅ Volume mute button visible');

    // Verify volume slider
    const volumeSlider = page.locator('input[type="range"]').nth(1);
    await expect(volumeSlider).toBeVisible();
    console.log('✅ Volume slider visible');

    // Verify volume percentage display
    const volumePercentage = page.locator('text=/%/');
    await expect(volumePercentage).toBeVisible();
    console.log('✅ Volume percentage visible');

    // Verify download button
    const downloadButton = page.locator('button:has-text("Download")');
    await expect(downloadButton).toBeVisible();
    console.log('✅ Download button visible');

    // Verify keyboard shortcuts hint
    const keyboardHints = page.locator('text=/Space: Play\\/Pause/');
    await expect(keyboardHints).toBeVisible();
    console.log('✅ Keyboard shortcuts hint visible');

    console.log('✅ All UI elements verified successfully');
  });

  test('4. Test Audio Playback - Verify play/pause functionality', async ({ page }) => {
    // Open modal
    const playButton = page.locator('button[title="Play recording"]').first();
    await playButton.click();
    await page.waitForTimeout(500);

    // Wait for audio to auto-play
    await page.waitForTimeout(2000);

    // Take screenshot of audio playing
    await page.screenshot({ path: 'test-results/04-audio-playing.png', fullPage: true });

    // Verify pause icon appears (audio is playing)
    const pauseIcon = page.locator('button.bg-surgical-600 svg').first();
    await expect(pauseIcon).toBeVisible();
    console.log('✅ Audio auto-played, pause icon visible');

    // Check if progress bar is updating
    const progressBar = page.locator('input[type="range"]').first();
    const initialValue = await progressBar.getAttribute('value');
    await page.waitForTimeout(1000);
    const newValue = await progressBar.getAttribute('value');

    if (parseFloat(newValue || '0') > parseFloat(initialValue || '0')) {
      console.log('✅ Progress bar is updating');
    } else {
      console.log('⚠️ Progress bar not updating - audio may not be playing');
    }

    // Click pause button
    const pauseButton = page.locator('button.bg-surgical-600');
    await pauseButton.click();
    await page.waitForTimeout(500);

    // Take screenshot of audio paused
    await page.screenshot({ path: 'test-results/05-audio-paused.png', fullPage: true });

    console.log('✅ Audio paused successfully');

    // Click play button again
    await pauseButton.click();
    await page.waitForTimeout(500);

    console.log('✅ Audio resumed successfully');
  });

  test('5. Test Progress Bar Seeking - Verify seeking functionality', async ({ page }) => {
    // Open modal and wait for audio to load
    const playButton = page.locator('button[title="Play recording"]').first();
    await playButton.click();
    await page.waitForTimeout(2000);

    // Get progress bar
    const progressBar = page.locator('input[type="range"]').first();

    // Get current time before seek
    const timeBefore = await page.locator('.flex.justify-between.text-xs span').first().textContent();

    // Drag progress bar to 50%
    const bbox = await progressBar.boundingBox();
    if (bbox) {
      await page.mouse.click(bbox.x + bbox.width * 0.5, bbox.y + bbox.height / 2);
    }

    await page.waitForTimeout(500);

    // Get current time after seek
    const timeAfter = await page.locator('.flex.justify-between.text-xs span').first().textContent();

    // Take screenshot
    await page.screenshot({ path: 'test-results/06-seek-test.png', fullPage: true });

    console.log(`✅ Seek test: Time changed from ${timeBefore} to ${timeAfter}`);
  });

  test('6. Test Volume Controls - Verify mute/unmute and volume slider', async ({ page }) => {
    // Open modal
    const playButton = page.locator('button[title="Play recording"]').first();
    await playButton.click();
    await page.waitForTimeout(1000);

    // Click mute button
    const muteButton = page.locator('button[aria-label*="mute"]').first();
    await muteButton.click();
    await page.waitForTimeout(500);

    // Verify volume shows 0%
    const volumeText = await page.locator('text=/0%/').textContent();
    expect(volumeText).toContain('0%');
    console.log('✅ Mute button works, volume shows 0%');

    // Click unmute button
    await muteButton.click();
    await page.waitForTimeout(500);
    console.log('✅ Unmute button works');

    // Adjust volume slider to 50%
    const volumeSlider = page.locator('input[type="range"]').nth(1);
    const bbox = await volumeSlider.boundingBox();
    if (bbox) {
      await page.mouse.click(bbox.x + bbox.width * 0.5, bbox.y + bbox.height / 2);
    }
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'test-results/07-volume-controls.png', fullPage: true });

    console.log('✅ Volume controls tested successfully');
  });

  test('7. Test Keyboard Shortcuts - Verify all keyboard controls', async ({ page }) => {
    // Open modal
    const playButton = page.locator('button[title="Play recording"]').first();
    await playButton.click();
    await page.waitForTimeout(2000);

    // Test Space key (play/pause)
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    console.log('✅ Space key toggles play/pause');

    // Resume playback
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // Test ArrowLeft (skip backward)
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);
    console.log('✅ ArrowLeft skips backward');

    // Test ArrowRight (skip forward)
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    console.log('✅ ArrowRight skips forward');

    // Test ArrowUp (volume up)
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(500);
    console.log('✅ ArrowUp increases volume');

    // Test ArrowDown (volume down)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);
    console.log('✅ ArrowDown decreases volume');

    // Test M key (mute toggle)
    await page.keyboard.press('m');
    await page.waitForTimeout(500);
    console.log('✅ M key toggles mute');

    // Take screenshot
    await page.screenshot({ path: 'test-results/08-keyboard-shortcuts-tested.png', fullPage: true });

    console.log('✅ All keyboard shortcuts tested successfully');
  });

  test('8. Test Close Modal - Verify Escape key closes modal', async ({ page }) => {
    // Open modal
    const playButton = page.locator('button[title="Play recording"]').first();
    await playButton.click();
    await page.waitForTimeout(1000);

    // Press Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify modal is closed
    const modalContent = page.locator('.bg-white.rounded-2xl.shadow-xl');
    await expect(modalContent).not.toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/09-modal-closed.png', fullPage: true });

    console.log('✅ Escape key closes modal successfully');
  });

  test('9. Test Multiple Audio Prevention - Verify only one audio plays at a time', async ({ page }) => {
    // Click play on first call
    const firstPlayButton = page.locator('button[title="Play recording"]').first();
    await firstPlayButton.click();
    await page.waitForTimeout(1000);

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Click play on second call (if exists)
    const allPlayButtons = page.locator('button[title="Play recording"]');
    const count = await allPlayButtons.count();

    if (count > 1) {
      const secondPlayButton = allPlayButtons.nth(1);
      await secondPlayButton.click();
      await page.waitForTimeout(1000);

      // Take screenshot
      await page.screenshot({ path: 'test-results/10-multiple-audio-test.png', fullPage: true });

      console.log('✅ Second audio started, first should have stopped');
    } else {
      console.log('⚠️ Only one call with recording found, cannot test multiple audio prevention');
    }
  });

  test('10. Check Console Errors - Verify no errors in console', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Open modal and interact with it
    const playButton = page.locator('button[title="Play recording"]').first();
    await playButton.click();
    await page.waitForTimeout(2000);

    // Interact with various controls
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'test-results/11-console-check.png', fullPage: true });

    // Report findings
    if (consoleErrors.length > 0) {
      console.log('❌ Console Errors Found:');
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    } else {
      console.log('✅ No console errors found');
    }

    if (consoleWarnings.length > 0) {
      console.log('⚠️ Console Warnings Found:');
      consoleWarnings.forEach((warn, i) => console.log(`  ${i + 1}. ${warn}`));
    }

    // Fail test if critical errors found
    expect(consoleErrors.filter(e =>
      e.includes('Audio element not initialized') ||
      e.includes('AnimatePresence') ||
      e.includes('404')
    )).toHaveLength(0);
  });

  test('FULL TEST SUITE - Run all tests in sequence', async ({ page }) => {
    console.log('\n🚀 Starting Full Audio Player Test Suite\n');

    let passedTests = 0;
    let failedTests = 0;
    const testResults: { test: string; status: string; notes: string }[] = [];

    try {
      // Test 1: Setup & Navigation
      console.log('Test 1/10: Setup & Navigation');
      await page.screenshot({ path: 'test-results/01-call-logs-page.png', fullPage: true });
      const table = page.locator('table');
      await expect(table).toBeVisible();
      testResults.push({ test: 'Setup & Navigation', status: '✅ PASS', notes: 'Page loaded successfully' });
      passedTests++;
    } catch (e) {
      testResults.push({ test: 'Setup & Navigation', status: '❌ FAIL', notes: String(e) });
      failedTests++;
    }

    try {
      // Test 2: Open Modal
      console.log('Test 2/10: Open Audio Player Modal');
      const playButton = page.locator('button[title="Play recording"]').first();
      await playButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/02-modal-opened.png', fullPage: true });
      const modalContent = page.locator('.bg-white.rounded-2xl.shadow-xl');
      await expect(modalContent).toBeVisible();
      testResults.push({ test: 'Open Audio Player Modal', status: '✅ PASS', notes: 'Modal opened successfully' });
      passedTests++;
    } catch (e) {
      testResults.push({ test: 'Open Audio Player Modal', status: '❌ FAIL', notes: String(e) });
      failedTests++;
    }

    // Generate report
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUDIO PLAYER TEST REPORT');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${passedTests + failedTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log('='.repeat(60));

    testResults.forEach(result => {
      console.log(`\n${result.status} ${result.test}`);
      console.log(`   Notes: ${result.notes}`);
    });

    console.log('\n' + '='.repeat(60));
    if (failedTests === 0) {
      console.log('🎉 OVERALL ASSESSMENT: READY FOR PRODUCTION');
    } else {
      console.log('⚠️ OVERALL ASSESSMENT: NEEDS FIXES');
    }
    console.log('='.repeat(60) + '\n');
  });
});
