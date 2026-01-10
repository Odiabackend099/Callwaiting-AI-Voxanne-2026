# 🚨 Warden Deployment Status - Critical Schema Mismatch Resolved

**Date:** 2025-01-10  
**Status:** ⚠️ PARTIAL - Foundation Migrations Applied, Full Warden Fixes Pending  
**Blocker:** Schema Mismatch (RESOLVED for Foundation)

---

## ✅ COMPLETED DEPLOYMENTS

### ✅ Migration 1: Organizations Table Foundation
**File:** `backend/migrations/20250110_create_organizations_table_foundation.sql`  
**Status:** ✅ **APPLIED SUCCESSFULLY**  
**Date:** 2025-01-10

**What Was Created:**
- `organizations` table (foundation for multi-tenant model)
- Default organization (`a0000000-0000-0000-0000-000000000001`)
- `updated_at` trigger for organizations table

**Impact:**
- Code can now query `organizations` table (no more "table doesn't exist" errors)
- Foundation established for org-based multi-tenant model

---

### ✅ Migration 2: auth_org_id() Function
**File:** `backend/migrations/20250110_create_auth_org_id_function.sql` (CORRECTED)  
**Status:** ✅ **APPLIED SUCCESSFULLY**  
**Date:** 2025-01-10

**What Was Created:**
- `public.auth_org_id()` function (extracts org_id from JWT `app_metadata`)
- Function in `public` schema (not `auth` - Supabase reserved schema)
- Granted execute permissions to `authenticated` and `service_role` roles

**Impact:**
- RLS policies can now use `(SELECT public.auth_org_id())` to filter by tenant
- Database-level tenant isolation via JWT claims is now possible

**Important Note:**
- Function name is `public.auth_org_id()` (not `auth.org_id()`)
- RLS policies must use `(SELECT public.auth_org_id())` syntax
- This is functionally equivalent to the intended `auth.org_id()` design

---

## ⚠️ PENDING DEPLOYMENTS (BLOCKED)

### ⚠️ Migration 3: org_id Immutability Triggers
**File:** `backend/migrations/20250110_create_org_id_immutability_triggers.sql`  
**Status:** ⚠️ **BLOCKED - Cannot Apply Yet**  
**Reason:** Target tables don't have `org_id` columns yet

**Blocking Dependencies:**
1. ❌ `call_logs` table has no `org_id` column
2. ❌ `call_tracking` table has no `org_id` column  
3. ❌ `calls` table has no `org_id` column
4. ❌ `leads` table has no `org_id` column (has `user_id` instead)
5. ❌ `agents` table has no `org_id` column
6. ❌ `knowledge_base` table has no `org_id` column (has `user_id` instead)
7. ❌ All other org-scoped tables missing `org_id` columns

**Required Before Deployment:**
- Add `org_id` columns to all target tables
- Backfill `org_id` from existing `user_id` data (1:1 mapping)
- Update foreign key constraints to reference `organizations(id)`
- Ensure NOT NULL constraints are applied

---

## 🔴 CRITICAL SCHEMA MISMATCH (PARTIALLY RESOLVED)

### Discovery:
The database schema was found to be **user-based** (single-tenant per user), while the code expects **org-based** (multi-tenant per organization).

**Database Has:**
- `user_id` columns (FK to `auth.users.id`)
- NO `org_id` columns
- NO `organizations` table (NOW CREATED ✅)

**Code Expects:**
- `org_id` columns (FK to `organizations.id`)
- `organizations` table (NOW EXISTS ✅)
- JWT `app_metadata.org_id` claim

### Resolution Progress:
1. ✅ **FIXED:** Created `organizations` table (foundation migration applied)
2. ✅ **FIXED:** Created `auth_org_id()` function (can now extract org_id from JWT)
3. ⚠️ **PENDING:** Add `org_id` columns to all tables
4. ⚠️ **PENDING:** Backfill `org_id` from `user_id` (1:1 mapping)
5. ⚠️ **PENDING:** Update JWT `app_metadata` for all users to include `org_id`

---

## 📋 NEXT STEPS (Priority Order)

### 🚨 Priority 1: Add org_id Columns to Existing Tables (REQUIRED)
**Before:** Immutability triggers can be applied  
**Timeline:** Day 1-2

**Required Migration:**
```sql
-- Migration: 20250110_add_org_id_to_existing_tables.sql
ALTER TABLE call_logs ADD COLUMN org_id UUID;
ALTER TABLE call_tracking ADD COLUMN org_id UUID;
ALTER TABLE calls ADD COLUMN org_id UUID;
ALTER TABLE leads ADD COLUMN org_id UUID;
-- ... (all other tables)
```

**Foreign Key Constraints:**
```sql
ALTER TABLE call_logs ADD CONSTRAINT fk_call_logs_org 
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
-- ... (all other tables)
```

---

### 🚨 Priority 2: Backfill org_id from user_id (REQUIRED)
**Before:** System can operate with org-based model  
**Timeline:** Day 2-3

**Strategy:**
- Map each `user_id` to default organization initially (1:1 mapping)
- Later, allow multiple users per organization (clinic teams)
- For now: `user_id` → `default_org_id` mapping

**Migration:**
```sql
-- For tables with user_id, map to default org
UPDATE call_logs SET org_id = 'a0000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE campaigns SET org_id = 'a0000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
-- ... (all other tables)
```

---

### 🚨 Priority 3: Update JWT app_metadata (REQUIRED)
**Before:** `auth_org_id()` function can return org_id  
**Timeline:** Day 3-4

**Required Script:**
```typescript
// For each user in auth.users:
supabase.auth.admin.updateUserById(userId, {
  app_metadata: { 
    org_id: 'a0000000-0000-0000-0000-000000000001' // Default org for now
  }
});
```

**Verification:**
```sql
-- Test in Supabase SQL Editor (authenticated as a user):
SELECT auth.uid();  -- Should return UUID
SELECT public.auth_org_id(); -- Should return org_id from app_metadata
```

---

### 🚨 Priority 4: Deploy Immutability Triggers (REQUIRED)
**Before:** Full Warden Week 1 completion  
**Timeline:** Day 4-5 (after org_id columns exist)

**Migration:**
- Apply `20250110_create_org_id_immutability_triggers.sql`
- Verify triggers work (attempt UPDATE that changes org_id → should fail)
- Verify normal UPDATEs work (changing other columns → should succeed)

---

## ✅ CODE FIXES (Already Applied - Not Deployed to Production Yet)

### ✅ Auth Middleware Fix (P0 CRITICAL)
**File:** `backend/src/middleware/auth.ts`  
**Status:** ✅ **CODE UPDATED** (not yet deployed to production)

**Changes:**
- Prioritizes `app_metadata.org_id` over `user_metadata.org_id`
- All 3 auth functions updated

**Deployment:** Requires backend deployment (not a migration)

---

### ✅ WebSocket Auth Fix (P1 HIGH)
**File:** `backend/src/server.ts`  
**Status:** ✅ **CODE UPDATED** (not yet deployed to production)

**Changes:**
- Removed query param fallback (`userId` query param)
- Enforces JWT-only authentication
- Uses `app_metadata.org_id` for tenant resolution

**Deployment:** Requires backend deployment (not a migration)

---

### ✅ Service Role Query Fixes (P1 HIGH)
**Files:**
- `backend/src/jobs/orphan-recording-cleanup.ts` ✅
- `backend/src/jobs/recording-queue-worker.ts` ✅

**Status:** ✅ **CODE UPDATED** (not yet deployed to production)

**Changes:**
- Added explicit `org_id` filtering to service role queries
- Processes per-org in isolated batches

**Deployment:** Requires backend deployment (not a migration)

---

## 🧪 TESTING CHECKLIST (After Full Deployment)

### Database-Level Tests:
- [ ] Test `public.auth_org_id()` returns org_id from JWT
- [ ] Test immutability triggers block org_id changes
- [ ] Test immutability triggers allow other column updates
- [ ] Test RLS policies use `(SELECT public.auth_org_id())` correctly

### Application-Level Tests:
- [ ] Test auth middleware extracts org_id from `app_metadata`
- [ ] Test users cannot access other orgs' data
- [ ] Test WebSocket auth requires JWT token (no query param fallback)
- [ ] Test background jobs filter by org_id correctly

### Integration Tests:
- [ ] Test cross-tenant data leakage is impossible
- [ ] Test service role queries respect org_id boundaries
- [ ] Test JWT org_id changes don't affect existing sessions

---

## 📊 DEPLOYMENT SUMMARY

| Component | Status | Blocker |
|-----------|--------|---------|
| Organizations table | ✅ Deployed | None |
| auth_org_id() function | ✅ Deployed | None |
| org_id columns | ⚠️ Pending | Needs migration |
| org_id backfill | ⚠️ Pending | Needs org_id columns first |
| JWT app_metadata update | ⚠️ Pending | Needs script execution |
| Immutability triggers | ⚠️ Blocked | Needs org_id columns first |
| Auth middleware code | ✅ Updated | Needs backend deployment |
| WebSocket auth code | ✅ Updated | Needs backend deployment |
| Service role query fixes | ✅ Updated | Needs backend deployment |

---

## ⚡ QUICK START GUIDE (For Next Engineer)

### Step 1: Apply org_id Column Migration
```bash
# Create migration file: 20250110_add_org_id_to_existing_tables.sql
# Add org_id UUID columns to all tables
# Apply in Supabase SQL Editor
```

### Step 2: Backfill org_id Data
```bash
# Create migration file: 20250110_backfill_org_id_from_user_id.sql
# Map user_id → default_org_id (1:1 mapping)
# Apply in Supabase SQL Editor
```

### Step 3: Update JWT app_metadata
```bash
# Run script: backend/scripts/update-user-org-metadata.ts
# Updates all users' app_metadata to include org_id
```

### Step 4: Apply Immutability Triggers
```bash
# Apply migration: 20250110_create_org_id_immutability_triggers.sql
# Verify triggers work (test UPDATE statements)
```

### Step 5: Deploy Backend Code
```bash
# Deploy updated backend code (auth middleware, WebSocket, background jobs)
# Test in staging first, then production
```

---

## 🚨 CRITICAL NOTES

1. **Function Name:** The function is `public.auth_org_id()` (not `auth.org_id()`). All RLS policies must use this name.

2. **Schema Mismatch:** The database still uses `user_id` in many tables. We need to add `org_id` columns and backfill data before triggers can be applied.

3. **Backward Compatibility:** Default organization was created (`a0000000-0000-0000-0000-000000000001`) to allow 1:1 user→org mapping during transition.

4. **Production Deployment:** Code fixes are ready but NOT deployed to production. Backend needs to be deployed after migrations are complete.

---

## 📝 FILES MODIFIED (This Session)

1. ✅ `backend/migrations/20250110_create_organizations_table_foundation.sql` (NEW, APPLIED)
2. ✅ `backend/migrations/20250110_create_auth_org_id_function.sql` (UPDATED, APPLIED)
3. ✅ `backend/migrations/20250110_create_org_id_immutability_triggers.sql` (UPDATED, PENDING)
4. ✅ `WARDEN_SCHEMA_MISMATCH_CRITICAL.md` (NEW - Audit Report)
5. ✅ `WARDEN_DEPLOYMENT_STATUS.md` (NEW - This Document)

---

**Next Action Required:** Create and apply migration to add `org_id` columns to existing tables.

**Timeline to Full Warden Week 1 Completion:** 2-3 days (after org_id columns are added)

---

**Signed,**  
**The Zero-Trust Warden**  
*Foundation Deployed - Schema Migration In Progress*
