# PHASE 0: Temi Twilio SMS Integration Test Guide

**Status:** Ready to Execute
**Created:** 2026-01-10
**Purpose:** Validate Twilio SMS integration works before refactoring to BYOC architecture

---

## 📋 Overview

This guide walks through testing Temi's Twilio account to ensure SMS integration works correctly before we implement the multi-tenant BYOC (Bring Your Own Credentials) architecture.

**What we're testing:**
1. ✅ Twilio account access and credentials
2. ✅ Phone number validation (E.164 format)
3. ✅ SMS delivery (generic message)
4. ✅ Hot lead SMS scenarios

**Why this matters:**
- Proves the integration pattern works end-to-end
- Validates error handling for common failure modes
- Documents baseline behavior before refactoring
- Establishes test phone numbers for ongoing validation

---

## Prerequisites

### 1. Environment Setup

Ensure your `.env` file in `/backend` has Temi's credentials:

```bash
# .env (already configured)
TWILIO_ACCOUNT_SID=AC0a90c92cbd17b575fde9ec6e817b71af
TWILIO_AUTH_TOKEN=11c1e5e1069e38f99a2f8c35b8baaef8
TWILIO_PHONE_NUMBER=+1234567890  # Will be Temi's actual Twilio number
```

### 2. Dependencies

Twilio is already in `package.json`:
```json
"twilio": "^5.10.7"
```

If not installed, run:
```bash
cd backend
npm install
```

### 3. Test Phone Numbers

For Twilio trial accounts, you need to verify test phone numbers first:
- Temi's personal number (for receiving hot lead alerts)
- Another number (for appointment confirmations, etc.)

**Get test numbers from Temi:**
1. Log into Twilio Console: https://www.twilio.com/console
2. Go to "Account" > "Settings" > "Subaccounts"
3. View verified caller IDs
4. Add phone numbers to test with

---

## Running the Tests

### Step 1: Start Backend Server

```bash
cd backend
npm run dev
```

This starts the server on `http://localhost:3001` and loads environment variables.

### Step 2: Run Test Script

In a new terminal:

```bash
cd backend

# Run without test phone (uses Twilio default test number)
npx ts-node scripts/test-twilio-sms.ts

# OR with custom test phone
npx ts-node scripts/test-twilio-sms.ts +14155551234
```

### Step 3: Expected Output

```
╔════════════════════════════════════════════════════╗
║  PHASE 0: Temi Twilio SMS Integration Test Suite  ║
╚════════════════════════════════════════════════════╝

📝 Test 1: Verify Twilio Account Access
══════════════════════════════════════════════════════
✅ Account verified
   Account SID: AC0a90c92cbd17b575fde9ec6e817b71af
   Status: active
   Friendly Name: Temi Dev Account
   Created: 2024-12-15

📝 Test 2: Validate Twilio Phone Number
══════════════════════════════════════════════════════
✅ Phone number is valid: +1234567890
✅ Phone number verified in account
   Friendly Name: Voxanne SMS
   Phone: +1-123-456-7890

💬 Using test phone: +14155552671

📝 Test 3: Send Test SMS
══════════════════════════════════════════════════════
📤 Sending SMS...
   From: +1234567890
   To: +14155552671
✅ SMS sent successfully
   Message SID: SM123456789abcdef123456789abcdef01
   Status: queued
   Date Sent: 2026-01-10T16:30:00Z

📝 Test 4: Simulate Hot Lead SMS
══════════════════════════════════════════════════════
📤 Sending hot lead SMS...
   From: +1234567890
   To: +14155552671
✅ Hot lead SMS sent successfully
   Message SID: SM123456789abcdef123456789abcdef02
   Status: queued

══════════════════════════════════════════════════════
📊 TEST SUMMARY
══════════════════════════════════════════════════════
✅ Account Verification
✅ Phone Number Validation
✅ Send Test SMS
✅ Send Hot Lead SMS
══════════════════════════════════════════════════════

Total: 4 passed, 0 failed

🎉 All tests passed! Twilio SMS integration is working.
   Ready to proceed with Phase 1: Database Schema
```

---

## Test Breakdown

### Test 1: Account Verification
**What it tests:** Can we connect to Twilio with the credentials provided?

**Success criteria:**
- ✅ Connection established
- ✅ Account status is "active"
- ✅ Account SID matches credentials

**Failure scenarios:**
- ❌ `Invalid API Key` → Wrong TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN
- ❌ `Account suspended` → Account status not "active"
- ❌ `Connection timeout` → Network or Twilio API down

---

### Test 2: Phone Number Validation
**What it tests:** Is the phone number in the correct format and registered?

**Success criteria:**
- ✅ Phone is E.164 format: `+1234567890`
- ✅ Phone is registered in Twilio account
- ✅ Phone is verified (can send SMS)

**Failure scenarios:**
- ❌ `Invalid phone format` → Not E.164
- ❌ `Not found in account` → Phone not provisioned
- ❌ `Unverified number` → Trial account, need to verify in console

---

### Test 3: Send Generic SMS
**What it tests:** Can we send a basic SMS message?

**Success criteria:**
- ✅ Message sent with status "queued" or "sent"
- ✅ Message SID returned (for tracking)
- ✅ Message received within 5 seconds

**Failure scenarios:**
- ❌ `Invalid phone number` → Recipient number invalid or not verified
- ❌ `Account suspended` → Trial credits expired
- ❌ `Invalid credentials` → Auth token wrong
- ❌ `Rate limit exceeded` → Too many messages too fast

---

### Test 4: Hot Lead SMS Scenario
**What it tests:** Does the hot lead alert message format correctly?

**Success criteria:**
- ✅ Message contains: lead name, phone, service, summary
- ✅ Message sent successfully
- ✅ Message includes 🔥 emoji and proper formatting

**Failure scenarios:**
- Same as Test 3 (SMS delivery issues)
- ❌ `Message too long` → Text > 160 characters (will split into multiple)

---

## Troubleshooting

### Error: "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN"

**Cause:** Environment variables not set
**Fix:**
```bash
# Verify .env file exists
ls -la backend/.env

# Check values
grep TWILIO backend/.env

# If missing, add them:
echo "TWILIO_ACCOUNT_SID=AC0a90c92cbd17b575fde9ec6e817b71af" >> backend/.env
echo "TWILIO_AUTH_TOKEN=11c1e5e1069e38f99a2f8c35b8baaef8" >> backend/.env
echo "TWILIO_PHONE_NUMBER=+1234567890" >> backend/.env
```

### Error: "Invalid API Key"

**Cause:** Wrong Account SID or Auth Token
**Fix:**
1. Log into Twilio Console: https://www.twilio.com/console
2. Go to "Account" > "Settings"
3. Copy exact Account SID and Auth Token
4. Update `.env` file
5. Restart: `npm run dev`

### Error: "Invalid phone number" (Code 21212)

**Cause:** Phone number not verified or wrong format
**Fix:**
1. For trial accounts, verify numbers in Twilio Console:
   - Go to "Phone Numbers" > "Verified Caller IDs"
   - Add your test phone number
   - Confirm the verification code via SMS
2. Or use Twilio test number: `+15005550006`

### Error: "Suspend Account"

**Cause:** Trial credits expired
**Fix:**
1. Check balance: https://www.twilio.com/console/account/billing
2. Add payment method if expired
3. Verify account in good standing

### Test hangs/timeout

**Cause:** Network issue or Twilio API slow
**Fix:**
```bash
# Kill the script
Ctrl+C

# Try again with explicit timeout
timeout 30 npx ts-node scripts/test-twilio-sms.ts

# Or run with debug logs
DEBUG=twilio npx ts-node scripts/test-twilio-sms.ts
```

---

## Success Checklist

Once tests pass, verify:

- [x] All 4 tests pass
- [x] SMS delivered to test phone within 5 seconds
- [x] Message formatting correct (no encoding issues)
- [x] Message SIDs returned (for tracking)
- [x] Error handling works for invalid phones
- [x] Account remains "active" after tests

---

## Next Steps

### If tests ✅ PASS:

1. **Document results** in `PHASE0_TEST_RESULTS.md`
2. **Proceed to Phase 1:** Database schema with `organization_api_credentials` table
3. **Checkpoint:** Commit working test to git

```bash
git add backend/scripts/test-twilio-sms.ts backend/.env.example
git commit -m "test: Add Twilio SMS integration test suite (Phase 0)"
```

### If tests ❌ FAIL:

1. **Identify failure** using troubleshooting guide above
2. **Fix the issue** (credentials, phone, account status)
3. **Re-run tests** until all pass
4. **Document learnings** in `PHASE0_TEST_RESULTS.md`

---

## Phase 0 Complete: What We Learned

Once tests pass, we'll document:

✅ **Twilio Integration Works**
- Account access validated
- Phone number verified
- SMS delivery confirmed
- Error handling validated

✅ **Ready for Phase 1**
- Database schema can store org credentials
- Backend services can fetch from DB instead of env vars
- Frontend can manage credentials per organization

✅ **Pattern Established**
- Service layer abstraction works
- Error handling robust
- Logging captures all details
- Ready to scale to multi-tenant

---

## References

- **Twilio Node SDK:** https://www.twilio.com/docs/libraries/node
- **E.164 Phone Format:** https://www.twilio.com/docs/glossary/what-e164
- **Twilio Trial Accounts:** https://www.twilio.com/docs/usage/tutorials/account-setup
- **SMS Message Limits:** https://www.twilio.com/docs/sms/send-messages

---

## Test Results

**Status:** [ ] Pending Execution

Once you run the tests, document results here:

```
Test Execution Date: _______________
Test Phone: _______________
Account SID: AC0a90c92cbd17b575fde9ec6e817b71af
Auth Token: ✓ (hidden)

Test Results:
- [ ] Test 1: Account Verification ✓/✗
- [ ] Test 2: Phone Number Validation ✓/✗
- [ ] Test 3: Send Generic SMS ✓/✗
- [ ] Test 4: Hot Lead SMS ✓/✗

Failures (if any):
_______________

Next Steps:
_______________
```
