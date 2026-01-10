# Manual Verification Checklist - Cross-Tenant Isolation

**Date:** 2025-01-10  
**Purpose:** Manual testing guide for verifying tenant isolation  
**Context:** Post-audit verification after critical fixes  
**Status:** Ready for Execution

---

## PREREQUISITES

### Setup Requirements

1. **Backend Server Running:**
   ```bash
   cd backend
   npm run dev
   # Should be running on http://localhost:3001
   ```

2. **Frontend Server Running:**
   ```bash
   npm run dev
   # Should be running on http://localhost:3000
   ```

3. **Two Test Organizations:**
   - Organization A (Default Org: `a0000000-0000-0000-0000-000000000001`)
   - Organization B (Test Org: `b0000000-0000-0000-0000-000000000001`)

4. **Two Test Users:**
   - User A: Belongs to Organization A (has `org_id` in JWT `app_metadata`)
   - User B: Belongs to Organization B (has `org_id` in JWT `app_metadata`)

---

## VERIFICATION CHECKLIST

### Phase 1: Database Schema Verification

#### ✅ Check 1.1: org_id Columns Exist
- [ ] Run verification script: `backend/scripts/verify-database-schema.sql` in Supabase SQL Editor
- [ ] Verify all critical tables have `org_id` column:
  - [ ] `call_logs` has `org_id`
  - [ ] `calls` has `org_id`
  - [ ] `knowledge_base` has `org_id`
  - [ ] `leads` has `org_id`
  - [ ] `campaigns` has `org_id`
- [ ] **Expected Result:** All tables should show "✅ EXISTS" status

#### ✅ Check 1.2: No NULL org_id Values
- [ ] Run verification query from script
- [ ] Verify zero NULL `org_id` values in all tables
- [ ] **Expected Result:** All tables should show "✅ NO NULL VALUES"

#### ✅ Check 1.3: RLS Enabled
- [ ] Run verification query from script
- [ ] Verify RLS is enabled on all multi-tenant tables
- [ ] **Expected Result:** All tables should show "✅ ENABLED"

#### ✅ Check 1.4: RLS Policies Use SSOT Function
- [ ] Run verification query from script
- [ ] Verify all policies use `public.auth_org_id()` function
- [ ] **Expected Result:** All policies should show "✅ USES SSOT FUNCTION"

#### ✅ Check 1.5: Organizations Table Exists
- [ ] Verify `organizations` table exists
- [ ] Verify default organization exists: `a0000000-0000-0000-0000-000000000001`
- [ ] **Expected Result:** Table exists with at least 1 organization

---

### Phase 2: API Endpoint Verification

#### ✅ Check 2.1: Inbound Calls Endpoint Isolation

**As User A (Org A):**
- [ ] Get auth token from browser console:
  ```javascript
  // In browser console (logged in as User A)
  const { data: { session } } = await window.supabase.auth.getSession();
  console.log('Token:', session?.access_token);
  ```

- [ ] Call API endpoint:
  ```bash
  curl -H "Authorization: Bearer $ORG_A_TOKEN" \
    "http://localhost:3001/api/calls-dashboard?call_type=inbound&limit=100"
  ```

- [ ] **Expected Result:**
  - ✅ Returns 200 OK
  - ✅ Response contains only Org A's inbound calls
  - ✅ No Org B's calls in response
  - ✅ Response includes `pagination` object

**As User B (Org B):**
- [ ] Get auth token from browser console (logged in as User B)
- [ ] Call same API endpoint with User B token
- [ ] **Expected Result:**
  - ✅ Returns 200 OK
  - ✅ Response contains only Org B's inbound calls
  - ✅ No Org A's calls in response

#### ✅ Check 2.2: Inbound Call Detail Endpoint Isolation

**As User A:**
- [ ] Get Org A's call ID (from previous test)
- [ ] Call detail endpoint:
  ```bash
  curl -H "Authorization: Bearer $ORG_A_TOKEN" \
    "http://localhost:3001/api/calls-dashboard/$ORG_A_CALL_ID"
  ```
- [ ] **Expected Result:**
  - ✅ Returns 200 OK
  - ✅ Returns call details for Org A's call

- [ ] Try to access Org B's call ID:
  ```bash
  curl -H "Authorization: Bearer $ORG_A_TOKEN" \
    "http://localhost:3001/api/calls-dashboard/$ORG_B_CALL_ID"
  ```
- [ ] **Expected Result:**
  - ✅ Returns 404 (Not Found) or 403 (Forbidden)
  - ✅ Should NOT return Org B's call details

#### ✅ Check 2.3: Dashboard Stats Endpoint Isolation

**As User A:**
- [ ] Call stats endpoint:
  ```bash
  curl -H "Authorization: Bearer $ORG_A_TOKEN" \
    "http://localhost:3001/api/calls-dashboard/stats"
  ```
- [ ] **Expected Result:**
  - ✅ Returns 200 OK
  - ✅ `totalCalls` count matches only Org A's calls
  - ✅ `recentCalls` array contains only Org A's calls
  - ✅ No Org B's calls in any stats

**As User B:**
- [ ] Call same stats endpoint with User B token
- [ ] **Expected Result:**
  - ✅ Returns different stats (only Org B's calls)
  - ✅ Stats match only Org B's data

#### ✅ Check 2.4: Knowledge Base Endpoint Isolation

**As User A:**
- [ ] Call KB endpoint:
  ```bash
  curl -H "Authorization: Bearer $ORG_A_TOKEN" \
    "http://localhost:3001/api/knowledge-base"
  ```
- [ ] **Expected Result:**
  - ✅ Returns 200 OK
  - ✅ `items` array contains only Org A's KB documents
  - ✅ No Org B's KB documents in response

**As User B:**
- [ ] Call same KB endpoint with User B token
- [ ] **Expected Result:**
  - ✅ Returns only Org B's KB documents
  - ✅ No Org A's KB documents in response

#### ✅ Check 2.5: Unauthenticated Requests

- [ ] Call any endpoint without Authorization header:
  ```bash
  curl "http://localhost:3001/api/calls-dashboard/stats"
  ```
- [ ] **Expected Result:**
  - ✅ Returns 401 Unauthorized
  - ✅ Error message: "Missing or invalid Authorization header"

---

### Phase 3: Frontend UI Verification

#### ✅ Check 3.1: Dashboard Page Isolation

**As User A (logged in):**
- [ ] Navigate to `http://localhost:3000/dashboard`
- [ ] Verify dashboard loads correctly
- [ ] Check "Recent Calls" section:
  - [ ] Only shows Org A's calls
  - [ ] Does not show Org B's calls
- [ ] Check statistics cards:
  - [ ] `totalCalls` matches only Org A's data
  - [ ] `inboundCalls` matches only Org A's data
  - [ ] `outboundCalls` matches only Org A's data

**As User B (logged in):**
- [ ] Navigate to `http://localhost:3000/dashboard` (as User B)
- [ ] Verify dashboard shows different stats (only Org B's data)
- [ ] Verify no Org A's data appears

#### ✅ Check 3.2: Call Logs Page Isolation

**As User A:**
- [ ] Navigate to `http://localhost:3000/dashboard/calls`
- [ ] Switch to "Inbound" tab
- [ ] Verify call list shows only Org A's inbound calls
- [ ] Click on a call to view details
- [ ] Verify call detail modal shows correct data (Org A's call)

**As User B:**
- [ ] Navigate to same page (as User B)
- [ ] Verify call list shows only Org B's calls
- [ ] Verify no Org A's calls appear

#### ✅ Check 3.3: Knowledge Base Page Isolation

**As User A:**
- [ ] Navigate to `http://localhost:3000/dashboard/knowledge-base`
- [ ] Verify KB documents list shows only Org A's documents
- [ ] Try to create a new KB document
- [ ] Verify document is created with correct `org_id`

**As User B:**
- [ ] Navigate to same page (as User B)
- [ ] Verify KB documents list shows only Org B's documents
- [ ] Verify no Org A's documents appear

---

### Phase 4: Background Jobs Verification

#### ✅ Check 4.1: Orphan Recording Cleanup Job

- [ ] Check backend logs for orphan cleanup job execution:
  ```bash
  # In terminal where backend is running
  # Look for: "[OrphanCleanup] Processing X organizations"
  ```
- [ ] **Expected Result:**
  - ✅ Log shows processing each org separately
  - ✅ Log shows: "Org {orgId} cleanup: X deleted, Y failed"
  - ✅ Each org is processed in isolated batches

#### ✅ Check 4.2: Recording Queue Worker

- [ ] Check backend logs for queue worker execution:
  ```bash
  # Look for: "[RecordingQueueWorker] Processing queue for organizations"
  ```
- [ ] **Expected Result:**
  - ✅ Log shows processing each org separately
  - ✅ Log shows: "Found pending items for org {orgId}"
  - ✅ Each org's queue is processed separately

#### ✅ Check 4.3: Recording Upload Retry Job

- [ ] Check backend logs for retry job execution:
  ```bash
  # Look for: "[RecordingUploadRetry] Processing retry job for X organizations"
  ```
- [ ] **Expected Result:**
  - ✅ Log shows processing each org separately
  - ✅ Log shows: "Processing X failed uploads for org {orgId}"
  - ✅ Each org's failed uploads are processed separately

#### ✅ Check 4.4: Stale Cleanup Job

- [ ] Check backend logs for stale cleanup execution:
  ```bash
  # Look for: "[RecordingQueueWorker] Stale cleanup completed for all orgs"
  ```
- [ ] **Expected Result:**
  - ✅ Log shows: "Stale cleanup completed for all orgs"
  - ✅ Each org is processed separately

---

### Phase 5: Cross-Tenant Attack Simulation

#### ✅ Check 5.1: Attempt to Access Another Org's Call

**As User A:**
- [ ] Get Org B's call ID from database (using service role)
- [ ] Attempt to access via API:
  ```bash
  curl -H "Authorization: Bearer $ORG_A_TOKEN" \
    "http://localhost:3001/api/calls-dashboard/$ORG_B_CALL_ID"
  ```
- [ ] **Expected Result:**
  - ✅ Returns 404 (Not Found) or 403 (Forbidden)
  - ✅ Should NOT return Org B's call data

#### ✅ Check 5.2: Attempt to Create Call for Another Org

**As User A:**
- [ ] Attempt to create call with Org B's `org_id`:
  ```bash
  curl -X POST -H "Authorization: Bearer $ORG_A_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"org_id": "b0000000-0000-0000-0000-000000000001", "phone_number": "+15559999999"}' \
    "http://localhost:3001/api/calls-dashboard"
  ```
- [ ] **Expected Result:**
  - ✅ Request should be rejected or org_id should be overridden from JWT
  - ✅ Should NOT allow creating data for another org

#### ✅ Check 5.3: Attempt to Query Without org_id Filter

- [ ] Check backend code for any queries that might bypass `org_id` filter
- [ ] Review recent changes in `calls-dashboard.ts`:
  - [ ] Verify inbound calls query has `.eq('org_id', orgId)`
  - [ ] Verify inbound call detail query has `.eq('org_id', orgId)`
- [ ] **Expected Result:**
  - ✅ All queries include `org_id` filter
  - ✅ No queries bypass tenant isolation

---

## TEST DATA SETUP

### Creating Test Organizations

If test organizations don't exist, create them in Supabase SQL Editor:

```sql
-- Create test organization B
INSERT INTO organizations (id, name, status)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Test Organization B', 'active')
ON CONFLICT (id) DO NOTHING;
```

### Creating Test Users

Create test users via Supabase Auth Admin API or dashboard:

1. **User A (Org A):**
   - Email: `test-org-a@example.com`
   - Password: `TestPassword123!`
   - `app_metadata.org_id`: `a0000000-0000-0000-0000-000000000001`

2. **User B (Org B):**
   - Email: `test-org-b@example.com`
   - Password: `TestPassword123!`
   - `app_metadata.org_id`: `b0000000-0000-0000-0000-000000000001`

### Creating Test Data

Run this in Supabase SQL Editor (as service role):

```sql
-- Create test call_logs for Org A
INSERT INTO call_logs (vapi_call_id, org_id, call_type, phone_number, caller_name, status, recording_storage_path)
VALUES 
  ('test-call-org-a-1', 'a0000000-0000-0000-0000-000000000001', 'inbound', '+15551111111', 'Test Caller A1', 'completed', 'test/path/a1.wav'),
  ('test-call-org-a-2', 'a0000000-0000-0000-0000-000000000001', 'inbound', '+15551111112', 'Test Caller A2', 'completed', 'test/path/a2.wav');

-- Create test call_logs for Org B
INSERT INTO call_logs (vapi_call_id, org_id, call_type, phone_number, caller_name, status, recording_storage_path)
VALUES 
  ('test-call-org-b-1', 'b0000000-0000-0000-0000-000000000001', 'inbound', '+15552222221', 'Test Caller B1', 'completed', 'test/path/b1.wav'),
  ('test-call-org-b-2', 'b0000000-0000-0000-0000-000000000001', 'inbound', '+15552222222', 'Test Caller B2', 'completed', 'test/path/b2.wav');
```

---

## EXPECTED RESULTS SUMMARY

### ✅ All Checks Should Pass

- ✅ Database schema has all required `org_id` columns
- ✅ Zero NULL `org_id` values
- ✅ RLS enabled on all multi-tenant tables
- ✅ RLS policies use SSOT function
- ✅ API endpoints filter by `org_id` correctly
- ✅ Frontend shows only user's org data
- ✅ Background jobs process per-org separately
- ✅ Cross-tenant access attempts are blocked

### ❌ If Any Check Fails

1. **Document the failure:**
   - Which check failed?
   - What was the actual result?
   - What was the expected result?

2. **Identify the root cause:**
   - Is it a code issue?
   - Is it a schema issue?
   - Is it a configuration issue?

3. **Fix the issue:**
   - Apply necessary fixes
   - Re-run the failed check
   - Verify fix resolves the issue

4. **Update documentation:**
   - Document the issue and resolution
   - Update verification checklist if needed

---

## SIGN-OFF

### Verification Complete

- [ ] All Phase 1 checks passed (Database Schema)
- [ ] All Phase 2 checks passed (API Endpoints)
- [ ] All Phase 3 checks passed (Frontend UI)
- [ ] All Phase 4 checks passed (Background Jobs)
- [ ] All Phase 5 checks passed (Attack Simulation)

### Ready for Production

- [ ] All critical fixes verified working
- [ ] No cross-tenant data leakage detected
- [ ] All endpoints enforce tenant isolation
- [ ] All background jobs process per-org
- [ ] Manual testing complete

**Status:** [ ] ✅ PASSED | [ ] ❌ FAILED | [ ] ⚠️ PARTIAL

**Notes:**
```
[Document any issues found or notes here]
```

**Signed:** ________________  
**Date:** ________________
