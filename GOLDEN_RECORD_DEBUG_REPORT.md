# Golden Record SSOT - Debug Report

**Date:** 2026-02-13
**Status:** ⚠️ **PARTIAL IMPLEMENTATION - Golden Record fields not being populated**

---

## Database Check Results

### Calls Data Found
✅ **Database connection:** Working
✅ **Total calls saved:** 21
✅ **cost_cents:** Being populated (values range 2-6 cents)

❌ **tools_used:** EMPTY for all calls
❌ **ended_reason:** EMPTY for all calls
❌ **appointment_id:** NOT LINKED for any calls

### Sample Call Data (Most Recent)
```
Call ID: 019c35ab-2f64-7bb7-892d-308796c9e98e
Created: 2/7/2026, 2:15:37 AM
Status: completed
Cost (cents): 2  ✓ POPULATED
Tools Used:  ✗ EMPTY (should have tool names)
Ended Reason: ✗ EMPTY (should have Vapi endedReason code)
Appointment: ✗ NOT LINKED
```

---

## Root Cause Analysis

### Problem 1: tools_used Not Extracted
**Expected:** Array of tool names like `['bookClinicAppointment', 'transferCall']`
**Actual:** Empty array `[]`

**Code location:** `backend/src/routes/vapi-webhook.ts` lines 449-467 (extractToolsUsed function)

**Possible causes:**
1. Vapi webhook payload missing `messages` array
2. Messages array empty or malformed
3. No tool calls in the messages (valid scenario)
4. extractToolsUsed function not finding tool names correctly

### Problem 2: ended_reason Not Captured
**Expected:** Vapi's endedReason code like `customer_hangup`, `assistant_ended_call`
**Actual:** NULL

**Code location:** `backend/src/routes/vapi-webhook.ts` line 775

**Possible causes:**
1. `message.endedReason` is undefined in the Vapi webhook payload
2. Vapi sends endedReason in a different field name

### Problem 3: Appointment Not Linking
**Expected:** Bidirectional link between calls and appointments
**Actual:** No links created

**Code location:** `backend/src/routes/vapi-webhook.ts` lines 844-917

**Possible causes:**
1. bookClinicAppointment tool not used in test calls
2. Time-bounded query not finding appointments (timing mismatch)
3. Appointment linking code silently failing

---

## Immediate Actions Required

### 1. Check Vapi Webhook Payload Structure
We need to see what Vapi is actually sending. Add logging to the webhook handler:

```typescript
// Add at top of webhook handler (line 600)
log.info('Vapi-Webhook', 'Full webhook payload received', {
  messageKeys: Object.keys(message),
  hasMessages: !!call?.messages,
  messageCount: call?.messages?.length || 0,
  endedReason: message.endedReason,
  cost: message.cost
});
```

### 2. Verify Webhook Handler Code Deployed
The webhook handler at `backend/src/routes/vapi-webhook.ts` contains the Golden Record extraction logic (lines 771-778). Verify:
- ✅ Code exists in file
- ⏳ **Needs confirmation:** Backend reloaded with this code?

### 3. Check Backend Server Logs
The backend server is running but we need to see if there are any errors during webhook processing:

```bash
# Check for errors in recent logs
tail -100 backend/logs/server.log | grep -i "error\|tools_used\|ended_reason"
```

### 4. Test Webhook Manually
Create a test call and check if all fields are populated. Run:

```bash
npm run simulate:full
```

This will trigger a simulated Vapi webhook and show if tools_used and ended_reason are captured.

---

## Expected vs Actual

| Field | Expected | Actual | Status |
|-------|----------|--------|--------|
| cost_cents | 70 (for $0.70 call) | 2-6 | ✅ Works |
| ended_reason | "customer_hangup" etc | NULL | ❌ Missing |
| tools_used | ["bookClinicAppointment"] | [] | ❌ Empty |
| appointment_id | UUID (if booked) | NULL | ❌ Not linked |

---

## Next Steps

1. **Verify deployment:** Has backend code with Golden Record extraction been reloaded?
   - Check if code changes were made to `vapi-webhook.ts` lines 771-778
   - If deployed, restart backend: `npm run dev` in backend directory

2. **Check webhook payload:** What does Vapi actually send?
   - Look at backend logs for the payload structure
   - Verify `message.endedReason` exists
   - Verify `call.messages` array is populated

3. **Run simulation test:**
   - Execute: `npm run simulate:full`
   - Check if tools_used and ended_reason are captured
   - Verify appointment linking works

4. **Debug extraction functions:**
   - Test extractToolsUsed() with actual Vapi message payload
   - Verify message format matches code expectations

---

## Files Involved

**Webhook Handler:** `backend/src/routes/vapi-webhook.ts`
- extractToolsUsed function: lines 449-467
- Golden Record field extraction: lines 771-778
- Appointment linking: lines 844-917

**Dashboard API:** `backend/src/routes/calls-dashboard.ts`
- Already includes Golden Record fields in response (lines 174, 556, 632)

**Database Migration:** `backend/supabase/migrations/20260213_golden_record_schema.sql`
- Columns created: cost_cents, tools_used, ended_reason, appointment_id
- Indexes created for performance
- View updated with appointment JOIN

---

## Hypothesis

The most likely scenario is that **the Vapi webhook payload structure doesn't match what the code expects for extracting tools_used and ended_reason**.

The fact that cost_cents IS being populated suggests:
- ✅ Webhook is being triggered
- ✅ Code is running
- ✅ Database saves are working
- ❌ **Specific fields in the payload are missing or in wrong structure**

---

**Recommendation:** Check Vapi webhook payload format in backend logs and compare with extraction code expectations.
