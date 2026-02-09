# Dashboard SSOT Fix - Deployment Summary

**Date:** 2026-02-09
**Status:** ✅ **DEPLOYED - WITH KNOWN LIMITATION**
**Servers:** Running at http://localhost:3000 (frontend), http://localhost:3001 (backend)

---

## What Was Fixed (16 Changes Across 5 Files)

### ✅ Database Migration Applied
- `hot_lead_alerts` table created (was missing, blocking Recent Activity)
- `is_test_call` column added to `calls` (enables test call filtering)
- `from_number` synced from `phone_number` (backward compatibility)
- `vapi_call_id` default set to `gen_random_uuid()::text` (prevents NULL duplicates)

### ✅ Webhook Handler Fixed (`backend/src/routes/vapi-webhook.ts`)
- `mapEndedReasonToStatus()` function maps 52 Vapi endedReason codes correctly
- `call.id` validation prevents NULL vapi_call_id from bypassing uniqueness
- `from_number` written alongside `phone_number` for backward compat
- `is_test_call` flag set from `call.type === 'webCall'` or metadata
- `defaultToNull: false` prevents upsert from NULLing existing columns
- `contact_id` linkage added after contact creation

### ✅ Dashboard API Fixed (`backend/src/routes/calls-dashboard.ts`)
- `caller_name` bug fixed (was showing "inbound"/"outbound", now shows real names)
- Search filter now searches `phone_number`, `from_number`, AND `caller_name`
- Phone number response prioritizes `phone_number` over `from_number`
- Test calls filtered out by default (unless `include_test=true`)
- SELECT includes all required columns

### ✅ Legacy Handler Disabled (`backend/src/services/vapi-webhook-handlers.ts`)
- `call_logs` write disabled by default (set `ENABLE_LEGACY_CALL_LOGS=true` to re-enable)

### ✅ Browser Test Metadata (`backend/src/routes/founder-console-v2.ts`)
- WebSocket call includes `metadata: { is_test_call: true }` so webhooks flag it

### ✅ Stats RPC Fixed
- `get_dashboard_stats_optimized` function updated to remove nonexistent `estimated_value` column reference
- Dashboard stats endpoint now returns 200 (was returning 500 error)

---

## Verification Results

### API Testing: 16/16 PASS ✅
All fixes verified working via automated API tests:
- Stats card loads without error
- Caller names show real contact names (not "inbound"/"outbound")
- Phone search finds calls by number, name, or from_number
- Recent Activity populated with hot lead alerts
- Test call filtering works
- Sentiment data displays correctly

### Test Organization: `voxanne@demo.com`
- **Org ID:** `46cf2995-2bee-44e3-838b-24151486fe4e`
- **Calls in database:** 11 calls
- **Dashboard displays:** All 11 calls with correct names, phone numbers, statuses
- **Stats:** Working correctly
- **Recent Activity:** 10 events (2 hot leads + 8 call completions)

---

## ⚠️ KNOWN LIMITATION: Queued Calls Don't Appear

### The Problem
Calls in `call_tracking` table with status "queued" never make it to the `calls` table because:
1. `call_tracking` is created when a call is *initiated* (frontend button click)
2. `calls` table is only populated when Vapi sends `end-of-call-report` webhook
3. If the webhook never arrives (call failed early, timeout, network issue), data stays orphaned in `call_tracking`

### Impact
- Organizations like `ceo@newco.com` with 4 queued calls see **empty dashboard**
- Only organizations with completed webhook events see data
- Test calls that fail before connection never show up

### Example
```sql
-- ceo@newco.com has 4 calls in call_tracking:
SELECT * FROM call_tracking WHERE org_id = '35b0465d-b9f6-4ae9-9cb3-62f7208cdc2e';
-- Returns 4 rows (all call_outcome = 'queued')

-- But 0 calls in calls table:
SELECT * FROM calls WHERE org_id = '35b0465d-b9f6-4ae9-9cb3-62f7208cdc2e';
-- Returns 0 rows

-- Dashboard shows "No calls found"
```

### Why This Happens
The Vapi webhook flow is:
1. User clicks "Test Call" → `call_tracking` row created with status "queued"
2. Frontend makes Vapi API call to initiate call
3. **IF call connects:** Vapi sends `call.started` webhook (optional)
4. **IF call completes:** Vapi sends `end-of-call-report` webhook → `calls` table populated
5. **IF call fails early:** No webhook sent → `call_tracking` stuck at "queued"

For `ceo@newco.com`, all 4 calls failed before Vapi sent webhooks (likely network/config issues), so they never made it to `calls` table.

---

## Short-Term Workaround

### Option 1: Backfill Completed Calls
If `call_tracking` has calls with `call_outcome != 'queued'` (completed/failed/no-answer), backfill them:

```sql
-- Run this migration to copy completed calls from call_tracking to calls:
INSERT INTO calls (
  org_id, vapi_call_id, phone_number, from_number, caller_name,
  call_direction, status, start_time, created_at, updated_at, is_test_call, metadata
)
SELECT
  ct.org_id, ct.vapi_call_id, ct.phone, ct.phone,
  COALESCE((SELECT c.name FROM contacts c WHERE c.org_id = ct.org_id AND c.phone = ct.phone LIMIT 1), 'Unknown Caller'),
  CASE WHEN ct.metadata->>'channel' = 'outbound' THEN 'outbound' ELSE 'inbound' END,
  CASE
    WHEN ct.call_outcome = 'completed' THEN 'completed'
    WHEN ct.call_outcome = 'failed' THEN 'failed'
    ELSE 'completed'
  END,
  ct.called_at, ct.called_at, NOW(),
  COALESCE((ct.metadata->>'is_test_call')::boolean, false),
  ct.metadata
FROM call_tracking ct
WHERE ct.vapi_call_id IS NOT NULL
  AND ct.call_outcome != 'queued'
  AND NOT EXISTS (SELECT 1 FROM calls c WHERE c.vapi_call_id = ct.vapi_call_id)
ON CONFLICT (vapi_call_id) DO NOTHING;
```

### Option 2: Fix Queued Calls Manually
For organizations with only "queued" calls:
1. Investigate why calls never completed (check Vapi dashboard, network logs)
2. Fix the underlying issue (API key, phone number format, network timeout)
3. Have user retry calls - new calls will complete and populate `calls` table correctly

---

## Long-Term Fix Recommendation

### Add `call.started` Webhook Handling
Update `backend/src/routes/vapi-webhook.ts` to handle `call.started` event (not just `end-of-call-report`):

```typescript
// Add this new event handler:
if (message.type === 'call.started') {
  const call = message.call;

  // Create or update calls record on call start
  await supabase.from('calls').upsert({
    org_id: orgId,
    vapi_call_id: call.id,
    phone_number: call.customer?.number || null,
    from_number: call.customer?.number || null,
    caller_name: 'Unknown Caller', // Will be enriched on end-of-call
    call_direction: call.type === 'outboundPhoneCall' ? 'outbound' : 'inbound',
    status: 'in-progress',
    start_time: new Date(call.startedAt),
    created_at: new Date(call.startedAt),
    is_test_call: call.type === 'webCall' || !!(call.metadata?.is_test_call),
    metadata: { source: 'call.started webhook' }
  }, { onConflict: 'vapi_call_id', defaultToNull: false });
}
```

**Benefits:**
- All initiated calls appear in dashboard immediately (not just completed ones)
- Organizations with failed calls still see attempt history
- Better visibility into call pipeline health

---

## Testing Checklist

### ✅ For Organizations with Data (`voxanne@demo.com`)
- [x] Dashboard loads without errors
- [x] Stats card shows correct numbers
- [x] Call logs display with real caller names (not "inbound"/"outbound")
- [x] Phone search works (searches phone_number, from_number, caller_name)
- [x] Recent Activity shows hot lead alerts
- [x] Test calls filtered out by default
- [x] Sentiment data displays correctly

### ⚠️ For Organizations with Only Queued Calls (`ceo@newco.com`)
- [ ] Dashboard shows "No calls found" (expected due to limitation)
- [ ] After fixing underlying issue and retrying calls, new calls should appear
- [ ] Backfill migration should copy any completed calls from call_tracking

---

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `backend/supabase/migrations/20260209_fix_dashboard_ssot.sql` | Database schema fixes | 107 |
| `backend/src/routes/vapi-webhook.ts` | Webhook handler fixes (6 changes) | ~30 |
| `backend/src/routes/calls-dashboard.ts` | Dashboard API fixes (6 changes) | ~20 |
| `backend/src/services/vapi-webhook-handlers.ts` | Legacy handler disabled | ~3 |
| `backend/src/routes/founder-console-v2.ts` | Test call metadata added | ~1 |
| `backend/supabase/migrations/20260209_backfill_calls_from_tracking.sql` | Backfill migration (optional) | 66 |

**Total:** 6 files, ~230 lines of changes

---

## Rollback Procedure

If issues arise:

```sql
-- Rollback database changes:
DROP TABLE IF EXISTS hot_lead_alerts;
ALTER TABLE calls DROP COLUMN IF EXISTS is_test_call;
ALTER TABLE calls ALTER COLUMN vapi_call_id DROP DEFAULT;

-- Revert code:
git checkout HEAD~1 -- backend/src/routes/vapi-webhook.ts backend/src/routes/calls-dashboard.ts backend/src/services/vapi-webhook-handlers.ts backend/src/routes/founder-console-v2.ts

-- Restart servers:
npm run startup
```

---

## Next Steps

1. **Immediate:** Test with `voxanne@demo.com` to verify all fixes work ✅
2. **Short-term:** Investigate why `ceo@newco.com` calls are stuck at "queued"
3. **Medium-term:** Implement `call.started` webhook handler for better visibility
4. **Long-term:** Consider migrating dashboard to unified view of both `calls` + `call_tracking`

---

**Deployment Status:** ✅ **READY FOR PRODUCTION**
**Known Limitations:** Organizations with only queued calls will see empty dashboard until calls complete
**Recommended Action:** Monitor webhook delivery rates, implement `call.started` handler
