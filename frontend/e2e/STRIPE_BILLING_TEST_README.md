# 💳 Stripe Billing E2E Test - Setup & Execution Guide

## 📋 Overview

Automated Playwright test that verifies the complete Stripe billing flow:
1. ✅ User login
2. ✅ Navigate to wallet/billing
3. ✅ Click "Add Funds" button
4. ✅ Fill Stripe checkout form (test card)
5. ✅ Complete payment
6. ✅ Verify wallet balance increased

**Purpose:** Eliminate manual testing of payment flows. Verify the "Money Engine" works end-to-end.

---

## 🚨 CRITICAL PREREQUISITES

**⚠️ WARNING:** The test WILL FAIL if any of these are missing:

### 1. Backend Server Running
```bash
cd backend
npm run dev
```
**Expected Output:** `Server running on port 3001`

### 2. Stripe Webhook Listener Running ⚡ **MOST CRITICAL**
```bash
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```
**Expected Output:**
```
> Ready! Your webhook signing secret is whsec_xxxxx
> Listening on https://api.stripe.com/...
```

**Why This Matters:**
- Without the listener, Stripe will charge the card successfully
- But the webhook won't fire → Database won't update → Balance shows $0.00
- Test will FAIL even though payment succeeded

### 3. Frontend Dev Server Running
```bash
cd frontend
npm run dev
```
**Expected Output:** `Local: http://localhost:3000`

---

## 🚀 Running the Test

### Option 1: Run Billing Test Only (Recommended)
```bash
npm run test:billing
```

### Option 2: Run with Playwright UI (Visual Debugging)
```bash
npx playwright test frontend/e2e/stripe-billing.spec.ts --ui
```

### Option 3: Run in Headed Mode (See Browser)
```bash
npx playwright test frontend/e2e/stripe-billing.spec.ts --headed
```

### Option 4: Run All E2E Tests
```bash
npm run test:e2e
```

---

## 🧪 Test Scenarios

### Test 1: Successful Payment Flow
**What It Does:**
- Logs in with test@demo.com / demo123
- Captures initial wallet balance (e.g., $1,000.00)
- Clicks "Add Funds" button
- Fills Stripe form with test card: `4242 4242 4242 4242`
- Completes payment
- Waits for webhook to process (5 seconds)
- Verifies balance increased (e.g., $1,025.00)

**Expected Duration:** 20-30 seconds

**Success Criteria:**
- ✅ Login successful
- ✅ Stripe checkout form loads
- ✅ Payment processes without errors
- ✅ Redirect back to dashboard
- ✅ Wallet balance increases

### Test 2: Payment Failure Handling
**What It Does:**
- Uses declining test card: `4000 0000 0000 0002`
- Verifies error message appears
- Ensures user not charged

**Expected Result:** Error message shown, balance unchanged

---

## 🔍 Debugging Failed Tests

### Symptom 1: "Balance did not increase"
**Cause:** Stripe webhook didn't fire
**Fix:**
1. Check Terminal 2 (Stripe listener) for webhook events
2. If no events, restart: `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
3. Verify backend webhook handler is running: `curl http://localhost:3001/api/webhooks/stripe`

### Symptom 2: "Could not find Stripe checkout form"
**Cause:** Button selector changed or Add Funds button not visible
**Fix:**
1. Run test in headed mode: `npx playwright test --headed`
2. Manually inspect the page
3. Update selectors in `stripe-billing.spec.ts`

### Symptom 3: "Login failed"
**Cause:** Test credentials incorrect or Supabase down
**Fix:**
1. Verify credentials: test@demo.com / demo123
2. Check Supabase dashboard: https://supabase.com/dashboard
3. Test manual login at http://localhost:3000/login

### Symptom 4: Test timeout after 60 seconds
**Cause:** Stripe checkout taking too long or stuck
**Fix:**
1. Check internet connection (Stripe Checkout requires network)
2. Clear browser cache: `npx playwright test --clear-cache`
3. Increase timeout in test file (line 23)

---

## 📸 Screenshots & Videos

**On Failure:** Test automatically captures:
- Screenshot: `test-results/stripe-billing-failure.png`
- Video: `test-results/videos/stripe-billing.webm` (if configured)

**Manual Screenshot:**
```bash
npx playwright test --screenshot=on
```

**Manual Video:**
```bash
npx playwright test --video=on
```

---

## 🧩 Test Architecture

### File Structure
```
frontend/e2e/
├── stripe-billing.spec.ts          # Main test file (YOU ARE HERE)
├── STRIPE_BILLING_TEST_README.md   # This file
├── analytics.spec.ts               # Existing analytics test
└── vapi-journey.spec.ts            # Existing VAPI test
```

### Key Functions

#### `handleStripeHostedCheckout(page, cardDetails)`
**Purpose:** Fill Stripe's hosted checkout page (checkout.stripe.com)
**Challenge:** Card fields are in iframes (security)
**Solution:** Use `page.frameLocator()` to target iframes

#### `handleStripeEmbeddedCheckout(page, cardDetails)`
**Purpose:** Fill embedded Stripe Elements on your own page
**Use Case:** If you implemented Stripe Elements instead of Checkout Sessions

---

## 🎯 Stripe Test Cards Reference

| Card Number | Result | Use Case |
|-------------|--------|----------|
| `4242 4242 4242 4242` | ✅ Success | Normal payment flow |
| `4000 0000 0000 0002` | ❌ Decline | Test error handling |
| `4000 0000 0000 9995` | ❌ Insufficient Funds | Test specific decline |
| `4000 0000 0000 9987` | ❌ Lost Card | Test fraud prevention |
| `4000 0000 0000 0069` | ❌ Expired | Test expiry validation |

**Expiry Date:** Any future date (e.g., `12/34`)
**CVC:** Any 3 digits (e.g., `123`)

**Full List:** https://stripe.com/docs/testing

---

## 📊 Expected Test Output

### Success (Terminal Output)
```
🚀 Starting Stripe Billing E2E Test...
📝 Step 1: Logging in...
✅ Login successful
💰 Step 2: Capturing initial wallet balance...
💵 Initial balance: $1,000.00
🔘 Step 3: Clicking "Add Funds" button...
✅ Clicked top-up button
🌐 Redirected to Stripe Checkout (Hosted Page)
💳 Filling Stripe hosted checkout form...
✅ Email filled
✅ Card number filled
✅ Expiry date filled
✅ CVC filled
✅ Cardholder name filled
✅ Postal code filled
💳 Payment submitted, waiting for processing...
🔄 Step 4: Waiting for redirect back to dashboard...
✅ Redirected back to dashboard
✔️  Step 5: Verifying wallet balance increased...
💵 Updated balance: $1,025.00
✅ SUCCESS: Balance increased by $25.00
🎉 Stripe Billing E2E Test PASSED!

✅ 1 passed (28.3s)
```

### Failure (Terminal Output)
```
❌ Error verifying balance: Balance did not increase
❌ FAILURE: Balance did not increase. Initial: $1000, Updated: $1000

Expected: balance to increase
Received: balance unchanged

Screenshot saved: test-results/stripe-billing-failure.png

❌ 1 failed (32.1s)
```

---

## 🔧 Troubleshooting Checklist

Before running the test, verify:

- [ ] Backend running on port 3001
- [ ] Stripe listener running and showing "Ready!"
- [ ] Frontend running on port 3000
- [ ] Test user exists in Supabase (test@demo.com)
- [ ] Stripe API keys in .env file
- [ ] Internet connection active (for Stripe API)
- [ ] No other tests occupying the browser

**Still Failing?**
1. Run in UI mode: `npx playwright test --ui`
2. Step through test manually
3. Check each selector with Playwright Inspector
4. Verify webhook logs in Stripe Dashboard

---

## 📚 Additional Resources

- **Playwright Docs:** https://playwright.dev/docs/intro
- **Stripe Testing:** https://stripe.com/docs/testing
- **Stripe Webhooks:** https://stripe.com/docs/webhooks
- **Stripe Elements:** https://stripe.com/docs/stripe-js

---

## 🎓 Training: How to Modify This Test

### Change Top-Up Amount
**File:** Your billing component (not this test)
**What to Change:** Hardcoded amount in "Add Funds" button

### Add More Test Cards
**File:** `stripe-billing.spec.ts`
**Location:** Bottom of file (test constants section)
**Example:**
```typescript
const INSUFFICIENT_FUNDS_CARD = {
    number: '4000000000009995',
    expiry: '1234',
    cvc: '123',
    name: 'Test User',
    postalCode: '10001'
};
```

### Test Different Amounts
**Add New Test:**
```typescript
test('Should handle $100 top-up', async ({ page }) => {
    // ... login logic
    await page.click('button:has-text("$100")'); // Select $100 option
    // ... rest of test
});
```

### Update Selectors
**If Button Changed:**
```typescript
// Before:
const topUpButton = page.locator('button:has-text("Add Funds")');

// After:
const topUpButton = page.locator('[data-testid="top-up-button"]');
```

---

## 🚨 Common Mistakes

### ❌ Mistake 1: Forgetting Stripe Listener
**Result:** Test fails at balance verification
**Symptom:** "Balance did not increase" after successful payment
**Fix:** Always run `stripe listen` in Terminal 2

### ❌ Mistake 2: Wrong Port in Webhook URL
**Result:** Webhook fires but backend doesn't receive it
**Symptom:** Stripe Dashboard shows webhook sent, but no database update
**Fix:** Verify port matches: `--forward-to localhost:3001/api/webhooks/stripe`

### ❌ Mistake 3: Running Test Without Backend
**Result:** Login fails immediately
**Symptom:** "Network error" or "Cannot find login page"
**Fix:** Start backend first: `cd backend && npm run dev`

### ❌ Mistake 4: Using Real Credit Card
**Result:** Real charge to real card (bad!)
**Symptom:** Actual money deducted
**Fix:** ALWAYS use test cards (4242 4242 4242 4242)

---

## ✅ Success Metrics

**Healthy Test:**
- Runs in <30 seconds
- Passes 95%+ of the time
- Fails only when code actually breaks
- Clear error messages when failing

**If Test Is Flaky (Random Failures):**
- Increase wait times (line 138, line 197)
- Add more explicit waits for Stripe elements
- Check for race conditions in billing code

---

**Last Updated:** 2026-02-12
**Maintained By:** QA Engineering Team
**Questions?** Check Slack #engineering-alerts or GitHub Issues
