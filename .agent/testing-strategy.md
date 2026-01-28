# 🎓 Testing Strategy: Full-Scope vs Contract Testing

**Last Updated:** 2026-01-26
**Status:** Production Testing Framework

---

## The Two Types of Tests

### 1. **Full-Scope Test** (Backend Isolation)
**File:** `backend/src/scripts/full-scope-test.ts`
**Command:** `npm run test:full-scope`

**What it tests:**
- Backend endpoints in isolation
- Database connectivity
- Credential existence
- Tool logic (booking, lookup, transfer)

**How it works:**
- Makes direct HTTP calls via axios
- Calls specific endpoints: `/api/vapi/tools/calendar/check`, `/api/vapi/tools/bookClinicAppointment`
- Bypasses Vapi webhook routing
- Uses simplified payloads (not exact Vapi format)

**Analogy:** Testing each car part individually (engine, brakes, steering) in a garage.

---

### 2. **Contract Test** (Vapi Integration)  🎓 **PhD-LEVEL**
**File:** `backend/src/scripts/vapi-integration-contract-test.ts`
**Command:** `npm run test:contract`

**What it tests:**
- **EXACT** Vapi → Backend integration
- Webhook payload format (what Vapi actually sends)
- Response contract (what Vapi expects to receive)
- JSON parsing (Vapi must be able to parse the response)
- Tool-specific flags (endCall: true, transfer object)

**How it works:**
- Simulates EXACT Vapi webhook payload
- Tests the complete tool invocation flow
- Verifies response schema compliance
- Tests speech output generation

**Analogy:** Testing the ENTIRE car on a real road with a real driver.

---

## When to Use Each Test

| Scenario | Use Full-Scope | Use Contract |
|----------|----------------|--------------|
| **After code changes** | ✅ Quick sanity check | ✅ Verify Vapi compatibility |
| **Before deployment** | ✅ Verify backend works | ✅✅ MUST PASS (critical) |
| **Debugging booking logic** | ✅ Easier to debug | ❌ Too high-level |
| **Debugging live call failures** | ❌ Won't catch Vapi issues | ✅✅ TRUTH TEST |
| **CI/CD pipeline** | ✅ Fast feedback | ✅ Gate to production |
| **Local development** | ✅ Run frequently | ⚠️ Run before commits |

---

## The Critical Difference: Why Both Tests Can Pass But Live Calls Fail

### Example: The Payload Format Issue

**Full-Scope Test (Passes):**
```typescript
// What you send:
const payload = {
  message: {
    toolCalls: [{
      function: {
        name: 'checkAvailability',
        arguments: { tenantId: 'abc', date: '2026-02-09' }
      }
    }]
  }
};

// Backend receives and processes ✅
// Test PASSES
```

**Contract Test (Catches Real Issue):**
```typescript
// What VAPI ACTUALLY sends:
const vapiPayload = {
  message: {
    type: 'tool-calls',  // ← Required by Vapi
    toolCallList: [{     // ← Note: toolCallList, not toolCalls
      id: 'tool-001',    // ← Required by Vapi
      type: 'function',  // ← Required by Vapi
      function: {
        name: 'checkAvailability',
        arguments: '{"tenantId":"abc","date":"2026-02-09"}'  // ← JSON STRING
      }
    }],
    call: {              // ← Required by Vapi
      id: 'call-123',
      metadata: { org_id: 'abc' }
    }
  },
  toolCallId: 'tool-001'  // ← Required by Vapi
};

// Backend receives this ✅
// But if extractArgs() doesn't handle ALL these formats...
// Live calls FAIL ❌
```

**The Issue:**
- Full-scope test uses simplified format → backend processes it → test passes ✅
- Live calls use Vapi's exact format → backend can't parse → live calls fail ❌
- **Contract test catches this** because it uses Vapi's exact format

---

## Response Contract Example

**What Backend Returns:**
```json
{
  "toolResult": {
    "content": "{\"success\":true,\"availableSlots\":[\"9:00 AM\",\"2:00 PM\"]}"
  },
  "speech": "I found 2 available times: 9:00 AM and 2:00 PM"
}
```

**What Vapi Expects:**
1. ✅ `toolResult.content` must be a **JSON string** (not an object)
2. ✅ The JSON string must be **parseable**
3. ✅ The parsed object must have `success` field
4. ✅ For endCall: Must include `endCall: true` flag
5. ✅ For transfer: Must include `transfer` object with `destination`

**Contract Test Verifies:**
```typescript
// 1. Check structure
if (!response.toolResult) throw new Error('Missing toolResult');

// 2. Check type
if (typeof response.toolResult.content !== 'string') {
  throw new Error('toolResult.content must be string, got ' + typeof content);
}

// 3. Check parseability
const parsed = JSON.parse(response.toolResult.content);

// 4. Check schema
if (!parsed.hasOwnProperty('success')) {
  throw new Error('Missing required field: success');
}

// 5. Check tool-specific flags
if (toolName === 'endCall' && response.endCall !== true) {
  throw new Error('endCall tool must return endCall: true');
}
```

---

## Real-World Example: The ngrok Expiration Bug

**Full-Scope Test:**
```bash
$ npm run test:full-scope
✅ Test 1: checkAvailability - PASSED
✅ Test 2: bookClinicAppointment - PASSED
✅ Test 3: lookupCaller - PASSED
✅ Test 4: transferCall - PASSED

🎉 ALL TESTS PASSED
```

**Live Call:**
```
User: "I'd like to book an appointment for tomorrow at 2 PM"
AI: "Let me check availability..."
[15 second timeout]
AI: "I'm having trouble checking the schedule. Can you try again?"
```

**What happened:**
- Full-scope test calls `http://localhost:3001` directly → works ✅
- Live call uses webhook `https://sobriquetical-zofia-abysmally.ngrok-free.dev` → expired URL → timeout ❌

**Contract Test Catches This:**
```bash
$ npm run test:contract
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 0: Webhook Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Target] https://sobriquetical-zofia-abysmally.ngrok-free.dev/api/webhook/health
❌ Webhook health check FAILED: Connection timeout

⚠️  WARNING: Still using ngrok URL - this will fail in production calls
   Expected: https://voxanne-backend.onrender.com
   Actual: https://sobriquetical-zofia-abysmally.ngrok-free.dev

❌ TEST SUITE ABORTED
```

Contract test fails immediately because it checks the ACTUAL webhook URL that Vapi will use.

---

## Testing Workflow

### Development (Daily)
```bash
# 1. Make changes
git checkout -b feature/new-booking-logic

# 2. Quick sanity check
npm run test:full-scope

# 3. If full-scope passes, verify Vapi compatibility
npm run test:contract

# 4. If both pass, commit
git add .
git commit -m "feat: add new booking logic"
```

### Before Deployment (CRITICAL)
```bash
# 1. Run full-scope test
npm run test:full-scope
✅ All tests passed

# 2. Run contract test (THE TRUTH TEST)
npm run test:contract
✅ All contract tests passed

# 3. ONLY THEN deploy
# If contract test fails, DO NOT DEPLOY
```

### After Deployment (Verification)
```bash
# 1. Update BACKEND_URL in .env to production URL
BACKEND_URL=https://voxanne-backend.onrender.com

# 2. Run contract test against production
npm run test:contract
✅ All tests passed

# 3. Run webhook updater script
npm run update:webhooks

# 4. Make test call
# Call Vapi number and book appointment
```

---

## What Each Test Catches

| Issue | Full-Scope | Contract |
|-------|------------|----------|
| **Booking logic bug** | ✅ | ✅ |
| **Database connection error** | ✅ | ✅ |
| **Expired credentials** | ✅ | ✅ |
| **Webhook URL expired (ngrok)** | ❌ | ✅ |
| **Wrong response format** | ❌ | ✅ |
| **Missing endCall flag** | ❌ | ✅ |
| **Invalid JSON in toolResult.content** | ❌ | ✅ |
| **Vapi can't parse response** | ❌ | ✅ |
| **Payload format mismatch** | ❌ | ✅ |
| **Tool-specific behavior** | ⚠️ Partial | ✅ |

---

## Red Flags: When Tests Disagree

**Scenario 1: Full-Scope Passes, Contract Fails**
```bash
$ npm run test:full-scope
✅ ALL TESTS PASSED

$ npm run test:contract
❌ CONTRACT VIOLATION: toolResult.content is not valid JSON
```

**What this means:** Backend works in isolation but is returning responses in the wrong format for Vapi.

**Action:** Fix response format in vapi-tools-routes.ts. The backend is returning an object when Vapi expects a JSON string.

---

**Scenario 2: Both Pass Locally, Live Calls Fail**
```bash
$ npm run test:full-scope (localhost)
✅ ALL TESTS PASSED

$ npm run test:contract (localhost)
✅ ALL CONTRACT TESTS PASSED

[Make live call]
❌ Tool call timeout after 15 seconds
```

**What this means:** Tests are using localhost, but live calls use production webhook URL which might be:
- Expired (ngrok)
- Not reachable from internet (firewall)
- Not configured in Vapi assistant

**Action:**
1. Update BACKEND_URL in .env to production URL
2. Re-run contract test: `npm run test:contract`
3. If passes, run: `npm run update:webhooks`
4. Make test call

---

**Scenario 3: Contract Passes, Live Calls Still Fail**
```bash
$ npm run test:contract
✅ ALL CONTRACT TESTS PASSED

[Make live call]
AI: "I'm having trouble accessing the calendar"
```

**What this means:** The webhook format is correct, but there's an issue with:
- OAuth credentials (Google Calendar expired)
- Org ID resolution (can't find org from phone number)
- Calendar API permissions

**Action:**
1. Check backend logs during live call
2. Run credential health check: `IntegrationDecryptor.validateGoogleCalendarHealth(orgId)`
3. Re-authorize Google Calendar if needed

---

## Best Practices

### ✅ DO
- Run contract test before EVERY deployment
- Update BACKEND_URL to production URL before contract test
- Treat contract test failures as blocking (DO NOT DEPLOY)
- Use full-scope test for rapid iteration
- Run both tests in CI/CD pipeline

### ❌ DON'T
- Deploy if contract test fails (live calls WILL fail)
- Skip contract test because "full-scope passed"
- Test against localhost and assume production works
- Ignore contract test warnings (ngrok URL, missing flags)
- Run contract test without updating BACKEND_URL first

---

## Contract Test Output (Example)

**SUCCESS:**
```
╔════════════════════════════════════════════════════════════╗
║  🎓 PhD-LEVEL VERIFICATION: Vapi Integration Contract     ║
║     Tests EXACTLY what happens on a live call             ║
╚════════════════════════════════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 1: Vapi → Backend → checkAvailability (REAL WEBHOOK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Vapi Webhook] POST /api/vapi/tools/calendar/check
[Backend Response] Status: 200
[Parsed Content] Success: true
[Parsed Content] Available Slots: 15
[Speech Output] Great! I found 15 available times on 2026-02-09...

✅ TEST 1 PASSED - Vapi contract verified

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 2: Vapi → Backend → bookClinicAppointment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Vapi Webhook] POST /api/vapi/tools/bookClinicAppointment
[Backend Response] Status: 200
[Parsed Content] Success: true
[Parsed Content] Appointment ID: appt_123abc
[Speech Output] Perfect! Your appointment is confirmed for...

✅ TEST 2 PASSED - Booking contract verified

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 3: Vapi → Backend → transferCall
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Vapi Webhook] POST /api/vapi/tools/transferCall
[Backend Response] Status: 200
[Transfer Object] Present: true
[Transfer Object] Destination: +15551234567

✅ TEST 3 PASSED - Transfer contract verified

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 4: Vapi → Backend → endCall (NEW TOOL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Vapi Webhook] POST /api/vapi/tools/endCall
[Backend Response] Status: 200
[End Call Flag] Present: true
[Speech Output] Thank you for calling. Goodbye!

✅ TEST 4 PASSED - endCall contract verified

╔════════════════════════════════════════════════════════════╗
║            ✅ ALL CONTRACT TESTS PASSED                    ║
║   Vapi → Backend integration is PRODUCTION READY           ║
╚════════════════════════════════════════════════════════════╝

🎉 VERIFICATION COMPLETE:
   - Webhook payload format: Valid
   - Response contract: Compliant
   - JSON parsing: Success
   - Tool-specific behavior: Verified
   - Live calls WILL work with this backend
```

---

## Summary

**Full-Scope Test:**
- Tests backend in isolation
- Fast feedback loop
- Good for development
- Can give false positives

**Contract Test:** 🎓
- Tests EXACT Vapi integration
- Simulates real live call flow
- TRUTH TEST for production readiness
- Must pass before deployment

**Rule of Thumb:**
> If contract test passes, live calls WILL work.
> If contract test fails, live calls WILL fail.
> Full-scope test passing is NOT enough.

---

**Commands:**
```bash
# Quick backend check
npm run test:full-scope

# Production readiness verification (THE TRUTH TEST)
npm run test:contract

# Both tests
npm run test:full-scope && npm run test:contract
```
