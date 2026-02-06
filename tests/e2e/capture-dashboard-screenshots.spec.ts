import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';

// Simplified script to just capture dashboard screenshots
// We'll add coordinates manually after seeing what's on the pages

test.describe('Dashboard Screenshots', () => {
    const screenshotsDir = '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/public/screenshots';
    test.setTimeout(120000); // 2 minutes timeout

    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
    });

    const capture = async (page: any, url: string, name: string) => {
        try {
            console.log(`📸 Capturing ${name}...`);
            await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);  // Wait 2 seconds for page to stabilize
            await page.screenshot({ path: path.join(screenshotsDir, name), fullPage: false });
            console.log(`✅ Saved ${name}`);
        } catch (e) {
            console.error(`❌ Failed to capture ${name}:`, e);
        }
    };

    test('Capture dashboard screenshots', async ({ page }) => {
        // Login first
        console.log('Logging in...');
        await page.goto('http://localhost:3000/login');
        await page.fill('input[type="email"]', 'voxanne@demo.com');
        await page.fill('input[type="password"]', 'demo123');
        await page.click('button:has-text("Sign In")');
        await page.waitForURL('**/dashboard', { timeout: 15000 });
        await page.waitForTimeout(2000);
        console.log('✅ Logged in');

        // Capture dashboard pages
        await capture(page, 'http://localhost:3000/dashboard', '01_dashboard_home.png');
        await capture(page, 'http://localhost:3000/dashboard/agent-config', '02_agent_config_inbound.png');
        await capture(page, 'http://localhost:3000/dashboard/knowledge-base', '03_knowledge_base.png');
        await capture(page, 'http://localhost:3000/dashboard/inbound-config', '04_telephony_credentials.png');
        await capture(page, 'http://localhost:3000/dashboard/telephony', '05_ai_forwarding_wizard_step1.png');
        await capture(page, 'http://localhost:3000/dashboard/agent-config', '07_test_browser_idle.png');
        await capture(page, 'http://localhost:3000/dashboard/outbound', '09_test_live_call_form.png');
        await capture(page, 'http://localhost:3000/dashboard/calls', '11_call_logs_dashboard.png');

        console.log('\n✅ All 8 dashboard screenshots captured!');
    });
});
