import { test } from '@playwright/test';
import path from 'path';

test('Debug Screenshot', async ({ page }) => {
    const screenshotsDir = '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/public/screenshots';
    console.log('Navigating to google');
    await page.goto('https://www.google.com');
    console.log('Taking screenshot');
    await page.screenshot({ path: path.join(screenshotsDir, 'debug_google.png') });
    console.log('Screenshot saved');
});
