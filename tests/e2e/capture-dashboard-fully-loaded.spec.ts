import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Capture Dashboard Screenshots with Full Data Load', () => {
  test('Capture homepage screenshot', async ({ page }) => {
    // Navigate to homepage
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Wait for page to be interactive
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshotPath = path.join(
      process.cwd(),
      'public/screenshots/01_homepage.png'
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Homepage screenshot saved: ${screenshotPath}`);
  });

  test('Capture fully loaded dashboard with manifest extraction', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

    // Fill login form
    await page.fill('input[type="email"]', 'voxanne@demo.com');
    await page.fill('input[type="password"]', 'demo123');

    // Click sign in
    await page.click('button:has-text("Sign In")');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // CRITICAL: Wait for dashboard to fully load with data
    // This allows API calls to complete and display populated cards
    console.log('⏳ Waiting for dashboard data to fully load...');
    await page.waitForTimeout(60000); // 60 seconds for all data to populate

    // Additional wait for any lazy-loaded elements
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 5000);
      });
    });

    console.log('✅ Dashboard fully loaded');

    // Take screenshot of full page
    const screenshotPath = path.join(
      process.cwd(),
      'public/screenshots/02_dashboard.png'
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Dashboard screenshot saved: ${screenshotPath}`);

    // Extract manifest with element coordinates
    const manifest = await page.evaluate(() => {
      const elements: any[] = [];

      // Define selectors to extract
      const selectors: { [key: string]: string } = {
        'create-assistant-btn': 'button:has-text("Create Assistant"), button:has-text("Create Agent"), a[href*="agent-config"]',
        'dashboard-header': 'h1, h2',
        'navigation-bar': 'nav, [role="navigation"]',
        'recent-activity-card': '[class*="activity"], [class*="recent"]',
        'hot-leads-card': '[class*="lead"], [class*="hot"]',
      };

      for (const [name, selector] of Object.entries(selectors)) {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          elements.push({
            name,
            selector,
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            centerX: Math.round(rect.left + rect.width / 2),
            centerY: Math.round(rect.top + rect.height / 2),
          });
        }
      }

      return {
        screenshotName: '02_dashboard.png',
        resolution: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        capturedAt: new Date().toISOString(),
        elements,
      };
    });

    // Save manifest
    const manifestPath = path.join(
      process.cwd(),
      'public/manifests/02_dashboard.json'
    );

    // Ensure manifests directory exists
    const manifestDir = path.dirname(manifestPath);
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Manifest saved: ${manifestPath}`);
    console.log(`   Found ${manifest.elements.length} elements:`);
    manifest.elements.forEach((el: any) => {
      console.log(`   - ${el.name}: (${el.centerX}, ${el.centerY})`);
    });
  });
});
