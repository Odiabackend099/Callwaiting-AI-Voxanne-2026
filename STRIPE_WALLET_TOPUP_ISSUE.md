# 🚨 CRITICAL BUG: Stripe Wallet Top-Up Not Updating Balance

**Date:** 2026-02-12
**Severity:** 🔴 **CRITICAL - Revenue Blocking Bug**
**Organization:** test@demo.com (ID: `ad9306a9-4d8a-4685-a667-cbeb7eb01a07`)
**Status:** ❌ **UNRESOLVED - Requires Immediate Investigation**

---

## Problem Summary

**User Action:** Customer clicks "Top Up" button on dashboard, pays £50 via Stripe Checkout
**Expected Result:** Wallet balance updates to reflect new credit (e.g., from £0 → £50)
**Actual Result:** ❌ Wallet balance remains unchanged (£0)
**Redirect:** User IS redirected to wallet dashboard after payment
**Payment:** ✅ Stripe DOES process the payment (money charged)

**User Reports:** "Balance not updating when I top up via dashboard. Only works when done manually via terminal."

---

## What Works (Verified)

✅ **Manual Terminal Credit**
- When user credits wallet manually via database/script, balance updates correctly
- Example: `$50 top-up via terminal → balance immediately shows £50`
- This proves the wallet UPDATE logic works correctly

✅ **Billing Gates** (From PRD)
- Phone provisioning gate: ✅ Deducts balance correctly
- SMS sending gate: ✅ Prevents sending without balance
- Call authorization gate: ✅ Checks balance before auth
- All gates verified working in PRD (Feb 12, 2026)

✅ **Stripe Webhook Automation**
- Webhook endpoint auto-registered on startup
- Signing secret stored in .env
- Environment detection (dev/staging/prod) working
- Webhook infrastructure deployed (Feb 12, 2026)

---

## What Doesn't Work

❌ **User Dashboard Top-Up Flow**
```
User clicks "Top Up" button
  ↓
Stripe Checkout modal opens
  ↓
User enters card (test: 4242 4242 4242 4242)
  ↓
User clicks "Pay" button
  ↓
Stripe processes payment ✅
  ↓
User redirected to /dashboard/wallet ✅
  ↓
Wallet balance = UNCHANGED ❌ (Should be +£50)
  ↓
No error messages displayed ❌
  ↓
No transaction record in credit_transactions ❌
```

---

## Database Structure (What You Need to Know)

### Organizations Table
- **Column:** `wallet_balance_pence` (INTEGER)
- **Purpose:** Single source of truth for wallet balance
- **Type:** Pence (1 pence = £0.01)
- **Test Org:** `ad9306a9-4d8a-4685-a667-cbeb7eb01a07`

### credit_transactions Table
- **Purpose:** Immutable audit trail of wallet operations
- **Key Columns:**
  - `org_id` - Which org this transaction belongs to
  - `type` - Transaction type ('topup', 'call', 'sms', etc.)
  - `direction` - 'credit' (add) or 'debit' (subtract)
  - `amount_pence` - Amount in pence
  - `balance_before_pence` - Balance before transaction
  - `balance_after_pence` - Balance after transaction
  - `stripe_payment_intent_id` - Link to Stripe payment
  - `created_at` - When transaction occurred

**Rule:** Every Stripe payment MUST create a row in credit_transactions
**Expected Row:** `type='topup'`, `direction='credit'`, `amount_pence=5000`, `stripe_payment_intent_id='pi_...'`

### Processing Flow

1. **Frontend:** User submits payment via Stripe Checkout
2. **Stripe:** Processes payment, creates `checkout.session.completed` event
3. **Webhook:** Stripe sends webhook to backend: `POST /api/webhooks/stripe`
4. **Backend Processing:**
   - Receives webhook event
   - Validates signature (HMAC-SHA256)
   - Extracts `checkout.session.completed` data
   - Reads `client_reference_id` → org_id
   - Reads amount_pence from session
   - **SHOULD:** Atomically update:
     - `organizations.wallet_balance_pence += amount_pence`
     - Insert row into `credit_transactions`
5. **Frontend:** Polls verification endpoint or waits for websocket update
6. **Dashboard:** Balance refreshes to show new amount

---

## What Was Implemented (From PRD & SSOT)

### ✅ Stripe Webhook Infrastructure (Feb 12, 2026)
- **File:** `backend/src/config/stripe-webhook-config.ts`
  - Environment detection (dev uses ngrok tunnel)
  - Automatic webhook URL generation

- **File:** `backend/src/scripts/setup-stripe-webhooks.ts`
  - Auto-registers webhook endpoint on startup
  - Stores signing secret in `.env`

- **File:** `backend/src/services/stripe-webhook-manager.ts`
  - Signature validation
  - Event routing

### ✅ Wallet Service (From PRD)
- **File:** `backend/src/services/wallet-service.ts`
  - `add_wallet_credits()` RPC function
  - Atomic balance updates with transaction logging
  - Debt limit enforcement

### ✅ Billing Gates (From PRD)
- Phone provisioning: Checks balance before purchase
- SMS sending: Prevents sending without funds
- Call authorization: Verifies balance before Vapi auth

---

## Potential Root Causes (Investigation Checklist)

### 1. ❓ Webhook Not Being Received
- [ ] Is Stripe sending the webhook to the correct URL?
- [ ] Is the ngrok tunnel running and configured?
- [ ] Check Stripe Dashboard → Developers → Webhooks → Recent deliveries
- [ ] Look for failed delivery attempts

### 2. ❓ Webhook Not Being Processed
- [ ] Is the webhook endpoint (`POST /api/webhooks/stripe`) responding with 200?
- [ ] Is signature validation passing?
- [ ] Is the webhook being added to the BullMQ job queue?
- [ ] Check backend logs for webhook processing errors

### 3. ❓ Webhook Processing Job Failing
- [ ] Is the BullMQ worker running?
- [ ] Are jobs being added to the queue but failing?
- [ ] Check job failure logs with error messages
- [ ] Is the Redis connection working?

### 4. ❓ Wallet Update Not Executing
- [ ] Is the `add_wallet_credits()` RPC function being called?
- [ ] Is the function returning an error?
- [ ] Is the org_id being extracted correctly from checkout session?
- [ ] Is there a Supabase permission/RLS issue?

### 5. ❓ Transaction Not Logged
- [ ] Is `credit_transactions` table receiving inserts?
- [ ] Query: `SELECT * FROM credit_transactions WHERE org_id = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07' ORDER BY created_at DESC LIMIT 5;`
- [ ] Expected: Recent 'topup' transactions matching Stripe payments

### 6. ❓ Frontend Not Refreshing
- [ ] Is frontend polling the wallet verification endpoint?
- [ ] Is there a websocket update that should trigger refresh?
- [ ] Are browser console errors preventing refresh?

### 7. ❓ Environment/Configuration Issues
- [ ] Is `STRIPE_WEBHOOK_SECRET` correctly set in `.env`?
- [ ] Is `STRIPE_SECRET_KEY` set?
- [ ] Is `NODE_ENV=development`? (Should be, for local)
- [ ] Is ngrok tunnel URL correct in `BACKEND_URL`?

---

## Investigation Workflow

### Step 1: Verify Webhook Reception (Check Stripe Dashboard)
```
1. Login: https://dashboard.stripe.com/test/webhooks
2. Find the webhook endpoint for your ngrok URL
3. Click on recent webhook events
4. Look for "checkout.session.completed" events
5. Check status: ✅ Delivered or ❌ Failed
6. If failed: Note the error message
7. If succeeded: Webhook is reaching backend
```

### Step 2: Check Backend Logs
```
Files to examine:
- backend logs during payment
- Search for: "webhook", "checkout.session", "stripe"
- Look for errors during job processing
```

### Step 3: Query Database
```sql
-- Check if transaction was recorded
SELECT * FROM credit_transactions
WHERE org_id = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07'
ORDER BY created_at DESC
LIMIT 10;

-- Check current wallet balance
SELECT wallet_balance_pence FROM organizations
WHERE id = 'ad9306a9-4d8a-4685-a667-cbeb7eb01a07';

-- Check if there are failed webhook processing jobs
-- (If using BullMQ, check dead letter queue)
```

### Step 4: Check Job Queue (Redis/BullMQ)
```
Files to check:
- backend/src/config/billing-queue.ts
- backend/src/jobs/stripe-webhook-processor.ts
- backend/src/routes/webhook-metrics.ts (for debugging)

Endpoint to check queue health:
- GET /api/webhook-metrics/queue-health
- GET /api/webhook-metrics/recent-failures?limit=20
```

### Step 5: Enable Debug Logging
```typescript
// Add to backend during investigation:
console.log('🔍 Webhook received:', event.type);
console.log('🔍 Org ID:', clientReferenceId);
console.log('🔍 Amount:', session.amount_total);
console.log('🔍 Starting wallet update...');
// ... etc
```

---

## Expected Behavior After Fix

```
User Top-Up Flow (SHOULD):
1. User clicks "Top Up" button
2. Stripe Checkout opens
3. User enters test card: 4242 4242 4242 4242
4. User clicks "Pay"
5. Stripe processes: ✅ Charges £50
6. Webhook sent to backend: checkout.session.completed
7. Backend processes webhook:
   - ✅ Validates signature
   - ✅ Extracts org_id + amount
   - ✅ Updates organizations.wallet_balance_pence
   - ✅ Logs transaction in credit_transactions
8. User redirected: /dashboard/wallet
9. Dashboard displays: ✅ Balance updated to £50
10. Transaction log shows: ✅ "Top-up: +£50" entry
```

---

## Critical Questions for Investigator

1. **Is the webhook endpoint responding?**
   - Try: `curl -X POST http://localhost:3001/api/webhooks/stripe -H "Content-Type: application/json" -d '{}'`
   - Expected: Either webhook validation error or 400 (bad signature is OK)
   - If you get 404: Endpoint doesn't exist or route not mounted

2. **Is the webhook secret correct?**
   - From `.env`: `STRIPE_WEBHOOK_SECRET`
   - From Stripe: https://dashboard.stripe.com/test/webhooks
   - Must match exactly for signature validation to pass

3. **Is the job queue working?**
   - Check Redis connection
   - Check if jobs are being added to queue
   - Check if worker is processing jobs

4. **Is the wallet update RPC being called?**
   - Add logging to `wallet-service.ts`
   - Check for any Supabase errors

5. **Is the transaction being logged?**
   - Query `credit_transactions` after payment
   - Should see a row with `type='topup'` and matching amount

---

## Files to Examine

### Critical Files
- `backend/src/routes/webhooks.ts` - Webhook endpoint handler
- `backend/src/services/stripe-webhook-manager.ts` - Webhook processing
- `backend/src/services/wallet-service.ts` - Wallet update logic
- `backend/src/config/billing-queue.ts` - Job queue setup
- `backend/src/jobs/stripe-webhook-processor.ts` - Job handler

### Configuration Files
- `backend/.env` - Check STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY
- `backend/src/config/stripe-webhook-config.ts` - Check webhook URL generation

### Database
- `organizations` table - wallet_balance_pence column
- `credit_transactions` table - Transaction logging
- Supabase RLS policies on both tables

---

## Test Case for Verification

**After fix is deployed:**

```
Test: Stripe Top-Up Works End-to-End
1. Organization: test@demo.com (ID: ad9306a9-4d8a-4685-a667-cbeb7eb01a07)
2. Initial balance: Record it (e.g., £0)
3. Top-up amount: £50
4. Test card: 4242 4242 4242 4242 (Exp: 12/34, CVC: 123)
5. Expected result: Balance = Initial + £50
6. Verify:
   - Dashboard shows new balance ✅
   - Transaction record exists in credit_transactions ✅
   - Stripe shows payment processed ✅
   - Webhook logs show successful processing ✅
```

---

## Summary for Next Developer

**You are receiving this bug report because:**
- User paid £50 via Stripe
- Stripe charged them (payment successful)
- **BUT** wallet balance didn't update
- Only works when manually credited via terminal

**Your mission:**
1. Understand the flow (see flowchart above)
2. Identify WHERE it breaks (webhook? job queue? wallet update? frontend?)
3. Fix the issue
4. Verify with test case above

**Don't guess** - use the investigation checklist systematically.
**Start with:** Stripe Dashboard to confirm webhooks are being sent.

---

**Report Generated:** 2026-02-12 18:00 UTC
**For:** Next AI Developer
**Context:** User tested $50 top-up, paid successfully, balance didn't update
