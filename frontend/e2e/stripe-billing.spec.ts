import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Stripe Billing Flow (Money Engine Verification)
 *
 * CRITICAL PREREQUISITES:
 * 1. Backend server running: npm run dev (in backend/)
 * 2. Stripe webhook listener running: stripe listen --forward-to localhost:3001/api/webhooks/stripe
 * 3. Frontend dev server running: npm run dev (in frontend/)
 *
 * Test Flow:
 * 1. Login with test credentials
 * 2. Navigate to Wallet/Billing section
 * 3. Click "Add Funds" / "Top Up" button
 * 4. Redirect to Stripe Checkout
 * 5. Fill test card details (4242 4242 4242 4242)
 * 6. Complete payment
 * 7. Redirect back to dashboard
 * 8. Verify wallet balance increased
 *
 * Expected Result: Wallet shows increased balance (e.g., $1,000.00 → $1,025.00)
 */

test.describe('Stripe Billing E2E Flow', () => {
    // Test credentials (from user requirements)
    const TEST_EMAIL = 'test@demo.com';
    const TEST_PASSWORD = 'demo123';

    // Stripe test card (always succeeds)
    const TEST_CARD = {
        number: '4242424242424242',
        expiry: '1234', // MM/YY format (December 2034)
        cvc: '123',
        name: 'Test User',
        postalCode: '10001'
    };

    test.beforeEach(async ({ page }) => {
        // Set longer timeout for Stripe redirects
        test.setTimeout(60000); // 60 seconds
    });

    test('Complete Stripe checkout flow and verify wallet balance', async ({ page }) => {
        console.log('🚀 Starting Stripe Billing E2E Test...');

        // ==================================================
        // STEP 1: LOGIN
        // ==================================================
        console.log('📝 Step 1: Logging in...');
        await page.goto('/login');

        // Wait for login page to load
        await expect(page).toHaveURL(/\/login/);

        // Fill login credentials
        await page.fill('input[type="email"]', TEST_EMAIL);
        await page.fill('input[type="password"]', TEST_PASSWORD);

        // Click sign in button
        await page.click('button:has-text("Sign In"), button[type="submit"]');

        // Wait for redirect to dashboard
        await page.waitForURL(/\/dashboard/, { timeout: 10000 });
        console.log('✅ Login successful');

        // ==================================================
        // STEP 2: CAPTURE INITIAL WALLET BALANCE
        // ==================================================
        console.log('💰 Step 2: Capturing initial wallet balance...');

        // Navigate to billing/wallet page (adjust selector based on your UI)
        // Option A: If there's a direct wallet page
        const walletLinkExists = await page.locator('a:has-text("Wallet"), a:has-text("Billing")').first().isVisible().catch(() => false);

        if (walletLinkExists) {
            await page.click('a:has-text("Wallet"), a:has-text("Billing")');
            await page.waitForTimeout(1000);
        } else {
            // Option B: Wallet is part of dashboard
            console.log('ℹ️  Wallet section on dashboard');
        }

        // Capture initial balance (adjust selector based on your UI)
        // Looking for patterns like "$1,000.00" or "Balance: $25.00"
        const balanceElement = page.locator('text=/\\$[0-9,]+\\.\\d{2}/, [data-testid="wallet-balance"]').first();

        let initialBalance = 0;
        try {
            const balanceText = await balanceElement.textContent({ timeout: 5000 });
            if (balanceText) {
                // Extract number from text like "$1,000.00"
                const match = balanceText.match(/\$([0-9,]+\.?\d*)/);
                if (match) {
                    initialBalance = parseFloat(match[1].replace(',', ''));
                    console.log(`💵 Initial balance: $${initialBalance.toFixed(2)}`);
                }
            }
        } catch (error) {
            console.warn('⚠️  Could not capture initial balance, proceeding anyway...');
        }

        // ==================================================
        // STEP 3: CLICK "ADD FUNDS" / "TOP UP" BUTTON
        // ==================================================
        console.log('🔘 Step 3: Clicking "Add Funds" button...');

        // Try multiple possible button selectors
        const topUpButton = page.locator(
            'button:has-text("Add Funds"),' +
            'button:has-text("Top Up"),' +
            'button:has-text("Add Credits"),' +
            'a:has-text("Add Funds"),' +
            '[data-testid="add-funds-button"]'
        ).first();

        await expect(topUpButton).toBeVisible({ timeout: 10000 });
        await topUpButton.click();
        console.log('✅ Clicked top-up button');

        // Wait for either:
        // 1. Redirect to Stripe Checkout (checkout.stripe.com)
        // 2. Modal/dialog with payment options
        await page.waitForTimeout(2000);

        // Check if we're on Stripe Checkout page
        const currentUrl = page.url();
        const isStripeCheckout = currentUrl.includes('checkout.stripe.com');

        if (isStripeCheckout) {
            console.log('🌐 Redirected to Stripe Checkout (Hosted Page)');
            await handleStripeHostedCheckout(page, TEST_CARD);
        } else {
            // Check for embedded Stripe Elements or modal
            console.log('🔍 Checking for embedded Stripe form...');
            const stripeIframeExists = await page.frameLocator('iframe[name*="stripe"]').first().locator('body').isVisible().catch(() => false);

            if (stripeIframeExists) {
                console.log('📦 Found embedded Stripe Elements');
                await handleStripeEmbeddedCheckout(page, TEST_CARD);
            } else {
                throw new Error('❌ Could not find Stripe checkout form (hosted or embedded)');
            }
        }

        // ==================================================
        // STEP 4: WAIT FOR REDIRECT BACK TO DASHBOARD
        // ==================================================
        console.log('🔄 Step 4: Waiting for redirect back to dashboard...');

        // Wait for success redirect (with generous timeout)
        await page.waitForURL(/\/dashboard|\/wallet|\/billing/, { timeout: 30000 });
        console.log('✅ Redirected back to dashboard');

        // ==================================================
        // STEP 5: VERIFY WALLET BALANCE INCREASED
        // ==================================================
        console.log('✔️  Step 5: Verifying wallet balance increased...');

        // Wait for webhook to process (Stripe webhook → Backend → Database → UI update)
        // This can take 2-5 seconds in development
        await page.waitForTimeout(5000);

        // Reload page to ensure fresh data
        await page.reload();
        await page.waitForTimeout(2000);

        // Capture updated balance
        const updatedBalanceElement = page.locator('text=/\\$[0-9,]+\\.\\d{2}/, [data-testid="wallet-balance"]').first();

        try {
            const updatedBalanceText = await updatedBalanceElement.textContent({ timeout: 10000 });
            if (updatedBalanceText) {
                const match = updatedBalanceText.match(/\$([0-9,]+\.?\d*)/);
                if (match) {
                    const updatedBalance = parseFloat(match[1].replace(',', ''));
                    console.log(`💵 Updated balance: $${updatedBalance.toFixed(2)}`);

                    // Verify balance increased
                    if (updatedBalance > initialBalance) {
                        const increase = updatedBalance - initialBalance;
                        console.log(`✅ SUCCESS: Balance increased by $${increase.toFixed(2)}`);

                        // Assert balance increased by expected amount (e.g., $25.00)
                        expect(updatedBalance).toBeGreaterThan(initialBalance);

                        // Optionally verify specific amount (if you know the top-up amount)
                        // expect(increase).toBe(25.00); // Uncomment if testing fixed amount
                    } else {
                        throw new Error(`❌ FAILURE: Balance did not increase. Initial: $${initialBalance}, Updated: $${updatedBalance}`);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error verifying balance:', error);

            // Take screenshot for debugging
            await page.screenshot({ path: 'test-results/stripe-billing-failure.png', fullPage: true });

            throw new Error('Balance verification failed. Check screenshot: test-results/stripe-billing-failure.png');
        }

        console.log('🎉 Stripe Billing E2E Test PASSED!');
    });

    test('Should handle Stripe payment failure gracefully', async ({ page }) => {
        console.log('🚀 Starting Stripe Payment Failure Test...');

        // Login
        await page.goto('/login');
        await page.fill('input[type="email"]', TEST_EMAIL);
        await page.fill('input[type="password"]', TEST_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(/\/dashboard/);

        // Click Add Funds
        const topUpButton = page.locator('button:has-text("Add Funds"), button:has-text("Top Up")').first();
        await topUpButton.click();
        await page.waitForTimeout(2000);

        // Use declining test card
        const DECLINING_CARD = {
            number: '4000000000000002', // Stripe test card that always declines
            expiry: '1234',
            cvc: '123',
            name: 'Test User',
            postalCode: '10001'
        };

        // Fill checkout form
        if (page.url().includes('checkout.stripe.com')) {
            await handleStripeHostedCheckout(page, DECLINING_CARD);
        }

        // Verify error message appears
        await expect(page.locator('text=/declined|failed|error/i')).toBeVisible({ timeout: 10000 });
        console.log('✅ Payment failure handled correctly');
    });
});

/**
 * Helper: Handle Stripe Hosted Checkout Page
 */
async function handleStripeHostedCheckout(page: Page, cardDetails: typeof TEST_CARD) {
    console.log('💳 Filling Stripe hosted checkout form...');

    // Wait for Stripe checkout page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Fill email (if present)
    const emailInput = page.locator('input[type="email"]#email').first();
    if (await emailInput.isVisible().catch(() => false)) {
        await emailInput.fill(TEST_EMAIL);
        console.log('✅ Email filled');
    }

    // Fill card number
    // Stripe uses iframes for card fields - we need to target the iframe
    const cardNumberFrame = page.frameLocator('iframe[name*="cardNumber"], iframe[title*="Secure card number"]').first();
    const cardNumberInput = cardNumberFrame.locator('input[name="cardnumber"], input[placeholder*="Card number"]').first();
    await cardNumberInput.waitFor({ state: 'visible', timeout: 10000 });
    await cardNumberInput.fill(cardDetails.number);
    console.log('✅ Card number filled');

    // Fill expiry date
    const cardExpiryFrame = page.frameLocator('iframe[name*="cardExpiry"], iframe[title*="Secure expiration date"]').first();
    const cardExpiryInput = cardExpiryFrame.locator('input[name="exp-date"], input[placeholder*="MM"]').first();
    await cardExpiryInput.fill(cardDetails.expiry);
    console.log('✅ Expiry date filled');

    // Fill CVC
    const cardCvcFrame = page.frameLocator('iframe[name*="cardCvc"], iframe[title*="Secure CVC"]').first();
    const cardCvcInput = cardCvcFrame.locator('input[name="cvc"], input[placeholder*="CVC"]').first();
    await cardCvcInput.fill(cardDetails.cvc);
    console.log('✅ CVC filled');

    // Fill billing name (outside iframe)
    const nameInput = page.locator('input[name="name"], input[placeholder*="Name on card"]').first();
    if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill(cardDetails.name);
        console.log('✅ Cardholder name filled');
    }

    // Fill billing postal code (outside iframe)
    const postalInput = page.locator('input[name="postal"], input[name="zip"], input[placeholder*="ZIP"]').first();
    if (await postalInput.isVisible().catch(() => false)) {
        await postalInput.fill(cardDetails.postalCode);
        console.log('✅ Postal code filled');
    }

    // Click Pay/Submit button
    const submitButton = page.locator('button[type="submit"]:has-text("Pay"), button:has-text("Submit payment")').first();
    await submitButton.click();
    console.log('💳 Payment submitted, waiting for processing...');
}

/**
 * Helper: Handle Embedded Stripe Elements
 */
async function handleStripeEmbeddedCheckout(page: Page, cardDetails: typeof TEST_CARD) {
    console.log('💳 Filling embedded Stripe form...');

    // Similar logic to hosted checkout, but selectors may differ
    // This is for Stripe Elements embedded in your own page

    const cardElementFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();

    // Fill card number
    const cardInput = cardElementFrame.locator('input[name="cardnumber"]').first();
    await cardInput.fill(cardDetails.number);

    // Fill expiry
    const expiryInput = cardElementFrame.locator('input[name="exp-date"]').first();
    await expiryInput.fill(cardDetails.expiry);

    // Fill CVC
    const cvcInput = cardElementFrame.locator('input[name="cvc"]').first();
    await cvcInput.fill(cardDetails.cvc);

    // Submit form (button is usually outside iframe)
    await page.click('button[type="submit"]');
    console.log('💳 Embedded payment submitted');
}

/**
 * Test Constants (Stripe Test Cards)
 *
 * Success: 4242 4242 4242 4242
 * Decline: 4000 0000 0000 0002
 * Insufficient Funds: 4000 0000 0000 9995
 * Lost Card: 4000 0000 0000 9987
 * Stolen Card: 4000 0000 0000 9979
 * Expired Card: 4000 0000 0000 0069
 * Processing Error: 4000 0000 0000 0119
 *
 * Source: https://stripe.com/docs/testing
 */
