import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

// ============================================================================
// Type Definitions for Coordinate Extraction
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

// ============================================================================
// Selector Mappings for Each Screenshot
// ============================================================================

const homepageTopSelectors: Record<string, string> = {
  'hero-heading': 'h1',
  'hero-subheading': 'h1 + p',
  'cta-button-primary': 'button:has-text("Get Started")',
  'cta-button-secondary': 'button:has-text("Watch Demo")',
  'navigation-bar': 'nav',
};

const signInSelectors: Record<string, string> = {
  'email-input': 'input[type="email"]',
  'password-input': 'input[type="password"]',
  'sign-in-button': 'button:has-text("Sign In")',
  'logo': 'svg',
};

const dashboardSelectors: Record<string, string> = {
  'dashboard-header': 'h1:has-text("Dashboard")',
  'recent-activity-section': 'text=/Recent Activity/i',
};

const dashboardHomeSelectors: Record<string, string> = {
  'hot-leads-card': '[data-testid="hot-leads"], .hot-leads-section, section:has-text("Hot Leads")',
  'recent-calls-card': '[data-testid="recent-calls"], .recent-calls-section, section:has-text("Recent Calls")',
};

const agentConfigSelectors: Record<string, string> = {
  'system-prompt-textarea': 'textarea[name="systemPrompt"], textarea[placeholder*="system prompt"], #systemPrompt',
};

const knowledgeBaseSelectors: Record<string, string> = {
  'upload-file-button': 'button:has-text("Upload"), button:has-text("Add Document"), input[type="file"]',
};

const telephonyCredentialsSelectors: Record<string, string> = {
  'twilio-account-sid-input': 'input[name="accountSid"], input[placeholder*="Account SID"]',
  'twilio-auth-token-input': 'input[name="authToken"], input[placeholder*="Auth Token"], input[type="password"]',
  'twilio-phone-number-input': 'input[name="phoneNumber"], input[placeholder*="Phone Number"]',
  'save-telephony-button': 'button:has-text("Save"), button:has-text("Connect"), button[type="submit"]',
};

const aiForwardingSelectors: Record<string, string> = {
  'forwarding-wizard-next': 'button:has-text("Next"), button:has-text("Continue"), button:has-text("Activate")',
};

const testBrowserSelectors: Record<string, string> = {
  'start-test-button': 'button:has-text("Test in Browser"), button:has-text("Start Test")',
};

const liveCallFormSelectors: Record<string, string> = {
  'test-phone-input': 'input[type="tel"], input[name="phoneNumber"], input[placeholder*="phone"]',
  'call-now-button': 'button:has-text("Call Now"), button:has-text("Start Call")',
};

const callLogsSelectors: Record<string, string> = {
  'sentiment-score-cell': 'td:has-text("Sentiment"), [data-column="sentiment"], .sentiment-score',
  'view-transcript-button': 'button:has-text("View Transcript"), button:has-text("Transcript")',
  'call-duration-cell': 'td:has-text("Duration"), [data-column="duration"], .call-duration',
};

// ============================================================================
// Coordinate Extraction Functions
// ============================================================================

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

// ============================================================================
// Enhanced Capture Function with Coordinate Extraction
// ============================================================================

test.describe('Website Journey Screenshots', () => {
    const screenshotsDir = '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/public/screenshots';
    test.setTimeout(300000); // 5 minutes timeout

    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
    });

    const captureWithCoordinates = async (
      page: any,
      url: string,
      name: string,
      selectors: Record<string, string>,
      action?: () => Promise<void>
    ) => {
        try {
            console.log(`📸 Capturing ${name}...`);
            await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(3000);  // Wait 3 seconds for page to stabilize
            if (action) await action();
            await page.waitForTimeout(3000);  // Wait 3 seconds after action

            // Extract coordinates BEFORE taking screenshot
            const manifest = await extractCoordinates(page, selectors, name);
            await saveManifest(manifest);

            // Take screenshot
            await page.screenshot({ path: path.join(screenshotsDir, name), fullPage: false });
            console.log(`✅ Saved ${name}`);
        } catch (e) {
            console.error(`❌ Failed to capture ${name}:`, e);
            try {
                await page.screenshot({ path: path.join(screenshotsDir, `error_${name}`), fullPage: true });
            } catch (err) { }
        }
    };

    test('Capture website journey screenshots with coordinates', async ({ page }) => {
        // 1. Homepage - Top (hero section visible)
        await captureWithCoordinates(page, 'http://localhost:3000', '00_homepage_top.png', homepageTopSelectors);

        // 2. Homepage - Scrolled Down (features section visible)
        await captureWithCoordinates(
          page,
          'http://localhost:3000',
          '00_homepage_scrolled.png',
          homepageTopSelectors, // Reuse same selectors
          async () => {
            try {
                // Scroll down 800px to show features section
                await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
                await page.waitForTimeout(2000);  // Wait 2 seconds for scroll to settle
            } catch (e) {
                console.error('Scroll failed:', e);
            }
          }
        );

        // 3. Sign In Page (empty form)
        await captureWithCoordinates(page, 'http://localhost:3000/login', '00_signin_page.png', signInSelectors);

        // 4. Dashboard After Login (for transition reference)
        await captureWithCoordinates(
          page,
          'http://localhost:3000/login',
          '00_dashboard_after_login.png',
          dashboardSelectors,
          async () => {
            try {
                console.log('Logging in with voxanne@demo.com...');

                // Fill credentials
                await page.fill('input[type="email"]', 'voxanne@demo.com');
                await page.fill('input[type="password"]', 'demo123');

                // Click sign in button
                await page.click('button:has-text("Sign In")');

                // Wait for navigation to dashboard
                await page.waitForURL('**/dashboard', { timeout: 10000 });
                await page.waitForTimeout(3000);  // Wait 3 seconds for dashboard to load

                console.log('Login successful, dashboard visible');
            } catch (e) {
                console.error('Login failed:', e);
            }
          }
        );

        // 5. Dashboard Home Page
        await captureWithCoordinates(
          page,
          'http://localhost:3000/dashboard',
          '01_dashboard_home.png',
          dashboardHomeSelectors
        );

        // 6. Agent Configuration Page
        await captureWithCoordinates(
          page,
          'http://localhost:3000/dashboard/agent-config',
          '02_agent_config_inbound.png',
          agentConfigSelectors
        );

        // 7. Knowledge Base Page
        await captureWithCoordinates(
          page,
          'http://localhost:3000/dashboard/knowledge-base',
          '03_knowledge_base.png',
          knowledgeBaseSelectors
        );

        // 8. Telephony Credentials Page
        await captureWithCoordinates(
          page,
          'http://localhost:3000/dashboard/inbound-config',
          '04_telephony_credentials.png',
          telephonyCredentialsSelectors
        );

        // 9. AI Forwarding Wizard
        await captureWithCoordinates(
          page,
          'http://localhost:3000/dashboard/telephony',
          '05_ai_forwarding_wizard_step1.png',
          aiForwardingSelectors
        );

        // 10. Test Browser Page
        await captureWithCoordinates(
          page,
          'http://localhost:3000/dashboard/agent-config',
          '07_test_browser_idle.png',
          testBrowserSelectors
        );

        // 11. Live Call Test Form
        await captureWithCoordinates(
          page,
          'http://localhost:3000/dashboard/outbound',
          '09_test_live_call_form.png',
          liveCallFormSelectors
        );

        // 12. Call Logs Dashboard
        await captureWithCoordinates(
          page,
          'http://localhost:3000/dashboard/calls',
          '11_call_logs_dashboard.png',
          callLogsSelectors
        );

        console.log('\n✅ All 12 website screenshots captured with coordinates!');
        console.log('Screenshots saved to:', screenshotsDir);
        console.log('Manifests saved to:', '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/public/manifests');
    });
});
