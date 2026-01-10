# 🧪 Manual Testing Guide: Phase 1 - Frontend API Migration

**Date:** 2025-01-10  
**Purpose:** Verify Phase 1 implementation (Frontend API Migration)  
**Status:** ⏳ Testing In Progress  

---

## 📋 Pre-Testing Checklist

Before starting tests, ensure:

- [ ] Backend server is running on `http://localhost:3001`
- [ ] Frontend server is running on `http://localhost:3000`
- [ ] User is authenticated in the application
- [ ] User has `org_id` in JWT `app_metadata` (verified from Week 1)
- [ ] Test data exists (at least one call_log and one knowledge_base document)

---

## 🧪 Test Suite: Dashboard Page

### Test 1.1: Dashboard Loads Without Errors

**Steps:**
1. Navigate to `http://localhost:3000/dashboard`
2. Wait for page to load completely
3. Check browser console for errors

**Expected Results:**
- ✅ Page loads successfully
- ✅ No console errors
- ✅ Loading indicator appears briefly, then disappears
- ✅ Stats cards display with numbers

**Actual Results:**
- [ ] Page loads: ✅ / ❌
- [ ] Console errors: None / [List errors]
- [ ] Loading state: ✅ / ❌
- [ ] Stats display: ✅ / ❌

**Notes:**
_Record any issues or unexpected behavior_

---

### Test 1.2: Dashboard Stats Display Correctly

**Steps:**
1. View dashboard page
2. Check each stat card displays correct values:
   - Total Calls
   - Inbound Calls
   - Outbound Calls
   - Completed Calls
   - Calls Today
   - Avg Duration

**Expected Results:**
- ✅ All stat cards display numeric values (or 0 if no data)
- ✅ Values match expected data (if test data exists)
- ✅ Stats are calculated correctly

**Actual Results:**
- [ ] Total Calls: [Value] ✅ / ❌
- [ ] Inbound Calls: [Value] ✅ / ❌
- [ ] Outbound Calls: [Value] ✅ / ❌
- [ ] Completed Calls: [Value] ✅ / ❌
- [ ] Calls Today: [Value] ✅ / ❌
- [ ] Avg Duration: [Value] ✅ / ❌

**Notes:**
_Record any discrepancies_

---

### Test 1.3: Recent Calls Display Correctly

**Steps:**
1. View dashboard page
2. Scroll to "Recent Calls" section
3. Verify last 5 calls display correctly

**Expected Results:**
- ✅ Recent calls section displays (or "No calls yet" message if empty)
- ✅ Each call shows: phone number, time ago, duration, status badge
- ✅ Calls are ordered by most recent first
- ✅ Inbound/Outbound badges display correctly
- ✅ Completed status icon displays (if status is 'completed')

**Actual Results:**
- [ ] Recent calls section: ✅ / ❌
- [ ] Phone numbers display: ✅ / ❌
- [ ] Time ago format: ✅ / ❌
- [ ] Duration format: ✅ / ❌
- [ ] Status badges: ✅ / ❌
- [ ] Order (most recent first): ✅ / ❌

**Notes:**
_Record any UI issues_

---

### Test 1.4: Network Request Verification (Backend API)

**Steps:**
1. Open browser Developer Tools → Network tab
2. Navigate to dashboard page
3. Filter requests by "stats" or "calls-dashboard"
4. Check request to `/api/calls-dashboard/stats`

**Expected Results:**
- ✅ Request is made to `/api/calls-dashboard/stats` (not direct Supabase)
- ✅ Request includes `Authorization: Bearer <token>` header
- ✅ Request returns `200 OK` status
- ✅ Response body contains: `totalCalls`, `inboundCalls`, `outboundCalls`, `completedCalls`, `callsToday`, `avgDuration`, `recentCalls[]`

**Actual Results:**
- [ ] Request to backend API: ✅ / ❌
- [ ] Authorization header: ✅ / ❌
- [ ] Response status: [Status Code] ✅ / ❌
- [ ] Response format: ✅ / ❌

**Request Details:**
```
Method: GET
URL: http://localhost:3001/api/calls-dashboard/stats
Status: [Code]
Response Time: [ms]
Response Size: [bytes]
```

**Response Body:**
```json
[Paste response body here]
```

**Notes:**
_Record any issues with the API call_

---

### Test 1.5: Error Handling (Network Error)

**Steps:**
1. Stop backend server (or block API requests)
2. Navigate to dashboard page
3. Check error handling behavior

**Expected Results:**
- ✅ Loading indicator appears
- ✅ Error message displays to user (not console only)
- ✅ Page doesn't crash
- ✅ User can retry (if retry mechanism exists)

**Actual Results:**
- [ ] Error message displayed: ✅ / ❌
- [ ] Error message text: [Text]
- [ ] Page stability: ✅ / ❌
- [ ] Retry mechanism: ✅ / ❌ / N/A

**Notes:**
_Restart backend server after this test_

---

### Test 1.6: Error Handling (Authentication Error)

**Steps:**
1. Clear authentication token (logout or clear localStorage)
2. Navigate to dashboard page
3. Check error handling behavior

**Expected Results:**
- ✅ User redirected to login page
- ✅ Or error message displayed (if staying on page)
- ✅ No data exposed to unauthenticated user

**Actual Results:**
- [ ] Redirect to login: ✅ / ❌
- [ ] Error message: [Message]
- [ ] No data exposed: ✅ / ❌

**Notes:**
_Login again after this test_

---

## 🧪 Test Suite: Knowledge Base Page

### Test 2.1: Knowledge Base List Loads

**Steps:**
1. Navigate to `http://localhost:3000/dashboard/knowledge-base`
2. Wait for page to load
3. Check browser console for errors

**Expected Results:**
- ✅ Page loads successfully
- ✅ No console errors
- ✅ Loading indicator appears briefly, then disappears
- ✅ Knowledge base documents list displays (or empty state if no documents)

**Actual Results:**
- [ ] Page loads: ✅ / ❌
- [ ] Console errors: None / [List errors]
- [ ] Loading state: ✅ / ❌
- [ ] Documents list displays: ✅ / ❌

**Notes:**
_Record any issues_

---

### Test 2.2: Network Request Verification (GET)

**Steps:**
1. Open browser Developer Tools → Network tab
2. Navigate to knowledge base page
3. Filter requests by "knowledge-base"
4. Check request to `/api/knowledge-base`

**Expected Results:**
- ✅ Request is made to `/api/knowledge-base` (not direct Supabase)
- ✅ Request includes `Authorization: Bearer <token>` header
- ✅ Request returns `200 OK` status
- ✅ Response body contains: `{ items: KBItem[] }`

**Actual Results:**
- [ ] Request to backend API: ✅ / ❌
- [ ] Authorization header: ✅ / ❌
- [ ] Response status: [Status Code] ✅ / ❌
- [ ] Response format: ✅ / ❌

**Request Details:**
```
Method: GET
URL: http://localhost:3001/api/knowledge-base
Status: [Code]
Response Time: [ms]
```

**Response Body:**
```json
[Paste response body here - first item only]
```

**Notes:**
_Record any issues_

---

### Test 2.3: Create New Knowledge Base Document

**Steps:**
1. Click "New Document" or "Add" button
2. Enter filename: `test-document.md`
3. Enter content: `This is a test document content.`
4. Select category: `general`
5. Click "Save" button
6. Check if document appears in list

**Expected Results:**
- ✅ Document created successfully
- ✅ Document appears in list after creation
- ✅ Success message displayed (if implemented)
- ✅ Document has correct filename, content, category

**Actual Results:**
- [ ] Document created: ✅ / ❌
- [ ] Document in list: ✅ / ❌
- [ ] Success message: ✅ / ❌ / N/A
- [ ] Correct data: ✅ / ❌

**Network Request:**
```
Method: POST
URL: http://localhost:3001/api/knowledge-base
Status: [Code]
Request Body: [Paste request body]
Response Body: [Paste response body]
```

**Notes:**
_Record any issues with creation_

---

### Test 2.4: Network Request Verification (POST)

**Steps:**
1. Create a new knowledge base document (from Test 2.3)
2. Check Network tab for POST request

**Expected Results:**
- ✅ Request is made to `/api/knowledge-base` (not direct Supabase)
- ✅ Request method: POST
- ✅ Request includes `Authorization: Bearer <token>` header
- ✅ Request body contains: `filename`, `content`, `category`, `active`
- ✅ Request returns `200 OK` or `201 Created` status
- ✅ Response contains created document

**Actual Results:**
- [ ] Request to backend API: ✅ / ❌
- [ ] POST method: ✅ / ❌
- [ ] Authorization header: ✅ / ❌
- [ ] Request body format: ✅ / ❌
- [ ] Response status: [Code] ✅ / ❌

**Notes:**
_Record any issues_

---

### Test 2.5: Delete Knowledge Base Document

**Steps:**
1. Find a test document (or create one)
2. Click "Delete" button on the document
3. Confirm deletion (if confirmation dialog exists)
4. Check if document is removed from list

**Expected Results:**
- ✅ Document deleted successfully
- ✅ Document removed from list (or marked as inactive)
- ✅ Success message displayed (if implemented)
- ✅ Document cannot be accessed after deletion

**Actual Results:**
- [ ] Document deleted: ✅ / ❌
- [ ] Removed from list: ✅ / ❌
- [ ] Success message: ✅ / ❌ / N/A
- [ ] Access blocked: ✅ / ❌

**Network Request:**
```
Method: DELETE
URL: http://localhost:3001/api/knowledge-base/[document-id]
Status: [Code]
```

**Notes:**
_Record any issues with deletion_

---

### Test 2.6: Network Request Verification (DELETE)

**Steps:**
1. Delete a knowledge base document (from Test 2.5)
2. Check Network tab for DELETE request

**Expected Results:**
- ✅ Request is made to `/api/knowledge-base/:id` (not direct Supabase)
- ✅ Request method: DELETE
- ✅ Request includes `Authorization: Bearer <token>` header
- ✅ Request returns `200 OK` or `204 No Content` status

**Actual Results:**
- [ ] Request to backend API: ✅ / ❌
- [ ] DELETE method: ✅ / ❌
- [ ] Authorization header: ✅ / ❌
- [ ] Response status: [Code] ✅ / ❌

**Notes:**
_Record any issues_

---

## 🔒 Test Suite: Security & Rate Limiting

### Test 3.1: Rate Limiting Verification

**Steps:**
1. Make multiple rapid requests to `/api/calls-dashboard/stats` (10+ requests in < 15 seconds)
2. Check if rate limiting is enforced
3. Check backend logs for rate limit entries

**Expected Results:**
- ✅ After 100 requests in 15 minutes, rate limit is enforced
- ✅ Response returns `429 Too Many Requests` status
- ✅ Error message indicates rate limit exceeded
- ✅ Backend logs show rate limit entries

**Actual Results:**
- [ ] Rate limit enforced: ✅ / ❌ / Not tested
- [ ] Response status: [Code]
- [ ] Error message: [Message]
- [ ] Backend logs: ✅ / ❌

**Notes:**
_Record rate limit behavior (may need to adjust limit for testing)_

---

### Test 3.2: Cross-Tenant Isolation (RLS Verification)

**Steps:**
1. Login as User A (Org A)
2. Navigate to dashboard - note the data shown
3. Verify backend API returns only Org A's data
4. Check Network tab - verify API response doesn't contain Org B's data

**Expected Results:**
- ✅ Dashboard shows only Org A's calls
- ✅ Knowledge base shows only Org A's documents
- ✅ API responses filtered by `org_id` (enforced by middleware)
- ✅ RLS policies still work (database-level enforcement)

**Actual Results:**
- [ ] Only Org A data shown: ✅ / ❌
- [ ] API filtered by org_id: ✅ / ❌
- [ ] RLS policies working: ✅ / ❌

**Notes:**
_If possible, test with two different org accounts_

---

### Test 3.3: Authentication Required

**Steps:**
1. Clear authentication token (logout)
2. Attempt to access `/api/calls-dashboard/stats` directly (via curl/Postman)
3. Check response

**Expected Results:**
- ✅ Request returns `401 Unauthorized` status
- ✅ Error message indicates authentication required
- ✅ No data returned

**Actual Results:**
- [ ] 401 status: ✅ / ❌
- [ ] Error message: [Message]
- [ ] No data: ✅ / ❌

**Command Used:**
```bash
curl -X GET http://localhost:3001/api/calls-dashboard/stats
```

**Response:**
```json
[Paste response]
```

---

## 📊 Backend Logs Verification

### Test 4.1: Backend Request Logging

**Steps:**
1. Perform actions in frontend (dashboard load, KB operations)
2. Check backend logs (console or log file)

**Expected Results:**
- ✅ All API requests logged in backend
- ✅ Logs include: endpoint, method, org_id, user_id, timestamp
- ✅ No errors in backend logs related to new endpoints

**Actual Results:**
- [ ] Requests logged: ✅ / ❌
- [ ] Log format correct: ✅ / ❌
- [ ] No errors: ✅ / ❌

**Sample Log Entries:**
```
[Paste sample log entries]
```

---

## ✅ Test Results Summary

### Overall Status
- **Total Tests:** [Number]
- **Passed:** [Number]
- **Failed:** [Number]
- **Skipped:** [Number]
- **Pass Rate:** [Percentage]%

### Critical Issues Found
1. [Issue description] - [Severity: Critical/High/Medium/Low]
2. [Issue description] - [Severity]

### Non-Critical Issues Found
1. [Issue description] - [Severity]
2. [Issue description] - [Severity]

### Recommendations
- [ ] Fix critical issues before proceeding
- [ ] Address high-priority issues
- [ ] Document medium-priority issues for future fixes
- [ ] Low-priority issues can be deferred

---

## 📝 Notes and Observations

**General Notes:**
_Record any observations, edge cases discovered, or suggestions for improvement_

**Performance Observations:**
_Record response times, loading performance, etc._

**UI/UX Observations:**
_Record any UI issues, usability concerns, etc._

---

**Tested By:** [Name]  
**Date:** [Date]  
**Time:** [Time]  
**Environment:** Development / Staging / Production  

---

## ✅ Sign-Off

**Phase 1 Testing:** ✅ Complete / ❌ Incomplete  
**Ready for Production:** ✅ Yes / ❌ No / ⚠️ With Conditions  

**Conditions:**
_If "With Conditions", list what must be fixed before production_

---

**Next Steps:**
- [ ] Fix critical issues
- [ ] Re-test after fixes
- [ ] Proceed to Phase 2 (Index Optimization)
- [ ] Proceed to Phase 3 (RLS Test Suite Execution)
