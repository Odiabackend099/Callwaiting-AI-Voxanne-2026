# Billing Cost Deduction Audit - Complete Testing Guide

## Executive Summary

This guide verifies that **when users make VAPI calls or provision phone numbers, their wallet balance is correctly debited**. This is critical business logic — users prepay via Stripe, and we must deduct costs.

**Current Status:**
- ✅ Backend: Running on port 3001
- ✅ Frontend: Running on port 3000
- ✅ Stripe: Integrated (webhook listener active)
- ✅ Test Account Balance: $815 (81,500 pence)

---

## MASTER TEST PLAN

### Phase 1: Automated Audit (No Manual Intervention)

```bash
# Run comprehensive billing audit
npm run audit:billing

# This tests:
✅ Current balance state
✅ VAPI call cost deductions
✅ Multi-tenant isolation (RLS)
✅ Debt limit enforcement
✅ Auto-recharge configuration
✅ Phone provisioning costs
✅ Transaction audit trail
✅ Idempotency (no double-charging)
```

---

### Phase 2: Live Cost Deduction Test (Real Call)

**Objective:** Make an actual VAPI call, watch balance drop.

#### Step 2A: Record Current Balance

```bash
# In terminal, query current balance
curl -X GET http://localhost:3001/api/billing/wallet \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response:
{
  "balance_pence": 81500,
  "balance_formatted": "£815.00",
  "low_balance_pence": 500,
  "is_low_balance": false,
  "auto_recharge_enabled": false,
  "has_payment_method": true
}

# NOTE: Record this balance for comparison
```

#### Step 2B: Make a Real VAPI Call

**Via Frontend:**
1. Go to http://localhost:3000/dashboard
2. Create or select an inbound agent
3. Call the test phone number (Vapi will prompt you)
4. Keep call ~60 seconds (controllable cost)
5. End call and wait for webhook processing

**Via Test Script:**
```bash
# Simulate incoming call (requires test Vapi account)
curl -X POST http://localhost:3001/api/vapi/test-incoming-call \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "duration_seconds": 60,
    "org_id": "YOUR_ORG_ID"
  }'
```

#### Step 2C: Verify Balance Decreased

```bash
# Query balance again
curl -X GET http://localhost:3001/api/billing/wallet \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: balance_pence should be LOWER
# For 60 second call:
# Cost = ceil((60/60) * 70) * 0.79 = 56 pence
# New balance: 81500 - 56 = 81444 pence (£814.44)
```

#### Step 2D: Verify Transaction Logged

```bash
# Query transaction history
curl -X GET http://localhost:3001/api/billing/wallet/transactions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: Most recent transaction should show:
{
  "type": "call_deduction",
  "direction": "debit",
  "amount_pence": 56,
  "balance_before_pence": 81500,
  "balance_after_pence": 81444,
  "call_id": "vapi-call-xxxxx",
  "created_at": "2026-02-13T15:45:00Z"
}
```

---

### Phase 3: Phone Provisioning Cost Audit

**Objective:** Verify phone number provisioning costs are deducted.

#### Step 3A: Check Existing Numbers

```bash
# Query provisioned phone numbers
curl -X GET http://localhost:3001/api/phone-numbers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response shows phone numbers with cost_pence
{
  "phone_numbers": [
    {
      "id": "xxx",
      "phone_number": "+12015551234",
      "provisioning_cost_pence": 1000,
      "created_at": "2026-02-12T10:00:00Z"
    }
  ]
}
```

#### Step 3B: Verify Provisioning Cost Deduction

```bash
# Query credit transactions for provisioning type
curl -X GET http://localhost:3001/api/billing/wallet/transactions?type=phone_provisioning \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: Each phone number has a corresponding debit transaction
{
  "transactions": [
    {
      "type": "phone_provisioning",
      "direction": "debit",
      "amount_pence": 1000,
      "balance_before_pence": 82000,
      "balance_after_pence": 81000,
      "created_at": "2026-02-12T10:00:01Z"
    }
  ]
}
```

---

### Phase 4: Debt Limit & Auto-Recharge Test

**Objective:** Verify system prevents over-drafting and triggers auto-recharge.

#### Step 4A: Check Current Config

```bash
# Get auto-recharge settings
curl -X GET http://localhost:3001/api/billing/plan \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response includes:
{
  "wallet_auto_recharge": true/false,
  "wallet_low_balance_pence": 500,
  "debt_limit_pence": 500
}
```

#### Step 4B: Enable Auto-Recharge (if disabled)

```bash
curl -X POST http://localhost:3001/api/billing/wallet/auto-recharge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "enabled": true,
    "threshold_pence": 500,
    "amount_pence": 5000
  }'
```

#### Step 4C: Make Large Call to Trigger Auto-Recharge

```bash
# Make 10+ minute call to deduct >500 pence
# This should trigger auto-recharge if:
# 1. Balance will drop below threshold (500p)
# 2. Auto-recharge is enabled
# 3. Payment method is saved

# After call completes, check:
# 1. Balance initially dropped
# 2. Auto-recharge triggered (check logs)
# 3. Balance restored via Stripe
```

---

### Phase 5: Multi-Tenant Isolation Verification

**Objective:** Ensure one org cannot access another's balance.

#### Step 5A: Query Your Transactions

```bash
# Get your transaction history
curl -X GET http://localhost:3001/api/billing/wallet/transactions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# All entries should have your org_id
```

#### Step 5B: Verify Other Orgs Blocked (RLS)

```bash
# Try to access another org's transactions (should be denied)
# This requires another JWT token from a different org
# If RLS is working: Will return 0 results
# If RLS is broken: Will return their transactions (SECURITY BUG)
```

---

### Phase 6: Edge Cases & Failure Scenarios

#### Test 6A: Insufficient Balance Rejection

```bash
# Set balance to 50 pence (below min 79p)
# Try to make a call
# Expected: Call rejected with 402 Payment Required

# Response:
{
  "error": "Insufficient credits to authorize call",
  "currentBalance": 50,
  "requiredBalance": 79
}
```

#### Test 6B: Webhook Retry (Idempotency)

```bash
# Trigger same webhook twice (simulate retry)
stripe trigger call.ended --call_id=test-call-123

stripe trigger call.ended --call_id=test-call-123  # Same ID

# Expected: Only charged ONCE
# Query transactions: Should see 1 entry, not 2
```

#### Test 6C: Stripe Integration Failure

```bash
# Stop Stripe listener
pkill -f "stripe listen"

# Make a call (balance will deduct from wallet, even if Stripe fails)

# Restart Stripe listener
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Webhook should process and credit wallet
# Check transaction history for both deduction and credit
```

---

## Expected Cost Calculation

### Formula
```
Duration (seconds) → Cost (cents USD) → Cost (pence GBP)

Cost = ceil((duration_seconds / 60) * 70) * 0.79
```

### Examples
| Duration | USD Cost | GBP Cost |
|----------|----------|----------|
| 30s | 35¢ | 28p |
| 60s | 70¢ | 56p |
| 91s | 107¢ | 85p |
| 120s | 140¢ | 112p |
| 300s (5 min) | 350¢ | 277p |
| 600s (10 min) | 700¢ | 553p |
| 3600s (1 hour) | 4200¢ | 3318p |

### With $815 Balance (81,500p)
- **Minutes available:** ~24.25 hours
- **Calls available:** ~2,900 1-minute calls
- **Before low balance:** 81,500p - 500p = 81,000p available

---

## Database Queries for Verification

### Query 1: Check All Transactions for Org

```sql
SELECT
  created_at,
  type,
  direction,
  amount_pence,
  balance_before_pence,
  balance_after_pence,
  call_id
FROM credit_transactions
WHERE org_id = 'YOUR_ORG_ID'
ORDER BY created_at DESC
LIMIT 20;
```

**Expected:** All rows have YOUR_ORG_ID, amounts are positive, directions are debit/credit

### Query 2: Verify Idempotency (No Duplicates)

```sql
SELECT
  call_id,
  COUNT(*) as charge_count
FROM credit_transactions
WHERE org_id = 'YOUR_ORG_ID'
  AND call_id IS NOT NULL
GROUP BY call_id
HAVING COUNT(*) > 1;
```

**Expected:** 0 results (no duplicates)

### Query 3: Check Negative Balances

```sql
SELECT
  id,
  name,
  wallet_balance_pence,
  debt_limit_pence
FROM organizations
WHERE wallet_balance_pence < 0
  AND id = 'YOUR_ORG_ID';
```

**Expected:** If negative, should be within debt_limit_pence

### Query 4: Verify RLS Policy

```sql
-- This query should only return YOUR_ORG_ID's data
SELECT org_id, COUNT(*) as txn_count
FROM credit_transactions
GROUP BY org_id;

-- If you can see multiple org_ids: RLS is BROKEN (SECURITY ISSUE)
-- If you see only your org_id: RLS is working ✅
```

---

## Troubleshooting

### Problem: Balance Not Decreasing After Call

**Diagnosis Steps:**

1. **Verify webhook was received:**
   ```bash
   tail -50 /tmp/stripe-listener.log | grep "call.ended"
   ```

2. **Check backend logs for processing:**
   ```bash
   tail -100 /tmp/backend.log | grep -i "wallet\|deduct\|billing"
   ```

3. **Verify call was created in database:**
   ```sql
   SELECT id, duration_seconds FROM calls
   WHERE org_id = 'YOUR_ORG_ID'
   ORDER BY created_at DESC LIMIT 1;
   ```

4. **Check for billing errors:**
   ```bash
   curl -X GET http://localhost:3001/api/monitoring/health \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

### Problem: Double-Charging (Balance Deducted Twice)

**Diagnosis:**

```sql
SELECT call_id, COUNT(*) as charges
FROM credit_transactions
WHERE org_id = 'YOUR_ORG_ID'
  AND type = 'call_deduction'
GROUP BY call_id
HAVING COUNT(*) > 1;
```

**If found, this is a BUG — RLS policy not unique on call_id**

### Problem: Can See Other Org's Transactions

**CRITICAL SECURITY ISSUE:**

```bash
# This query should return 0 results
curl -X GET http://localhost:3001/api/billing/wallet/transactions \
  -H "Authorization: Bearer DIFFERENT_ORG_JWT"

# If it returns results: RLS policies are misconfigured
```

---

## Success Criteria

✅ **Test Passes When:**

1. Call cost deducted correctly (balance decreased)
2. Transaction logged in `credit_transactions` table
3. Deduction amount = ceil((duration_seconds / 60) * 70) * 0.79
4. Org_id matches authenticated user
5. No duplicate charges (idempotency)
6. Insufficient balance blocks calls
7. Debt limit enforced
8. Auto-recharge triggered when needed
9. Phone provisioning costs deducted
10. Audit trail is immutable

---

## Running the Full Test Suite

```bash
cd backend

# Install dependencies
npm install

# Run comprehensive audit
npm run audit:billing

# Expected output:
# ✅ PASSED: 8-10 tests
# ❌ FAILED: 0 tests (if architecture is correct)
# ⏳ PENDING: 0-2 tests (require manual verification)
```

---

## Next Steps After Testing

1. **If all tests pass:**
   - ✅ Cost deduction system is production-ready
   - Deploy with confidence
   - Monitor first week for anomalies

2. **If tests fail:**
   - Identify specific gap (see troubleshooting)
   - Check database schema matches migrations
   - Verify RLS policies are applied
   - Review webhook processing logs

3. **Monitoring:**
   - Watch for negative balances
   - Monitor auto-recharge success rate
   - Track cost calculation accuracy
   - Alert on RLS policy violations

---

## Quick Reference: Critical Files

| File | Purpose | Critical Lines |
|------|---------|----------------|
| `backend/src/routes/vapi-webhook.ts` | Call cost deduction | 1124-1143 |
| `backend/src/services/wallet-service.ts` | Deduction logic | 171-338 |
| `backend/supabase/migrations/20260208_*.sql` | RPC functions | 104-179 |
| `backend/src/routes/billing-api.ts` | Wallet endpoints | 450-620 |
| `backend/src/services/billing-manager.ts` | Billing orchestration | 32-69 |

---

**Status: 🚀 READY FOR COMPREHENSIVE AUDIT**
