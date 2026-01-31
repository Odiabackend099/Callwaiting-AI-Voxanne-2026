# Phase 6: Schema Fix Report

**Date:** 2026-01-31
**Status:** ⚠️ PARTIAL - Schema Mismatch Detected and Documented
**Action Required:** Code updates to match actual schema

---

## Executive Summary

The Phase 6 table unification migration was **partially successful**:

✅ **Completed:**
- Unified `calls` table created
- 5 inbound call records successfully migrated with `call_direction='inbound'`
- Data integrity maintained (no data loss)
- `call_direction` field properly populated

❌ **Issues:**
- Table schema doesn't match migration specification
- Missing sentiment analysis columns: `sentiment_label`, `sentiment_score`, `sentiment_summary`, `sentiment_urgency`
- Missing phone fields: `phone_number`, `caller_name`
- Extra columns: `from_number`, `to_number`, `intent`, `start_time`, `end_time`, `transcript_text`
- Dashboard code expects `phone_number` but table has `from_number`

---

## Schema Mismatch Analysis

### Actual Table Schema (Current State)

**Columns in unified `calls` table:**
```
- id (UUID)
- org_id (UUID)
- vapi_call_id (TEXT)
- contact_id (UUID)
- call_direction (TEXT) ✅ Correct
- call_type (TEXT) ✅ Correct
- from_number (TEXT) ← Uses old column name
- to_number (TEXT) ← Extra column
- call_sid (TEXT) ✅ Correct
- created_at (TIMESTAMPTZ) ✅ Correct
- updated_at (TIMESTAMPTZ) ✅ Correct
- start_time (TIMESTAMPTZ) ← Extra column
- end_time (TIMESTAMPTZ) ← Extra column
- duration_seconds (INTEGER) ✅ Correct
- status (TEXT) ✅ Correct
- recording_url (TEXT) ✅ Correct
- recording_storage_path (TEXT) ✅ Correct
- transcript (TEXT) ✅ Correct
- transcript_text (TEXT) ← Extra/duplicate column
- sentiment (TEXT) ✅ Partial (only legacy field)
- intent (TEXT) ← Extra column
- outcome (TEXT) ✅ Correct
- outcome_summary (TEXT) ✅ Correct
- notes (TEXT) ✅ Correct
- metadata (JSONB) ✅ Correct
```

**Missing Columns (Expected but Not Present):**
- `phone_number` - should contain inbound caller's phone number
- `caller_name` - should contain inbound caller's name
- `sentiment_label` - should be 'positive', 'neutral', or 'negative'
- `sentiment_score` - should be 0.0 to 1.0
- `sentiment_summary` - should be human-readable summary
- `sentiment_urgency` - should be 'low', 'medium', 'high', or 'critical'

### Expected Table Schema (From Migration Specification)

Based on the migration file `/backend/supabase/migrations/20260131_unify_calls_tables.sql`, the table should have:

```sql
CREATE TABLE calls_unified (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  vapi_call_id TEXT UNIQUE NOT NULL,
  contact_id UUID,
  call_direction TEXT NOT NULL,
  call_type TEXT NOT NULL,
  phone_number TEXT,          -- MISSING!
  caller_name TEXT,           -- MISSING!
  call_sid TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT,
  recording_url TEXT,
  recording_storage_path TEXT,
  transcript TEXT,
  sentiment TEXT,
  sentiment_label TEXT,       -- MISSING!
  sentiment_score NUMERIC,    -- MISSING!
  sentiment_summary TEXT,     -- MISSING!
  sentiment_urgency TEXT,     -- MISSING!
  outcome TEXT,
  outcome_summary TEXT,
  notes TEXT,
  metadata JSONB
);
```

---

## Root Cause Analysis

**What Happened:**
1. Migration SQL specified creation of `calls_unified` table
2. Actual result: A `calls` table was created/modified but with the wrong schema
3. The table structure appears to be based on an existing legacy `calls` table rather than the new unified schema

**Why This Happened:**
- The migration likely used an `ALTER TABLE` or existing table structure instead of `CREATE TABLE` from scratch
- The database had an existing `calls` table with columns like `from_number`, `to_number`
- The migration renamed it without fully restructuring the schema

**Evidence:**
- Table name in code expects `calls` but migration created `calls_unified` → renamed to `calls`
- Column names `from_number`, `to_number` come from original `calls` table structure
- Inbound call data exists (5 rows), so data did migrate

---

## Immediate Impact on Dashboard

### Current Problem

The dashboard code in `backend/src/routes/calls-dashboard.ts` (line 63) queries:

```typescript
.select('id, call_direction, phone_number, caller_name, created_at, duration_seconds, ...')
```

**But the table has `from_number` instead of `phone_number`**, causing error:
```
column calls.phone_number does not exist
```

### Solution Options

**Option 1: Update Code to Match Current Schema (Quick Fix)**
- Modify dashboard queries to use `from_number` instead of `phone_number`
- Modify webhook handler to map data to actual column names
- This gets the dashboard working immediately
- Trade-off: Doesn't fix the underlying schema mismatch

**Option 2: Fix Database Schema (Proper Solution)**
- Add missing columns to table
- Migrate data from `from_number` → `phone_number`
- Update webhook handler to use correct columns
- Estimated time: 30 minutes (once database connection is available)

**Recommended Approach:** **Option 1 + Option 2**
- Apply Option 1 now (get dashboard working)
- Apply Option 2 when database connection available (proper schema)

---

## Data Currently in Table

**5 migrated records with:**
- `call_direction = 'inbound'` ✅
- `from_number` has phone number (e.g., `+15551234567`) ⚠️ Wrong column name
- `to_number` has receiving number
- `sentiment = NULL` (will be populated by future webhooks) ⚠️ Missing detailed fields

**Example Record:**
```json
{
  "id": "xxx-xxx-xxx",
  "call_direction": "inbound",
  "from_number": "+15551234567",
  "to_number": "+12345678901",
  "sentiment": null,
  "sentiment_label": null,
  "sentiment_score": null,
  "sentiment_summary": null,
  "sentiment_urgency": null,
  "created_at": "2026-01-31T12:00:00+00:00"
}
```

---

## Files Affected

### Frontend/Dashboard

**File:** `backend/src/routes/calls-dashboard.ts`

**Current Code (Line 63):**
```typescript
.select('id, call_direction, phone_number, caller_name, created_at, duration_seconds, status, recording_url, recording_storage_path, transcript, sentiment_score, sentiment_label, sentiment_summary, sentiment_urgency', { count: 'exact' })
```

**Required Change:**
```typescript
.select('id, call_direction, from_number, call_type, created_at, duration_seconds, status, recording_url, recording_storage_path, transcript, sentiment', { count: 'exact' })
```

**Response Transformation (Line 107-123):**
Change:
```typescript
phone_number: call.phone_number || 'Unknown'
caller_name: call.caller_name || 'Unknown Caller'
sentiment_score: call.sentiment_score
sentiment_label: call.sentiment_label
sentiment_summary: call.sentiment_summary
sentiment_urgency: call.sentiment_urgency
```

To:
```typescript
phone_number: call.from_number || 'Unknown'  // Map from_number → phone_number
caller_name: call.call_type || 'Unknown Caller'  // Use call_type as placeholder
sentiment_score: null  // Not available in current schema
sentiment_label: call.sentiment ? mapSentimentToLabel(call.sentiment) : null
sentiment_summary: call.sentiment || null
sentiment_urgency: null  // Not available in current schema
```

### Webhook Handler

**File:** `backend/src/routes/vapi-webhook.ts`

**Current Code (Line ~305-370):**
```typescript
const { error: callLogError } = await supabase
  .from('calls')
  .upsert({
    phone_number: call?.customer?.number,
    caller_name: call?.customer?.name,
    sentiment_label: sentimentLabel,
    sentiment_score: sentimentScore,
    sentiment_summary: sentimentSummary,
    sentiment_urgency: sentimentUrgency,
    ...
  })
```

**Required Change:**
```typescript
const { error: callLogError } = await supabase
  .from('calls')
  .upsert({
    from_number: call?.customer?.number,  // Map to from_number
    call_type: callDirection,  // Use call_type instead of caller_name
    sentiment: `${sentimentLabel}:${sentimentScore}:${sentimentSummary}`,  // Pack into sentiment field
    intent: extractIntent(artifact?.summary),  // Use intent field
    ...
  })
```

---

## SQL Commands to Add Missing Columns

**When database connection becomes available, execute:**

```sql
-- Add missing sentiment columns
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS sentiment_label TEXT,
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC,
ADD COLUMN IF NOT EXISTS sentiment_summary TEXT,
ADD COLUMN IF NOT EXISTS sentiment_urgency TEXT;

-- Add phone_number and caller_name columns
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS caller_name TEXT;

-- Migrate data from from_number → phone_number for inbound calls
UPDATE calls
SET phone_number = from_number
WHERE call_direction = 'inbound' AND phone_number IS NULL;

-- Set caller_name to 'Unknown Caller' for inbound calls
UPDATE calls
SET caller_name = 'Unknown Caller'
WHERE call_direction = 'inbound' AND caller_name IS NULL;
```

Migration file created: `/backend/supabase/migrations/20260131_fix_unified_calls_schema.sql`

---

## Recommended Next Steps

### Step 1: Quick Fix (Now - 15 minutes)
1. ✅ Document schema mismatch (THIS REPORT)
2. ✅ Create corrective migration file (CREATED)
3. ⏳ Update dashboard code to use actual schema
4. ⏳ Update webhook handler to use actual schema
5. ⏳ Test dashboard displays calls correctly

### Step 2: Proper Fix (When DB Connection Available - 30 minutes)
1. Apply corrective migration to add missing columns
2. Migrate data from `from_number` → `phone_number`
3. Update code to use proper columns (revert quick fix changes)
4. Run comprehensive tests

### Step 3: Verification (15 minutes)
1. Test dashboard displays calls with all variables
2. Test webhook handler logs new calls correctly
3. Verify sentiment fields populated (will be NULL until new calls arrive)
4. Monitor logs for any errors

---

## Testing Checklist

- [ ] Dashboard API `/api/calls-dashboard` returns 200 (not error)
- [ ] Dashboard shows migrated calls (5 rows from earlier migration)
- [ ] Phone number displays correctly (mapped from `from_number`)
- [ ] Caller name displays (mapped from `call_type` or placeholder)
- [ ] Frontend dashboards loads without console errors
- [ ] Next inbound call triggers webhook and logs to unified table
- [ ] Stats API returns accurate inbound/outbound counts

---

## Risk Assessment

**Risk Level:** LOW ⭕

**Why:**
- Data integrity maintained (no data loss)
- Only schema columns differ (not data)
- Can be fixed with code changes or schema migration
- No customer impact (pre-launch)
- Fully reversible

**Mitigation:**
- Code changes are low-risk (query mapping only)
- Schema migration is standard (add columns, data migration)
- Both options preserve existing data
- Easy to roll back by reverting code changes

---

## Summary

The table unification **partially succeeded**. The unified `calls` table exists with 5 migrated records, but the schema needs adjustment. We have two paths forward:

1. **Quick Fix:** Update code to match current schema (working in 15 minutes)
2. **Proper Fix:** Add missing columns and restructure schema (working in 30 minutes)

Recommendation: Apply Quick Fix now to unblock dashboard testing, then apply Proper Fix when database connection is available.

Files to update:
- `backend/src/routes/calls-dashboard.ts` - Change `phone_number` → `from_number`
- `backend/src/routes/vapi-webhook.ts` - Adjust field mappings

---

**Created:** 2026-01-31 13:10 UTC
**Author:** Claude Code (Phase 6 Migration Analysis)
