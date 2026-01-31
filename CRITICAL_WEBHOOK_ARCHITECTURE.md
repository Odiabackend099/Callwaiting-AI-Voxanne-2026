# 🚨 CRITICAL: Webhook Architecture - SOURCE OF TRUTH

**Last Updated:** 2026-01-31
**Status:** ✅ PRODUCTION VERIFIED (Live Fire Test Passed)
**Author:** System Verification

---

## ⚠️ READ THIS FIRST

There are **TWO webhook endpoints** in the codebase, but only **ONE receives Vapi webhooks**:

| Endpoint | File | Receives Vapi Webhooks? | Purpose |
|----------|------|-------------------------|---------|
| `/api/vapi/webhook` | `backend/src/routes/vapi-webhook.ts` | **✅ YES (PRIMARY)** | Handles end-of-call, tool calls, RAG requests |
| `/api/webhooks/vapi` | `backend/src/routes/webhooks.ts` | ❌ NO (UNUSED) | Legacy/alternative endpoint |

**Why this matters:**
- Vapi assistant's `serverUrl` is hardcoded to `/api/vapi/webhook` in `founder-console-v2.ts:645`
- ALL production webhooks go to `vapi-webhook.ts`
- Modifying `webhooks.ts` will NOT affect production behavior
- **DO NOT confuse the two files** - they have similar names but different purposes

---

## ✅ Verified Architecture (2026-01-31)

### Webhook Flow (Production)

```
┌────────────────────────────────────────────────────────────┐
│ Vapi Sends Webhook (end-of-call-report)                    │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ POST /api/vapi/webhook                                      │
│ File: backend/src/routes/vapi-webhook.ts                   │
│ Lines: 211-293 (end-of-call handler)                       │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ [1] Resolve org_id from assistantId                        │
│     - Query agents table for org_id                        │
│     - Exit early if org_id not found                       │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ [2] Upsert call_logs entry                                 │
│     - vapi_call_id (primary key for upsert)                │
│     - call_sid (placeholder: "vapi-{call_id}")             │
│     - org_id (multi-tenant isolation)                      │
│     - from_number (correct column name!)                   │
│     - outcome_summary (from analysis.summary)              │
│     - recording_url (from artifact.recordingUrl)           │
│     - total_cost (correct column name!)                    │
│     - sentiment (correct column name!)                     │
│     - metadata (JSON: source, endedReason, etc.)           │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ [3] Broadcast WebSocket event to dashboard                 │
│     - wsBroadcast(orgId, { type: 'call_ended' })           │
└──────────────────────┬─────────────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────────────┐
│ [4] Run analytics (fire-and-forget)                        │
│     - AnalyticsService.processEndOfCall(message)           │
└────────────────────────────────────────────────────────────┘
```

---

## 🔴 CRITICAL: Database Column Mappings

The `call_logs` table uses **different column names** than you might expect. Use these mappings:

| Vapi Webhook Data | ❌ WRONG Column | ✅ CORRECT Column | Notes |
|-------------------|----------------|------------------|-------|
| `call.customer.number` | `phone_number` | `from_number` | Twilio convention |
| `call.customer.name` | `caller_name` | ❌ DOESN'T EXIST | Don't include this field |
| `message.cost` | `cost` | `total_cost` | Database schema |
| `analysis.sentiment` | `sentiment_label` | `sentiment` | Simplified name |
| `message.durationSeconds` | `call.duration` | `message.durationSeconds` | Use message-level field |
| `artifact.recordingUrl` | `artifact.recording` | `artifact.recordingUrl` | Full property path |
| ANY Vapi call | (omitted) | `call_sid` | **REQUIRED** - use `"vapi-{call_id}"` as placeholder |

**🚨 BREAKING ERROR:** Omitting `call_sid` will cause:
```
null value in column "call_sid" of relation "call_logs" violates not-null constraint
```

---

## 📋 Correct Upsert Code (Verified Working)

```typescript
// backend/src/routes/vapi-webhook.ts (lines 244-268)
const { error: upsertError } = await supabase
  .from('call_logs')
  .upsert({
    vapi_call_id: call?.id,
    call_sid: `vapi-${call?.id}`,  // ← REQUIRED placeholder
    org_id: orgId,
    from_number: call?.customer?.number || null,  // ← Correct column
    duration_seconds: Math.round(message.durationSeconds || 0),  // ← Use message.durationSeconds
    status: 'completed',
    outcome: 'completed',
    outcome_summary: analysis?.summary || null,  // ← From analysis object
    transcript: artifact?.transcript || null,
    recording_url: typeof artifact?.recordingUrl === 'string'  // ← Correct path
      ? artifact.recordingUrl
      : null,
    call_type: 'inbound',
    total_cost: message.cost || 0,  // ← Correct column
    started_at: message.startedAt || new Date().toISOString(),
    ended_at: message.endedAt || new Date().toISOString(),
    sentiment: analysis?.sentiment || null,  // ← Correct column
    metadata: {
      source: 'vapi-webhook-handler',
      endedReason: message.endedReason,
      successEvaluation: analysis?.successEvaluation
    }
  }, { onConflict: 'vapi_call_id' });  // ← Idempotent upsert
```

---

## 🧪 Verification (Proven Working)

**Test Date:** 2026-01-31 04:25:41 UTC
**Test Call ID:** `019c1238-85f2-7887-a7ab-fbca50b1b79e`
**Result:** ✅ SUCCESS

**Logs:**
```
[2026-01-31T04:25:40.933Z] [INFO] [Vapi-Webhook] Looking up agent
  {"assistantId":"24058b42-9498-4516-b8b0-d95f2fc65e93"}

[2026-01-31T04:25:41.651Z] [INFO] [Vapi-Webhook] Agent lookup result
  {"foundAgent":true,"orgId":"46cf2995-2bee-44e3-838b-24151486fe4e"}

[2026-01-31T04:25:41.874Z] [INFO] [Vapi-Webhook] ✅ Call logged to call_logs
  {"callId":"019c1238-85f2-7887-a7ab-fbca50b1b79e",
   "orgId":"46cf2995-2bee-44e3-838b-24151486fe4e"}
```

**Database Verification:**
```sql
SELECT vapi_call_id, call_sid, org_id, from_number, outcome_summary, recording_url
FROM call_logs
WHERE vapi_call_id = '019c1238-85f2-7887-a7ab-fbca50b1b79e';

-- Result:
-- vapi_call_id: 019c1238-85f2-7887-a7ab-fbca50b1b79e
-- call_sid: vapi-019c1238-85f2-7887-a7ab-fbca50b1b79e
-- org_id: 46cf2995-2bee-44e3-838b-24151486fe4e
-- from_number: +2348141995397
-- outcome_summary: The user called Serenity MedSpa intending to rebook...
-- recording_url: https://storage.vapi.ai/019c1238-85f2-7887-a7ab-fbca50b1b79e-...
```

✅ **ALL FIELDS POPULATED CORRECTLY**

---

## ⚠️ Common Mistakes to Avoid

### ❌ WRONG: Modifying webhooks.ts thinking it will affect production

```typescript
// This file is NOT used by Vapi!
// File: backend/src/routes/webhooks.ts
app.post('/api/webhooks/vapi', async (req, res) => {
  // This handler is NEVER called by production Vapi webhooks
  // serverUrl points to /api/vapi/webhook instead
});
```

**Why this is wrong:** The Vapi assistant's `serverUrl` is set to `/api/vapi/webhook` in `founder-console-v2.ts:645`. Vapi sends webhooks to that URL, not `/api/webhooks/vapi`.

### ❌ WRONG: Using incorrect column names

```typescript
// This will FAIL with "column not found" error
await supabase.from('call_logs').insert({
  phone_number: call.customer.number,  // ❌ Column doesn't exist
  caller_name: call.customer.name,      // ❌ Column doesn't exist
  cost: call.cost,                      // ❌ Column is called total_cost
  sentiment_label: analysis.sentiment   // ❌ Column is called sentiment
});
```

### ❌ WRONG: Omitting call_sid field

```typescript
// This will FAIL with NOT NULL constraint violation
await supabase.from('call_logs').insert({
  vapi_call_id: call.id,
  org_id: orgId,
  // Missing call_sid! ← This causes error
  from_number: call.customer.number
});
```

### ✅ CORRECT: Using vapi-webhook.ts with correct columns

```typescript
// File: backend/src/routes/vapi-webhook.ts
await supabase.from('call_logs').upsert({
  vapi_call_id: call.id,
  call_sid: `vapi-${call.id}`,         // ✅ Placeholder format
  org_id: orgId,
  from_number: call.customer.number,    // ✅ Correct column
  total_cost: message.cost,             // ✅ Correct column
  sentiment: analysis.sentiment         // ✅ Correct column
}, { onConflict: 'vapi_call_id' });
```

---

## 🔧 How to Verify Your Changes

After modifying vapi-webhook.ts, run this verification:

```bash
# 1. Restart backend
cd backend
lsof -ti:3001 | xargs kill -9 2>/dev/null
npm run dev &

# 2. Wait for startup
sleep 5

# 3. Replay captured webhook
curl -X POST http://localhost:3001/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d @/tmp/test-webhook.json

# 4. Check logs for success
grep "✅ Call logged to call_logs" /tmp/backend.log

# 5. Verify database entry
npx tsx scripts/verify-call-logged.ts
```

**Expected Output:**
```
✅✅✅ CALL SUCCESSFULLY LOGGED! ✅✅✅

Call Details:
  vapi_call_id: 019c1238-85f2-7887-a7ab-fbca50b1b79e
  call_sid: vapi-019c1238-85f2-7887-a7ab-fbca50b1b79e
  org_id: 46cf2995-2bee-44e3-838b-24151486fe4e
  from_number: +2348141995397
  ... (all fields populated)
```

---

## 📚 Related Files

### Primary Files (Actually Used in Production)
- ✅ `backend/src/routes/vapi-webhook.ts` - Primary webhook handler
- ✅ `backend/src/routes/founder-console-v2.ts:645` - Sets serverUrl to `/api/vapi/webhook`
- ✅ `backend/scripts/verify-call-logged.ts` - Verification script

### Secondary Files (Not Used by Vapi)
- ⚠️ `backend/src/routes/webhooks.ts` - Alternative endpoint (NOT used by Vapi)
- ⚠️ `backend/docs/WEBHOOK_HANDLER_GUIDE.md` - **OUTDATED** (documents wrong file!)

---

## 🚀 Deployment Checklist

Before deploying webhook changes:

- [ ] Modified `vapi-webhook.ts` (NOT webhooks.ts)
- [ ] Used correct column names (from_number, total_cost, sentiment)
- [ ] Included `call_sid` placeholder field
- [ ] Tested with replayed webhook (`/tmp/test-webhook.json`)
- [ ] Verified database entry created successfully
- [ ] Checked logs for "✅ Call logged to call_logs"
- [ ] Confirmed NO errors in backend logs
- [ ] Backend restart completed successfully

---

## 📞 Support & Questions

If calls are not appearing on the dashboard after webhook arrives:

1. **Check backend logs for errors:**
   ```bash
   grep -E "Cannot resolve org_id|Failed to upsert" /tmp/backend.log | tail -20
   ```

2. **Verify agent exists in database:**
   ```bash
   npx tsx scripts/check-agent-lookup.ts
   ```

3. **Check for database constraint violations:**
   ```bash
   grep "violates not-null constraint" /tmp/backend.log
   ```

4. **Verify call_logs table schema:**
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'call_logs'
   ORDER BY ordinal_position;
   ```

---

## 🎓 Key Takeaways

1. **One Source of Truth:** `/api/vapi/webhook` → `vapi-webhook.ts`
2. **Column Names Matter:** Use `from_number`, `total_cost`, `sentiment` (not `phone_number`, `cost`, `sentiment_label`)
3. **call_sid is Required:** Use `"vapi-{call_id}"` as placeholder for Vapi calls
4. **Test Before Deploy:** Always replay captured webhook to verify changes work
5. **Check Logs:** Backend logs show exactly what went wrong

---

**This document is the single source of truth for webhook architecture. Do not modify production code without consulting this document first.**
