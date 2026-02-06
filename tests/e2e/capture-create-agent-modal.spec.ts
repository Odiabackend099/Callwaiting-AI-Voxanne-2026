import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Capture Create Agent Modal with Manifest', () => {
  test('Capture create agent modal and extract coordinates', async ({ page }) => {
    // Login to dashboard
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

    await page.fill('input[type="email"]', 'voxanne@demo.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button:has-text("Sign In")');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Click "Create Assistant" button to open modal
    console.log('🔍 Looking for Create Assistant button...');
    await page.click('button:has-text("Create Assistant"), button:has-text("Create Agent"), a[href*="agent"]', { timeout: 10000 });

    // Wait for modal/page to load
    await page.waitForTimeout(2000);

    console.log('✅ Create Agent modal/page opened');

    // Take screenshot
    const screenshotPath = path.join(
      process.cwd(),
      'public/screenshots/03_create_agent_modal.png'
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`✅ Screenshot saved: ${screenshotPath}`);

    // Extract manifest with specific form elements
    const manifest = await page.evaluate(() => {
      const elements: any[] = [];

      // Define selectors for form elements
      const selectors: { [key: string]: string } = {
        'name_input': 'input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]',
        'voice_select': 'select, [role="combobox"], button[aria-haspopup="listbox"]',
        'save_btn': 'button[type="submit"], button:has-text("Save"), button:has-text("Create")',
        'agent_name_label': 'label:has-text("Name"), label:has-text("Agent Name")',
        'voice_label': 'label:has-text("Voice"), label:has-text("voice")',
      };

      for (const [key, selector] of Object.entries(selectors)) {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          elements.push({
            name: key,
            selector,
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            centerX: Math.round(rect.left + rect.width / 2),
            centerY: Math.round(rect.top + rect.height / 2),
            visible: rect.height > 0 && rect.width > 0,
          });
        }
      }

      return {
        screenshotName: '03_create_agent_modal.png',
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
      'public/manifests/03_create_agent.json'
    );

    const manifestDir = path.dirname(manifestPath);
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✅ Manifest saved: ${manifestPath}`);
    console.log(`   Found ${manifest.elements.length} elements:`);
    manifest.elements.forEach((el: any) => {
      const visible = el.visible ? '✅' : '⚠️';
      console.log(`   ${visible} ${el.name}: (${el.centerX}, ${el.centerY}) - ${el.width}x${el.height}`);
    });
  });
});
