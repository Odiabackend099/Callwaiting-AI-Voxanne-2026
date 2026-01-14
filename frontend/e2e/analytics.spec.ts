import { test, expect } from '@playwright/test';

test.describe('Analytics & Revenue Verification', () => {
    test('Dashboard should reflect high-value Rhinoplasty lead', async ({ page }) => {
        // 1. Login (Mock or Real)
        await page.goto('/login');
        await page.fill('input[type="email"]', 'admin@voxanne.demo');
        await page.fill('input[type="password"]', 'demo123');
        await page.click('button:has-text("Sign In")');

        // 2. Navigate to Dashboard
        await page.goto('/dashboard');
        await expect(page).toHaveURL('/dashboard');

        // 3. Verify "Clinical Pulse" or Pipeline Value
        // The "Rhinoplasty" call from the backend script should have added £8,000
        // We look for a metric card containing "Pipeline Value"
        const pipelineCard = page.locator('div:has-text("Pipeline Value")');
        await expect(pipelineCard).toBeVisible();

        // The value should be formatted as GBP
        // We expect it to be non-zero now.
        // Note: Exact value depends on other test data, but we check format and presence.
        await expect(pipelineCard).toContainText('£');

        // 4. Check "Hot Lead" Alert
        const alertsSection = page.locator('div:has-text("Recent Alerts")');
        await expect(alertsSection).toBeVisible();
        await expect(alertsSection).toContainText('Rhinoplasty');
        await expect(alertsSection).toContainText('£8,000'); // Check if value is displayed

        // 5. Verify "Success Rate" Chart exists
        await expect(page.locator('canvas')).toBeVisible(); // Assuming Chart.js/Recharts canvas
    });
});
