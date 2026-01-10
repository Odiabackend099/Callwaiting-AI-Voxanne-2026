# 📋 Planning: Update RLS Policies to Use org_id (SSOT)

**Date:** 2025-01-10  
**Task:** Update existing RLS policies from user_id-based to org_id-based isolation  
**Context:** Zero-Trust Warden Phase 1 - RLS Policy Update for SSOT  
**Status:** Planning Phase

---

## Problem Statement

**Current State:**
- RLS is enabled on key tables (call_logs, calls, leads, knowledge_base, campaigns, campaign_leads, contacts)
- RLS policies use `user_id = auth.uid()` pattern (user-based isolation)
- Policies are NOT using `org_id = public.auth_org_id()` pattern (org-based isolation)

**Target State:**
- RLS policies use `org_id = (SELECT public.auth_org_id())` pattern
- Database-level tenant isolation enforced via org_id (SSOT)
- Multi-tenant org-based model enforced at database level

**Why This Matters:**
- Current policies allow users to only see their own data (user-based)
- After org_id migration, policies should allow users to see their org's data (org-based)
- Supports future multi-user organizations (clinic teams)
- Enforces SSOT at database level (cannot be bypassed by application bugs)

---

## Implementation Phases

### Phase 1: Audit Current RLS Policies (Discovery)

**Goal:** Document all existing RLS policies and identify which need updating

**Steps:**
1. Query all RLS policies from database
2. Categorize policies by isolation pattern:
   - `user_id = auth.uid()` (needs update)
   - `org_id = ...` (already correct)
   - `auth.role() = 'authenticated'` (too permissive, needs org_id)
   - Service role bypasses (keep as-is, but note)
3. Identify critical tables that need org_id-based policies

**Acceptance Criteria:**
- ✅ Complete list of all RLS policies
- ✅ Policies categorized by update priority (critical vs secondary)
- ✅ Tables identified that need org_id-based policies

**Status:** ✅ **COMPLETE** (from initial SQL query)

**Findings:**
- **call_logs:** Uses `auth.role() = 'authenticated'` (too permissive, needs org_id)
- **calls:** Uses service role bypass (needs org_id policy for authenticated users)
- **campaigns:** Uses `user_id = auth.uid()` (needs update to org_id)
- **contacts:** Uses `user_id = auth.uid()` (needs update to org_id)
- **knowledge_base:** Uses `user_id = auth.uid()` (needs update to org_id)
- **leads:** Uses `user_id = auth.uid()` (needs update to org_id)
- **campaign_leads:** Uses `auth.role() = 'authenticated'` (too permissive, needs org_id)

---

### Phase 2: Create org_id-Based RLS Policies (Implementation)

**Goal:** Create new RLS policies using `org_id = (SELECT public.auth_org_id())` pattern

**Strategy:**
- **Option A:** Drop old policies and create new ones (clean slate)
- **Option B:** Keep old policies as fallback, add new org_id policies (gradual migration)
- **Option C:** Update existing policies in-place (risky, may break)

**Recommended:** Option A (drop and recreate) for critical tables, Option B for gradual migration

**Acceptance Criteria:**
- ✅ New org_id-based policies created for all org-scoped tables
- ✅ Policies use `org_id = (SELECT public.auth_org_id())` pattern
- ✅ Service role bypasses preserved (for background jobs)
- ✅ Policies tested and verified

---

### Phase 3: Test Cross-Tenant Isolation (Verification)

**Goal:** Verify that RLS policies prevent cross-tenant data leakage

**Test Scenarios:**
1. User from Org A cannot SELECT data from Org B
2. User from Org A cannot INSERT data for Org B
3. User from Org A cannot UPDATE data from Org B
4. User from Org A cannot DELETE data from Org B
5. Service role can access all orgs' data (for background jobs)

**Acceptance Criteria:**
- ✅ All test scenarios pass
- ✅ Zero cross-tenant data leakage possible
- ✅ Service role queries work correctly (with explicit org_id filtering)

---

## Implementation Plan

### Critical Tables (Update First):
1. **call_logs** - Replace `auth.role() = 'authenticated'` with `org_id = (SELECT public.auth_org_id())`
2. **calls** - Add org_id policy for authenticated users (currently only service role)
3. **campaigns** - Replace `user_id = auth.uid()` with `org_id = (SELECT public.auth_org_id())`
4. **contacts** - Replace `user_id = auth.uid()` with `org_id = (SELECT public.auth_org_id())`
5. **knowledge_base** - Replace `user_id = auth.uid()` with `org_id = (SELECT public.auth_org_id())`
6. **leads** - Replace `user_id = auth.uid()` with `org_id = (SELECT public.auth_org_id())`
7. **campaign_leads** - Replace `auth.role() = 'authenticated'` with `org_id = (SELECT public.auth_org_id())`

### Secondary Tables (Update After):
- All other org-scoped tables with existing RLS policies

---

## RLS Policy Template

### Standard org_id Policy (SELECT/UPDATE/DELETE):
```sql
-- Users can only SELECT/UPDATE/DELETE their org's data
CREATE POLICY "{table}_org_isolation"
ON {table}
FOR SELECT, UPDATE, DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));
```

### Standard org_id Policy (INSERT):
```sql
-- Users can only INSERT data for their org
CREATE POLICY "{table}_org_insert"
ON {table}
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));
```

### Service Role Bypass (Keep Existing):
```sql
-- Service role can access all orgs' data (for background jobs)
CREATE POLICY "{table}_service_role_bypass"
ON {table}
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

## Migration Strategy

### Step 1: Drop Old Policies (Critical Tables)
```sql
-- Drop old user_id-based or permissive policies
DROP POLICY IF EXISTS "Users can view all call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can insert call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can update call logs" ON call_logs;
-- ... (repeat for all tables)
```

### Step 2: Create New org_id-Based Policies
```sql
-- Create new org_id-based policies
CREATE POLICY "call_logs_org_isolation"
ON call_logs
FOR SELECT, UPDATE, DELETE
TO authenticated
USING (org_id = (SELECT public.auth_org_id()));

CREATE POLICY "call_logs_org_insert"
ON call_logs
FOR INSERT
TO authenticated
WITH CHECK (org_id = (SELECT public.auth_org_id()));
-- ... (repeat for all tables)
```

### Step 3: Verify Policies Work
```sql
-- Test as authenticated user from Org A:
SELECT * FROM call_logs;
-- Should only return Org A's data

-- Test cross-tenant access (should return empty):
SELECT * FROM call_logs WHERE org_id = 'different-org-id';
-- Should return empty (RLS blocks it)
```

---

## Risk Assessment

**Risk 1: Breaking Existing Queries**
- **Mitigation:** Keep old policies during transition (gradual migration)
- **Impact:** Some queries may need to be updated to use org_id

**Risk 2: Service Role Queries Broken**
- **Mitigation:** Service role bypass policies are preserved
- **Impact:** None (service role still has full access)

**Risk 3: Performance Degradation**
- **Mitigation:** `public.auth_org_id()` is STABLE (Postgres can cache during request)
- **Impact:** Minimal (function is optimized for RLS use)

**Risk 4: Users Lose Access to Their Data**
- **Mitigation:** Test policies thoroughly before deployment
- **Impact:** Critical - must verify all users have org_id in JWT before deploying

---

## Testing Strategy

### Unit Tests (Per Table):
1. Test SELECT policy (returns only org's data)
2. Test INSERT policy (requires org_id match)
3. Test UPDATE policy (only org's data can be updated)
4. Test DELETE policy (only org's data can be deleted)
5. Test service role bypass (has full access)

### Integration Tests:
1. User from Org A cannot access Org B's data
2. User from Org A cannot create data for Org B
3. Service role can access all orgs' data
4. `public.auth_org_id()` returns correct org_id from JWT

---

## Success Criteria

- [x] Planning document created ✅
- [ ] Phase 1: All RLS policies audited
- [ ] Phase 2: org_id-based policies created for critical tables
- [ ] Phase 3: Cross-tenant isolation tests pass
- [ ] All test scenarios verified
- [ ] No regressions introduced
- [ ] Documentation updated

---

**Status:** Planning Complete ✅  
**Next Step:** Begin Phase 1 - Create migration to update RLS policies
