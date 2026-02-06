import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

// ============================================================================
// SCENE 1: "Zero to Hero" Flow (Homepage → Create Assistant)
// ============================================================================

interface ElementCoordinates {
  name: string;
  selector: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface SceneManifest {
  screenshotName: string;
  resolution: { width: number; height: number };
  capturedAt: string;
  elements: ElementCoordinates[];
}

async function extractCoordinates(
  page: any,
  selectors: Record<string, string>,
  screenshotName: string
): Promise<SceneManifest> {
  const elements: ElementCoordinates[] = [];

  for (const [name, selector] of Object.entries(selectors)) {
    try {
      const element = await page.locator(selector).first();
      const box = await element.boundingBox();

      if (box) {
        elements.push({
          name,
          selector,
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
          centerX: Math.round(box.x + box.width / 2),
          centerY: Math.round(box.y + box.height / 2),
        });
        console.log(`✅ Extracted: ${name} -> (${box.x}, ${box.y}, ${box.width}, ${box.height})`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to extract ${name} (${selector}):`, error);
    }
  }

  return {
    screenshotName,
    resolution: { width: 1920, height: 1080 },
    capturedAt: new Date().toISOString(),
    elements,
  };
}

async function saveManifest(manifest: SceneManifest) {
  const manifestsDir = '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/public/manifests';
  await fs.mkdir(manifestsDir, { recursive: true });

  const filename = manifest.screenshotName.replace('.png', '.json');
  const filepath = path.join(manifestsDir, filename);

  await fs.writeFile(filepath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`💾 Saved manifest: ${filename}`);
}

test.describe('Scene 1: Zero to Hero Assets', () => {
  const screenshotsDir = '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/public/screenshots';
  test.setTimeout(120000); // 2 minutes timeout

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('Capture Scene 1 Assets (Homepage → Dashboard)', async ({ page }) => {
    console.log('\n🎬 SCENE 1: CAPTURING ASSETS FOR "ZERO TO HERO" FLOW\n');

    // ========================================================================
    // PART A: HOMEPAGE (The Hook)
    // ========================================================================

    console.log('📸 Part A: Capturing Homepage...');
    await page.goto('http://localhost:3000', { timeout: 60000, waitUntil: 'networkidle' });
    await page.waitForTimeout(15000); // Wait 15 seconds for full page load

    // Scroll to top
    await page.evaluate(() => window.scrollTo(0, 0));

    // Take homepage screenshot (no manifest needed - just visual)
    await page.screenshot({
      path: path.join(screenshotsDir, '01_homepage.png'),
      fullPage: false,
      type: 'png'
    });
    console.log('✅ Saved: 01_homepage.png');

    // ========================================================================
    // PART B: DASHBOARD (The Action)
    // ========================================================================

    console.log('\n📸 Part B: Capturing Dashboard with "Create Assistant" button...');

    // Navigate to login page
    await page.goto('http://localhost:3000/login', { timeout: 60000, waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Login
    console.log('🔐 Logging in with voxanne@demo.com...');
    await page.fill('input[type="email"]', 'voxanne@demo.com');
    await page.fill('input[type="password"]', 'demo123');
    await page.click('button:has-text("Sign In")');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForTimeout(15000); // Wait 15 seconds for dashboard to fully load
    console.log('✅ Dashboard loaded');

    // Scroll to top
    await page.evaluate(() => window.scrollTo(0, 0));

    // Define selectors for "Create Assistant" button
    // Try multiple possible selectors
    const dashboardSelectors: Record<string, string> = {
      'create-assistant-btn': [
        'button:has-text("Create Assistant")',
        'button:has-text("Create Agent")',
        'button:has-text("New Agent")',
        'a:has-text("Create Assistant")',
        'a:has-text("Create Agent")',
        'a[href*="agent-config"]',
        '[data-testid="create-agent"]',
        '#create-agent-btn'
      ].join(', '),
      'dashboard-header': 'h1:has-text("Dashboard")',
      'navigation-bar': 'nav',
    };

    // Extract coordinates BEFORE taking screenshot
    const manifest = await extractCoordinates(page, dashboardSelectors, '02_dashboard.png');
    await saveManifest(manifest);

    // Take dashboard screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, '02_dashboard.png'),
      fullPage: false,
      type: 'png'
    });
    console.log('✅ Saved: 02_dashboard.png');

    // ========================================================================
    // VERIFICATION
    // ========================================================================

    console.log('\n✅ SCENE 1 ASSETS CAPTURED SUCCESSFULLY!');
    console.log('📁 Screenshots:');
    console.log('   - 01_homepage.png (The Hook)');
    console.log('   - 02_dashboard.png (The Action)');
    console.log('📁 Manifests:');
    console.log('   - 02_dashboard.json (Create Assistant button coordinates)');

    if (manifest.elements.length > 0) {
      console.log('\n🎯 Extracted Coordinates:');
      manifest.elements.forEach(el => {
        console.log(`   - ${el.name}: {x: ${el.x}, y: ${el.y}, width: ${el.width}, height: ${el.height}}`);
        console.log(`     Center: {x: ${el.centerX}, y: ${el.centerY}}`);
      });
    } else {
      console.warn('\n⚠️  WARNING: No coordinates extracted! Button selectors may be incorrect.');
      console.warn('   Manual inspection of dashboard HTML required.');
    }
  });
});
