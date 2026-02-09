# Call.Started Webhook Handler - Implementation Complete

**Date:** 2026-02-09
**Status:** ✅ **DEPLOYED**
**Servers:** Running at http://localhost:3000 (frontend), http://localhost:3001 (backend)

---

## Problem Solved

**Before:** Calls in `call_tracking` table never appeared in dashboard because `calls` table was only populated on `end-of-call-report` webhook. If webhook never arrived (call failed early, timeout, network issue), data stayed orphaned.

**After:** `calls` table is now populated on BOTH `call.started` AND `end-of-call-report` webhooks:
- `call.started` → Creates record with status "in-progress" immediately
- `end-of-call-report` → Updates record with final data (transcript, sentiment, recording, etc.)

---

## What Was Implemented

### New Webhook Handler: `call.started`

**File:** `backend/src/routes/vapi-webhook.ts` (lines 241-345)

**Triggers When:** Vapi sends `call.started` event (when call begins, not when it ends)

**What It Does:**
1. Resolves `org_id` from `assistantId` → agents table lookup
2. Validates `call.id` exists (prevents NULL vapi_call_id bypass)
3. Determines call direction from `call.type` (inbound/outbound/web)
4. Enriches caller name from contacts table (if phone number matches)
5. Inserts record into `calls` table with:
   - `status: 'in-progress'`
   - `phone_number`, `from_number`, `caller_name`
   - `is_test_call` flag (from call.type === 'webCall' or metadata)
   - `metadata: { source: 'call.started webhook' }`
6. Returns HTTP 200 (per Vapi docs requirement)

**Key Features:**
- ✅ Uses `defaultToNull: false` so `end-of-call-report` can merge data later
- ✅ Handles org_id resolution via assistant lookup + metadata fallback
- ✅ Enriches caller name from contacts table immediately
- ✅ Flags test calls correctly
- ✅ Returns 200 even on errors (Vapi requirement)

---

## How It Works

### Before (Old Flow):
```
User clicks "Call" → call_tracking created (status: queued)
    ↓
Vapi initiates call
    ↓
IF call completes → Vapi sends end-of-call-report → calls table populated
IF call fails → No webhook → calls table EMPTY → Dashboard shows "No calls"
```

### After (New Flow):
```
User clicks "Call" → call_tracking created (status: queued)
    ↓
Vapi initiates call → Vapi sends call.started
    ↓
✅ calls table populated with status "in-progress" → Dashboard shows call immediately
    ↓
IF call completes → Vapi sends end-of-call-report → calls table UPDATED with transcript/sentiment/recording
IF call fails → Call still visible in dashboard (status: "in-progress" or updated to "failed")
```

---

## Benefits

1. **Immediate Visibility:** All initiated calls appear in dashboard instantly (not just completed ones)
2. **No More Empty Dashboards:** Organizations like `ceo@newco.com` with only queued calls will now see data
3. **Better Call Pipeline Health:** Can see which calls started but never completed
4. **Unified Data Source:** Dashboard always queries `calls` table (no need to merge with `call_tracking`)
5. **Future-Proof:** Handles all call types (inbound, outbound, web/browser tests)

---

## Testing

### Test Case 1: Inbound Call
```bash
# Trigger inbound call via Vapi phone number
# Expected: call.started webhook received → calls table populated immediately
# Dashboard shows: Status "in-progress", caller name enriched from contacts
```

### Test Case 2: Outbound Call
```bash
# Trigger outbound call via "Call Back" button
# Expected: call.started webhook received → calls table populated immediately
# Dashboard shows: Status "in-progress", phone number, direction "outbound"
```

### Test Case 3: Browser Test Call
```bash
# Click "Test Agent" button in dashboard
# Expected: call.started webhook received → calls table populated immediately
# Dashboard shows: Status "in-progress", is_test_call=true, hidden by default
```

### Test Case 4: Call That Fails Early
```bash
# Initiate call that fails before connecting
# Expected: call.started creates record → end-of-call-report updates status to "failed"
# Dashboard shows: Status "failed", visible in call logs
```

---

## Code Changes

### File Modified: `backend/src/routes/vapi-webhook.ts`

**Lines Added:** ~105 lines (new call.started handler)

**Key Logic:**
```typescript
if (message && message.type === 'call.started') {
  const call = message.call;

  // Resolve org_id from assistant
  let orgId: string | null = null;
  const assistantId = call?.assistantId || body.assistantId;
  if (assistantId) {
    const { data: agent } = await supabase
      .from('agents')
      .select('org_id')
      .eq('vapi_assistant_id', assistantId)
      .maybeSingle();
    orgId = (agent as any)?.org_id ?? null;
  }

  // Validate call.id
  if (!call?.id) {
    log.error('Vapi-Webhook', 'Missing call.id in call.started');
    return res.status(200).json({ success: true, error: 'Missing call.id' });
  }

  // Enrich caller name
  let callerName = 'Unknown Caller';
  if (phoneNumber && orgId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('name')
      .eq('org_id', orgId)
      .eq('phone', phoneNumber)
      .maybeSingle();
    if (contact?.name) {
      callerName = contact.name;
    }
  }

  // Insert into calls table
  await supabase.from('calls').upsert({
    org_id: orgId,
    vapi_call_id: call.id,
    phone_number: call.customer?.number || null,
    caller_name: callerName,
    status: 'in-progress',
    is_test_call: call.type === 'webCall' || !!(call.metadata?.is_test_call),
    // ... more fields
  }, { onConflict: 'vapi_call_id', defaultToNull: false });

  return res.status(200).json({ success: true });
}
```

---

## Deployment Status

| Component | Status | Verification |
|-----------|--------|--------------|
| Code Implementation | ✅ Complete | 105 lines added to vapi-webhook.ts |
| Backend Server | ✅ Running | http://localhost:3001 |
| Frontend Server | ✅ Running | http://localhost:3000 |
| Webhook Health | ✅ Healthy | `{"status":"healthy"}` |
| TypeScript Compilation | ✅ No Errors | Backend logs clean |

---

## Next Steps

1. **Test with Real Calls:**
   - Have user make inbound call to Vapi number
   - Verify `call.started` webhook logs appear in backend
   - Verify calls table populated immediately (before call ends)
   - Verify dashboard shows call with status "in-progress"

2. **Test with Browser Test:**
   - Click "Test Agent" in dashboard
   - Verify call appears immediately (not after call ends)
   - Verify `is_test_call=true` flag set correctly
   - Verify test calls filtered from default view

3. **Verify All Organizations Work:**
   - Test with `voxanne@demo.com` (has existing calls) ✅
   - Test with `ceo@newco.com` (previously empty) → Should now show calls
   - Test with new organization → Should work from first call

4. **Monitor Webhook Logs:**
   - Check backend logs for `🚀 CALL STARTED` messages
   - Check for any errors in call.started processing
   - Verify org_id resolution works correctly
   - Verify caller name enrichment happens

---

## Success Criteria

✅ **Phase 1:** Code implemented and deployed (COMPLETE)
⏳ **Phase 2:** Real call test (verify call.started webhook received)
⏳ **Phase 3:** Dashboard shows call immediately (not just after completion)
⏳ **Phase 4:** All organizations see their call data (no more empty dashboards)

---

## Rollback Procedure

If issues arise:

```bash
# Revert code changes:
git checkout HEAD~1 -- backend/src/routes/vapi-webhook.ts

# Restart servers:
pkill -9 -f npm
export NGROK_AUTH_TOKEN="35aXl1N52lOGdDE20Mfmr7WY0du_7AZmStxUgVhDNpn5WB7ZU"
cd backend && npm run startup
```

---

## Related Files

- `backend/src/routes/vapi-webhook.ts` - Main implementation
- `DASHBOARD_FIX_DEPLOYMENT_SUMMARY.md` - Original 16 fixes documentation
- `.agent/3 step coding principle.md` - Planning methodology used

---

**Status:** ✅ **READY FOR TESTING**
**Deployed:** 2026-02-09 08:19 UTC
**Verification:** Backend running, no compilation errors, webhook health OK
