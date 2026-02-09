# QA Manual Testing Guide - Dashboard Data Verification

**Date:** 2026-02-09
**Tester:** [Your Name]
**Environment:** Local Development (http://localhost:3000)
**Login:** voxanne@demo.com / demo123

---

## Overview

This guide walks you through systematic verification of ALL dashboard data fields to ensure NO "Unknown" values or empty fields are displayed.

## Pre-Flight Setup

### 1. Start the Application
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd backend && npm run dev
```

### 2. Automated Database Check (Run First)
```bash
# Run automated verification script
cd backend
DEMO_ORG_ID="your-org-id" npx ts-node src/scripts/qa-dashboard-verification.ts
```

This script will check:
- Calls table data quality
- Contacts table data quality
- Hot lead alerts data
- Data consistency between tables
- Database schema correctness

**IMPORTANT:** Review the script output BEFORE manual testing. It will identify data issues at the database level.

---

## Manual Testing Checklist

### TEST 1: Dashboard Home Page (/dashboard)

#### 1.1 Stats Cards (Top of Page)

**Location:** Dashboard home → Stats cards at top

Take screenshot: `01-stats-cards.png`

Verify these cards:
- [ ] **Total Calls** - Shows numeric count (NOT "0" if calls exist)
- [ ] **Inbound Calls** - Shows numeric count
- [ ] **Outbound Calls** - Shows numeric count
- [ ] **Avg Duration** - Shows time in format "XXs" or "Xm Ys" (NOT "0s" if calls exist)
- [ ] **Avg Sentiment** - Shows percentage (NOT "0%" if calls with sentiment exist)
- [ ] **Pipeline Value** - Shows dollar amount (may be $0 if no pipeline)

**Expected:** All cards show real numbers, not all zeros
**Result:** ✅ PASS / ❌ FAIL
**Notes:**
```
[Record actual values seen]
```

---

#### 1.2 Recent Activity Widget

**Location:** Dashboard home → "Recent Activity" section

Take screenshot: `02-recent-activity.png`

For EACH activity item shown, verify:
- [ ] **Event Icon** - Shows 📞 (call), 🔥 (hot lead), or 📅 (appointment)
- [ ] **Summary Text** - Shows descriptive text (NOT empty, NOT "N/A")
- [ ] **Metadata** - Shows relevant details:
  - For calls: Sentiment label (positive/neutral/negative), NOT "Unknown"
  - For calls: Sentiment summary text (NOT empty)
  - For hot leads: Lead score (0-100 number)
  - For hot leads: Service interest (may be empty - optional field)
- [ ] **Timestamp** - Shows relative time ("5 mins ago", "2 hours ago")

**Count visible activities:** [___]

**Sample 3 activities and record:**
1. Activity 1:
   - Type: [call_completed / hot_lead_detected / appointment_booked]
   - Summary: [Text shown]
   - Metadata: [Details shown]
   - Any "Unknown" values? [YES / NO]

2. Activity 2:
   - Type: [___]
   - Summary: [___]
   - Metadata: [___]
   - Any "Unknown" values? [YES / NO]

3. Activity 3:
   - Type: [___]
   - Summary: [___]
   - Metadata: [___]
   - Any "Unknown" values? [YES / NO]

**Result:** ✅ PASS / ❌ FAIL
**Issues found:**
```
[List any "Unknown" or empty values]
```

---

### TEST 2: Call Logs Page (/dashboard/calls)

#### 2.1 Inbound Calls Tab

**Location:** Left sidebar → "Calls" → "Inbound Calls" tab

Take screenshot: `03-inbound-calls.png`

**Table Column Verification:**

For the first 5-10 calls in the table, verify:

| # | Date & Time | Caller Name | Phone Number | Duration | Status | Sentiment | Outcome Summary | Issues |
|---|-------------|-------------|--------------|----------|--------|-----------|-----------------|--------|
| 1 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [List any "Unknown" or empty] |
| 2 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | |
| 3 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | |
| 4 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | |
| 5 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | |

**Specific Field Checks:**

1. **Caller Name Column:**
   - [ ] NO "Unknown Caller" values
   - [ ] NO "inbound" or "outbound" values (these are directions, not names)
   - [ ] ALL show real person names (e.g., "John Smith", "Samson", "Maria")
   - **If ANY "Unknown Caller" found:** ❌ CRITICAL FAILURE

2. **Phone Number Column:**
   - [ ] NO "Unknown" values
   - [ ] ALL show E.164 format (e.g., "+2348141995397", "+14155551234")
   - [ ] NO empty values
   - **If ANY "Unknown" found:** ❌ CRITICAL FAILURE

3. **Sentiment Column:**
   - [ ] Shows label AND score (e.g., "Positive (85%)")
   - [ ] NO "0%" values (unless legitimately 0)
   - [ ] May show urgency badge ("High Urgency", "Medium")
   - **If shows "0%" on all calls:** ⚠️ WARNING (check if sentiment data exists)

4. **Outcome Summary Column:**
   - [ ] Shows descriptive text (NOT "—" or empty)
   - [ ] Text is readable and makes sense
   - [ ] May show urgency indicator ("High urgency", "Medium urgency")
   - **If all empty:** ⚠️ WARNING (check webhook processing)

**List ALL unique caller names seen:**
```
1. [Name]
2. [Name]
3. [Name]
...
```

**List ALL unique phone numbers seen:**
```
1. [Phone]
2. [Phone]
3. [Phone]
...
```

**Result:** ✅ PASS / ❌ FAIL
**Issues found:**
```
[Describe any "Unknown" or missing data]
```

---

#### 2.2 Outbound Calls Tab

**Location:** Call Logs page → "Outbound Calls" tab

Take screenshot: `04-outbound-calls.png`

Repeat the same verification as 2.1 for outbound calls:

**Table Column Verification:**

| # | Date & Time | Caller Name | Phone Number | Duration | Status | Sentiment | Outcome Summary | Issues |
|---|-------------|-------------|--------------|----------|--------|-----------|-----------------|--------|
| 1 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | |
| 2 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | |
| 3 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | |

**Result:** ✅ PASS / ❌ FAIL
**Issues found:**
```
[Describe any issues]
```

---

### TEST 3: Call Details Modal

#### 3.1 Open Call Details

**Action:** Click on any call row from the Call Logs table

Take screenshot: `05-call-details-modal.png`

**Modal Header Verification:**
- [ ] **Caller Name** - Shows real name (NOT "Unknown Caller")
- [ ] **Phone Number** - Shows real E.164 number (NOT "Unknown")
- [ ] **Date/Time** - Shows formatted timestamp

**Call Metadata Cards:**
- [ ] **Duration** - Shows time in "Xm Ys" format
- [ ] **Status** - Shows status (completed/missed/transferred/failed)
- [ ] **Sentiment** - Shows sentiment label (positive/neutral/negative), NOT "N/A"
- [ ] **Sentiment Urgency Badge** - May show "High Urgency" or "Medium" badge
- [ ] **Recording Status** - Shows status badge (Ready/Processing/Failed)

**Clinical Summary Section:**
- [ ] Shows sentiment summary text (NOT empty)
- [ ] Text is readable and relevant to the call

**Recording Player:**
- [ ] If recording exists, player controls visible
- [ ] If recording processing, shows "Recording is being uploaded..."
- [ ] If recording failed, shows error message

**Transcript Section:**
- [ ] Shows conversation between "Voxanne (Agent)" and "Caller"
- [ ] Each segment has timestamp
- [ ] Text is readable (NOT empty or "...")
- [ ] Shows first 50 words of transcript:
  ```
  [Paste first 50 words here]
  ```

**Action Buttons:**
- [ ] Download button (enabled if recording ready)
- [ ] Share button (enabled if recording ready)
- [ ] Add to CRM button (always enabled)
- [ ] Follow-up button (enabled if phone number exists)
- [ ] Export button (enabled if transcript exists)

**Result:** ✅ PASS / ❌ FAIL
**Issues found:**
```
[Describe any missing or "Unknown" data]
```

---

### TEST 4: Leads Page (/dashboard/leads)

**Location:** Left sidebar → "Leads" or "Hot Leads"

Take screenshot: `06-leads-table.png`

**Table Column Verification:**

For the first 5-10 leads shown, verify:

| # | Lead Name | Phone Number | Lead Status | Lead Score | Service Interest | Last Contacted | Created At | Issues |
|---|-----------|--------------|-------------|------------|------------------|----------------|------------|--------|
| 1 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗ or N/A] | [✓/✗] | [✓/✗] | |
| 2 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗ or N/A] | [✓/✗] | [✓/✗] | |
| 3 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗ or N/A] | [✓/✗] | [✓/✗] | |
| 4 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗ or N/A] | [✓/✗] | [✓/✗] | |
| 5 | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗] | [✓/✗ or N/A] | [✓/✗] | [✓/✗] | |

**Specific Field Checks:**

1. **Lead Name:**
   - [ ] NO "Unknown" values
   - [ ] ALL show real contact names
   - **If ANY "Unknown" found:** ❌ CRITICAL FAILURE

2. **Phone Number:**
   - [ ] NO "Unknown" values
   - [ ] ALL show E.164 format
   - **If ANY "Unknown" found:** ❌ CRITICAL FAILURE

3. **Lead Status:**
   - [ ] Shows "hot", "warm", or "cold"
   - [ ] NOT empty
   - **Count hot leads:** [___]

4. **Lead Score:**
   - [ ] Shows numeric value 0-100
   - [ ] NOT "0" for all leads (unless legitimately scored 0)
   - [ ] For hot leads, score should be >= 60

5. **Service Interest:**
   - [ ] May be empty (optional field)
   - [ ] If populated, shows service names or categories

6. **Last Contacted:**
   - [ ] Shows date/time OR "Never"
   - [ ] NOT empty

**List first 5 lead names:**
```
1. [Name] - Score: [__] - Status: [hot/warm/cold]
2. [Name] - Score: [__] - Status: [hot/warm/cold]
3. [Name] - Score: [__] - Status: [hot/warm/cold]
4. [Name] - Score: [__] - Status: [hot/warm/cold]
5. [Name] - Score: [__] - Status: [hot/warm/cold]
```

**Result:** ✅ PASS / ❌ FAIL
**Issues found:**
```
[Describe any issues]
```

---

### TEST 5: Search & Filter Functionality

#### 5.1 Search by Phone Number

**Location:** Call Logs page → Search box

**Action:** Search for "+234" (Nigerian phone prefix)

Take screenshot: `07-search-phone.png`

- [ ] Results filter to show only matching calls
- [ ] All results have phone numbers starting with "+234"
- [ ] Caller names still populated (NOT "Unknown")

**Result:** ✅ PASS / ❌ FAIL

---

#### 5.2 Search by Name

**Action:** Search for "Samson" (or any known contact name)

Take screenshot: `08-search-name.png`

- [ ] Results filter to show only matching calls
- [ ] All results have "Samson" in caller name
- [ ] Phone numbers still populated

**Result:** ✅ PASS / ❌ FAIL

---

#### 5.3 Filter by Status

**Action:** Select "Completed" from Status dropdown

- [ ] Results filter to show only completed calls
- [ ] Status column shows "Completed" for all visible rows

**Result:** ✅ PASS / ❌ FAIL

---

### TEST 6: Data Consistency Across Pages

**Goal:** Verify same data appears consistently everywhere

#### 6.1 Select a Specific Call

**Action:**
1. Go to Dashboard home page
2. Note the first call in "Recent Activity" widget:
   - Caller Name: [_______________]
   - Phone Number: [_______________]
   - Outcome Summary: [_______________]

3. Go to Call Logs page
4. Find the same call (by phone number or time)
5. Verify data matches:
   - [ ] Caller Name matches
   - [ ] Phone Number matches
   - [ ] Outcome/Summary matches

6. Go to Leads page
7. Find the same contact (by phone number)
8. Verify data matches:
   - [ ] Contact Name matches Caller Name
   - [ ] Phone Number matches

**Result:** ✅ PASS / ❌ FAIL
**Issues found:**
```
[Describe any inconsistencies]
```

---

### TEST 7: Edge Cases

#### 7.1 Calls with No Recording

**Action:** Find a call with "No recording" status

- [ ] Still shows caller name (NOT "Unknown")
- [ ] Still shows phone number
- [ ] Still shows sentiment data
- [ ] Play/Download buttons disabled (expected)

**Result:** ✅ PASS / ❌ FAIL

---

#### 7.2 Old Calls (Before Sentiment Feature)

**Action:** Find calls from before 2026-02-02 (if any)

- [ ] May show "N/A" for sentiment (expected for old data)
- [ ] Still shows caller name and phone number
- [ ] Outcome summary may be empty (expected)

**Result:** ✅ PASS / ⚠️ EXPECTED (old data)

---

## Final Report Template

### Executive Summary

**Date Tested:** [YYYY-MM-DD]
**Tester:** [Your Name]
**Environment:** Local Development
**Total Tests:** 7

**Results:**
- ✅ **Passed:** [X] tests
- ❌ **Failed:** [X] tests
- ⚠️ **Warnings:** [X] tests

**Overall Status:** [PASS / FAIL / PASS WITH WARNINGS]

---

### Critical Issues Found

**Issue 1: [Title]**
- **Severity:** CRITICAL / HIGH / MEDIUM / LOW
- **Location:** [Page/Component]
- **Description:** [What you saw]
- **Expected:** [What should appear]
- **Screenshot:** [Filename]

**Issue 2: [Title]**
- ...

---

### Detailed Test Results

**TEST 1: Dashboard Home** - [PASS / FAIL]
- Stats Cards: [PASS / FAIL]
- Recent Activity: [PASS / FAIL]
- Issues: [List]

**TEST 2: Call Logs** - [PASS / FAIL]
- Inbound Calls: [PASS / FAIL]
- Outbound Calls: [PASS / FAIL]
- Issues: [List]

**TEST 3: Call Details** - [PASS / FAIL]
- Issues: [List]

**TEST 4: Leads Page** - [PASS / FAIL]
- Issues: [List]

**TEST 5: Search/Filter** - [PASS / FAIL]
- Issues: [List]

**TEST 6: Data Consistency** - [PASS / FAIL]
- Issues: [List]

**TEST 7: Edge Cases** - [PASS / FAIL]
- Issues: [List]

---

### Data Quality Summary

**Caller Names:**
- Total unique names seen: [___]
- "Unknown Caller" count: [___]
- Sample names: [List 5-10]

**Phone Numbers:**
- Total unique numbers seen: [___]
- "Unknown" count: [___]
- Sample numbers: [List 5-10]

**Sentiment Data:**
- Calls with sentiment: [___]
- Calls without sentiment: [___]
- "0%" sentiment count: [___]

**Outcome Summaries:**
- Calls with summaries: [___]
- Calls without summaries: [___]

---

### Recommendations

1. [Action item 1]
2. [Action item 2]
3. [Action item 3]

---

### Screenshots Attached

1. `01-stats-cards.png` - Dashboard stats cards
2. `02-recent-activity.png` - Recent activity widget
3. `03-inbound-calls.png` - Inbound calls table
4. `04-outbound-calls.png` - Outbound calls table
5. `05-call-details-modal.png` - Call details modal
6. `06-leads-table.png` - Leads table
7. `07-search-phone.png` - Search by phone
8. `08-search-name.png` - Search by name

---

## Success Criteria

### ✅ PASS Criteria:
- ALL caller names show real person names (NO "Unknown Caller")
- ALL phone numbers show E.164 format (NO "Unknown")
- ALL sentiment data populated for recent calls (after 2026-02-02)
- ALL outcome summaries populated for recent calls
- Data consistent across all pages
- Search and filter functions work correctly

### ⚠️ PASS WITH WARNINGS Criteria:
- Most fields populated correctly
- Some old calls missing sentiment (expected for historical data)
- Some calls missing outcome summary (minor issue)
- Minor data inconsistencies that don't block usage

### ❌ FAIL Criteria:
- ANY "Unknown Caller" values in call logs
- ANY "Unknown" phone numbers
- Critical fields consistently empty (sentiment, outcome)
- Data inconsistencies between pages
- Search/filter broken

---

## Quick Command Reference

### Check Backend Logs
```bash
cd backend
npm run dev | grep -E "(caller_name|phone_number|sentiment)"
```

### Query Database Directly
```bash
# Check calls data
curl -X POST http://localhost:54321/rest/v1/rpc/inspect_calls \
  -H "apikey: your-key" \
  -H "Authorization: Bearer your-token"
```

### Re-run Automated Tests
```bash
cd backend
DEMO_ORG_ID="your-org-id" npx ts-node src/scripts/qa-dashboard-verification.ts
```

---

**END OF MANUAL TESTING GUIDE**

For questions or issues, refer to:
- `DEBUGGING_COMPLETE_SUMMARY.md` - Debugging methodology
- `DEPLOYMENT_VERIFICATION_COMPLETE.md` - Code verification report
- `DASHBOARD_API_COMPREHENSIVE_TEST_REPORT.md` - API endpoint specifications
