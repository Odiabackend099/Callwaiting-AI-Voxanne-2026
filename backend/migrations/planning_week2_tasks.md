# 📋 Planning Document: Zero-Trust Warden Week 2 Tasks

**Date:** 2025-01-10  
**Context:** Zero-Trust Warden Week 2 - Secondary Hardening (P2-P3 Priority)  
**Status:** Planning Phase - Ready for Execution  

---

## Problem Statement

Week 1 critical fixes are complete. Three Week 2 optimizations remain to harden the system:

1. **Frontend Direct Database Queries** - 4 locations bypass backend API (rate limiting, business logic, audit logging)
2. **Missing Index Optimizations** - Some composite indexes don't include `org_id` as first column (performance issue)
3. **RLS Test Suite Execution** - Integration tests created but not executed/verified

**Why This Matters:**
- **Security:** Frontend queries bypass rate limiting and centralized auth validation (RLS protects, but architecture should enforce backend API)
- **Performance:** Indexes without `org_id` first are slower for multi-tenant queries
- **Quality:** Integration tests verify cross-tenant isolation works correctly

**Dependencies:**
- Week 1 complete (✅ Done)
- RLS policies deployed (✅ Done)
- `public.auth_org_id()` function exists (✅ Done)

**Assumptions:**
- Backend API routes exist or can be created
- Frontend code uses `authedBackendFetch` utility (already exists)
- Test database can be set up for integration tests
- No breaking changes to existing functionality

---

## Implementation Phases

### Phase 1: Frontend API Migration (P2 MEDIUM)
**Goal:** Migrate all frontend direct Supabase queries to backend API endpoints

#### Step 1.1: Audit and Document Frontend Direct Queries ✅
- **Status:** ✅ COMPLETE
- **Found Queries:**
  1. `src/app/dashboard/page.tsx` (line 65-68): Direct query to `call_logs` for dashboard stats
  2. `src/lib/supabaseHelpers.ts` (line 49): `getKnowledgeBase()` - Direct query to `knowledge_base`
  3. `src/lib/supabaseHelpers.ts` (line 61): `saveKnowledgeBase()` - Direct INSERT to `knowledge_base`
  4. `src/lib/supabaseHelpers.ts` (line 78): `deleteKnowledgeBase()` - Direct DELETE from `knowledge_base`

#### Step 1.2: Create/Verify Backend API Endpoints
- **Input:** Query requirements from Step 1.1
- **Output:** Backend API endpoints that match frontend needs

**Endpoints Required:**
1. **GET `/api/calls-dashboard/stats`** - Dashboard statistics
   - **Current State:** `GET /api/calls-dashboard/analytics/summary` exists (similar, may need adjustment)
   - **Required Response:** `{ totalCalls, inboundCalls, outboundCalls, completedCalls, callsToday, avgDuration, recentCalls[] }`
   
2. **GET `/api/knowledge-base`** - Get knowledge base documents
   - **Current State:** Needs verification
   
3. **POST `/api/knowledge-base`** - Create knowledge base document
   - **Current State:** Needs verification
   
4. **DELETE `/api/knowledge-base/:id`** - Delete knowledge base document
   - **Current State:** Needs verification

- **Acceptance Criteria:**
  - ✅ All endpoints exist and match frontend requirements
  - ✅ Endpoints use `requireAuth` middleware
  - ✅ Endpoints filter by `org_id` (via middleware)
  - ✅ Endpoints return expected response format

#### Step 1.3: Update Frontend Code
- **Input:** Backend API endpoints from Step 1.2
- **Output:** Updated frontend code using `authedBackendFetch`

**Files to Update:**
1. `src/app/dashboard/page.tsx`: Replace `supabase.from('call_logs')` with backend API
2. `src/lib/supabaseHelpers.ts`: Replace knowledge base queries with backend API

- **Acceptance Criteria:**
  - ✅ All direct queries replaced with backend API calls
  - ✅ Error handling preserved
  - ✅ Response format matches frontend expectations
  - ✅ No breaking changes to UI/UX

#### Step 1.4: Testing and Verification
- **Acceptance Criteria:**
  - ✅ All test scenarios pass
  - ✅ No console errors
  - ✅ Backend rate limiting logs show requests
  - ✅ RLS policies still work

---

### Phase 2: Index Optimization (P3 LOW)
**Goal:** Add `org_id` as first column in composite indexes for optimal multi-tenant query performance

#### Step 2.1: Audit Existing Indexes
- **Input:** Database schema
- **Output:** List of indexes that don't include `org_id` as first column

#### Step 2.2: Create Optimized Composite Indexes
- **Output:** Migration file with optimized indexes
- **Migration File:** `backend/migrations/20250110_optimize_indexes_org_id.sql`

#### Step 2.3: Verify Index Performance
- **Acceptance Criteria:**
  - ✅ Indexes are being used (idx_scan > 0 after queries)
  - ✅ Query performance improved
  - ✅ No redundant indexes created

---

### Phase 3: RLS Test Suite Execution (P2 MEDIUM)
**Goal:** Execute integration tests to verify cross-tenant isolation works correctly

#### Step 3.1: Set Up Test Environment
- **Requirements:**
  1. Test database configured
  2. Jest/Test framework configured
  3. Environment variables set
  4. Test data setup scripts created

#### Step 3.2: Execute Integration Tests
- **Test File:** `backend/tests/rls-cross-tenant-isolation.test.ts`

#### Step 3.3: Fix Test Failures (If Any)
#### Step 3.4: Document Test Results

---

## Testing Strategy

### Unit Tests
- Mock `authedBackendFetch` responses
- Test error handling
- Test response format transformation

### Integration Tests
- Full RLS test suite execution
- Verify all scenarios pass

### Manual Verification
- Dashboard loads correctly
- Knowledge base operations work
- Rate limiting enforced
- Error messages display correctly

---

## Success Criteria

### Phase 1: Frontend API Migration
- [ ] All 4 frontend direct queries migrated
- [ ] Backend API endpoints work correctly
- [ ] Frontend functionality unchanged
- [ ] Rate limiting enforced
- [ ] No console errors

### Phase 2: Index Optimization
- [ ] Frequently queried indexes include `org_id` first
- [ ] Query performance improved
- [ ] Index usage verified
- [ ] Migration applied successfully

### Phase 3: RLS Test Suite Execution
- [ ] Test environment configured
- [ ] All integration tests pass
- [ ] Test coverage > 80%
- [ ] Test results documented

---

## Timeline Estimate

- **Phase 1:** 2-3 days
- **Phase 2:** 1-2 days
- **Phase 3:** 1-2 days

**Total Estimate:** 4-7 days (sequential execution)

---

## Next Steps

1. ✅ Planning document created
2. Create TODO list
3. Begin Phase 1, Step 1.2 - Verify/Create backend endpoints
4. Execute Phase 1
5. Execute Phase 2
6. Execute Phase 3

**Status:** ✅ Planning Complete - Ready for Execution
