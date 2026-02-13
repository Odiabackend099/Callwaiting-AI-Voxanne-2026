# AI Developer Handoff: Fix VAPI Data Population Issues to 100%

**Date:** 2026-02-13
**Priority:** HIGH - Blocking data analytics and reporting
**Effort Estimate:** 4-6 hours
**Complexity:** Medium (straightforward extraction logic, well-defined requirements)

---

## Executive Summary

The VAPI → Backend → Supabase → Dashboard pipeline is **fully operational and verified working end-to-end**. However, **3 specific fields are not being populated** from the VAPI webhook payload due to missing or incomplete extraction logic in the webhook handler.

**This is NOT a pipeline failure.** Real data IS flowing through the system (22 calls confirmed in database with vapi_call_id). The issue is that specific fields in the webhook handler are not being extracted from the VAPI payload before storing.

**Your Task:** Fix 3 data extraction issues in the webhook handler to achieve 100% field population across all calls.

---

## Required Context Reading

**BEFORE YOU START IMPLEMENTATION, you MUST read:**

1. **`.agent/prd.md`** (Section 2.5 - VAPI End-to-End Pipeline Verification)
   - Explains what was verified and what the 3 issues are
   - Documents the pipeline flow end-to-end
   - Provides background on why this matters

2. **`.agent/database-ssot.md`** (Database Schema Section)
   - Documents the `calls` table structure
   - Shows which fields are under-populated and why
   - Provides details on each issue's root cause

3. **This prompt** - Explains specifically what to fix

---

## The 3 Data Population Issues

### Issue #1: cost_cents - 73% Populated (16/22 calls) ⚠️

**Current Status:** Cost data is present in 16 of 22 calls (73%)

**What's Wrong:** 6 calls are missing cost_cents data

**Root Cause:** `backend/src/routes/vapi-webhook.ts` is not extracting `message.cost` from VAPI webhook payload

**What VAPI Sends:** The webhook payload contains:
```javascript
message: {
  cost: 0.82,  // Cost in USD (e.g., 0.82 = 82 cents)
  durationSeconds: 45,
  // ... other fields
}
```

**What We Need to Do:**
- Extract `message.cost` (in dollars)
- Convert to cents: `Math.ceil(message.cost * 100)` → integer cents
- Store in `calls.cost_cents` column

**Code Location:** `backend/src/routes/vapi-webhook.ts`
- Lines 150-270: VAPI payload parsing section
- Find where other cost-related fields might be extracted
- Add cost extraction logic if missing or fix if broken

**Success Criteria:**
```sql
-- After fix, this query should return 22 (all calls):
SELECT COUNT(*) as calls_with_cost
FROM calls
WHERE cost_cents > 0;
-- Expected: 22 (100%)
```

---

### Issue #2: sentiment_score - 45% Populated (10/22 calls) ⚠️

**Current Status:** Sentiment data is present in 10 of 22 calls (45%)

**What's Wrong:** 12 calls are missing sentiment analysis data

**Root Cause:** Sentiment analysis service not running on all calls or results not being stored in database

**What VAPI Sends:** The webhook payload contains sentiment analysis results:
```javascript
{
  sentiment: {
    label: "positive",       // "positive" | "neutral" | "negative"
    score: 0.85,            // numeric 0.0-1.0
    summary: "Customer expressed satisfaction with service",
    urgency: "low"          // "low" | "medium" | "high" | "critical"
  }
}
```

**What We Need to Do:**
Extract all 4 sentiment fields from VAPI response:
1. `sentiment_label` - classification
2. `sentiment_score` - numeric score
3. `sentiment_summary` - human-readable description
4. `sentiment_urgency` - urgency tier

**Code Location:** `backend/src/routes/vapi-webhook.ts`
- Lines 320-400: Sentiment analysis integration section
- Verify sentiment extraction is implemented
- Ensure all 4 fields are being stored, not just label

**Success Criteria:**
```sql
-- After fix, this query should return 22 (all completed calls):
SELECT COUNT(*) as calls_with_sentiment
FROM calls
WHERE sentiment_score IS NOT NULL;
-- Expected: 22 (100%)
```

---

### Issue #3: tools_used - 0% Populated (0/22 calls) ❌ CRITICAL

**Current Status:** NO calls have tools_used data (0%)

**What's Wrong:** tools_used column exists but is always empty or NULL

**Root Cause:** Tool tracking is not implemented in webhook handler at all

**What VAPI Sends:** The webhook payload contains tool calls in the messages array:
```javascript
call: {
  messages: [
    {
      role: "assistant",
      content: "...",
      toolCall: {
        function: {
          name: "checkAvailability"  // ← Tool name
        }
      }
    },
    {
      role: "assistant",
      content: "...",
      toolCall: {
        function: {
          name: "bookClinicAppointment"  // ← Tool name
        }
      }
    },
    // ... more messages
  ]
}
```

**What We Need to Do:**

Create new function `extractToolsUsed(messages)` that:
1. Iterates through the `call.messages` array
2. Finds messages where `toolCall` property exists
3. Extracts the tool name: `message.toolCall.function.name`
4. Returns array of unique tool names: `['checkAvailability', 'bookClinicAppointment']`

**Expected Output Format:**
```javascript
// For a call that used 2 tools:
tools_used: ['checkAvailability', 'bookClinicAppointment']

// For a call that used no tools:
tools_used: []

// For a call with duplicate tool calls:
tools_used: ['transferCall']  // No duplicates
```

**Code Location:** `backend/src/routes/vapi-webhook.ts`
- Lines 200-220: Create new function here
- Must be called during webhook processing
- Result stored in `tools_used` column

**Success Criteria:**
```sql
-- After fix, this query should return 22 (all calls have tool array):
SELECT COUNT(*) as calls_with_tools
FROM calls
WHERE tools_used IS NOT NULL
  AND array_length(tools_used, 1) > 0;
-- Expected: 22+ (100% of calls)

-- Sample query to see which tools were used:
SELECT DISTINCT unnest(tools_used) as tool_name
FROM calls
WHERE tools_used IS NOT NULL
ORDER BY tool_name;
-- Expected: checkAvailability, bookClinicAppointment, transferCall, etc.
```

---

## Implementation Plan Template

Before you start coding, **create your own implementation plan** answering:

1. **Investigation Phase:**
   - [ ] Read `.agent/prd.md` section 2.5 completely
   - [ ] Read `.agent/database-ssot.md` calls table section completely
   - [ ] Open `backend/src/routes/vapi-webhook.ts` and locate VAPI payload parsing section
   - [ ] Find existing cost/sentiment extraction logic (if any)
   - [ ] Identify where `tools_used` should be populated

2. **Design Phase:**
   - [ ] Plan where to add cost extraction (line number estimate)
   - [ ] Plan where to fix/verify sentiment extraction (line number estimate)
   - [ ] Plan new `extractToolsUsed()` function signature
   - [ ] Decide: inline function or extracted to service file?
   - [ ] Document any assumptions about VAPI payload structure

3. **Implementation Phase:**
   - [ ] Add/fix cost extraction logic
   - [ ] Add/fix sentiment extraction logic
   - [ ] Implement extractToolsUsed() function
   - [ ] Wire up function calls in webhook handler
   - [ ] Update TypeScript types if needed

4. **Testing Phase:**
   - [ ] Write SQL queries to verify all 3 fields are populated
   - [ ] Check data types match schema (cost_cents: integer, sentiment_score: numeric, tools_used: text[])
   - [ ] Sample a few calls to verify data looks correct
   - [ ] Check that empty values are handled correctly (cost=0, sentiment=NULL, tools=[])

5. **Verification Phase:**
   - [ ] Run final SQL queries to confirm 100% population
   - [ ] Document what was fixed
   - [ ] Note any issues encountered and how they were resolved

---

## Code Structure Reference

### File to Modify:
`backend/src/routes/vapi-webhook.ts` (1,270 lines)

### Current Structure (Approximate Line Ranges):
```
Lines 1-100:       Imports and setup
Lines 100-150:     Middleware and authorization
Lines 150-270:     VAPI payload parsing (COST EXTRACTION HERE)
Lines 270-320:     Call record preparation
Lines 320-400:     Sentiment analysis (SENTIMENT EXTRACTION HERE)
Lines 400-500:     Appointment linking
Lines 500-600:     Database upsert
Lines 600-800:     Helper functions
Lines 800-900:     Tool sync and callbacks
Lines 900+:        Export
```

### Key Variables You'll Need:
```typescript
const message = call.message;           // Contains cost, duration
const artifact = call.artifact;         // Contains transcript, recording
const messages = call.messages;         // Array of conversation messages
```

---

## Success Criteria (Acceptance Checklist)

Your implementation is complete when:

- [ ] **All 3 issues fixed** - No errors during fix implementation
- [ ] **Code compiles** - TypeScript compiles without errors (`npm run build`)
- [ ] **100% cost_cents population** - All calls have cost_cents > 0 or = 0 (not NULL)
- [ ] **100% sentiment_score population** - All completed calls have sentiment_score populated
- [ ] **100% tools_used population** - All calls have tools_used array (may be empty [] for calls with no tools)
- [ ] **Data types correct** - cost_cents: integer, sentiment_score: numeric, tools_used: text[]
- [ ] **No regressions** - Existing webhook handler logic still works correctly
- [ ] **Documentation updated** - Added comments explaining the new extraction logic

---

## Testing Commands

After implementation, run these SQL queries to verify:

```sql
-- Verify cost_cents population
SELECT
  COUNT(*) as total_calls,
  COUNT(CASE WHEN cost_cents > 0 THEN 1 END) as calls_with_cost,
  COUNT(CASE WHEN cost_cents IS NULL THEN 1 END) as calls_without_cost,
  ROUND(100.0 * COUNT(CASE WHEN cost_cents > 0 THEN 1 END) / COUNT(*), 1) as cost_percentage
FROM calls;

-- Verify sentiment_score population
SELECT
  COUNT(*) as total_calls,
  COUNT(CASE WHEN sentiment_score IS NOT NULL THEN 1 END) as calls_with_sentiment,
  COUNT(CASE WHEN sentiment_score IS NULL THEN 1 END) as calls_without_sentiment,
  ROUND(100.0 * COUNT(CASE WHEN sentiment_score IS NOT NULL THEN 1 END) / COUNT(*), 1) as sentiment_percentage
FROM calls;

-- Verify tools_used population
SELECT
  COUNT(*) as total_calls,
  COUNT(CASE WHEN tools_used IS NOT NULL AND array_length(tools_used, 1) > 0 THEN 1 END) as calls_with_tools,
  COUNT(CASE WHEN tools_used IS NULL OR array_length(tools_used, 1) = 0 THEN 1 END) as calls_without_tools,
  ROUND(100.0 * COUNT(CASE WHEN tools_used IS NOT NULL AND array_length(tools_used, 1) > 0 THEN 1 END) / COUNT(*), 1) as tools_percentage
FROM calls;

-- See what tools were actually used (after fix)
SELECT DISTINCT unnest(tools_used) as tool_used, COUNT(*) as times_used
FROM calls
WHERE tools_used IS NOT NULL AND array_length(tools_used, 1) > 0
GROUP BY unnest(tools_used)
ORDER BY times_used DESC;

-- Sample a few calls to verify data looks reasonable
SELECT
  id,
  created_at,
  cost_cents,
  sentiment_label,
  sentiment_score,
  tools_used
FROM calls
ORDER BY created_at DESC
LIMIT 5;
```

---

## Important Notes

1. **VAPI Payload Structure:** The exact field names in VAPI webhook payload should be verified. Check `backend/src/types/vapi-types.ts` or similar for VAPI type definitions if they exist.

2. **Null Handling:**
   - `cost_cents`: Should default to 0 if not in payload (never NULL)
   - `sentiment_score`: Can be NULL if sentiment not analyzed
   - `tools_used`: Should default to empty array [] (not NULL)

3. **Data Preservation:** Do NOT delete or modify existing call data. Only fix the extraction logic going forward. Existing calls will keep their current values.

4. **Testing:** You can test by looking at recent calls in Supabase (the 22 calls that already exist). After fix is deployed, new calls will have all fields populated.

5. **Backward Compatibility:** Ensure your changes don't break existing webhook processing for calls that don't have these fields.

---

## References

- **PRD Full Context:** `.agent/prd.md` (Section 2.5 and Section 6.2 - Golden Record Analytics)
- **Database Schema:** `.agent/database-ssot.md` (Production Tables section)
- **Verification Results:** `VERIFICATION_RESULTS_2026-02-13.md`
- **Webhook Handler:** `backend/src/routes/vapi-webhook.ts` (1,270 lines - study the structure)

---

## Getting Started

1. **Read the full context:**
   ```bash
   # Read these in order:
   cat .agent/prd.md | grep -A 100 "2.5 VAPI End-to-End"
   cat .agent/database-ssot.md | grep -A 50 "calls"
   ```

2. **Examine the webhook handler:**
   ```bash
   code backend/src/routes/vapi-webhook.ts
   # Focus on: payload parsing, cost extraction, sentiment handling
   ```

3. **Create your implementation plan** (in a comment or separate file)
   - What you'll fix
   - Where you'll fix it
   - How you'll test it

4. **Implement the fixes** (4-6 hours estimated)

5. **Test your changes** (run the SQL queries above)

6. **Verify 100% population** before marking complete

---

## Success Message

When all 3 issues are fixed to 100%, the dashboard will:
- ✅ Show accurate call costs in analytics
- ✅ Display sentiment percentages correctly
- ✅ Track which tools were used during each call
- ✅ Enable proper lead scoring and alerts

**Expected completion:** 2026-02-13 or 2026-02-14

---

**Questions?** Reference the PRD (Section 2.5), Database SSOT, or Verification Results document.

**Status:** Ready for implementation
