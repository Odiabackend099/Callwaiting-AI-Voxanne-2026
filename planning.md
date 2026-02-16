# Call Logs Dashboard Fixes - Planning Document

**Date:** 2026-02-16
**Principle:** 3-Step Coding Principle
**Status:** Planning Phase

---

## Issues Identified

### PRIMARY Issues (User Priority)
1. **Sentiment displaying hardcoded "neutral"** - All calls show "neutral" instead of real Vapi sentiment data
2. **Outcome summary not from Vapi** - Should use Vapi's `analysis.summary`, not GPT-4o
3. **Contact display incomplete** - Should show both name AND phone number extracted properly

### SECONDARY Issues
4. **Recording playback not working** - Play button opens modal but doesn't play audio
5. **Total volume accuracy** - Ensure inbound/outbound counts are accurate
6. **Action buttons** - Send reminder and Reschedule functionality

---

## Root Cause Analysis

### Issue 1: Hardcoded "neutral" Sentiment

**Investigation:**
- Webhook handler (lines 675-710 in `vapi-webhook.ts`) extracts sentiment from `analysis` object:
  - `analysis?.sentiment` → `sentimentLabel`
  - `analysis?.structuredData?.sentimentScore` → `sentimentScore`
  - `analysis?.summary` → `sentimentSummary`
  - `analysis?.structuredData?.sentimentUrgency` → `sentimentUrgency`
- Falls back to defaults: 'neutral', 0.5, summary text, 'low' (lines 693-697)

**Root Cause:**
- Vapi's `analysisPlan` was JUST added to Vapi assistants (2026-02-16)
- Existing calls in database have NULL sentiment fields
- Frontend may be showing these NULL values as "neutral"

**Data Flow:**
```
Vapi Call → Webhook → analysis.structuredData.sentimentScore
                    → analysis.sentiment
                    → analysis.summary
                    → analysis.structuredData.sentimentUrgency
          → Database (sentiment_score, sentiment_label, sentiment_summary, sentiment_urgency)
          → API /api/calls-dashboard
          → Frontend page.tsx
```

### Issue 2: Outcome Summary Source

**Current State:**
- Line 682-683: `outcomeShort = analysis?.structuredData?.shortOutcome`
- Line 683: `outcomeDetailed = analysis?.summary`
- Lines 711-758: GPT-4o fallback ONLY if `analysis?.summary` is missing

**Root Cause:**
- The webhook IS using Vapi data as PRIMARY source (correct)
- GPT-4o is only a fallback when Vapi data is missing
- User may be seeing old calls (pre-analysisPlan) that have NULL outcome_summary

### Issue 3: Contact Display

**Current State:**
- Frontend (line 505 in `calls/page.tsx`): `{selectedCall.caller_name}`
- Frontend (line 506): `{selectedCall.phone_number}`
- Backend (lines 683-688 in `calls-dashboard.ts`): Resolves caller_name from DB or contacts JOIN

**Problem:**
- Display only shows caller_name, not BOTH name and phone
- Phone number is on separate line with bullet separator

### Issue 4: Recording Playback

**Current State:**
- Line 414 (calls/page.tsx): Play button calls `fetchCallDetail(call.id)`
- Line 543-548: `<RecordingPlayer callId={selectedCall.id} recordingUrl={selectedCall.recording_url} />`
- Backend (line 700 in `calls-dashboard.ts`): `recording_url: callData.recording_signed_url || callData.recording_url`

**Likely Issues:**
1. `recording_url` might be NULL or invalid
2. `RecordingPlayer` component may not be handling the URL correctly
3. Signed URL might have expired

---

## Solution Design

### Phase 1: Fix Sentiment Display (PRIMARY)

**Goal:** Show real Vapi sentiment data, not hardcoded "neutral"

**Changes Required:**

1. **Verify Vapi analysisPlan is working:**
   - Make a test call to trigger Vapi webhook
   - Check logs for "Vapi native analysis extracted"
   - Verify `analysis.structuredData` contains sentimentScore, sentimentUrgency, shortOutcome

2. **Frontend: Show sentiment properly**
   - File: `src/app/dashboard/calls/page.tsx`
   - Current: Line 526 shows `{selectedCall.sentiment_label || 'N/A'}`
   - Issue: May not be showing sentiment_score or urgency
   - Fix: Display all 4 sentiment fields properly:
     ```typescript
     Sentiment: {sentiment_label} ({(sentiment_score * 100).toFixed(0)}%)
     Urgency: {sentiment_urgency}
     Summary: {sentiment_summary}
     ```

3. **Backend: Ensure defaults are applied**
   - Lines 693-697 in `vapi-webhook.ts` already apply defaults
   - No changes needed

**Testing:**
- Make new test call with analysisPlan enabled
- Check database for non-NULL sentiment fields
- Verify frontend displays all 4 sentiment fields

---

### Phase 2: Fix Outcome Summary (PRIMARY)

**Goal:** Ensure outcome_summary comes from Vapi, not GPT-4o

**Current State:** Already correct! Lines 682-683 use Vapi as primary source.

**Changes Required:**

1. **Frontend: Display outcome_summary prominently**
   - File: `src/app/dashboard/calls/page.tsx`
   - Current: Line 400-406 shows `call.outcome_summary || call.sentiment_summary`
   - Problem: May be showing sentiment_summary as fallback
   - Fix: Show ONLY `outcome_summary` (Vapi's `analysis.summary`)

2. **Call Detail Modal:**
   - Line 535-540 shows "Clinical Summary" with `sentiment_summary`
   - Should show "Outcome Summary" with `outcome_summary`
   - Add second section for sentiment details

**Testing:**
- Make test call
- Verify `analysis.summary` is populated by Vapi
- Check database `outcome_summary` column
- Verify frontend shows Vapi's summary, not GPT-4o

---

### Phase 3: Fix Contact Display (PRIMARY)

**Goal:** Show both contact name AND phone number extracted properly

**Changes Required:**

1. **Call Detail Modal Header:**
   - File: `src/app/dashboard/calls/page.tsx`
   - Line 505: Currently shows `{selectedCall.caller_name}`
   - Line 506: Shows `{selectedCall.phone_number}` with bullet separator
   - Fix: Format as "John Smith (+1234567890)" or "John Smith • +1234567890"

2. **Extract from database properly:**
   - Backend already provides both fields (lines 695-696 in `calls-dashboard.ts`)
   - No backend changes needed

**Implementation:**
```typescript
// Line 505-506 replacement:
<h2 className="text-2xl font-bold text-obsidian">
  {selectedCall.caller_name}
  {selectedCall.phone_number && selectedCall.caller_name !== selectedCall.phone_number && (
    <span className="text-lg text-obsidian/60 font-normal ml-2">
      ({selectedCall.phone_number})
    </span>
  )}
</h2>
<p className="text-sm text-obsidian/60">{formatDateTime(selectedCall.call_date)}</p>
```

---

### Phase 4: Fix Recording Playback (SECONDARY)

**Goal:** Recording actually plays when Play button clicked

**Investigation Needed:**
1. Check `RecordingPlayer` component implementation
2. Verify recording URL is signed and valid
3. Test audio element playback

**Files to Check:**
- `src/components/RecordingPlayer.tsx`
- Backend endpoint: `/api/calls-dashboard/:callId/recording-url`

**Likely Fixes:**
1. RecordingPlayer: Ensure it handles `recordingUrl` prop correctly
2. Backend: Check if signed URL generation is working
3. Frontend: Add error handling for playback failures

---

### Phase 5: Verify Total Volume Accuracy (SECONDARY)

**Current State:**
- `ClinicalPulse.tsx` already fixed to show separate inbound/outbound counts
- Backend API `/api/analytics/summary` provides the counts

**Verification:**
- Check if counts match database reality
- Query: `SELECT call_direction, COUNT(*) FROM calls WHERE org_id = 'demo-org' GROUP BY call_direction`

---

### Phase 6: Action Buttons (DEFERRED)

**Send Reminder & Reschedule:**
- User marked as lower priority
- Defer to Phase 6
- Focus on sentiment, outcome, contacts first

---

## Implementation Order

1. ✅ **Phase 1:** Fix Sentiment Display (30 min)
   - Test Vapi analysisPlan with new call
   - Update frontend to show all 4 sentiment fields
   - Verify database fields populated

2. ✅ **Phase 2:** Fix Outcome Summary (20 min)
   - Update frontend to show `outcome_summary` prominently
   - Separate outcome from sentiment in modal
   - Verify Vapi source

3. ✅ **Phase 3:** Fix Contact Display (15 min)
   - Format name + phone in modal header
   - Ensure proper extraction from backend

4. ⏳ **Phase 4:** Fix Recording Playback (30 min)
   - Investigate RecordingPlayer component
   - Fix audio playback
   - Add error handling

5. ⏳ **Phase 5:** Verify Total Volume (10 min)
   - Query database for actual counts
   - Compare with dashboard display

6. ⏳ **Phase 6:** Action Buttons (deferred)

---

## Success Criteria

### Phase 1 (Sentiment)
- ✅ New test call shows real sentiment data (not "neutral" default)
- ✅ Frontend displays: label, score %, urgency, summary
- ✅ Database has non-NULL sentiment fields

### Phase 2 (Outcome)
- ✅ Outcome summary comes from Vapi `analysis.summary`
- ✅ Displayed prominently in call detail modal
- ✅ Separate from sentiment display

### Phase 3 (Contacts)
- ✅ Modal header shows "John Smith (+1234567890)"
- ✅ Name and phone properly extracted
- ✅ Handles edge cases (phone-only, name-only)

### Phase 4 (Recording)
- ✅ Play button actually plays audio
- ✅ Audio controls work (play/pause/seek)
- ✅ Error handling for missing/invalid URLs

---

## Database Schema Reference

**Calls Table (Relevant Columns):**
```sql
-- From: backend/supabase/migrations/20260213_golden_record_schema.sql
sentiment_label TEXT              -- 'positive', 'neutral', 'negative'
sentiment_score NUMERIC(3,2)      -- 0.0 to 1.0
sentiment_summary TEXT            -- Human-readable summary
sentiment_urgency TEXT            -- 'low', 'medium', 'high', 'critical'
outcome TEXT                      -- Short outcome (1-2 words)
outcome_summary TEXT              -- Detailed outcome (from Vapi analysis.summary)
phone_number TEXT                 -- E.164 format
caller_name TEXT                  -- DEPRECATED (use calls_with_caller_names view)
recording_url TEXT                -- Vapi recording URL
recording_signed_url TEXT         -- Supabase signed URL (if uploaded)
```

**Vapi analysisPlan Structure:**
```typescript
analysisPlan: {
  summaryPrompt: string,          // Instructs Vapi how to summarize
  structuredDataPrompt: string,   // Instructs extraction
  structuredDataSchema: {
    sentimentScore: number,       // 0.0-1.0
    sentimentUrgency: string,     // enum: low/medium/high/critical
    shortOutcome: string,         // 1-2 words
    appointmentBooked: boolean,
    serviceDiscussed: string
  },
  successEvaluationPrompt: string,
  successEvaluationRubric: 'PassFail'
}
```

---

## Risk Assessment

**Low Risk:**
- Phase 1-3: Frontend display changes only
- No database migrations
- No breaking changes to API

**Medium Risk:**
- Phase 4: Recording playback involves external URLs
- May require CORS or signed URL fixes

**High Risk:**
- None

---

## Next Steps

1. Execute Phase 1: Fix sentiment display
2. Make test call to populate real Vapi data
3. Verify dashboard shows correct data
4. Execute Phase 2 & 3 sequentially
5. Test with demo.com organization

---

**Status:** ✅ PLANNING COMPLETE - Ready for execution
