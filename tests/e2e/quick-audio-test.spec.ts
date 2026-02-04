import { test, expect } from '@playwright/test';

test.describe('Quick Audio Player Test', () => {
  test('Can we even load the page?', async ({ page }) => {
    console.log('1. Navigating to homepage...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    console.log('2. Taking screenshot of homepage...');
    await page.screenshot({ path: 'test-results/homepage.png' });

    console.log('3. Checking page title...');
    const title = await page.title();
    console.log(`   Title: ${title}`);

    console.log('✅ Basic page load test passed');
  });

  test('Can we access dashboard?', async ({ page }) => {
    console.log('1. Trying to access dashboard/calls...');
    const response = await page.goto('http://localhost:3000/dashboard/calls');

    console.log(`2. Response status: ${response?.status()}`);
    console.log(`3. Final URL: ${page.url()}`);

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/dashboard-attempt.png' });

    const content = await page.content();
    console.log(`4. Page has ${content.length} characters`);

    if (page.url().includes('/login')) {
      console.log('⚠️  Redirected to login page');
    } else {
      console.log('✅ Dashboard page loaded');
    }
  });
});
