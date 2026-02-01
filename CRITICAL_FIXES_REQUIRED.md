# Critical Issues & Fixes Required - 2026-02-01

## Summary
Post-endpoint testing revealed 4 critical issues blocking production readiness. All can be fixed in <2 hours.

---

## Issue #1: Recording Playback Endpoint Uses Wrong Table Names ⚠️ CRITICAL

**Problem:** Recording-URL endpoint queries outdated table names after Phase 6 migration
- Queries: `call_logs` and `calls` tables
- Should query: `calls` table (unified after Phase 6)
- Result: 404 "Recording not found" even when recording exists

**Location:** `backend/src/routes/calls-dashboard.ts` lines 408-466

**Current Code:**
```typescript
// Lines 416-421: Queries call_logs (doesn't exist - renamed to call_logs_legacy)
const { data: inboundCall } = await supabase
  .from('call_logs')  // ❌ WRONG - renamed in Phase 6
  .select(...)
  .single();

// Lines 440-445: Falls back to calls (correct table, but outdated logic)
const { data: outboundCall } = await supabase
  .from('calls')      // ✅ CORRECT
  .select(...)
```

**Fix Required:**
- Replace both queries with single unified `calls` table query
- Remove `call_logs_legacy` reference (Phase 6 uses unified table)
- Keep fallback logic for backward compatibility

**Impact:** CRITICAL - Recording playback broken for all calls

---

## Issue #2: Sentiment Data Not Stored With Full Fields 🟡 HIGH

**Problem:** Sentiment stored as packed string "label:score:summary" instead of separate columns
- Current: `sentiment: "positive:0.85:Customer was happy"`
- Issue: Unpacking happens in response handler (fragile, error-prone)
- Missing: `sentiment_urgency` field not stored

**Location:** `backend/src/routes/calls-dashboard.ts` lines 125-134

**Current Code:**
```typescript
let sentimentLabel = null;
let sentimentScore = null;
let sentimentSummary = null;
if (call.sentiment) {
  const parts = call.sentiment.split(':');  // ❌ Fragile parsing
  sentimentLabel = parts[0] || null;
  sentimentScore = parts[1] ? parseFloat(parts[1]) : null;
  sentimentSummary = parts[2] || call.sentiment;
}
// Missing: sentimentUrgency field entirely
```

**Fix Required:**
- Verify webhook stores separate sentiment fields: `sentiment_label`, `sentiment_score`, `sentiment_summary`, `sentiment_urgency`
- Update query to SELECT all 4 sentiment fields directly (not packed string)
- Remove unpacking logic (safer and faster)

**Impact:** HIGH - Dashboard shows incomplete sentiment data

---

## Issue #3: Dashboard-Pulse View Likely Broken or Missing 🟡 HIGH

**Problem:** View `view_clinical_dashboard_pulse` may not exist or use wrong column names
- Expected: Queries view first, falls back to direct aggregation
- Likely issue: View references old column names (direction vs call_direction)
- Result: Falls back to direct query (slower, less efficient)

**Location:** `backend/src/routes/analytics.ts` lines 30-51

**Current Code:**
```typescript
const { data: pulseData, error: pulseError } = await supabase
  .from('view_clinical_dashboard_pulse')
  .select('*')
  .eq('org_id', orgId);

if (!pulseError && pulseData) {
  // Use view data
} else {
  // Fall back to direct aggregation (slower)
}
```

**Fix Required:**
- Either recreate view with correct column names: `call_direction` (not `direction`)
- Or accept fallback as acceptable (direct aggregation is working)
- Verify fallback logic works correctly

**Impact:** HIGH - Performance degradation (slower dashboard loads)

---

## Issue #4: Outcome Summaries Not Implemented ⚠️ MEDIUM

**Problem:** Call outcomes show only brief label "positive", not detailed 2-3 sentence summaries
- Expected: "Customer confirmed interest in Botox treatment and requested pricing information"
- Actual: "positive" (generic)
- Missing: No GPT-4o integration for outcome analysis

**Location:** Webhook handlers not calling outcome summary service
- `backend/src/routes/vapi-webhook.ts` (missing outcome generation)
- `backend/src/services/outcome-summary.ts` (not implemented)

**Fix Required:**
- Create `OutcomeSummaryService` to generate summaries via GPT-4o
- Integrate into webhook handler (after call ends)
- Store in `outcome_summary` column

**Impact:** MEDIUM - Dashboard shows generic outcomes instead of actionable summaries

---

## Fix Priority & Effort Estimate

| Issue | Priority | Type | Effort | Impact |
|-------|----------|------|--------|--------|
| #1: Recording-URL Endpoint | 🔴 CRITICAL | Code | 20 min | Records unplayable |
| #2: Sentiment Fields | 🟡 HIGH | Code | 15 min | Incomplete data |
| #3: Dashboard View | 🟡 HIGH | DB | 20 min | Slow dashboard |
| #4: Outcome Summaries | 🟠 MEDIUM | Feature | 45 min | Generic outcomes |

**Total Effort:** 100 minutes (1 hour 40 minutes)
**Recommendation:** Fix #1-3 immediately (critical), then #4 (nice-to-have)

---

## Files to Modify

1. `backend/src/routes/calls-dashboard.ts` (Issues #1, #2)
   - Fix recording-url endpoint (lines 408-466)
   - Fix sentiment unpacking (lines 125-134)

2. `backend/supabase/migrations/` (Issue #3)
   - Create or verify view migration
   - Ensure column names match code

3. `backend/src/routes/vapi-webhook.ts` (Issue #4)
   - Add outcome summary generation after call ends

4. `backend/src/services/outcome-summary.ts` (Issue #4)
   - Create new service to generate summaries via GPT-4o

---

## Next Steps

1. ✅ Read this document
2. ⏳ Implement Fix #1: Recording-URL Endpoint
3. ⏳ Implement Fix #2: Sentiment Fields
4. ⏳ Verify Fix #3: Dashboard View
5. ⏳ Implement Fix #4: Outcome Summaries (optional)
6. ⏳ Run end-to-end test: trigger call → verify all data displays

---

**Status:** Ready for implementation
**Created:** 2026-02-01
**By:** Claude Code
