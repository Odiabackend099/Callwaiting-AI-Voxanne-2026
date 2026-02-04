import { test } from '@playwright/test';
import path from 'path';

test.describe('Retry Screenshot 05', () => {
    const screenshotsDir = '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/public/screenshots';
    test.setTimeout(120000); // 2 minutes

    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
    });

    test('Capture 05', async ({ page }) => {
        // Login
        console.log('Logging in...');
        await page.goto('http://localhost:3000/login');
        await page.fill('input[type="email"]', 'VOXANNE@DEMO.COM');
        await page.fill('input[type="password"]', 'demo123');
        await page.click('button:has-text("Sign In")');
        await page.waitForURL('**/dashboard', { timeout: 30000 });
        console.log('Login successful.');

        // 5. AI Forwarding 1
        console.log('Capturing 05...');
        await page.goto('http://localhost:3000/dashboard/telephony', { timeout: 60000 });
        await page.waitForTimeout(5000); // Wait longer for wizard
        await page.screenshot({ path: path.join(screenshotsDir, '05_ai_forwarding_wizard_step1.png'), fullPage: true });
        console.log('✅ Saved 05');
    });
});
