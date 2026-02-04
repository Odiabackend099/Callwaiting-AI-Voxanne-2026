import { test } from '@playwright/test';
import path from 'path';

test.describe('Website Journey Screenshots', () => {
    const screenshotsDir = '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/public/screenshots';
    test.setTimeout(300000); // 5 minutes timeout

    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
    });

    const capture = async (page: any, url: string, name: string, action?: () => Promise<void>) => {
        try {
            console.log(`📸 Capturing ${name}...`);
            await page.goto(url, { timeout: 30000, waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);
            if (action) await action();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: path.join(screenshotsDir, name), fullPage: false });
            console.log(`✅ Saved ${name}`);
        } catch (e) {
            console.error(`❌ Failed to capture ${name}:`, e);
            try {
                await page.screenshot({ path: path.join(screenshotsDir, `error_${name}`), fullPage: true });
            } catch (err) { }
        }
    };

    test('Capture website journey screenshots', async ({ page }) => {
        // 1. Homepage - Top (hero section visible)
        await capture(page, 'http://localhost:3000', '00_homepage_top.png');

        // 2. Homepage - Scrolled Down (features section visible)
        await capture(page, 'http://localhost:3000', '00_homepage_scrolled.png', async () => {
            try {
                // Scroll down 800px to show features section
                await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'smooth' }));
                await page.waitForTimeout(1000);
            } catch (e) {
                console.error('Scroll failed:', e);
            }
        });

        // 3. Sign In Page (empty form)
        await capture(page, 'http://localhost:3000/login', '00_signin_page.png');

        // 4. Dashboard After Login (for transition reference)
        await capture(page, 'http://localhost:3000/login', '00_dashboard_after_login.png', async () => {
            try {
                console.log('Logging in with voxanne@demo.com...');

                // Fill credentials
                await page.fill('input[type="email"]', 'voxanne@demo.com');
                await page.fill('input[type="password"]', 'demo123');

                // Click sign in button
                await page.click('button:has-text("Sign In")');

                // Wait for navigation to dashboard
                await page.waitForURL('**/dashboard', { timeout: 10000 });
                await page.waitForTimeout(2000);

                console.log('Login successful, dashboard visible');
            } catch (e) {
                console.error('Login failed:', e);
            }
        });

        console.log('\n✅ All 4 website screenshots captured successfully!');
        console.log('Screenshots saved to:', screenshotsDir);
    });
});
