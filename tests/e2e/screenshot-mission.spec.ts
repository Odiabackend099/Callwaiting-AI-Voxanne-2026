import { test } from '@playwright/test';
import path from 'path';

test.describe('Screenshot Capture Mission', () => {
    const screenshotsDir = '/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/remotion-videos/public/screenshots';
    test.setTimeout(600000); // 10 minutes timeout

    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
    });

    const capture = async (page: any, url: string, name: string, action?: () => Promise<void>) => {
        try {
            console.log(`📸 Capturing ${name}...`);
            await page.goto(url, { timeout: 30000 });
            await page.waitForTimeout(3000);
            if (action) await action();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: path.join(screenshotsDir, name), fullPage: true });
            console.log(`✅ Saved ${name}`);
        } catch (e) {
            console.error(`❌ Failed to capture ${name}:`, e);
            try {
                await page.screenshot({ path: path.join(screenshotsDir, `error_${name}`), fullPage: true });
            } catch (err) { }
        }
    };

    test('Capture all 15 screenshots robustly', async ({ page }) => {
        // Login
        try {
            console.log('Logging in...');
            await page.goto('http://localhost:3000/login');
            await page.fill('input[type="email"]', 'VOXANNE@DEMO.COM');
            await page.fill('input[type="password"]', 'demo123');
            await page.click('button:has-text("Sign In")');
            await page.waitForURL('**/dashboard', { timeout: 30000 });
            console.log('Login successful.');
        } catch (e) {
            console.error('Login failed:', e);
        }

        // 1. Dashboard Home
        await capture(page, 'http://localhost:3000/dashboard', '01_dashboard_home.png');

        // 2. Agent Config Inbound
        await capture(page, 'http://localhost:3000/dashboard/agent-config?agent=inbound', '02_agent_config_inbound.png');

        // 3. Knowledge Base
        await capture(page, 'http://localhost:3000/dashboard/knowledge-base', '03_knowledge_base.png');

        // 4. Telephony Creds
        await capture(page, 'http://localhost:3000/dashboard/inbound-config', '04_telephony_credentials.png');

        // 5. AI Forwarding 1
        await capture(page, 'http://localhost:3000/dashboard/telephony', '05_ai_forwarding_wizard_step1.png');

        // 6. AI Forwarding Code
        await capture(page, 'http://localhost:3000/dashboard/telephony', '06_ai_forwarding_code_display.png', async () => {
            try {
                // Optional: Add wizard steps if needed to show code
            } catch (e) { }
        });

        // 7. Browser Test Idle
        await capture(page, 'http://localhost:3000/dashboard/test?tab=web', '07_test_browser_idle.png');

        // 8. Browser Test Active
        await capture(page, 'http://localhost:3000/dashboard/test?tab=web', '08_test_browser_active.png', async () => {
            try {
                await page.click('button:has-text("Start Call")', { timeout: 5000 });
                await page.keyboard.type('What are your hours?');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(8000);
            } catch (e) { }
        });

        // 9. Live Call Form
        await capture(page, 'http://localhost:3000/dashboard/test?tab=phone', '09_test_live_call_form.png');

        // 10. Live Call Active
        await capture(page, 'http://localhost:3000/dashboard/test?tab=phone', '10_test_live_call_active.png', async () => {
            try {
                await page.fill('input[type="tel"]', '+15551234567');
                await page.click('button:has-text("Call Me")', { timeout: 5000 });
                await page.waitForTimeout(5000);
            } catch (e) { }
        });

        // 11. Call Logs
        await capture(page, 'http://localhost:3000/dashboard/calls', '11_call_logs_dashboard.png');

        // 12. Leads
        await capture(page, 'http://localhost:3000/dashboard/leads', '12_leads_dashboard_hot.png');

        // 13. Appointments
        await capture(page, 'http://localhost:3000/dashboard/appointments', '13_appointments_calendar.png');

        // 14. Outbound Config
        await capture(page, 'http://localhost:3000/dashboard/agent-config?agent=outbound', '14_agent_config_outbound.png');

        // 15. Escalation Rules
        await capture(page, 'http://localhost:3000/dashboard/escalation-rules', '15_escalation_rules.png');
    });
});
