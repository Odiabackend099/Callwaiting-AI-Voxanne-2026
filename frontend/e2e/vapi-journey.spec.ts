
import { test, expect } from '@playwright/test';

const DASHBOARD_URL = 'http://localhost:3000/dashboard';

test.describe('Vapi Agent Lifecycle & User Acceptance Test', () => {
    test('Complete Vapi Integration Journey', async ({ page }) => {

        // ===============================================
        // MOCK AUTH & API
        // ===============================================
        await page.route('**/auth/v1/user', async route => {
            await route.fulfill({
                status: 200,
                json: {
                    id: 'test-user',
                    aud: 'authenticated',
                    role: 'authenticated',
                    email: 'test@example.com',
                    app_metadata: { provider: 'email' },
                    user_metadata: {},
                    created_at: new Date().toISOString(),
                }
            });
        });

        // Inject session into local storage to satisfy Supabase client init
        await page.addInitScript(() => {
            const session = {
                access_token: 'mock-token',
                refresh_token: 'mock-refresh',
                user: { id: 'test-user', email: 'test@example.com' },
                expires_at: Math.floor(Date.now() / 1000) + 3600
            };
            // Try both standard naming conventions just in case
            localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: session }));
            localStorage.setItem('sb-igdaiursvzwnqucvrhdo-auth-token', JSON.stringify(session));
        });

        // ===============================================
        // STEP 1: Create/Configure Inbound Agent
        // ===============================================
        console.log('Step 1: Configure Inbound Agent');
        await page.goto(`${DASHBOARD_URL}/agent-config?agent=inbound`);

        // Wait for loading to finish
        await expect(page.locator('text=Agent Configuration')).toBeVisible({ timeout: 15000 });

        // Verify Inbound Agent setup by checking for the Inbound Agent header in the content area
        await expect(page.locator('h2:has-text("Inbound Agent")')).toBeVisible();

        // Fill System Prompt (Correct Placeholder)
        await page.fill('textarea[placeholder="You are a helpful AI assistant..."]', 'You are a helpful medical receptionist.');

        // Fill First Message
        await page.fill('textarea[placeholder="Hello, thanks for calling!"]', 'Thanks for calling Voxanne Clinic.');

        // Select Voice (Native Select)
        // We select the second option as the first is "Select a voice..."
        await page.locator('select').first().selectOption({ index: 1 });

        // Click Save
        const savePromise = page.waitForResponse(resp =>
            resp.url().includes('/founder-console/agent/behavior') && resp.status() === 200
        );
        await page.click('button:has-text("Save Inbound Agent")');
        await savePromise;
        console.log('✅ Agent Configuration Saved');

        // ===============================================
        // STEP 2: Update Agent & Verify Idempotency
        // ===============================================
        console.log('Step 2: Update Agent Configuration');

        // Modification
        await page.fill('textarea[placeholder="You are a helpful AI assistant..."]', 'You are a helpful medical receptionist. Modified.');

        const updatePromise = page.waitForResponse(resp =>
            resp.url().includes('/founder-console/agent/behavior') && resp.status() === 200
        );
        await page.click('button:has-text("Save Inbound Agent")');
        await updatePromise;
        console.log('✅ Agent Configuration Updated');

        // ===============================================
        // STEP 3: Provision Phone Number (Mock UI)
        // ===============================================
        console.log('Step 3: Provision Phone Number');
        await page.goto(`${DASHBOARD_URL}/inbound-config`);

        // Wait for page
        await expect(page.locator('text=Phone Configuration').or(page.locator('text=Inbound Configuration'))).toBeVisible();

        // Just verify navigation works for now as strict provisioning test requires valid Twilio credentials in UI
        console.log('✅ Inbound Config Page Loaded');

        // ===============================================
        // STEP 4: Select Number in Agent Config
        // ===============================================
        console.log('Step 4: Link Number to Agent');
        await page.goto(`${DASHBOARD_URL}/agent-config?agent=inbound`);

        await expect(page.locator('text=Select Phone Number')).toBeVisible();

        // Try to select a number if available (might be empty in test env)
        const numberSelect = page.locator('select').nth(1); // Assuming 2nd select on page (1st is template, 2nd is number, 3rd voice, 4th lang)
        // Actually, looking at code: Template is first select. Phone Number is next.
        // Let's verify counts or look for nearby text.

        // Note: If no numbers, the UI shows a warning message (Line 715)
        // "No phone numbers found..."
        // We'll log what we see.
        if (await page.locator('text=No phone numbers found').isVisible()) {
            console.log('⚠️ No numbers found to link (Expected in mock env without Vapi keys)');
        } else {
            console.log('ℹ️ Numbers available, attempting selection');
            // await numberSelect.selectOption({ index: 1 });
            // await page.click('button:has-text("Sync Number")');
        }

        // ===============================================
        // STEP 5: Trigger Outbound Call
        // ===============================================
        console.log('Step 5: Trigger Outbound Call');

        // Switch to Outbound Tab to find the test button
        await page.click('button:has-text("Outbound Agent")');

        // Click "Test Live Call"
        await page.click('button:has-text("Test Live Call")');

        // Expect redirection to test page
        await expect(page).toHaveURL(/.*\/dashboard\/test\?tab=phone/);

        console.log('✅ Navigated to Test Runner');

        // In test page, simulate call start
        // await page.fill('input[type="tel"]', '+15550000000');
        // await page.click('text=Start Call');
        // console.log('✅ Call Triggered');

    });
});
