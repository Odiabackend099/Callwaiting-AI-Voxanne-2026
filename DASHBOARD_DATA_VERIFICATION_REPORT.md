# Dashboard Data Verification Report
**Date:** 2026-02-02
**Verified By:** Automated Script + Manual Inspection
**Database:** Supabase (lbjymlodxprzqgtyqtcq)

---

## Executive Summary

**Total Checks:** 18
**✅ Passed:** 8/18 (44%)
**❌ Failed:** 5/18 (28%)
**⚠️ Warnings:** 5/18 (28%)

**Overall Status:** ⚠️ **PARTIALLY FUNCTIONAL** - Critical data quality issues detected

---

## Critical Issues (5)

### 1. ❌ FAIL: Caller Names - Missing Column
**Issue:** The `calls` table does NOT have a `caller_name` column.

**Current Schema:**
- ✅ `from_number` - Phone number (E.164 format)
- ✅ `intent` - Contains "Unknown Caller" in some records
- ❌ `caller_name` - **DOES NOT EXIST**

**Impact:** Dashboard cannot display enriched caller names. All calls show "Unknown Caller".

**Sample Data:**
```json
{
  "intent": "Unknown Caller",
  "from_number": "+2348141995397"
}
```

**Fix Required:**
1. Add `caller_name` column to `calls` table
2. Implement caller name enrichment service
3. Populate from `contacts.name` where `from_number` matches `contacts.phone`

---

### 2. ❌ FAIL: Sentiment Labels - Missing Column
**Issue:** The `calls` table does NOT have `sentiment_label` or `sentiment_score` columns.

**Current Schema:**
- ✅ `sentiment` - TEXT field (e.g., "positive", "neutral", "negative")
- ❌ `sentiment_label` - **DOES NOT EXIST**
- ❌ `sentiment_score` - **DOES NOT EXIST** (numeric 0.0-1.0)

**Impact:** Dashboard cannot display sentiment analysis or ClinicalPulse metrics.

**Sample Data:**
```json
{
  "sentiment": "positive"  // TEXT, not NUMERIC
}
```

**Current Data Quality:**
- Recent calls: 4 of 5 have `sentiment: null`
- Only 1 call has sentiment: "positive" (from manual test)

**Fix Required:**
1. Add `sentiment_score` column (DECIMAL 0.0-1.0)
2. Add `sentiment_label` column (TEXT: positive/neutral/negative)
3. Parse existing `sentiment` TEXT into numeric scores
4. Implement sentiment analysis pipeline for new calls

---

### 3. ❌ FAIL: Phone Number Enrichment - NULL Values
**Issue:** Recent calls have `from_number: null` and `to_number: null`.

**Current Data:**
- Last 5 calls: 4 have `from_number: null`
- Only 1 call has phone number: `+2348141995397`

**Impact:** Cannot lookup contact names, cannot call back leads.

**Fix Required:**
1. Ensure Vapi webhook sends phone numbers
2. Add validation to reject calls without phone numbers
3. Backfill missing phone numbers from Vapi API

---

### 4. ❌ FAIL: Hot Lead Alerts - Empty Table
**Issue:** The `hot_lead_alerts` table has 0 records.

**Expected Behavior:**
- When `contacts.lead_score >= 60`, create alert
- Recent Activity panel shows hot leads

**Current State:**
- No alerts in last 7 days
- Table schema exists but is empty

**Fix Required:**
1. Implement hot lead detection logic
2. Trigger alerts when lead score crosses threshold
3. Backfill alerts for existing high-scoring contacts

---

### 5. ❌ FAIL: Recording URLs - Missing Data
**Issue:** No recording URLs or storage paths found in recent calls.

**Current Data:**
- All recent calls: `recording_url: null`, `recording_storage_path: null`

**Impact:** Cannot play back call recordings in dashboard.

**Fix Required:**
1. Ensure Vapi sends recording URLs in webhooks
2. Implement recording download service
3. Store recordings in Supabase Storage

---

## Warnings (5)

### 6. ⚠️ WARN: Caller Name Enrichment Rate - 0%
**Details:**
- Total calls (last 7 days): 4
- Calls with enriched names: 0 (0%)
- All calls show: `"intent": "Unknown Caller"`

**Root Cause:** Combination of:
1. Missing `caller_name` column
2. `from_number: null` in recent calls
3. No contact lookup logic

---

### 7. ⚠️ WARN: Sentiment Data - Mostly NULL
**Details:**
- Total calls (last 7 days): 4
- Calls with sentiment: 1 (25%)
- Calls with NULL sentiment: 3 (75%)

**Root Cause:**
- Sentiment analysis not running on recent calls
- Manual test call has sentiment, webhook-received calls do not

---

### 8. ⚠️ WARN: Contact Enrichment - Low Volume
**Details:**
- Total contacts (last 7 days): 2
- Contacts with names: 2 (100% ✅)
- But call volume is 4, so 50% of calls don't have associated contacts

---

### 9. ⚠️ WARN: Call Status - All "queued"
**Details:**
- Recent calls: 3 have `status: "queued"`, 1 has `status: "completed"`
- "queued" should be temporary state

**Possible Cause:**
- Webhook not updating call status to "in_progress" or "completed"
- Status machine not progressing

---

### 10. ⚠️ WARN: Call Outcome - Inconsistent
**Details:**
- Recent calls have outcomes: "Consultation Booked", "Call Completed", "completed", "inquiry"
- Inconsistent capitalization and naming

**Fix Required:** Standardize outcome enum

---

## Passed Checks (8)

### ✅ PASS: Database Connectivity
Successfully connected to Supabase.

### ✅ PASS: Total Call Volume
Total calls in database: **8**

### ✅ PASS: Recent Call Activity
Last call: **2026-02-02T03:10:40.387Z** (0 hours ago)

### ✅ PASS: Contact Names
2/2 contacts (100%) have names:
- "Test Patient"
- "Test Contact"

### ✅ PASS: Phone Number Format (E.164)
All phone numbers that exist are in E.164 format (+15551234567).

### ✅ PASS: Calls Table Structure
Table exists with 21 columns including:
- `id`, `org_id`, `vapi_call_id`
- `from_number`, `to_number`, `call_direction`
- `status`, `sentiment`, `intent`, `outcome`
- `transcript`, `transcript_text`
- `recording_url`, `recording_storage_path`

### ✅ PASS: Contacts Table Structure
Table exists with required columns:
- `id`, `name`, `phone`, `email`
- `lead_status`, `lead_score`

### ✅ PASS: Organizations Count
Total organizations: **5**

---

## Sample Data (5 Most Recent Calls)

### Call 1 (Latest)
```json
{
  "id": "b6a13fa7-4aa2-4dc1-a87b-cbe17468acc9",
  "vapi_call_id": "019c1c54-b903-7998-8816-03bfb3bf61e5",
  "from_number": null,  ❌
  "to_number": null,  ❌
  "call_direction": "inbound",
  "status": "queued",  ⚠️
  "sentiment": null,  ❌
  "intent": "Unknown Caller",  ❌
  "outcome": "Consultation Booked",
  "created_at": "2026-02-02T03:10:40.387+00:00"
}
```

### Call 2
```json
{
  "id": "b3dbf90c-b84e-41a1-b487-564650f1e985",
  "vapi_call_id": "019c1bae-07a7-7009-9add-c16ca27e92da",
  "from_number": null,  ❌
  "to_number": null,  ❌
  "call_direction": "inbound",
  "status": "queued",  ⚠️
  "sentiment": null,  ❌
  "intent": "Unknown Caller",  ❌
  "outcome": "Consultation Booked",
  "created_at": "2026-02-02T00:08:36.007+00:00"
}
```

### Call 3
```json
{
  "id": "d01ac0a4-e0f9-4cac-9774-99261cd0df11",
  "vapi_call_id": "019c1bad-90fb-7bbb-8edb-5897a153bd51",
  "from_number": null,  ❌
  "to_number": null,  ❌
  "call_direction": "inbound",
  "status": "queued",  ⚠️
  "sentiment": null,  ❌
  "intent": "Unknown Caller",  ❌
  "outcome": "Call Completed",
  "created_at": "2026-02-02T00:08:05.627+00:00"
}
```

### Call 4 (Working Example)
```json
{
  "id": "880be5ed-0e39-4e16-92a5-60594078dad9",
  "vapi_call_id": "019c1238-85f2-7887-a7ab-fbca50b1b79e",
  "from_number": "+2348141995397",  ✅
  "to_number": null,
  "call_direction": "inbound",
  "status": "completed",  ✅
  "sentiment": null,  ❌
  "intent": null,
  "outcome": "completed",
  "created_at": "2026-01-31T04:25:42.937518+00:00"
}
```

### Call 5 (Manual Test - Best Example)
```json
{
  "id": "867163b2-4907-4c0d-8546-2fe2b04a6089",
  "vapi_call_id": "test-manual-1769703826.454570",
  "from_number": "+15551234567",  ✅
  "to_number": "+12345678901",  ✅
  "call_direction": "inbound",
  "status": "completed",  ✅
  "sentiment": "positive",  ✅
  "intent": "inquiry",  ✅
  "outcome": "inquiry",  ✅
  "created_at": "2026-01-29T16:23:46.45457+00:00"
}
```

**Key Observation:** Manual test call (Call 5) has all data populated correctly. Recent webhook-received calls (Calls 1-3) have missing data.

---

## Root Cause Analysis

### Why is data missing?

1. **Schema Mismatch:** Dashboard expects columns that don't exist
   - `calls.caller_name` ❌
   - `calls.sentiment_label` ❌
   - `calls.sentiment_score` ❌

2. **Webhook Processing Issues:** Recent calls have NULL fields
   - `from_number` should be populated by Vapi webhook
   - `sentiment` should be analyzed after call ends
   - Status should progress from "queued" → "in_progress" → "completed"

3. **Missing Services:**
   - Caller name enrichment (contact lookup)
   - Sentiment analysis pipeline
   - Hot lead detection
   - Recording download

---

## Recommended Fixes (Priority Order)

### Priority 1: Schema Fixes (1 hour)
```sql
-- Add missing columns to calls table
ALTER TABLE calls ADD COLUMN caller_name TEXT;
ALTER TABLE calls ADD COLUMN sentiment_score DECIMAL(3,2);
ALTER TABLE calls ADD COLUMN sentiment_label TEXT;

-- Create index for performance
CREATE INDEX idx_calls_from_number ON calls(from_number);
CREATE INDEX idx_calls_sentiment_score ON calls(sentiment_score);
```

### Priority 2: Webhook Data Population (2 hours)
**Fix:** Update webhook handler to extract and save:
- `from_number` from Vapi webhook payload
- `to_number` from Vapi webhook payload
- Update status as call progresses

**File:** `backend/src/routes/vapi-webhook.ts`

### Priority 3: Caller Name Enrichment (1 hour)
**Fix:** After call is created, lookup contact by phone:
```typescript
const contact = await supabase
  .from('contacts')
  .select('name')
  .eq('phone', call.from_number)
  .single();

if (contact) {
  await supabase
    .from('calls')
    .update({ caller_name: contact.name })
    .eq('id', call.id);
}
```

### Priority 4: Sentiment Analysis (2 hours)
**Fix:** Implement sentiment scoring:
```typescript
function analyzeSentiment(transcript: string): { score: number, label: string } {
  // Use OpenAI API or sentiment library
  const score = calculateScore(transcript); // 0.0-1.0
  const label = score > 0.6 ? 'positive' : score < 0.4 ? 'negative' : 'neutral';
  return { score, label };
}
```

### Priority 5: Hot Lead Detection (1 hour)
**Fix:** Trigger alert when lead score updated:
```typescript
if (contact.lead_score >= 60) {
  await supabase.from('hot_lead_alerts').insert({
    org_id: contact.org_id,
    contact_id: contact.id,
    lead_score: contact.lead_score,
    alert_type: 'high_score'
  });
}
```

---

## Testing Checklist

After fixes are applied:

- [ ] Schema migration applied successfully
- [ ] New call has `from_number` populated
- [ ] New call has `caller_name` enriched from contacts
- [ ] New call has `sentiment_score` calculated
- [ ] New call has `sentiment_label` set
- [ ] Hot lead alert created when score >= 60
- [ ] Dashboard "Recent Activity" shows enriched names
- [ ] Dashboard "ClinicalPulse" shows sentiment percentages
- [ ] Recording URL populated when available

---

## Comparison to Expected Behavior

| Feature | Expected | Actual | Status |
|---------|----------|--------|--------|
| Caller Names | Enriched from contacts | "Unknown Caller" | ❌ BROKEN |
| Sentiment Score | Numeric 0.0-1.0 | NULL or TEXT | ❌ BROKEN |
| Sentiment Label | positive/neutral/negative | NULL | ❌ BROKEN |
| Phone Numbers | Always present | NULL in 75% of calls | ❌ BROKEN |
| Hot Lead Alerts | Auto-created | 0 alerts | ❌ BROKEN |
| Contact Names | Enriched | 100% enriched | ✅ WORKING |
| Phone Format | E.164 | E.164 | ✅ WORKING |
| Call Volume | >0 | 8 calls | ✅ WORKING |
| Database Connection | Connected | Connected | ✅ WORKING |

---

## Conclusion

The dashboard data infrastructure is **partially functional** but has **critical data quality issues** that prevent core features from working:

1. **Schema is incomplete** - Missing columns for caller names and sentiment scores
2. **Webhook processing is broken** - Recent calls have NULL phone numbers and sentiment
3. **Enrichment pipelines missing** - No caller name lookup, no sentiment analysis, no hot lead detection

**Estimated Fix Time:** 6-8 hours (1 developer, full day)

**Business Impact:** Dashboard cannot demonstrate value until data quality is fixed. All demo calls will show "Unknown Caller" with no sentiment analysis.

**Recommendation:** Fix Priority 1-3 before Friday demo. Priorities 4-5 can wait if time is limited.

---

## Verification Script

Location: `/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/verify-dashboard-data.sh`

Run again after fixes:
```bash
chmod +x verify-dashboard-data.sh
./verify-dashboard-data.sh
```

Expected output after fixes: **18/18 checks passed** ✅
