# Billing Gates Verification Checklist

**Purpose:** Comprehensive checklist to ensure all billing gates are working correctly before production deployment.

**Date:** 2026-02-12
**Version:** 1.0

---

## Pre-Deployment Checklist

### ✅ Code Implementation

- [ ] **Phase 1:** Phone provisioning billing gate implemented
  - [ ] `checkBalance()` imported in `managed-telephony.ts`
  - [ ] `deductPhoneProvisioningCost()` imported in `managed-telephony.ts`
  - [ ] Balance check occurs BEFORE Twilio API call (lines 104-120)
  - [ ] Deduction occurs BEFORE Twilio API call (lines 122-143)
  - [ ] 402 status code returned if insufficient funds
  - [ ] Refund logic implemented if Twilio fails (lines 137-161)

- [ ] **Phase 2:** Call authorization billing gate implemented
  - [ ] `checkBalance()` imported in `vapi-webhook.ts`
  - [ ] Balance check occurs in assistant-request handler (lines 956-999)
  - [ ] 402 status code returned if insufficient funds
  - [ ] Detailed error message with balance info provided
  - [ ] Success case logged for monitoring

- [ ] **Phase 3:** Transaction logging working
  - [ ] `deductPhoneProvisioningCost()` function created in `wallet-service.ts`
  - [ ] Function uses `add_wallet_credits` RPC with negative amount
  - [ ] Logs to `credit_transactions` table with type 'phone_provisioning'
  - [ ] Returns `DeductionResult` with success/failure status

### ✅ Server Configuration

- [ ] Backend server restarted after code changes
- [ ] No compilation errors in TypeScript build
- [ ] Backend listening on expected port (3001)
- [ ] Health check endpoint returns 200
- [ ] Environment variables loaded correctly

### ✅ Database State

- [ ] `credit_transactions` table exists and is accessible
- [ ] `organizations` table has `wallet_balance_pence` column
- [ ] `add_wallet_credits` RPC function exists
- [ ] Test organization exists in database
- [ ] Test organization has valid `org_id`

---

## Functional Testing Checklist

### 📋 Phase 4: Phone Provisioning with $0 Balance

- [ ] **Setup Complete**
  - [ ] Test org balance set to 0 pence
  - [ ] Balance verified via database query
  - [ ] JWT token obtained and valid

- [ ] **Test Execution**
  - [ ] POST request sent to `/api/managed-telephony/provision`
  - [ ] Request includes valid authorization header
  - [ ] Request body includes country, numberType, areaCode

- [ ] **Response Validation**
  - [ ] HTTP status code is 402
  - [ ] Response body contains `error` field
  - [ ] Error message mentions "Insufficient funds"
  - [ ] Response includes `required: 1000`
  - [ ] Response includes `current: 0`
  - [ ] Response includes `canRetry: true`

- [ ] **Side Effects Verification**
  - [ ] Balance still 0 after request (no deduction)
  - [ ] NO phone number created in `managed_phone_numbers`
  - [ ] NO transaction logged in `credit_transactions`
  - [ ] NO call to Twilio API (check Twilio logs if possible)

- [ ] **Logging Verification**
  - [ ] Backend logs show "Provisioning blocked - insufficient balance"
  - [ ] Log includes orgId, required (1000), current (0)

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

---

### 📋 Phase 5: Phone Provisioning with $10 Balance

- [ ] **Setup Complete**
  - [ ] Test org balance set to 1000 pence
  - [ ] Balance verified via database query (1000)
  - [ ] Existing phone numbers deleted (one-number-per-org rule)

- [ ] **Test Execution**
  - [ ] POST request sent to `/api/managed-telephony/provision`
  - [ ] Request includes valid authorization header
  - [ ] Request body includes country, numberType, areaCode

- [ ] **Response Validation**
  - [ ] HTTP status code is 201 or 200
  - [ ] Response body contains `success: true`
  - [ ] Response includes `phoneNumber` (E.164 format)
  - [ ] Response includes `vapiPhoneId` (UUID)
  - [ ] Response includes `subaccountSid` (Twilio format)

- [ ] **Balance Deduction Verification**
  - [ ] Balance before: 1000 pence
  - [ ] Balance after: 0 pence (1000 - 1000 = 0)
  - [ ] Deduction occurred BEFORE Twilio call

- [ ] **Transaction Logging Verification**
  - [ ] Transaction exists in `credit_transactions`
  - [ ] `transaction_type` = 'phone_provisioning'
  - [ ] `amount_pence` = -1000 (negative for deduction)
  - [ ] `description` mentions phone number
  - [ ] `balance_before_pence` = 1000
  - [ ] `balance_after_pence` = 0
  - [ ] `created_at` is recent timestamp
  - [ ] `org_id` matches test org

- [ ] **SSOT Verification**
  - [ ] Phone number in `managed_phone_numbers` table
  - [ ] Phone number in `org_credentials` table (dual-write)
  - [ ] `is_managed` = true in `org_credentials`
  - [ ] `is_active` = true in both tables

- [ ] **Refund Test (Optional)**
  - [ ] If provisioning fails, balance is refunded
  - [ ] Refund transaction logged with type 'refund'
  - [ ] Balance returns to 1000 pence

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

---

### 📋 Phase 6: Call Authorization with $0 Balance

- [ ] **Setup Complete**
  - [ ] Test org balance set to 0 pence
  - [ ] Test org has at least one agent configured
  - [ ] Agent has valid `vapi_assistant_id`
  - [ ] Assistant ID retrieved and stored

- [ ] **Test Execution**
  - [ ] POST request sent to `/api/vapi/webhook`
  - [ ] Request body includes `message.type: 'assistant-request'`
  - [ ] Request body includes `assistantId`
  - [ ] Request mimics Vapi webhook format

- [ ] **Response Validation**
  - [ ] HTTP status code is 402
  - [ ] Response body contains `error` field
  - [ ] Error message mentions "Insufficient credits"
  - [ ] Response includes `currentBalance: 0`
  - [ ] Response includes `requiredBalance: 79`
  - [ ] Response includes `autoRechargeEnabled` field

- [ ] **Side Effects Verification**
  - [ ] Balance still 0 after request
  - [ ] NO call initiated
  - [ ] NO transaction logged (authorization doesn't charge)
  - [ ] Assistant config NOT returned

- [ ] **Logging Verification**
  - [ ] Backend logs show "Call blocked - insufficient balance"
  - [ ] Log includes orgId, assistantId, balancePence, deficit

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Passed | ❌ Failed

---

## Edge Cases & Security Checklist

### 🔒 Security Validation

- [ ] **Race Condition Prevention**
  - [ ] Concurrent provisioning requests tested
  - [ ] Only ONE request succeeds with $10 balance
  - [ ] Second request blocked with 402
  - [ ] Balance deducted only once

- [ ] **Negative Balance Prevention**
  - [ ] Cannot deduct below debt limit
  - [ ] Provisioning blocked even if within debt limit
  - [ ] Calls allowed within debt limit (500 pence)

- [ ] **Transaction Integrity**
  - [ ] All deductions logged in `credit_transactions`
  - [ ] No orphaned transactions
  - [ ] Balance snapshots (before/after) correct
  - [ ] Timestamps accurate

- [ ] **Error Handling**
  - [ ] Invalid JWT returns 401
  - [ ] Missing org_id returns 401
  - [ ] Feature flag disabled returns 403
  - [ ] Database errors return 500 (not 402)
  - [ ] Twilio failures trigger refund

### 📊 Monitoring & Alerting

- [ ] **Logging**
  - [ ] All 402 responses logged with context
  - [ ] Balance checks logged (success and failure)
  - [ ] Deductions logged with full details
  - [ ] Refunds logged with reason

- [ ] **Metrics** (if applicable)
  - [ ] 402 error rate tracked
  - [ ] Provisioning success/failure rate tracked
  - [ ] Balance deduction amounts tracked
  - [ ] Average balance per org tracked

---

## Integration Testing Checklist

### 🔄 End-to-End Workflows

- [ ] **Happy Path: Top-up → Provision → Call**
  1. [ ] User starts with $0 balance
  2. [ ] Top-up via Stripe Checkout ($10)
  3. [ ] Provision phone number (balance → $0)
  4. [ ] Make test call (blocked due to $0)
  5. [ ] Top-up again ($10)
  6. [ ] Make test call (succeeds, balance decrements)

- [ ] **Error Recovery: Failed Provisioning**
  1. [ ] User has $10 balance
  2. [ ] Provisioning fails (Twilio error)
  3. [ ] Balance refunded to $10
  4. [ ] User can retry provisioning

- [ ] **Dashboard Display**
  - [ ] Wallet balance displayed correctly
  - [ ] Low balance warning shows when < £0.79
  - [ ] Transactions appear in transaction history
  - [ ] Error messages clear and actionable

---

## Performance & Load Testing Checklist

### ⚡ Performance Validation

- [ ] **Response Times**
  - [ ] Balance check: < 50ms
  - [ ] Deduction: < 100ms
  - [ ] Provisioning endpoint: < 3000ms (includes Twilio)
  - [ ] Call authorization: < 500ms

- [ ] **Concurrency**
  - [ ] 10 concurrent provisioning requests handled
  - [ ] 100 concurrent call authorizations handled
  - [ ] No deadlocks or race conditions

- [ ] **Database Load**
  - [ ] Credit transactions table indexed properly
  - [ ] No slow queries (EXPLAIN ANALYZE)
  - [ ] Connection pool not exhausted

---

## Deployment Checklist

### 🚀 Pre-Production

- [ ] **Code Review**
  - [ ] All changes reviewed by second developer
  - [ ] No hardcoded values (costs, thresholds)
  - [ ] Error messages user-friendly
  - [ ] Logging appropriate (not excessive)

- [ ] **Testing Sign-off**
  - [ ] All 6 test phases passed
  - [ ] Edge cases tested
  - [ ] Security audit complete
  - [ ] Performance acceptable

- [ ] **Documentation**
  - [ ] BILLING_GATES_MANUAL_TEST_GUIDE.md created
  - [ ] Test results documented
  - [ ] Rollback procedure documented
  - [ ] Team trained on new billing gates

### 🌐 Production Deployment

- [ ] **Staging Deployment**
  - [ ] Code deployed to staging
  - [ ] All tests re-run in staging
  - [ ] No errors in staging logs
  - [ ] Monitored for 24 hours

- [ ] **Production Deployment**
  - [ ] Database migrations applied (if any)
  - [ ] Backend deployed with new code
  - [ ] Health checks passing
  - [ ] No errors in production logs (first 1 hour)

- [ ] **Post-Deployment Monitoring**
  - [ ] 402 error rate monitored (first 24 hours)
  - [ ] No customer complaints about billing
  - [ ] Twilio costs stable (no unauthorized provisioning)
  - [ ] Vapi costs stable (no unauthorized calls)

### 📈 Success Metrics

- [ ] **Week 1 After Deployment**
  - [ ] Zero unauthorized phone provisioning attempts
  - [ ] Zero unauthorized call attempts
  - [ ] 402 error rate < 5% of total requests
  - [ ] No revenue leaks detected

- [ ] **Week 2 After Deployment**
  - [ ] Customer feedback reviewed
  - [ ] Error rates stable
  - [ ] No false positives (legitimate users blocked)
  - [ ] Refund logic working correctly

---

## Rollback Plan

### ⚠️ If Critical Issues Found

- [ ] **Immediate Actions**
  - [ ] Stop production deployment
  - [ ] Revert to previous backend version
  - [ ] Notify team via Slack
  - [ ] Document issue in incident report

- [ ] **Investigation**
  - [ ] Review production logs
  - [ ] Identify failing test scenario
  - [ ] Reproduce in local environment
  - [ ] Fix root cause

- [ ] **Re-deployment**
  - [ ] Apply fix
  - [ ] Re-run all tests
  - [ ] Deploy to staging first
  - [ ] Monitor for 24 hours before production

---

## Sign-off

| Role | Name | Date | Status |
|------|------|------|--------|
| **Developer** | __________ | __________ | ⬜ Approved / ❌ Rejected |
| **QA Engineer** | __________ | __________ | ⬜ Approved / ❌ Rejected |
| **Tech Lead** | __________ | __________ | ⬜ Approved / ❌ Rejected |
| **CTO** | __________ | __________ | ⬜ Approved / ❌ Rejected |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________

**Final Approval:** ⬜ APPROVED FOR PRODUCTION | ❌ REQUIRES FIXES

---

**Checklist Version:** 1.0
**Last Updated:** 2026-02-12
**Status:** Ready for use
