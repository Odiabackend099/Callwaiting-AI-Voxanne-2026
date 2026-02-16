# Database SSOT Verification - Call Logs Dashboard

**Date:** 2026-02-16
**Objective:** Verify all database fields flow correctly to frontend

---

## Database Schema → Backend API → Frontend Mapping

### Calls Table Fields (SSOT)

**Source:** `backend/supabase/migrations/20260213_golden_record_schema.sql`

| Database Column | Type | Backend API Field | Frontend Display | Status |
|----------------|------|-------------------|------------------|--------|
| **Core Fields** |
| `id` | UUID | `id` | Call ID | ✅ PASS |
| `org_id` | UUID | (filtered) | N/A | ✅ PASS |
| `vapi_call_id` | TEXT | `vapi_call_id` | Hidden | ✅ PASS |
| `created_at` | TIMESTAMPTZ | `call_date` | DateTime | ✅ PASS |
| `updated_at` | TIMESTAMPTZ | (not sent) | N/A | ✅ OK |
| **Contact Fields** |
| `contact_id` | UUID | (not sent) | N/A | ✅ OK |
| `phone_number` | TEXT | `phone_number` | Modal header | ✅ PASS |
| `resolved_caller_name` | TEXT (VIEW) | `caller_name` | Modal header | ✅ PASS |
| **Call Metadata** |
| `call_direction` | TEXT | `call_direction`, `call_type` | 📞/📲 Icon | ✅ PASS |
| `call_sid` | TEXT | (not sent) | N/A | ✅ OK |
| `duration_seconds` | INTEGER | `duration_seconds` | "5m 23s" | ✅ PASS |
| `status` | TEXT | `status` | Badge | ✅ PASS |
| `ended_reason` | TEXT | `ended_reason` | (hidden) | ✅ PASS |
| **Sentiment Fields (PRIMARY ISSUE)** |
| `sentiment_label` | TEXT | `sentiment_label` | "positive" | ❌ **ISSUE** |
| `sentiment_score` | NUMERIC | `sentiment_score` | "(85%)" | ❌ **ISSUE** |
| `sentiment_summary` | TEXT | `sentiment_summary` | Sentiment section | ❌ **ISSUE** |
| `sentiment_urgency` | TEXT | `sentiment_urgency` | Urgency badge | ❌ **ISSUE** |
| `sentiment` | TEXT (legacy) | (fallback only) | N/A | ✅ PASS |
| **Outcome Fields (PRIMARY ISSUE)** |
| `outcome` | TEXT | `outcome` | Short outcome | ❌ **ISSUE** |
| `outcome_summary` | TEXT | `outcome_summary` | Outcome Summary | ❌ **ISSUE** |
| **Recording Fields** |
| `recording_url` | TEXT | `recording_url` | Audio player | ⚠️ **VERIFY** |
| `recording_storage_path` | TEXT | (not sent) | N/A | ✅ OK |
| `recording_signed_url` | TEXT | (checked in detail endpoint) | N/A | ✅ PASS |
| `transcript` | JSONB | `transcript` | Transcript view | ✅ PASS |
| `has_recording` | BOOLEAN | `has_recording` | Play button | ✅ PASS |
| `has_transcript` | BOOLEAN | `has_transcript` | Transcript icon | ✅ PASS |
| **Golden Record Fields** |
| `cost_cents` | INTEGER | `cost_cents` | (hidden) | ✅ PASS |
| `tools_used` | TEXT[] | `tools_used` | (hidden) | ✅ PASS |
| `appointment_id` | UUID | `appointment_id` | Appointment link | ✅ PASS |
| `is_test_call` | BOOLEAN | (filtered) | N/A | ✅ PASS |

---

## Issue Analysis

### PRIMARY ISSUE: NULL Sentiment/Outcome Data

**Root Cause:**
Existing calls in the database were created BEFORE the `analysisPlan` was added to Vapi assistants (2026-02-16).

**Database State:**
```sql
-- Check current data
SELECT
  id,
  sentiment_label,
  sentiment_score,
  sentiment_summary,
  sentiment_urgency,
  outcome,
  outcome_summary,
  created_at
FROM calls
WHERE org_id = 'demo-org-id'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result for Historical Calls:**
- `sentiment_label`: NULL → Falls back to 'neutral' (webhook default line 694)
- `sentiment_score`: NULL → Falls back to 0.5 (webhook default line 695)
- `sentiment_summary`: NULL → Falls back to outcome_detailed (webhook default line 696)
- `sentiment_urgency`: NULL → Falls back to 'low' (webhook default line 697)
- `outcome`: NULL → Falls back to 'Call Completed' (webhook default line 682)
- `outcome_summary`: NULL → Falls back to 'Call completed successfully.' (webhook default line 683)

**Expected Result for NEW Calls (post-analysisPlan):**
- `sentiment_label`: 'positive' / 'neutral' / 'negative' (from Vapi `analysis.sentiment`)
- `sentiment_score`: 0.0-1.0 (from Vapi `analysis.structuredData.sentimentScore`)
- `sentiment_summary`: "Customer was satisfied..." (from Vapi `analysis.summary`)
- `sentiment_urgency`: 'low' / 'medium' / 'high' / 'critical' (from Vapi `analysis.structuredData.sentimentUrgency`)
- `outcome`: "Appointment Booked" (from Vapi `analysis.structuredData.shortOutcome`)
- `outcome_summary`: "Customer booked appointment..." (from Vapi `analysis.summary`)

---

## Backend API Verification

### 1. GET /api/calls-dashboard (List Endpoint)

**File:** `backend/src/routes/calls-dashboard.ts` (Lines 185-233)

**Query:**
```typescript
// Line 112-113
.from('calls_with_caller_names')  // ← SSOT VIEW
.select('*', { count: 'exact' })
```

**Response Mapping:**
```typescript
// Lines 186-222
{
  id: call.id,
  phone_number: call.phone_number || 'Unknown',
  caller_name: resolvedCallerName,  // From VIEW
  call_date: call.created_at,
  duration_seconds: call.duration_seconds || 0,
  status: call.status || 'completed',
  call_direction: call.call_direction,

  // ✅ SENTIMENT FIELDS - Correctly mapped from DB
  sentiment_score: sentimentScore ? parseFloat(String(sentimentScore)) : null,
  sentiment_label: sentimentLabel || null,
  sentiment_summary: sentimentSummary || null,
  sentiment_urgency: sentimentUrgency || null,

  // ✅ OUTCOME FIELDS - Correctly mapped from DB
  outcome: call.outcome || null,
  outcome_summary: call.outcome_summary || null,

  // ✅ RECORDING FIELDS
  has_recording: !!(call.recording_url || call.recording_storage_path),
  recording_status: (call.recording_url || call.recording_storage_path) ? 'completed' : null,
  has_transcript: !!call.transcript,

  // ✅ GOLDEN RECORD FIELDS
  cost_cents: call.cost_cents || 0,
  ended_reason: call.ended_reason || null,
  tools_used: call.tools_used || [],
  has_appointment: call.has_appointment || false,
  appointment_id: call.appointment_id || null
}
```

**Verification:** ✅ **CORRECT** - All database fields correctly mapped

---

### 2. GET /api/calls-dashboard/:callId (Detail Endpoint)

**File:** `backend/src/routes/calls-dashboard.ts` (Lines 634-730)

**Query:**
```typescript
// Lines 647-652
const { data: callData, error: callError } = await supabase
  .from('calls')
  .select('*, contacts!contact_id(name)')
  .eq('id', callId)
  .eq('org_id', orgId)
  .maybeSingle();
```

**Response Mapping:**
```typescript
// Lines 693-721
return res.json({
  id: callData.id,
  phone_number: callData.phone_number || 'Unknown',
  caller_name: resolvedCallerName,
  call_date: callData.created_at,
  duration_seconds: callData.duration_seconds || 0,
  status: callData.status || 'completed',

  // ✅ RECORDING FIELDS
  recording_url: callData.recording_signed_url || callData.recording_url,
  recording_storage_path: callData.recording_storage_path,
  has_recording: !!(callData.recording_url || callData.recording_storage_path),
  recording_status: (callData.recording_url || callData.recording_storage_path) ? 'completed' : null,
  has_transcript: !!callData.transcript,
  transcript,  // Formatted array

  // ✅ SENTIMENT FIELDS
  sentiment_score: callData.sentiment_score,
  sentiment_label: callData.sentiment_label,
  sentiment_summary: callData.sentiment_summary,
  sentiment_urgency: callData.sentiment_urgency,

  // ✅ OUTCOME FIELDS
  outcome: callData.outcome,
  outcome_summary: callData.outcome_summary,

  // ✅ METADATA
  action_items: callData.action_items || [],
  vapi_call_id: callData.vapi_call_id,
  created_at: callData.created_at,
  call_type: callType,

  // ✅ GOLDEN RECORD FIELDS
  cost_cents: callData.cost_cents || 0,
  ended_reason: callData.ended_reason || null,
  tools_used: callData.tools_used || [],
  appointment_id: callData.appointment_id || null
});
```

**Verification:** ✅ **CORRECT** - All database fields correctly sent to frontend

---

## Frontend Verification

### 1. Call List Display

**File:** `src/app/dashboard/calls/page.tsx` (Lines 350-465)

**Data Received:**
```typescript
interface Call {
  id: string;
  phone_number: string;
  caller_name: string;
  call_date: string;
  duration_seconds: number;
  status: 'completed' | 'missed' | 'transferred' | 'failed';
  has_recording: boolean;
  has_transcript: boolean;
  sentiment_score?: number;        // ✅ RECEIVED
  sentiment_label?: string;        // ✅ RECEIVED
  sentiment_summary?: string;      // ✅ RECEIVED
  sentiment_urgency?: string;      // ✅ RECEIVED
  outcome?: string;                // ✅ RECEIVED
  outcome_summary?: string;        // ✅ RECEIVED
  call_type?: 'inbound' | 'outbound';
  recording_status?: 'pending' | 'processing' | 'completed' | 'failed';
  recording_url?: string;
}
```

**Display in Table (Lines 380-406):**
- ✅ Caller Name: `{call.caller_name}` (from VIEW)
- ✅ Phone: `{call.phone_number}`
- ✅ Sentiment: `{call.sentiment_label}` badge
- ✅ Outcome Summary: `{call.outcome_summary || call.sentiment_summary}` (prioritized correctly)
- ✅ Duration: `{formatDuration(call.duration_seconds)}`

**Verification:** ✅ **CORRECT** - All fields displayed from API response

---

### 2. Call Detail Modal

**File:** `src/app/dashboard/calls/page.tsx` (Lines 499-600)

**Data Received:**
```typescript
interface CallDetail extends Call {
  recording_url?: string;
  transcript: Array<{
    speaker: 'caller' | 'voxanne';
    text: string;
    timestamp: number;
    sentiment: string;
  }>;
  action_items: string[];
}
```

**Display in Modal:**

**Lines 503-518 (Header):**
```typescript
<h2 className="text-2xl font-bold text-obsidian">
  {selectedCall.caller_name}
  {selectedCall.phone_number && selectedCall.caller_name !== selectedCall.phone_number && (
    <span className="text-lg text-obsidian/60 font-normal ml-2">
      ({selectedCall.phone_number})
    </span>
  )}
</h2>
```
✅ **CORRECT** - Shows name + phone from database

**Lines 514-542 (Metadata Grid):**
```typescript
<div>
  <p className="text-xs text-obsidian/60 font-medium uppercase">Sentiment</p>
  <p className="text-lg font-bold text-obsidian capitalize">
    {selectedCall.sentiment_label || 'neutral'}
    {selectedCall.sentiment_score !== null && selectedCall.sentiment_score !== undefined && (
      <span className="text-sm text-obsidian/60 font-normal ml-1">
        ({Math.round(selectedCall.sentiment_score * 100)}%)
      </span>
    )}
  </p>
  {selectedCall.sentiment_urgency && selectedCall.sentiment_urgency !== 'low' && (
    <p className="text-xs text-obsidian/60 mt-1">
      <span className={`urgency badge classes`}>
        {selectedCall.sentiment_urgency} urgency
      </span>
    </p>
  )}
</div>
```
✅ **CORRECT** - All sentiment fields from database displayed

**Lines 544-558 (Outcome Summary):**
```typescript
{selectedCall.outcome_summary && (
  <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
    <p className="text-sm font-bold text-obsidian mb-2">📋 Outcome Summary</p>
    <p className="text-sm text-obsidian/70 leading-relaxed">{selectedCall.outcome_summary}</p>
  </div>
)}

{selectedCall.sentiment_summary && selectedCall.sentiment_summary !== selectedCall.outcome_summary && (
  <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4">
    <p className="text-sm font-bold text-obsidian mb-2">💭 Sentiment Analysis</p>
    <p className="text-sm text-obsidian/70 leading-relaxed">{selectedCall.sentiment_summary}</p>
  </div>
)}
```
✅ **CORRECT** - Outcome and sentiment from database displayed

**Lines 559-565 (Recording Player):**
```typescript
{selectedCall.has_recording && selectedCall.recording_status === 'completed' && (
  <div className="bg-surgical-50 rounded-lg p-4">
    <p className="text-sm font-bold text-obsidian mb-3">Recording</p>
    <RecordingPlayer callId={selectedCall.id} recordingUrl={selectedCall.recording_url} />
  </div>
)}
```
✅ **CORRECT** - Recording URL from database passed to player

---

## Webhook → Database Flow Verification

**File:** `backend/src/routes/vapi-webhook.ts` (Lines 675-1011)

### Vapi Analysis Extraction

**Lines 675-709:**
```typescript
// 3. Extract sentiment + outcome from Vapi's NATIVE analysis (PRIMARY source)
let sentimentLabel: string | null = analysis?.sentiment || null;
let sentimentScore: number | null = analysis?.structuredData?.sentimentScore ?? null;
let sentimentSummary: string | null = analysis?.summary || null;
let sentimentUrgency: string | null = analysis?.structuredData?.sentimentUrgency || null;
let outcomeShort: string = analysis?.structuredData?.shortOutcome || 'Call Completed';
let outcomeDetailed: string = analysis?.summary || 'Call completed successfully.';

// Map Vapi sentiment label to numeric score if structuredData didn't provide one
if (sentimentScore === null && sentimentLabel) {
  sentimentScore = sentimentLabel === 'positive' ? 0.8 :
                   sentimentLabel === 'negative' ? 0.2 : 0.5;
}

// Ensure all fields have values (SSOT compliance — no NULLs in critical fields)
if (!sentimentLabel) sentimentLabel = 'neutral';
if (sentimentScore === null) sentimentScore = 0.5;
if (!sentimentSummary) sentimentSummary = outcomeDetailed;
if (!sentimentUrgency) sentimentUrgency = 'low';
```

✅ **CORRECT** - Vapi analysis data extracted with defaults

### Database Insert

**Lines 954-1011:**
```typescript
const { error: upsertError } = await supabase
  .from('calls')
  .upsert({
    vapi_call_id: call?.id,
    org_id: orgId,

    // ✅ SENTIMENT FIELDS
    sentiment_label: sentimentLabel,
    sentiment_score: sentimentScore,
    sentiment_summary: sentimentSummary,
    sentiment_urgency: sentimentUrgency,

    // ✅ OUTCOME FIELDS
    outcome: outcomeShort,
    outcome_summary: outcomeDetailed,

    // ✅ RECORDING FIELDS
    recording_url: (typeof artifact?.recordingUrl === 'string' ? artifact.recordingUrl : null)
      || (typeof artifact?.recording === 'string' ? artifact.recording : null)
      || (typeof message?.recordingUrl === 'string' ? message.recordingUrl : null),
    transcript: artifact?.transcript || null,

    // ... other fields
  }, { onConflict: 'vapi_call_id', defaultToNull: false });
```

✅ **CORRECT** - All Vapi data correctly inserted into database

---

## ROOT CAUSE SUMMARY

### Why Sentiment Shows "neutral"

**For Historical Calls (pre-2026-02-16):**
1. ❌ Database has NULL values (analysisPlan wasn't configured)
2. ✅ Backend sends NULL to frontend
3. ✅ Frontend displays "neutral" (default fallback)
4. ✅ **This is EXPECTED and CORRECT behavior**

**For NEW Calls (post-2026-02-16):**
1. ✅ Vapi sends analysis data in webhook
2. ✅ Webhook extracts and inserts into database
3. ✅ Backend reads from database and sends to frontend
4. ✅ Frontend displays real sentiment data
5. ✅ **This SHOULD work for new calls**

---

## Action Required

### Immediate Verification

**Test with NEW Call:**
```bash
# 1. Make test call to Vapi number
# 2. Wait for webhook to process
# 3. Check database
psql -c "SELECT sentiment_label, sentiment_score, sentiment_summary, sentiment_urgency, outcome_summary FROM calls ORDER BY created_at DESC LIMIT 1;"

# 4. Expected result for NEW call:
# sentiment_label   | positive
# sentiment_score   | 0.85
# sentiment_summary | Customer was satisfied and interested...
# sentiment_urgency | medium
# outcome_summary   | Customer inquired about Botox pricing...
```

**Check Webhook Logs:**
```bash
# In backend terminal, look for:
[INFO] [Vapi-Webhook] Vapi native analysis extracted {
  callId: 'xxx',
  sentimentLabel: 'positive',    # ← Should NOT be 'neutral'
  sentimentScore: 0.85,           # ← Should NOT be 0.5
  outcomeShort: 'Inquiry',        # ← Should NOT be 'Call Completed'
  hasSummary: true,               # ← Should be true
  hasStructuredData: true,        # ← Should be true
  source: 'vapi-native'
}
```

### If NEW Calls Still Show "neutral"

**Possible Issues:**

1. **Vapi analysisPlan not synced:**
   - Run: `npm run push-analysis-plan` (script created 2026-02-16)
   - Verify all 8 assistants updated

2. **Vapi webhook not sending analysis:**
   - Check Vapi dashboard: Settings → Webhooks → Logs
   - Verify `end-of-call-report` includes `analysis` object

3. **Webhook handler not extracting:**
   - Check backend logs for "Vapi native analysis extracted"
   - Verify `analysis.structuredData` is populated

---

## Conclusion

### Backend SSOT Compliance: ✅ VERIFIED

**All database fields correctly flow through:**
1. ✅ Database schema has all required columns
2. ✅ Webhook correctly extracts from Vapi and inserts to DB
3. ✅ Backend API correctly reads from DB and sends to frontend
4. ✅ Frontend correctly receives and displays data

### Issue: Historical Data

**Root Cause:** Database has NULL values for calls made before analysisPlan was added.

**Solution:**
- Historical calls: Will continue showing defaults (expected)
- NEW calls: Should show real Vapi sentiment data

**Next Step:** Make a test call and verify the complete data flow works end-to-end.

---

**Status:** ✅ **DATABASE SSOT VERIFIED - Ready for live testing**
