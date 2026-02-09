# QA Quick Checklist - Dashboard Data Verification

**Date:** 2026-02-09
**Time Required:** ~1 hour
**Login:** voxanne@demo.com / demo123

---

## Pre-Flight (5 minutes)

```bash
# 1. Check database has data
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend
npx ts-node src/scripts/quick-db-check.ts
```

**Expected:** See real caller names and phone numbers (NOT "Unknown")

```bash
# 2. Restart backend server (REQUIRED for fixes to take effect)
# Stop current server (Ctrl+C), then:
npm run dev
```

**Expected:** `✓ Server running on port 3000`

```bash
# 3. Start frontend (if not already running)
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026
npm run dev
```

**Expected:** `✓ Ready on http://localhost:3000`

---

## Dashboard Home Page (5 minutes)

**URL:** http://localhost:3000/dashboard

### Stats Cards (Top)
- [ ] Total Calls: Shows number (NOT "0" if calls exist)
- [ ] Avg Duration: Shows time (NOT "0s" if calls exist)
- [ ] Avg Sentiment: Shows percentage (NOT "0%" if calls exist)

### Recent Activity Widget
- [ ] Shows list of events (calls, hot leads, appointments)
- [ ] Each event has real caller name (NOT "Unknown")
- [ ] Each event has summary text (NOT empty)
- [ ] Each event has sentiment or score (NOT "0")

**Screenshot:** `01-dashboard-home.png`

**Result:** ✅ PASS / ❌ FAIL

---

## Call Logs - Inbound (10 minutes)

**URL:** http://localhost:3000/dashboard/calls → "Inbound Calls" tab

### Table Check
For the first 5 calls, verify:
- [ ] **Caller Name:** Real names (NOT "Unknown Caller", NOT "inbound")
- [ ] **Phone Number:** E.164 format like +14155551234 (NOT "Unknown")
- [ ] **Sentiment:** Label + score like "Positive (85%)" (NOT "0%")
- [ ] **Outcome Summary:** Text visible (NOT "—" or empty)

### Sample Data
**Call 1:**
- Name: [_________________]
- Phone: [_________________]
- Sentiment: [_________________]
- Outcome: [_________________]

**Call 2:**
- Name: [_________________]
- Phone: [_________________]
- Sentiment: [_________________]
- Outcome: [_________________]

**Screenshot:** `02-inbound-calls.png`

**Result:** ✅ PASS / ❌ FAIL

**Issues:** [List any "Unknown" or empty values]

---

## Call Logs - Outbound (5 minutes)

**URL:** http://localhost:3000/dashboard/calls → "Outbound Calls" tab

### Quick Check
- [ ] Shows outbound calls (if any)
- [ ] Contact names populated (NOT "Unknown")
- [ ] Phone numbers populated (NOT "Unknown")

**Screenshot:** `03-outbound-calls.png`

**Result:** ✅ PASS / ❌ FAIL

---

## Call Details Modal (10 minutes)

**Action:** Click any call row from Call Logs

### Modal Header
- [ ] **Caller Name:** Real name (NOT "Unknown Caller")
- [ ] **Phone Number:** E.164 format (NOT "Unknown")
- [ ] **Date/Time:** Formatted correctly

### Metadata Cards
- [ ] **Duration:** Shows time (e.g., "3m 45s")
- [ ] **Status:** Shows status (completed/missed/transferred/failed)
- [ ] **Sentiment:** Shows label (positive/neutral/negative), NOT "N/A"
- [ ] **Recording:** Shows status badge (Ready/Processing/Failed)

### Clinical Summary
- [ ] Shows sentiment summary text (NOT empty)
- [ ] Text is readable and relevant

### Transcript
- [ ] Shows conversation segments (Voxanne vs Caller)
- [ ] Each segment has timestamp
- [ ] Text is readable (NOT "..." or empty)

**First 50 words of transcript:**
```
[Paste here]
```

**Screenshot:** `04-call-details.png`

**Result:** ✅ PASS / ❌ FAIL

**Issues:** [List any missing data]

---

## Leads Page (10 minutes)

**URL:** http://localhost:3000/dashboard/leads

### Table Check
For the first 5 leads, verify:
- [ ] **Lead Name:** Real names (NOT "Unknown")
- [ ] **Phone Number:** E.164 format (NOT "Unknown")
- [ ] **Lead Status:** Shows hot/warm/cold (NOT empty)
- [ ] **Lead Score:** Shows 0-100 number (NOT empty)

### Sample Data
**Lead 1:**
- Name: [_________________]
- Phone: [_________________]
- Status: [_________________]
- Score: [_________________]

**Lead 2:**
- Name: [_________________]
- Phone: [_________________]
- Status: [_________________]
- Score: [_________________]

**Screenshot:** `05-leads-table.png`

**Result:** ✅ PASS / ❌ FAIL

**Issues:** [List any "Unknown" values]

---

## Search & Filter (5 minutes)

### Test 1: Search by Phone
**Action:** In Call Logs, search for "+234" (or any phone prefix)

- [ ] Results filter correctly
- [ ] Only matching phone numbers shown
- [ ] Caller names still populated (NOT "Unknown")

**Screenshot:** `06-search-phone.png`

### Test 2: Search by Name
**Action:** Search for "Samson" (or any known name)

- [ ] Results filter correctly
- [ ] Only matching names shown
- [ ] Phone numbers still populated

**Screenshot:** `07-search-name.png`

### Test 3: Filter by Status
**Action:** Select "Completed" from Status dropdown

- [ ] Results filter correctly
- [ ] Only completed calls shown

**Result:** ✅ PASS / ❌ FAIL

---

## Data Consistency (5 minutes)

### Cross-Page Verification
**Action:**
1. Note first call in Dashboard Recent Activity:
   - Name: [_________________]
   - Phone: [_________________]

2. Find same call in Call Logs (by phone or time)
3. Verify data matches:
   - [ ] Name matches
   - [ ] Phone matches
   - [ ] Summary/outcome matches

4. Find same contact in Leads page (by phone)
5. Verify data matches:
   - [ ] Name matches
   - [ ] Phone matches

**Result:** ✅ PASS / ❌ FAIL

**Issues:** [List any inconsistencies]

---

## Automated Tests (5 minutes)

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend

# Get org ID from quick check output
npx ts-node src/scripts/quick-db-check.ts

# Run full test suite (replace with actual org ID)
DEMO_ORG_ID="your-org-id-here" npx ts-node src/scripts/qa-dashboard-verification.ts
```

**Expected Output:**
```
✅ TEST 1 PASSED: All data populated correctly
✅ TEST 2 PASSED: All contact data valid
⚠️  TEST 3 WARNING: No hot lead alerts (may be expected)
✅ TEST 4 PASSED: Data is consistent
✅ TEST 5 PASSED: Schema is correct

OVERALL STATUS: ✅ ALL TESTS PASSED
```

**Result:** ✅ PASS / ❌ FAIL

**Issues:** [List any test failures]

---

## Final Verdict

### Overall Status
**Choose one:**
- [ ] ✅ **PASS** - All tests passed, production ready
- [ ] ⚠️ **PASS WITH WARNINGS** - Minor issues, acceptable for demo
- [ ] ❌ **FAIL** - Critical issues found, requires fixes

### Issues Summary
**Critical Issues (blocks production):**
```
1. [Issue description]
2. [Issue description]
```

**Minor Issues (warnings only):**
```
1. [Issue description]
2. [Issue description]
```

### Data Quality Stats
- Total calls checked: [___]
- "Unknown Caller" count: [___] (MUST be 0)
- "Unknown" phone count: [___] (MUST be 0)
- Calls with sentiment: [___]
- Calls with outcomes: [___]

### Recommendation
**Choose one:**
- [ ] ✅ **DEPLOY TO PRODUCTION** - All checks passed
- [ ] ⚠️ **DEPLOY WITH MONITORING** - Minor issues present, monitor after deploy
- [ ] ❌ **DO NOT DEPLOY** - Critical issues require fixes first

---

## Quick Fix Guide

### If "Unknown Caller" found:
```bash
# 1. Verify migration applied
ls -la backend/supabase/migrations/ | grep 20260131

# 2. Check webhook code (line 407)
grep -A 2 "caller_name:" backend/src/routes/vapi-webhook.ts

# 3. Restart server
cd backend && npm run dev
```

### If "0%" sentiment found:
```bash
# 1. Check query uses sentiment_score (line 296)
grep "sentiment_score" backend/src/routes/calls-dashboard.ts

# 2. Trigger test call to populate new format

# 3. Restart server
cd backend && npm run dev
```

### If Recent Activity empty:
```bash
# 1. Check hot lead alert code (lines 570-583)
grep -A 15 "if (leadScoring.score >= 60)" backend/src/routes/vapi-webhook.ts

# 2. Verify guard condition removed (should NOT have "if (!existingContact)")

# 3. Trigger test call with lead_score >= 60
```

---

## Time Breakdown

| Task | Time | Status |
|------|------|--------|
| Pre-Flight | 5 min | [ ] |
| Dashboard Home | 5 min | [ ] |
| Call Logs - Inbound | 10 min | [ ] |
| Call Logs - Outbound | 5 min | [ ] |
| Call Details Modal | 10 min | [ ] |
| Leads Page | 10 min | [ ] |
| Search & Filter | 5 min | [ ] |
| Data Consistency | 5 min | [ ] |
| Automated Tests | 5 min | [ ] |
| **Total** | **~1 hour** | |

---

## Screenshots Checklist

Upload these to test report:
- [ ] `01-dashboard-home.png`
- [ ] `02-inbound-calls.png`
- [ ] `03-outbound-calls.png`
- [ ] `04-call-details.png`
- [ ] `05-leads-table.png`
- [ ] `06-search-phone.png`
- [ ] `07-search-name.png`

---

## Need Help?

**For detailed guidance:**
- Full manual guide: `QA_MANUAL_TESTING_GUIDE.md`
- Testing summary: `QA_TESTING_SUMMARY.md`
- Code fixes: `DEPLOYMENT_VERIFICATION_COMPLETE.md`
- Debugging: `DEBUGGING_COMPLETE_SUMMARY.md`

**Quick commands:**
```bash
# Check database
cd backend && npx ts-node src/scripts/quick-db-check.ts

# Run full tests
DEMO_ORG_ID="your-org-id" npx ts-node src/scripts/qa-dashboard-verification.ts

# Restart server
cd backend && npm run dev
```

---

**Ready to start? Begin with Pre-Flight above! ⬆️**
