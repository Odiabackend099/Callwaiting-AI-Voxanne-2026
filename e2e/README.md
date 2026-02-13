# Stripe Billing E2E Test - Quick Start Guide

## 🎯 What This Test Does

Automates the complete Stripe billing flow:
1. ✅ Login as test user
2. ✅ Navigate to wallet
3. ✅ Click "Top Up $10"
4. ✅ Redirect to Stripe Checkout
5. ✅ Fill test card `4242 4242 4242 4242`
6. ✅ Submit payment
7. ✅ Verify wallet balance increased

**Result:** You never have to manually type a credit card number again! 🎉

---

## ⚡ Quick Start (30 seconds)

### Terminal 1: Start Servers
```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run startup
```

### Terminal 2: Start Stripe Webhook Listener
```bash
stripe listen --forward-to http://localhost:3001/api/webhooks/stripe
```

### Terminal 3: Run Test
```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
npx playwright test e2e/billing.spec.ts --headed --project=chromium
```

**Expected Result:**
```
✓ e2e/billing.spec.ts:User can top up wallet and verify balance increase (38s)
1 passed (38s)
```

---

## 📋 Prerequisites Checklist

Before running the test, verify:

- [ ] **Backend running:** `curl http://localhost:3001/health` returns 200
- [ ] **Frontend running:** Open `http://localhost:3000` in browser
- [ ] **Stripe CLI installed:** `stripe --version` shows version
- [ ] **Stripe webhook listener:** See webhook events in Terminal 2
- [ ] **Test user exists:** `test@demo.com` / `demo123` can login manually
- [ ] **Stripe test mode:** `STRIPE_SECRET_KEY` starts with `sk_test_`

---

## 🧪 Test Commands

### Run Full Test (Visible Browser)
```bash
npx playwright test e2e/billing.spec.ts --headed
```

### Run in Debug Mode (Step Through)
```bash
npx playwright test e2e/billing.spec.ts --debug
```

### Run Specific Test
```bash
npx playwright test e2e/billing.spec.ts -g "top up wallet"
```

### Run on Different Browser
```bash
# Firefox
npx playwright test e2e/billing.spec.ts --project=firefox

# Safari
npx playwright test e2e/billing.spec.ts --project=webkit
```

### Run Without Headless (Fastest)
```bash
npx playwright test e2e/billing.spec.ts
```

---

## 📁 File Structure

```
e2e/
├── billing.spec.ts                 # Main E2E test
├── README.md                       # This file
├── STRIPE_BILLING_TEST_PLANNING.md # Detailed implementation plan
└── utils/
    ├── auth-helpers.ts             # Login/logout utilities
    ├── stripe-helpers.ts           # Stripe checkout interaction
    └── wallet-helpers.ts           # Wallet balance utilities
```

---

## 🐛 Troubleshooting

### Issue: "Timeout waiting for Stripe redirect"

**Cause:** Backend can't create Stripe checkout session

**Fix:**
1. Check `STRIPE_SECRET_KEY` in `backend/.env`
2. Verify backend logs: `docker logs voxanne-backend` or check console
3. Test Stripe API manually:
   ```bash
   curl https://api.stripe.com/v1/checkout/sessions \
     -u sk_test_YOUR_KEY: \
     -d "mode=payment" \
     -d "line_items[0][price_data][currency]=usd" \
     -d "line_items[0][price_data][unit_amount]=1000" \
     -d "line_items[0][price_data][product_data][name]=Top Up" \
     -d "line_items[0][quantity]=1" \
     -d "success_url=http://localhost:3000/dashboard" \
     -d "cancel_url=http://localhost:3000/dashboard"
   ```

---

### Issue: "Balance didn't update"

**Cause:** Stripe webhook didn't fire

**Fix:**
1. **Verify `stripe listen` is running in Terminal 2**
   - You should see: `Ready! Your webhook signing secret is whsec_...`
   - You should see events when payment completes

2. Check webhook secret matches:
   ```bash
   # Get secret from Stripe CLI output
   grep STRIPE_WEBHOOK_SECRET backend/.env
   # Should match: whsec_... from stripe listen
   ```

3. Check backend webhook logs:
   - Look for "Received Stripe webhook: checkout.session.completed"

4. Manually trigger webhook:
   ```bash
   stripe trigger checkout.session.completed
   ```

---

### Issue: "Cannot find iframe"

**Cause:** Stripe changed their DOM structure

**Fix:**
1. Run test with visible browser:
   ```bash
   npx playwright test e2e/billing.spec.ts --headed
   ```

2. When Stripe page loads, pause and inspect:
   - Add `await page.pause()` in `stripe-helpers.ts`
   - Right-click → Inspect → Find iframe name
   - Update selector in `fillStripeCheckoutForm()`

3. Check Playwright's element locator:
   ```bash
   npx playwright codegen https://checkout.stripe.com/test_session_123
   ```

---

### Issue: "Test user doesn't exist"

**Cause:** `test@demo.com` not in database

**Fix:**
1. Create user manually:
   - Open `http://localhost:3000/signup`
   - Email: `test@demo.com`
   - Password: `demo123`
   - Complete signup

2. Or use SQL:
   ```sql
   INSERT INTO users (email, password_hash)
   VALUES ('test@demo.com', 'hashed_password_here');
   ```

---

### Issue: "Payment declined"

**Cause:** Wrong test card or Stripe in live mode

**Fix:**
1. Verify test card: `4242 4242 4242 4242`
2. Check Stripe mode:
   ```bash
   grep STRIPE_SECRET_KEY backend/.env
   # Must start with: sk_test_
   ```
3. Try different test cards:
   - Success: `4242 4242 4242 4242`
   - Declined: `4000 0000 0000 0002`
   - Insufficient Funds: `4000 0000 0000 9995`

---

## 🔧 Advanced Usage

### Run in CI/CD

Add to `.github/workflows/test.yml`:
```yaml
name: E2E Billing Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm ci

      - name: Start backend
        run: npm run dev &
        working-directory: ./backend

      - name: Start frontend
        run: npm run dev &

      - name: Wait for servers
        run: |
          npx wait-on http://localhost:3001/health
          npx wait-on http://localhost:3000

      - name: Start Stripe webhook listener
        run: stripe listen --forward-to http://localhost:3001/api/webhooks/stripe &
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}

      - name: Run E2E test
        run: npx playwright test e2e/billing.spec.ts

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

### Customize Test Amount

Edit `e2e/billing.spec.ts`:
```typescript
const topUpAmountCents = 2000; // Change to $20.00
```

---

### Test Multiple Top-Ups

Add loop in test:
```typescript
for (let i = 0; i < 3; i++) {
  await initiateTopUp(page, 1000);
  await completeStripeCheckout(page);
  await waitForBalanceUpdate(page, initialBalance + (i + 1) * 10);
}
```

---

### Capture Video of Test

Playwright auto-captures on failure. To always capture:
```typescript
test.use({ video: 'on' });
```

---

## 📊 Understanding Test Output

### Success Output
```
Running 1 test using 1 worker
Step 1: Authenticating as test user...
✅ Authenticated successfully
Step 2: Navigating to wallet...
✅ Wallet page loaded
Step 3: Capturing initial balance...
Initial balance: $0.00
Step 4: Initiating $10.00 top-up...
✅ Top-up initiated
Step 5: Waiting for Stripe checkout redirect...
✅ Redirected to Stripe
Step 6: Filling Stripe checkout form...
✅ Stripe form filled and submitted
Step 7: Waiting for redirect back to app...
✅ Redirected back to dashboard
Step 8: Verifying balance increased...
Waiting for balance to update from $0.00 to $10.00...
⏳ This may take up to 15 seconds (webhook processing time)
✅ Balance updated successfully: $10.00
🎉 Test completed successfully!

1 passed (38s)
```

### Failure Output (with helpful diagnostics)
```
Step 8: Verifying balance increased...
✖ Error: Balance did not update within 20000ms.
   Expected: $10.00, Current: $0.00.
   This usually means the Stripe webhook didn't fire.
   Verify 'stripe listen' is running in Terminal 2.
```

---

## 🎓 Learning Resources

- **Playwright Docs:** https://playwright.dev
- **Stripe Testing:** https://stripe.com/docs/testing
- **Test Card Numbers:** https://stripe.com/docs/testing#cards
- **Webhook Testing:** https://stripe.com/docs/webhooks/test

---

## 🚀 Next Steps

After verifying this test works:

1. **Add more test scenarios:**
   - Test cancelled payment (user clicks "Back" on Stripe)
   - Test declined card (`4000 0000 0000 0002`)
   - Test multiple currency amounts

2. **Integrate with CI/CD:**
   - Add to GitHub Actions
   - Run on every PR
   - Block merge if test fails

3. **Expand to other features:**
   - Test subscription creation
   - Test invoice payment
   - Test refund flow

---

**Test Created:** 2026-02-12
**Status:** ✅ Ready for use
**Maintainer:** Follow 3-step coding principle for updates
