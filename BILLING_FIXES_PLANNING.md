# Billing Security & UX Fixes - Planning Document

**Date:** 2026-02-12
**Priority:** P0 (Critical - Production Blockers)
**Estimated Time:** 1 hour total
**Principle:** 3-Step Coding (Plan → Code → Test)

---

## OVERVIEW

Layer 5 (Billing Audit) identified **2 P0 critical issues** that must be fixed before production launch:

1. **🔴 P0-1:** Webhook signature bypass in dev mode (revenue vulnerability)
2. **🔴 P0-2:** $0.70/min rate hidden from wallet UI (customer confusion)

Both fixes are **small, surgical changes** with **zero breaking changes** to existing functionality.

---

## P0-1: WEBHOOK SIGNATURE BYPASS FIX

### Current Code (VULNERABLE)

**File:** `backend/src/middleware/verify-stripe-signature.ts`
**Lines:** 27-32

```typescript
// CRITICAL SECURITY HOLE
if (process.env.NODE_ENV === 'development' && !secret) {
  log.warn('StripeSignature', 'Skipping signature verification in development mode');
  (req as any).stripeEvent = req.body;
  return next(); // ⚠️ ALLOWS FAKE WEBHOOKS
}
```

### Attack Vector

1. Production server accidentally deployed with `NODE_ENV=development`
2. Attacker sends fake webhook: `{"type": "checkout.session.completed", "data": {...}}`
3. Platform credits £1M to attacker account
4. Attacker makes unlimited free calls
5. Platform bankrupt

### Fix Strategy

**Remove development bypass entirely.** Use Stripe CLI for local testing.

```typescript
// AFTER FIX (lines 27-31 deleted)
if (!secret) {
  log.error('StripeSignature', 'STRIPE_WEBHOOK_SECRET not configured');
  return res.status(500).json({ error: 'Webhook secret required' });
}

// No development bypass - signature verification ALWAYS enforced
```

### Local Development Workflow (Replacement)

```bash
# Use Stripe CLI for local testing (official Stripe recommendation)
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# This provides:
# 1. Real webhook signatures (secure)
# 2. Test event triggering (stripe trigger checkout.session.completed)
# 3. Same production behavior in dev
```

### Verification

**Test 1: Valid Signature**
```bash
# Should succeed (200 OK)
stripe trigger checkout.session.completed
```

**Test 2: Invalid Signature**
```bash
# Should fail (401 Unauthorized)
curl -X POST http://localhost:3001/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed"}'
```

**Test 3: Missing Secret**
```bash
# Should fail with 500 error
STRIPE_WEBHOOK_SECRET="" npm run dev
# Then try to send webhook → 500 Internal Server Error
```

---

## P0-2: DISPLAY $0.70/MIN RATE IN UI

### Current Code (MISSING)

**File:** `src/app/dashboard/wallet/page.tsx`
**Line:** 206

```tsx
// Shows credits but NOT dollar rate
<span className="px-2.5 py-1 bg-white/20 text-white rounded-full text-xs font-bold">
    10 credits/min
</span>
```

### Customer Impact

- Cannot calculate: "How much will a 5-minute call cost?"
- Cannot verify charges are correct
- Support tickets: "Why was I charged $3.50?"

### Fix Strategy

**Add $0.70/min to badge alongside credits.**

```tsx
// AFTER FIX
<span className="px-2.5 py-1 bg-white/20 text-white rounded-full text-xs font-bold">
    $0.70/minute (10 credits/min)
</span>
```

### Additional Context (Optional Enhancement)

Add explainer card below balance:

```tsx
// Add after line 230 (below balance card)
<div className="mt-4 p-4 bg-surgical-50 border border-surgical-200 rounded-xl text-sm">
    <p className="font-bold text-obsidian mb-1">💡 How Credits Work</p>
    <p className="text-obsidian/70">
        1 minute of calling = 10 credits ($0.70)<br/>
        Example: A 5-minute call deducts 50 credits ($3.50)
    </p>
</div>
```

### Verification

**Visual Test:**
1. Open `http://localhost:3000/dashboard/wallet`
2. Verify badge shows: "$0.70/minute (10 credits/min)"
3. Verify explainer card appears below balance

**Functional Test:**
1. Customer sees pricing upfront
2. Can calculate cost per call
3. Can verify charges against displayed rate

---

## OPTIONAL P1 FIXES (NOT BLOCKING)

### P1-1: Webhook Rate Limiting (30 min)

**File:** `backend/src/routes/stripe-webhooks.ts:36`

```typescript
import { rateLimit } from 'express-rate-limit';

const webhookRateLimit = rateLimit({
  windowMs: 60000,
  max: 100,
  message: 'Webhook rate limit exceeded'
});

router.post('/stripe',
  webhookRateLimit, // ADD THIS
  verifyStripeSignature(),
  async (req, res) => { /* ... */ }
);
```

**Decision:** Skip for now - signature verification provides adequate protection.

### P1-2: 3D Secure/SCA (30 min)

**File:** `backend/src/routes/billing-api.ts:523`

```typescript
payment_intent_data: {
  setup_future_usage: 'off_session',
  payment_method_options: {
    card: {
      request_three_d_secure: 'automatic'
    }
  }
}
```

**Decision:** Skip for now - only needed for EU expansion.

---

## IMPLEMENTATION ORDER

### Step 1: Remove Webhook Bypass (5 minutes)

1. Open `backend/src/middleware/verify-stripe-signature.ts`
2. Delete lines 27-32 (dev mode bypass)
3. Verify signature verification always enforced

### Step 2: Add Pricing to Wallet UI (10 minutes)

1. Open `src/app/dashboard/wallet/page.tsx`
2. Update badge at line 206 to show "$0.70/minute"
3. Add explainer card at line 230 (optional)

### Step 3: Test Both Fixes (5 minutes)

1. Test webhook with invalid signature → 401
2. Test webhook with missing secret → 500
3. Verify wallet UI shows pricing
4. Verify explainer card displays

**Total Time:** 20 minutes

---

## RISK ASSESSMENT

**P0-1 Fix (Webhook Bypass):**
- **Breaking Changes:** None (signature verification already in place)
- **Rollback:** Git revert if issues arise
- **Risk Level:** LOW (only removes insecure code path)

**P0-2 Fix (Pricing Display):**
- **Breaking Changes:** None (additive UI change only)
- **Rollback:** Git revert if design doesn't match brand
- **Risk Level:** ZERO (pure UI enhancement)

---

## SUCCESS CRITERIA

**P0-1 Success:**
- ✅ All webhooks require valid signature
- ✅ No development bypass exists
- ✅ Local testing uses Stripe CLI

**P0-2 Success:**
- ✅ Wallet UI displays "$0.70/minute"
- ✅ Explainer card shows conversion math
- ✅ Customers can calculate call costs

---

## FILES TO MODIFY

### Backend (1 file)
- `backend/src/middleware/verify-stripe-signature.ts` (delete 6 lines)

### Frontend (1 file)
- `src/app/dashboard/wallet/page.tsx` (add 1 line + optional explainer)

**Total Changes:** 2 files, ~15 lines of code

---

## DEPLOYMENT CHECKLIST

**Pre-Deployment:**
- [ ] Code changes committed
- [ ] Tests passing (webhook + UI)
- [ ] Stripe CLI tested locally

**Post-Deployment:**
- [ ] Monitor Sentry for webhook errors
- [ ] Check Stripe Dashboard webhook delivery
- [ ] Verify wallet UI displays correctly
- [ ] Monitor support tickets for billing confusion

---

## NEXT STEPS AFTER FIXES

1. ✅ Verify P0 fixes deployed
2. ⏳ Resume Layer 6 (Security Audit)
3. ⏳ Schedule P1 fixes for next sprint
4. ⏳ Deploy to production

---

**STATUS:** ✅ PLANNING COMPLETE - READY TO CODE
