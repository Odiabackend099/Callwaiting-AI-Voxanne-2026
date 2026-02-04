import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Remotion Demo Screenshots', () => {
    const screenshotsDir = '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/public/screenshots';

    test.use({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1, // Ensure 1:1 pixel mapping if possible, though standard is fine
    });

    test.beforeAll(async () => {
        // Ensure directory exists
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }
    });

    test('Capture all 4 screenshots', async ({ page }) => {
        // Screenshot 1: 00_homepage_top.png
        console.log('Capturing Screenshot 1...');
        await page.goto('http://localhost:3000');
        // Wait for page to fully load (2-3 seconds as requested)
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(screenshotsDir, '00_homepage_top.png') });

        // Screenshot 2: 00_homepage_scrolled.png
        console.log('Capturing Screenshot 2...');
        await page.evaluate(() => window.scrollTo(0, 800));
        await page.waitForTimeout(1000); // Wait for smooth scroll
        await page.screenshot({ path: path.join(screenshotsDir, '00_homepage_scrolled.png') });

        // Screenshot 3: 00_signin_page.png
        console.log('Capturing Screenshot 3...');
        await page.goto('http://localhost:3000/login');
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(screenshotsDir, '00_signin_page.png') });

        // Screenshot 4: 00_dashboard_after_login.png
        console.log('Capturing Screenshot 4...');
        // Assuming we are on login page from previous step
        await page.fill('input[type="email"]', 'voxanne@demo.com');
        await page.fill('input[type="password"]', 'demo123');

        // Click "Sign In" - need to find correct selector. 
        // Usually it's a button with type="submit" or text "Sign In"
        // Going with generic robust selector or fallback
        const signInBtn = page.locator('button[type="submit"]');
        await signInBtn.click();

        // Wait for redirect to /dashboard
        await page.waitForURL('**/dashboard', { timeout: 10000 });

        // Wait 2 more seconds
        await page.waitForTimeout(2000);

        await page.screenshot({ path: path.join(screenshotsDir, '00_dashboard_after_login.png') });
        console.log('All screenshots captured successfully.');
    });
});
