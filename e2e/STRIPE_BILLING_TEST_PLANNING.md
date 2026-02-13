# Stripe Billing E2E Test - Implementation Plan

**Created:** 2026-02-12
**Status:** PLANNING PHASE
**Follows:** 3-Step Coding Principle

---

## 🎯 OBJECTIVE

Create a comprehensive Playwright E2E test that automates the entire Stripe billing flow:
- User login
- Wallet top-up initiation
- Stripe checkout completion
- Balance verification post-payment

**Critical Success Criteria:**
- Test must pass reliably with live Stripe Checkout
- Must handle Stripe iframe interactions correctly
- Must verify webhook processing completes before balance check
- Must provide clear failure diagnostics

---

## 📋 STEP 1: PROBLEM ANALYSIS

### What Problem Are We Solving?

**Manual Testing Pain:**
- Developers manually test billing flow 50+ times per day
- Each test requires typing test card `4242 4242 4242 4242`
- No automated verification of webhook → database → UI pipeline
- Regression bugs go undetected until production

**Root Cause:**
The "Money Engine" has 4 integration points:
1. Frontend → Backend (Top-up API)
2. Backend → Stripe (Create Checkout Session)
3. Stripe → Backend (Webhook: `checkout.session.completed`)
4. Backend → Database (Update wallet balance)

**If ANY link fails, the money disappears silently.**

### Requirements

**Functional Requirements:**
1. Authenticate as test user (`test@demo.com` / `demo123`)
2. Navigate to Wallet section
3. Click "Add Funds" button
4. Handle redirect to Stripe Checkout (hosted page)
5. Fill Stripe payment form with test card
6. Submit payment
7. Handle redirect back to dashboard
8. Verify wallet balance increased by top-up amount

**Non-Functional Requirements:**
1. Test must run in < 45 seconds (acceptable for E2E)
2. Must provide clear error messages on failure
3. Must handle race conditions (webhook delay)
4. Must be idempotent (can run repeatedly)
5. Must work in CI/CD pipeline

**Constraints:**
1. **Webhook Dependency:** Test REQUIRES `stripe listen` running in Terminal 2
2. **Iframe Challenge:** Stripe Checkout uses iframe for card input (requires special handling)
3. **Timing:** Webhook processing can take 1-10 seconds (need retry logic)
4. **Environment:** Test card `4242 4242 4242 4242` only works in Stripe test mode

**Dependencies:**
- Playwright `@playwright/test` (✅ already installed)
- Running backend server on `localhost:3001`
- Running frontend server on `localhost:3000`
- Stripe CLI webhook listener (`stripe listen --forward-to localhost:3001/api/webhooks/stripe`)
- Test user exists in database

---

## 📐 STEP 2: TECHNICAL ARCHITECTURE

### Implementation Phases

#### **Phase 1: Test Infrastructure Setup**
**Duration:** 10 minutes
**Files:**
- `e2e/billing.spec.ts` (main test file)
- `e2e/utils/stripe-helpers.ts` (Stripe iframe utilities)
- `e2e/utils/auth-helpers.ts` (login utilities)

**Tasks:**
1. Create test file structure
2. Set up test fixtures (before/after hooks)
3. Create reusable login helper
4. Create Stripe iframe interaction helpers

**Testing:**
- Verify test file imports correctly
- Verify helpers can be imported
- Run empty test to confirm Playwright setup

---

#### **Phase 2: Authentication Flow**
**Duration:** 15 minutes
**File:** `e2e/utils/auth-helpers.ts`

**Implementation:**
```typescript
export async function loginAsTestUser(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'test@demo.com');
  await page.fill('input[name="password"]', 'demo123');
  await page.click('button[type="submit"]');

  // Wait for redirect AND ensure dashboard loaded
  await page.waitForURL('/dashboard', { timeout: 10000 });
  await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 5000 });
}
```

**Acceptance Criteria:**
- ✅ Login redirects to `/dashboard`
- ✅ User sees welcome message or dashboard content
- ✅ No error messages displayed
- ✅ Cookies/session persists for subsequent navigations

**Testing:**
- Run standalone test: login → verify URL → verify UI element

---

#### **Phase 3: Wallet Navigation**
**Duration:** 10 minutes
**File:** `e2e/billing.spec.ts`

**Implementation:**
```typescript
test('User can navigate to Wallet section', async ({ page }) => {
  await loginAsTestUser(page);

  // Navigate to Wallet
  await page.click('a[href="/dashboard/billing"]'); // or text=Wallet

  // Verify wallet UI visible
  await expect(page.locator('text=Current Balance')).toBeVisible();
  await expect(page.locator('button:has-text("Add Funds")')).toBeVisible();
});
```

**Acceptance Criteria:**
- ✅ Wallet page loads
- ✅ Current balance displayed (even if $0.00)
- ✅ "Add Funds" button visible and enabled

---

#### **Phase 4: Stripe Checkout Initiation**
**Duration:** 20 minutes
**File:** `e2e/billing.spec.ts`

**Implementation:**
```typescript
// Capture initial balance
const initialBalanceText = await page.locator('[data-testid="wallet-balance"]').textContent();
const initialBalance = parseFloat(initialBalanceText?.replace(/[$,]/g, '') || '0');

// Click "Add Funds" (may have different amount options)
await page.click('button[data-amount="1000"]'); // $10.00 = 1000 cents

// Wait for redirect to Stripe (critical timing)
await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });
```

**Acceptance Criteria:**
- ✅ Click triggers Stripe Checkout redirect
- ✅ URL changes to `checkout.stripe.com`
- ✅ Stripe payment form loads within 15 seconds

**Error Handling:**
- If redirect doesn't happen: Check backend logs for Stripe API error
- If timeout: Check `STRIPE_SECRET_KEY` is set correctly

---

#### **Phase 5: Stripe Checkout Completion (The Tricky Part)**
**Duration:** 30 minutes
**File:** `e2e/utils/stripe-helpers.ts`

**Challenge:** Stripe Checkout uses iframes for card input (PCI compliance). Standard Playwright selectors won't work.

**Solution:** Use Stripe test mode selectors (they're predictable)

**Implementation:**
```typescript
export async function fillStripeCheckoutForm(page: Page) {
  // Wait for Stripe form to load
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });

  // Fill email (if not pre-filled)
  const emailInput = page.locator('input[name="email"]');
  if (await emailInput.isVisible()) {
    await emailInput.fill('test@demo.com');
  }

  // CRITICAL: Stripe card fields are in an iframe
  // We need to switch context to the iframe
  const cardNumberFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();

  // Fill card number
  await cardNumberFrame.locator('input[name="cardnumber"]').fill('4242424242424242');

  // Fill expiry (format: MM/YY)
  await cardNumberFrame.locator('input[name="exp-date"]').fill('12/34');

  // Fill CVC
  await cardNumberFrame.locator('input[name="cvc"]').fill('123');

  // Fill billing postal code (outside iframe)
  await page.locator('input[name="billingPostalCode"]').fill('10001');

  // Submit payment
  await page.click('button[type="submit"]:has-text("Pay")');
}
```

**Acceptance Criteria:**
- ✅ All Stripe fields filled correctly
- ✅ No validation errors displayed
- ✅ Payment submission triggers redirect back to app

**Testing:**
- Run with `--headed` flag to visually verify form filling
- Add `await page.pause()` to inspect iframe structure if needed

---

#### **Phase 6: Redirect Back & Webhook Wait**
**Duration:** 20 minutes
**File:** `e2e/billing.spec.ts`

**Challenge:** Webhook processing is asynchronous. UI might show old balance for 1-10 seconds.

**Solution:** Polling with retry logic

**Implementation:**
```typescript
// After Stripe payment, redirect back to dashboard
await page.waitForURL(/\/dashboard/, { timeout: 20000 });

// CRITICAL: Webhook might not have fired yet
// Poll for balance update with 15-second timeout
const expectedBalance = initialBalance + 10.00; // $10.00 top-up

await expect(async () => {
  // Reload page to get fresh data
  await page.reload();

  // Get updated balance
  const balanceText = await page.locator('[data-testid="wallet-balance"]').textContent();
  const currentBalance = parseFloat(balanceText?.replace(/[$,]/g, '') || '0');

  // Assert balance increased
  expect(currentBalance).toBeGreaterThanOrEqual(expectedBalance);
}).toPass({ timeout: 15000, intervals: [2000, 3000, 5000] });
```

**Acceptance Criteria:**
- ✅ Redirect completes within 20 seconds
- ✅ Balance updates within 15 seconds of redirect
- ✅ Balance increases by exact top-up amount

**Failure Scenarios:**
1. **Balance doesn't update:** Webhook didn't fire (check `stripe listen`)
2. **Balance increases but wrong amount:** Frontend displaying cents as dollars (check formatting)
3. **Timeout:** Webhook failed (check backend logs for Stripe signature verification error)

---

#### **Phase 7: Complete E2E Test**
**Duration:** 15 minutes
**File:** `e2e/billing.spec.ts`

**Full Test Integration:**
```typescript
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth-helpers';
import { fillStripeCheckoutForm } from './utils/stripe-helpers';

test.describe('Stripe Billing E2E', () => {
  test('User can top up wallet and verify balance increase', async ({ page }) => {
    // Step 1: Login
    await loginAsTestUser(page);

    // Step 2: Navigate to Wallet
    await page.click('a[href="/dashboard/billing"]');

    // Step 3: Capture initial balance
    const initialBalanceText = await page.locator('[data-testid="wallet-balance"]').textContent();
    const initialBalance = parseFloat(initialBalanceText?.replace(/[$,]/g, '') || '0');

    // Step 4: Initiate top-up
    await page.click('button[data-amount="1000"]'); // $10.00

    // Step 5: Wait for Stripe redirect
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15000 });

    // Step 6: Fill Stripe checkout form
    await fillStripeCheckoutForm(page);

    // Step 7: Wait for redirect back
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });

    // Step 8: Verify balance increase (with retry)
    const expectedBalance = initialBalance + 10.00;
    await expect(async () => {
      await page.reload();
      const balanceText = await page.locator('[data-testid="wallet-balance"]').textContent();
      const currentBalance = parseFloat(balanceText?.replace(/[$,]/g, '') || '0');
      expect(currentBalance).toBeGreaterThanOrEqual(expectedBalance);
    }).toPass({ timeout: 15000 });
  });
});
```

**Acceptance Criteria:**
- ✅ Full flow completes without errors
- ✅ Test passes consistently (3/3 runs)
- ✅ Clear error messages on failure
- ✅ Test completes in < 45 seconds

---

## 🧪 STEP 3: TESTING STRATEGY

### Unit Testing (Helpers)

**Test:** `auth-helpers.test.ts`
```typescript
test('loginAsTestUser should redirect to dashboard', async ({ page }) => {
  await loginAsTestUser(page);
  await expect(page).toHaveURL('/dashboard');
});
```

**Test:** `stripe-helpers.test.ts`
```typescript
test('fillStripeCheckoutForm should fill all fields', async ({ page }) => {
  // Mock Stripe checkout page
  await page.goto('https://checkout.stripe.com/test_session_123');
  await fillStripeCheckoutForm(page);

  // Verify fields filled (if accessible)
  const cardNumberFrame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
  await expect(cardNumberFrame.locator('input[name="cardnumber"]')).toHaveValue('4242424242424242');
});
```

### Integration Testing (E2E)

**Prerequisites Checklist:**
- [ ] Backend server running on `localhost:3001`
- [ ] Frontend server running on `localhost:3000`
- [ ] Stripe CLI webhook listener running: `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
- [ ] Test user `test@demo.com` exists in database
- [ ] Stripe test mode enabled (check `STRIPE_SECRET_KEY` starts with `sk_test_`)

**Test Execution:**
```bash
# Terminal 1: Start servers
npm run startup

# Terminal 2: Start Stripe webhook listener
stripe listen --forward-to http://localhost:3001/api/webhooks/stripe

# Terminal 3: Run E2E test
npx playwright test e2e/billing.spec.ts --headed --project=chromium
```

**Expected Output:**
```
✓ e2e/billing.spec.ts:10:5 › User can top up wallet and verify balance increase (38s)

1 passed (38s)
```

### Error Diagnostics

**Common Failures & Fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Timeout waiting for Stripe redirect` | Backend Stripe API call failed | Check `STRIPE_SECRET_KEY` in backend/.env |
| `Balance didn't increase` | Webhook didn't fire | Verify `stripe listen` is running |
| `Cannot find iframe` | Stripe changed their DOM structure | Update iframe selector in `stripe-helpers.ts` |
| `Login failed` | Test user doesn't exist | Create user via signup flow or seed script |
| `Payment declined` | Used wrong test card | Use `4242 4242 4242 4242` (success card) |

---

## 📊 ACCEPTANCE CRITERIA

### Phase Completion Checklist

**Phase 1: Infrastructure** ✅
- [ ] Test file created and imports work
- [ ] Helpers created and can be imported
- [ ] Empty test runs without errors

**Phase 2: Authentication** ✅
- [ ] Login helper works standalone
- [ ] Redirects to dashboard correctly
- [ ] Session persists

**Phase 3: Wallet Navigation** ✅
- [ ] Can navigate to wallet page
- [ ] Balance and buttons visible

**Phase 4: Stripe Initiation** ✅
- [ ] Click triggers Stripe redirect
- [ ] Redirects within 15 seconds

**Phase 5: Stripe Completion** ✅
- [ ] All Stripe fields fillable
- [ ] Payment submission works
- [ ] No validation errors

**Phase 6: Webhook & Balance** ✅
- [ ] Redirect back to dashboard
- [ ] Balance updates within 15 seconds
- [ ] Amount is correct

**Phase 7: Full E2E** ✅
- [ ] Complete flow passes 3/3 times
- [ ] Test completes in < 45 seconds
- [ ] Clear error messages on failure

---

## 🚀 DEPLOYMENT

### CI/CD Integration

**GitHub Actions Workflow:**
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

## 📝 IMPLEMENTATION NOTES

### Critical Assumptions

1. **Frontend Uses `data-testid` Attributes:**
   - Balance element: `data-testid="wallet-balance"`
   - Top-up buttons: `data-amount="1000"` (for $10.00)
   - If these don't exist, test will need to be updated with actual selectors

2. **Stripe Checkout Flow:**
   - Uses Stripe Checkout (hosted page), NOT Stripe Elements (embedded)
   - Test card `4242 4242 4242 4242` always succeeds
   - Webhook signature verification is enabled

3. **Webhook Processing Time:**
   - Typical: 2-5 seconds
   - Maximum: 15 seconds (test timeout)
   - If slower, increase polling timeout

### Known Limitations

1. **Stripe Iframe Structure:**
   - Stripe may change iframe selectors in future updates
   - Test will need maintenance if Stripe updates their form

2. **Webhook Dependency:**
   - Test CANNOT run without `stripe listen`
   - CI/CD must install Stripe CLI and run listener

3. **Idempotency:**
   - Each test run creates a new Stripe payment
   - Test database may accumulate test payments
   - Consider cleanup script to delete test payments

---

## 🔄 PHASE EXECUTION PLAN

### Timeline

1. **Phase 1-2:** 25 minutes (Setup + Auth)
2. **Phase 3-4:** 30 minutes (Wallet + Stripe Init)
3. **Phase 5-6:** 50 minutes (Stripe Form + Webhook)
4. **Phase 7:** 15 minutes (Integration + Testing)

**Total:** ~2 hours

### Next Steps

1. ✅ **Planning Complete** (this document)
2. ⏳ **Phase 1:** Create test infrastructure
3. ⏳ **Phase 2:** Implement authentication
4. ⏳ **Phase 3:** Implement wallet navigation
5. ⏳ **Phase 4:** Implement Stripe initiation
6. ⏳ **Phase 5:** Implement Stripe form filling
7. ⏳ **Phase 6:** Implement balance verification
8. ⏳ **Phase 7:** Integration testing

---

**Status:** 📋 PLANNING COMPLETE - READY FOR IMPLEMENTATION
**Next Action:** Begin Phase 1 implementation
