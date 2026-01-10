# Verification Execution Guide

**Date:** 2025-01-10  
**Purpose:** Step-by-step guide to execute all verification phases  
**Context:** Post-audit verification after critical fixes  
**Status:** Ready to Execute

---

## 📋 PHASE 1: Database Schema Verification

### Method 1: Run SQL Script (Recommended)

**Step 1:** Open Supabase SQL Editor
- Navigate to your Supabase project dashboard
- Go to SQL Editor
- Click "New Query"

**Step 2:** Run Verification Script
- Copy contents of `backend/scripts/verify-database-schema.sql`
- Paste into SQL Editor
- Click "Run" (or press Ctrl+Enter)
- Review results

**Expected Results:**
- ✅ All critical tables have `org_id` column
- ✅ Zero NULL `org_id` values
- ✅ RLS enabled on all multi-tenant tables
- ✅ RLS policies use `public.auth_org_id()` function
- ✅ `organizations` table exists with default org
- ✅ Required indexes exist

### Method 2: Run TypeScript Verification Script

**Step 1:** Ensure environment variables are set
```bash
cd backend
# Verify .env file has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

**Step 2:** Run verification script
```bash
npx tsx scripts/run-database-verification.ts
```

**Expected Output:**
```
🚀 Starting Database Schema Verification...
============================================================
📋 VERIFICATION 1: Checking org_id Columns...
   ✅ PASS: All required tables have org_id column
📋 VERIFICATION 2: Checking for NULL org_id Values...
   ✅ PASS: No NULL org_id values found
📋 VERIFICATION 3: Checking RLS Enabled...
   ✅ PASS: RLS is enabled on all tables
📋 VERIFICATION 4: Checking Organizations Table...
   ✅ PASS: Organizations table exists with X org(s)
📋 VERIFICATION 5: Checking auth_org_id() Function...
   ✅ PASS: Function exists

📊 VERIFICATION REPORT SUMMARY
✅ Passed: 5
❌ Failed: 0
⚠️  Warnings: 0
```

---

## 📋 PHASE 2: Integration Tests - Cross-Tenant Isolation

### Prerequisites

1. **Backend server running:**
   ```bash
   cd backend
   npm run dev
   # Should be running on http://localhost:3001
   ```

2. **Environment variables set:**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BACKEND_URL` (optional, defaults to http://localhost:3001)

### Run Tests

**Option 1: Run RLS Tests (Database-Level)**
```bash
cd backend
npm test -- rls-cross-tenant-isolation.test.ts
```

**Expected Results:**
```
✅ should allow Org A user to SELECT their own org campaigns
✅ should prevent Org A user from SELECTING Org B campaigns
✅ should prevent Org A user from INSERTING campaign for Org B
✅ should prevent Org A user from UPDATING Org B campaign
✅ should allow Org A user to SELECT their own org leads
✅ should prevent Org A user from SELECTING Org B leads
✅ should allow Org A user to SELECT their own org call logs
✅ should prevent Org A user from SELECTING Org B call logs
✅ should allow Org A user to SELECT their own org knowledge base
✅ should prevent Org A user from SELECTING Org B knowledge base
```

**Option 2: Run API Tests (Application-Level)**
```bash
cd backend
npm test -- api-cross-tenant-isolation.test.ts
```

**Expected Results:**
```
✅ should allow Org A user to see their own inbound calls
✅ should prevent Org A user from seeing Org B inbound calls
✅ should allow Org A user to access their own inbound call details
✅ should prevent Org A user from accessing Org B inbound call details
✅ should return stats only for Org A calls
✅ should allow Org A user to see their own KB documents
✅ should prevent Org A user from seeing Org B KB documents
✅ should reject unauthenticated requests
```

**Note:** These tests require:
- Backend server running
- Test data to be created (tests handle this automatically)
- Multiple organizations to exist (tests create Test Org B automatically)

---

## 📋 PHASE 3: Manual Verification

### Quick Manual Test Checklist

**1. Test Inbound Calls Endpoint (5 minutes)**
- [ ] Get auth token from browser console (as Org A user)
- [ ] Call: `GET /api/calls-dashboard?call_type=inbound`
- [ ] Verify: Only Org A's calls returned
- [ ] Repeat as Org B user
- [ ] Verify: Only Org B's calls returned

**2. Test Call Detail Endpoint (5 minutes)**
- [ ] As Org A user, try to access Org B's call ID
- [ ] Verify: Returns 404 (Not Found)
- [ ] As Org A user, access Org A's call ID
- [ ] Verify: Returns 200 OK with call details

**3. Test Dashboard Stats (5 minutes)**
- [ ] As Org A user, call: `GET /api/calls-dashboard/stats`
- [ ] Verify: Stats match only Org A's data
- [ ] Repeat as Org B user
- [ ] Verify: Different stats (only Org B's data)

**4. Test Knowledge Base Endpoint (5 minutes)**
- [ ] As Org A user, call: `GET /api/knowledge-base`
- [ ] Verify: Only Org A's KB documents returned
- [ ] Repeat as Org B user
- [ ] Verify: Only Org B's KB documents returned

**5. Test Frontend UI (10 minutes)**
- [ ] Login as Org A user → Navigate to `/dashboard/calls`
- [ ] Verify: Only Org A's calls visible
- [ ] Login as Org B user → Navigate to `/dashboard/calls`
- [ ] Verify: Only Org B's calls visible (different from Org A)

**Total Time:** ~30 minutes

---

## 📋 PHASE 4: Background Jobs Verification

### Check Logs for Per-Org Processing

**1. Orphan Recording Cleanup:**
```bash
# In backend logs, look for:
grep "OrphanCleanup" backend.log | grep "Processing"
# Expected: "Processing X organizations" followed by per-org processing
```

**2. Recording Queue Worker:**
```bash
grep "RecordingQueueWorker" backend.log | grep "org"
# Expected: "Found pending items for org {orgId}" (one per org)
```

**3. Recording Upload Retry:**
```bash
grep "RecordingUploadRetry" backend.log | grep "Processing"
# Expected: "Processing retry job for X organizations" followed by per-org processing
```

**4. Stale Cleanup:**
```bash
grep "Stale cleanup" backend.log | grep "org"
# Expected: "Stale cleanup completed for all orgs" with per-org processing
```

---

## 📋 VERIFICATION RESULTS DOCUMENTATION

### After Running All Phases

Create a verification report with:

1. **Database Schema Verification Results:**
   - ✅/❌ Status for each check
   - Any issues found
   - Resolution steps if issues found

2. **Integration Test Results:**
   - Test pass/fail counts
   - Any failing tests
   - Test output logs

3. **Manual Verification Results:**
   - Checklist completion status
   - Any issues found during manual testing
   - Screenshots (if applicable)

4. **Background Jobs Verification:**
   - Log excerpts showing per-org processing
   - Any errors or warnings

5. **Overall Assessment:**
   - ✅ Ready for Production
   - ⚠️  Ready with Warnings
   - ❌ Not Ready (Issues Found)

---

## QUICK START (All Phases in One Go)

### Automated Verification (Recommended)

```bash
# 1. Database Schema Verification (SQL Script)
# Run in Supabase SQL Editor: backend/scripts/verify-database-schema.sql

# 2. Integration Tests (Jest)
cd backend
npm test -- rls-cross-tenant-isolation.test.ts
npm test -- api-cross-tenant-isolation.test.ts

# 3. Manual Verification (Follow Checklist)
# Use: MANUAL_VERIFICATION_CHECKLIST.md

# 4. Background Jobs (Check Logs)
# Monitor backend logs for per-org processing messages
```

### Manual Verification (If Tests Fail)

```bash
# Get auth tokens
# In browser console (logged in as Org A):
const { data: { session } } = await window.supabase.auth.getSession();
console.log('Org A Token:', session?.access_token);

# Test API endpoints
curl -H "Authorization: Bearer $ORG_A_TOKEN" \
  http://localhost:3001/api/calls-dashboard?call_type=inbound

# Verify response only contains Org A's calls
```

---

## TROUBLESHOOTING

### If Database Verification Fails

**Issue:** Missing `org_id` columns
- **Fix:** Apply migration: `backend/migrations/20250110_add_org_id_to_existing_tables.sql`

**Issue:** NULL `org_id` values
- **Fix:** Apply migration: `backend/migrations/20250110_backfill_org_id_from_user_id.sql`

**Issue:** RLS not enabled
- **Fix:** Enable RLS on tables: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`

**Issue:** RLS policies don't use SSOT function
- **Fix:** Apply migration: `backend/migrations/20250110_update_rls_policies_to_org_id.sql`

### If Integration Tests Fail

**Issue:** Tests fail with "Missing SUPABASE_URL"
- **Fix:** Create `.env` file in `backend/` directory with required variables

**Issue:** Tests fail with "User not found"
- **Fix:** Tests create test users automatically, but verify service role key has admin permissions

**Issue:** Tests fail with "Call log not found"
- **Fix:** Tests create test data automatically, verify test data creation in `beforeAll`

### If Manual Verification Fails

**Issue:** Org A user can see Org B's data
- **Fix:** Verify `org_id` filter is applied in query (check recent fixes)
- **Fix:** Verify RLS policies are active

**Issue:** API returns 401 for authenticated requests
- **Fix:** Verify JWT token is valid and includes `org_id` in `app_metadata`
- **Fix:** Verify auth middleware is working correctly

---

## SUCCESS CRITERIA

### ✅ All Phases Must Pass

- [ ] Phase 1: All database verification checks pass
- [ ] Phase 2: All integration tests pass
- [ ] Phase 3: All manual verification checklist items pass
- [ ] Phase 4: Background jobs process per-org correctly

### ✅ Production Readiness

- [ ] No cross-tenant data leakage detected
- [ ] All endpoints enforce tenant isolation
- [ ] All background jobs process per-org
- [ ] RLS policies active and working
- [ ] No critical security issues found

**Status:** [ ] ✅ READY | [ ] ⚠️ READY WITH WARNINGS | [ ] ❌ NOT READY

---

**Next Steps After Verification:**
1. If all checks pass → Deploy to production
2. If warnings found → Review and fix warnings
3. If failures found → Fix issues and re-run verification
