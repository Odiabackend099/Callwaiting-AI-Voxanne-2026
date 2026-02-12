# Billing Gates Manual Test Guide

**Purpose:** Step-by-step manual testing instructions for verifying the revenue leak fixes.

**Date:** 2026-02-12
**Critical Fixes:** Phone provisioning billing gate + Call authorization billing gate

---

## Prerequisites

### 1. Get Your JWT Token

You need a valid JWT token for the test user. Get it from Supabase:

```bash
# Option A: Generate via Supabase CLI
supabase auth sign-in --email test@demo.com --password demo123

# Option B: Login via dashboard and copy token from browser DevTools
# 1. Login to http://localhost:3000
# 2. Open DevTools → Application → Local Storage
# 3. Find "supabase.auth.token" and copy the JWT
```

**Set the token as an environment variable:**
```bash
export JWT_TOKEN="your-jwt-token-here"
```

### 2. Verify Backend is Running

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok"}
```

### 3. Get Your Organization ID

```bash
# Via Supabase SQL Editor or psql:
SELECT id FROM organizations WHERE email = 'test@demo.com';

# Set as environment variable
export ORG_ID="your-org-id-here"
```

---

## Phase 4: Phone Provisioning with $0 Balance ❌ (Should Fail)

### Setup: Set Balance to $0

```bash
# Via Supabase SQL Editor
UPDATE organizations
SET wallet_balance_pence = 0
WHERE email = 'test@demo.com';

# Verify
SELECT wallet_balance_pence FROM organizations WHERE email = 'test@demo.com';
-- Expected: 0
```

### Test: Try to Provision Phone Number

```bash
curl -X POST http://localhost:3001/api/managed-telephony/provision \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "country": "US",
    "numberType": "local",
    "areaCode": "415"
  }' \
  -i
```

### Expected Result ✅

**HTTP Status:** `402 Payment Required`

**Response Body:**
```json
{
  "error": "Insufficient funds. $10.00 required to provision phone number.",
  "required": 1000,
  "current": 0,
  "canRetry": true
}
```

### Verify Balance Unchanged

```bash
SELECT wallet_balance_pence FROM organizations WHERE email = 'test@demo.com';
-- Expected: 0 (no deduction occurred)
```

### Pass Criteria

- ✅ HTTP status is 402
- ✅ Error message mentions insufficient funds
- ✅ `required` field shows 1000 pence
- ✅ `current` field shows 0
- ✅ Balance remains 0 (no charge)
- ✅ NO call to Twilio API was made

---

## Phase 5: Phone Provisioning with $10 Balance ✅ (Should Succeed)

### Setup: Credit Account with $10

```bash
# Via Supabase SQL Editor
UPDATE organizations
SET wallet_balance_pence = 1000
WHERE email = 'test@demo.com';

# Verify
SELECT wallet_balance_pence FROM organizations WHERE email = 'test@demo.com';
-- Expected: 1000
```

### Important: Check for Existing Phone Number

```bash
# Via Supabase SQL Editor
SELECT phone_number FROM managed_phone_numbers
WHERE org_id = '$ORG_ID' AND status = 'active';

# If a number exists, delete it first:
DELETE FROM managed_phone_numbers WHERE org_id = '$ORG_ID';
DELETE FROM org_credentials WHERE org_id = '$ORG_ID' AND provider = 'twilio';
```

### Test: Provision Phone Number

```bash
curl -X POST http://localhost:3001/api/managed-telephony/provision \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "country": "US",
    "numberType": "local",
    "areaCode": "415"
  }' \
  -i
```

### Expected Result ✅

**HTTP Status:** `201 Created` or `200 OK`

**Response Body:**
```json
{
  "success": true,
  "phoneNumber": "+14155551234",
  "vapiPhoneId": "abc-123-uuid",
  "subaccountSid": "AC..."
}
```

### Verify Balance Deducted

```bash
SELECT wallet_balance_pence FROM organizations WHERE email = 'test@demo.com';
-- Expected: 0 (1000 - 1000 = 0)
```

### Verify Transaction Logged

```bash
SELECT
  transaction_type,
  amount_pence,
  description,
  created_at
FROM credit_transactions
WHERE org_id = '$ORG_ID'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- `transaction_type` = `'phone_provisioning'`
- `amount_pence` = `-1000` (negative for deduction)
- `description` contains phone number or "Phone number provisioning"

### Pass Criteria

- ✅ HTTP status is 201 or 200
- ✅ Response contains `phoneNumber` and `vapiPhoneId`
- ✅ Balance deducted from 1000 to 0
- ✅ Transaction logged in `credit_transactions`
- ✅ Phone number appears in `managed_phone_numbers` table
- ✅ Phone number appears in `org_credentials` table (SSOT)

---

## Phase 6: Call Authorization with $0 Balance ❌ (Should Fail)

### Setup: Set Balance to $0

```bash
UPDATE organizations
SET wallet_balance_pence = 0
WHERE email = 'test@demo.com';
```

### Get Assistant ID for Testing

```bash
SELECT vapi_assistant_id FROM agents
WHERE org_id = '$ORG_ID'
LIMIT 1;

# Set as environment variable
export ASSISTANT_ID="your-assistant-id-here"
```

### Test: Simulate Vapi Assistant Request

```bash
curl -X POST http://localhost:3001/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "assistant-request",
      "call": {
        "assistantId": "'$ASSISTANT_ID'"
      }
    },
    "assistantId": "'$ASSISTANT_ID'"
  }' \
  -i
```

### Expected Result ✅

**HTTP Status:** `402 Payment Required`

**Response Body:**
```json
{
  "error": "Insufficient credits to authorize call",
  "message": "Please top up your account at your Voxanne dashboard to make calls.",
  "currentBalance": 0,
  "requiredBalance": 79,
  "autoRechargeEnabled": false
}
```

### Pass Criteria

- ✅ HTTP status is 402
- ✅ Error message mentions insufficient credits
- ✅ `currentBalance` shows 0
- ✅ `requiredBalance` shows 79 (minimum for calls)
- ✅ Call is NOT authorized (no assistant config returned)

---

## Alternative: Test Call Authorization via Dashboard

If you prefer to test through the actual UI:

### 1. Login to Dashboard

```bash
# Navigate to frontend
open http://localhost:3000

# Login with test credentials
# Email: test@demo.com
# Password: demo123
```

### 2. Navigate to Contacts

Click "Contacts" in sidebar → Select any contact

### 3. Try to Make a Call

Click "Call Back" or "Test Call" button

### Expected Result ✅

- ❌ Call fails with error message
- ⚠️ Alert appears: "Insufficient credits. Please top up your wallet..."
- 📊 No call appears in call logs
- 💰 Balance remains $0

---

## Edge Case Tests (Optional)

### Test A: Refund on Provisioning Failure

**Setup:**
```bash
# Credit balance
UPDATE organizations SET wallet_balance_pence = 1000 WHERE email = 'test@demo.com';

# Temporarily break Twilio credentials to force failure
UPDATE organizations SET wallet_balance_pence = 1000 WHERE email = 'test@demo.com';
```

**Test:**
```bash
# Try to provision (will fail due to invalid credentials)
curl -X POST http://localhost:3001/api/managed-telephony/provision \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"country": "US", "numberType": "local", "areaCode": "415"}'
```

**Expected:**
- ✅ Provisioning fails
- ✅ Balance is refunded (back to 1000 pence)
- ✅ Response indicates `"refunded": true`

### Test B: Concurrent Provisioning Attempts

**Purpose:** Verify atomic balance deduction prevents race conditions

```bash
# Run two simultaneous requests
curl -X POST http://localhost:3001/api/managed-telephony/provision \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"areaCode": "415"}' &

curl -X POST http://localhost:3001/api/managed-telephony/provision \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"areaCode": "415"}' &

wait
```

**Expected:**
- ✅ Only ONE request succeeds
- ✅ Second request fails with 402 (insufficient funds)
- ✅ Balance deducted only once

---

## Troubleshooting

### Issue: 401 Unauthorized

**Cause:** JWT token expired or invalid

**Fix:**
```bash
# Regenerate token via dashboard or Supabase CLI
# Update JWT_TOKEN environment variable
```

### Issue: 404 Not Found

**Cause:** Backend route not mounted or feature flag disabled

**Fix:**
```bash
# Verify feature flag
SELECT * FROM feature_flags WHERE feature_name = 'managed_telephony';

# Enable if disabled
UPDATE feature_flags SET enabled = true WHERE feature_name = 'managed_telephony';
```

### Issue: Test org has existing phone number

**Cause:** One-number-per-org rule blocks provisioning

**Fix:**
```bash
# Delete existing number
DELETE FROM managed_phone_numbers WHERE org_id = '$ORG_ID';
DELETE FROM org_credentials WHERE org_id = '$ORG_ID' AND provider = 'twilio';
```

### Issue: Balance doesn't change

**Cause:** RPC function `add_wallet_credits` may not support negative amounts

**Fix:** Check database logs for RPC errors:
```bash
# Backend logs
tail -f logs/backend.log | grep "WalletService"
```

---

## Success Criteria Summary

**All tests pass when:**

1. ✅ **Phase 4:** Phone provisioning returns 402 with $0 balance
2. ✅ **Phase 5:** Phone provisioning succeeds with $10 balance, balance deducted, transaction logged
3. ✅ **Phase 6:** Call authorization returns 402 with $0 balance

**Production Readiness:** Deploy only if all 3 phases pass

---

## Next Steps After Testing

If all tests pass:

1. ✅ Mark todos as complete
2. ✅ Update plan file with completion status
3. ✅ Commit changes to git
4. ✅ Deploy to staging environment
5. ✅ Monitor for 24 hours
6. ✅ Deploy to production

If any tests fail:

1. ❌ Review backend logs for errors
2. ❌ Verify RPC functions exist and work correctly
3. ❌ Check database schema (credit_transactions table)
4. ❌ Debug specific failing endpoint
5. ❌ Re-run tests after fixes

---

**Test Guide Version:** 1.0
**Last Updated:** 2026-02-12
**Status:** Ready for execution
