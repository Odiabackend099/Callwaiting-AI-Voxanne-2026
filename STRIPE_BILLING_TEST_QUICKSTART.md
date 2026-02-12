# ⚡ Stripe Billing Test - Quick Start (30 seconds)

## 🚀 Run the Test NOW (3 Terminal Windows)

### Terminal 1: Backend
```bash
cd backend
npm run dev
# Wait for: "Server running on port 3001"
```

### Terminal 2: Stripe Webhook Listener ⚡ CRITICAL
```bash
stripe listen --forward-to localhost:3001/api/webhooks/stripe
# Wait for: "Ready! Your webhook signing secret is whsec_xxxxx"
```

### Terminal 3: Run Test
```bash
npm run test:billing
# OR for visual debugging:
npm run test:billing:headed
```

---

## ✅ Expected Output

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
✅ Card number filled
✅ Expiry date filled
✅ CVC filled
💳 Payment submitted, waiting for processing...
🔄 Step 4: Waiting for redirect back to dashboard...
✅ Redirected back to dashboard
✔️  Step 5: Verifying wallet balance increased...
💵 Updated balance: $1,025.00
✅ SUCCESS: Balance increased by $25.00
🎉 Stripe Billing E2E Test PASSED!

✅ 1 passed (28.3s)
```

---

## 🚨 If Test Fails

### "Balance did not increase"
**Cause:** Stripe webhook listener not running (Terminal 2)
**Fix:** Start `stripe listen` and re-run test

### "Cannot find login page"
**Cause:** Backend not running (Terminal 1)
**Fix:** Start backend and re-run test

### "Could not find Add Funds button"
**Cause:** Frontend not at http://localhost:3000
**Fix:** Start frontend: `npm run dev` (in main directory)

---

## 📚 Full Documentation

See `frontend/e2e/STRIPE_BILLING_TEST_README.md` for:
- Detailed troubleshooting
- Test architecture
- Stripe test cards reference
- Debugging with Playwright UI

---

## 🎯 Test Commands

| Command | Use Case |
|---------|----------|
| `npm run test:billing` | Run test (headless) |
| `npm run test:billing:headed` | Run test with visible browser |
| `npm run test:billing:ui` | Open Playwright UI for debugging |
| `npm run test:billing:debug` | Step through test line-by-line |

---

**Test File:** `frontend/e2e/stripe-billing.spec.ts`
**Credentials:** test@demo.com / demo123
**Test Card:** 4242 4242 4242 4242 (Expiry: 12/34, CVC: 123)
