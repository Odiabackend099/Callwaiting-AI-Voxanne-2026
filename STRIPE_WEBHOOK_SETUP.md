# Stripe CLI Webhook Setup - Complete Guide

## What This Does

The Stripe CLI listens for webhook events from your Stripe test account and forwards them to your local backend. This is **essential** for E2E testing because:

1. **Real Webhook Processing**: Tests can trigger real Stripe payment events
2. **Multi-Tenancy Verification**: Webhooks correctly credit the organization that made the payment
3. **Full Payment Flow**: Login → Checkout → Payment → Webhook → Balance Update

---

## QUICK START (3 terminals)

### Terminal 1: Start Stripe Webhook Listener

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
bash setup-stripe-webhooks.sh
```

**What you'll see:**
```
Getting ready to listen for Stripe events...
Ready! You are now listening for Stripe events...
→ Forwarding to http://localhost:3001/api/webhooks/stripe
```

**Keep this running throughout entire test!**

---

### Terminal 2: Start Backend Server

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npm run dev
```

**Expected output:**
```
[StripeWebhook] Webhook handler ready
Server running on port 3001
```

---

### Terminal 3: Run E2E Test

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026

# Start frontend (background)
npm run dev &

# Wait for frontend
sleep 5

# Run billing test
npm run test:billing:headed
```

---

## DETAILED SETUP

### Step 1: Authenticate Stripe CLI

**Only needed once.**

```bash
stripe login
```

- Browser opens
- Click "Authorize"
- Browser shows: "Your CLI is authenticated"
- Return to terminal

**Verify:**
```bash
stripe config --list
```

---

### Step 2: Verify Webhook Secret

Your webhook secret is already in `backend/.env`:

```bash
# Check it exists
grep STRIPE_WEBHOOK_SECRET backend/.env

# Should show:
# STRIPE_WEBHOOK_SECRET='whsec_cTpz8b2pCiBvQeEayoqYwCEPcBknX69W'
```

---

### Step 3: Start Backend

Terminal 2:
```bash
cd backend
npm run dev
```

Wait for:
```
Server running on port 3001
```

---

### Step 4: Start Webhook Listener

Terminal 1:
```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
bash setup-stripe-webhooks.sh
```

This will:
1. Verify Stripe CLI is installed
2. Verify you're authenticated
3. Verify webhook secret exists
4. Start listening and forwarding to `localhost:3001/api/webhooks/stripe`

---

### Step 5: Run E2E Test

Terminal 3:
```bash
npm run test:billing:headed
```

---

## WHAT HAPPENS DURING TEST

### Test Flow
1. Browser opens test site
2. User logs in (test@demo.com / demo123)
3. User adds funds (£25)
4. Stripe Checkout opens (iframe embedded)
5. Test enters card: `4242 4242 4242 4242`
6. Test submits payment
7. **[Terminal 1]** Webhook listener shows: `→ charge.succeeded [evt_...]`
8. **[Terminal 2]** Backend logs: `[StripeWebhook] Processing wallet top-up for org: xxx`
9. Backend updates org wallet balance (org_id correctly filtered)
10. Test verifies balance increased ✅

---

## VERIFICATION CHECKLIST

### Before Running Test

- [ ] `stripe --version` returns version number
- [ ] `stripe config --list` shows configuration
- [ ] `backend/.env` contains `STRIPE_WEBHOOK_SECRET`
- [ ] Backend is running on port 3001
- [ ] Webhook listener shows "Ready!"

### During Test

- [ ] Stripe Checkout iframe appears
- [ ] Card input works
- [ ] Payment submits
- [ ] Webhook fires (Terminal 1 shows event)
- [ ] Backend processes webhook (Terminal 2 shows logs)
- [ ] Test verifies wallet balance increased

### Success Criteria

✅ Test completes without timeout
✅ Webhook listener logs payment event
✅ Backend logs correct org_id in webhook handler
✅ Wallet balance increases after payment
✅ Test assertion passes: `await expect(balanceAfter).toBeGreaterThan(balanceBefore)`

---

## TROUBLESHOOTING

### Error: "stripe: command not found"

```bash
# Reinstall
brew install stripe/stripe-cli/stripe

# Verify
stripe --version
```

### Error: "Not authenticated"

```bash
# Re-authenticate
stripe login

# Verify
stripe config --list
```

### Error: "Signature verification failed"

The webhook secret in `.env` doesn't match what Stripe is using.

**Solution:**
1. Stop webhook listener (Ctrl+C)
2. Run: `stripe listen` (without --forward-to)
3. Copy the signing secret displayed
4. Update `backend/.env`: `STRIPE_WEBHOOK_SECRET=whsec_test_...`
5. Restart backend: `npm run dev`
6. Run webhook listener again

### Error: "Port 3001 already in use"

```bash
# Find what's using it
lsof -i :3001

# Kill it
kill -9 <PID>

# Or use different port
PORT=3002 npm run dev
# Then update webhook listener:
stripe listen --forward-to localhost:3002/api/webhooks/stripe
```

### Webhooks not appearing in listener output

1. **Check backend is running:** `lsof -i :3001`
2. **Check webhook secret is correct:** `grep STRIPE_WEBHOOK_SECRET backend/.env`
3. **Check listener is forwarding:** Output should say "Forwarding to http://localhost:3001/api/webhooks/stripe"
4. **Test manually:**
   ```bash
   stripe trigger charge.succeeded
   ```
   Should see event in listener output

---

## MANUAL WEBHOOK TESTING

Without running full E2E test:

```bash
# Terminal 1: Webhook listener (keep running)
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Terminal 2: Backend (keep running)
cd backend && npm run dev

# Terminal 3: Trigger test webhooks
stripe trigger charge.succeeded
stripe trigger customer.created
stripe trigger invoice.created
```

**Expected in Terminal 1:**
```
→ charge.succeeded [evt_test_...]
→ customer.created [evt_test_...]
→ invoice.created [evt_test_...]
```

**Expected in Terminal 2:**
```
[StripeWebhook] Received charge.succeeded event, processing wallet top-up...
[StripeWebhook] Balance updated: +2500 pence
```

---

## ARCHITECTURE: Multi-Tenancy Flow

This is what we're verifying:

```
Payment Initiation
├─ JWT contains: org_id (from login)
├─ Create checkout session
└─ Pass org_id in session metadata

Payment Success (User submits card)
├─ Stripe charges card
└─ Stripe fires charge.succeeded webhook

Webhook Received
├─ Terminal 1: Stripe listen receives event
├─ Stripe listens forwards to localhost:3001/api/webhooks/stripe
└─ Terminal 2: Backend receives webhook

Webhook Processing (stripe-webhooks.ts)
├─ Extract org_id from session.metadata ← THIS IS THE CRITICAL STEP
├─ Validate org_id is not null
├─ Call addCredits(org_id, amountPence, ...) ← org_id ensures credits go to correct org
└─ Update organizations.balance WHERE id = org_id ← RLS + explicit filter ensures isolation

Balance Update
├─ Only the org that made the payment receives credits
└─ No other org can see or access those credits
```

---

## FILES INVOLVED

| File | Role |
|------|------|
| `setup-stripe-webhooks.sh` | Setup automation script |
| `backend/.env` | Contains `STRIPE_WEBHOOK_SECRET` |
| `backend/src/routes/stripe-webhooks.ts` | Webhook handler - extracts org_id, credits wallet |
| `backend/src/routes/billing-api.ts` | Creates checkout sessions - passes org_id in metadata |
| `tests/e2e/stripe-billing.spec.ts` | E2E test - completes full payment flow |
| `backend/src/services/wallet-service.ts` | Wallet credit logic |

---

## NEXT STEPS

1. Run the setup script: `bash setup-stripe-webhooks.sh`
2. Start the webhook listener (Terminal 1)
3. Start the backend (Terminal 2)
4. Run the E2E test (Terminal 3)
5. Verify balance updates correctly

The test confirms that **organization ID flows correctly through the entire payment pipeline** ✅

