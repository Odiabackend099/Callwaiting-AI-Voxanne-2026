# MANUAL-02: Real Stripe Checkout

**Tier:** 1 (Must Pass — Blocks Release)
**Requires:** Stripe test mode, webhook forwarding to backend
**Time:** ~3 minutes
**Tester:** ____________________
**Date:** ____________________
**Result:** PASS / FAIL

---

## Pre-Conditions

- [ ] Demo account logged in on desktop browser
- [ ] Stripe CLI forwarding webhooks:
  ```bash
  stripe listen --forward-to http://localhost:3001/api/webhooks/stripe
  ```
- [ ] Note current wallet balance from `/dashboard/wallet`

**Wallet Balance Before:** £____________________

---

## Test Steps

### 1. Initiate Top-Up

- [ ] **1.1** Navigate to `/dashboard/wallet`
- [ ] **1.2** Click "Top Up" button
- [ ] **1.3** Top-up modal appears with amount options
- [ ] **1.4** Select an amount (minimum £25)
  - Amount selected: £____________________
- [ ] **1.5** Click "Proceed to Payment" or equivalent CTA

### 2. Stripe Checkout

- [ ] **2.1** Redirected to `checkout.stripe.com`
- [ ] **2.2** Stripe checkout form loads (card input visible)
- [ ] **2.3** Enter test card: `4242 4242 4242 4242`
- [ ] **2.4** Expiry: `12/34`, CVC: `123`
- [ ] **2.5** Click "Pay" / "Complete Payment"
- [ ] **2.6** Redirected back to Voxanne dashboard
  - Redirect URL: ____________________

### 3. Wallet Verification (within 30 seconds of redirect)

- [ ] **3.1** Wallet balance increased by top-up amount
  - Balance after: £____________________
  - Increase matches selected amount? YES / NO
- [ ] **3.2** New "Top-Up" entry in transaction history
  - Entry visible? YES / NO
  - Amount correct? YES / NO
  - Timestamp reasonable? YES / NO

### 4. Stripe CLI Webhook Confirmation

- [ ] **4.1** Stripe CLI shows `checkout.session.completed` event received
- [ ] **4.2** Backend logs show webhook processed successfully

---

## Pass Criteria

Steps 3.1 and 3.2 confirmed within 30 seconds of redirect back from Stripe.

## Edge Cases to Note

- [ ] What happens if you close the Stripe tab without paying? (Should return to wallet with no change)
- [ ] What happens if you use a declined card (`4000 0000 0000 0002`)? (Should show error on Stripe)

## Notes / Issues Found

```
(Record any issues, unexpected behavior, or UX concerns here)


```

## Screenshots

Attach screenshots of:
1. Stripe checkout form
2. Wallet balance before and after
3. Transaction history entry
4. Stripe CLI webhook log
