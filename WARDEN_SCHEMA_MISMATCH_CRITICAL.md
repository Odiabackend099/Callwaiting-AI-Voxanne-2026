# 🚨 CRITICAL: Schema Mismatch Between Code and Database

**Date:** 2025-01-10  
**Severity:** 🔴 CRITICAL - Blocking Warden Deployment  
**Status:** ❌ BLOCKER - Migrations Cannot Be Applied

---

## EXECUTIVE SUMMARY

**CRITICAL DISCOVERY:** The database schema does not match the application code expectations. This is a fundamental architectural mismatch that prevents the Warden fixes from being deployed.

**The Problem:**
- **Code expects:** `org_id` columns, `organizations` table (multi-tenant per organization)
- **Database has:** `user_id` columns, NO `organizations` table (single-tenant per user)
- **Result:** Migrations cannot be applied (references non-existent `organizations` table)

---

## VERIFIED DATABASE STATE

### ✅ What EXISTS in Database:
```sql
-- Tables with user_id (single-tenant model):
- leads.user_id (FK to auth.users.id)
- campaigns.user_id (FK to auth.users.id)
- knowledge_base.user_id (FK to auth.users.id)
- call_logs (has lead_id, NO org_id, NO user_id)
- cold_call_logs.user_id (FK to auth.users.id)
```

### ❌ What DOES NOT EXIST in Database:
```sql
-- Missing tables:
- organizations (referenced by migrations but doesn't exist)

-- Missing columns:
- call_logs.org_id (migrations expect this, but table doesn't have it)
- call_tracking.org_id (migrations expect this)
- calls.org_id (migrations expect this)
- knowledge_base.org_id (migrations expect this, but table has user_id instead)
- agents.org_id (migrations expect this)
- integrations.org_id (migrations expect this)
```

---

## CODE EXPECTATIONS (Backend)

### Files That Reference `organizations` Table:
1. `backend/src/server.ts` (Line 198) - Health check queries organizations
2. `backend/src/middleware/auth.ts` (Lines 59, 138, 211) - Auth fallback queries organizations
3. `backend/src/routes/founder-console-v2.ts` (Lines 123, 448, 465, 1164, 1681) - Agent config queries organizations
4. `backend/src/jobs/orphan-recording-cleanup.ts` (Line 105) - Background job queries organizations
5. `backend/src/jobs/recording-queue-worker.ts` (Line 277) - Background job queries organizations

### Files That Reference `org_id`:
- All routes use `req.user.orgId` (extracted from JWT `app_metadata.org_id`)
- All queries filter by `.eq('org_id', orgId)`
- Migrations create `org_id` columns

---

## ROOT CAUSE ANALYSIS

**Scenario 1: Migrations Not Applied** (Most Likely)
- Migrations were written but never run in Supabase
- Database still in original state (user-based tenant model)
- Code was updated to expect org-based model, but database wasn't migrated

**Scenario 2: Architecture Transition** (Possible)
- System originally designed as single-tenant per user
- Decision made to transition to multi-tenant per organization
- Migrations created but never applied
- Code updated but database not migrated

**Scenario 3: Multiple Environments** (Less Likely)
- Production database has different schema than expected
- Migrations were applied to dev/staging but not production

---

## IMPACT ON WARDEN FIXES

### ❌ Blocked Migrations:
1. **`20250110_create_auth_org_id_function.sql`** - References `auth` schema (can't create functions there)
2. **`20250110_create_org_id_immutability_triggers.sql`** - References tables with `org_id` that don't exist
3. **All existing migrations** that reference `organizations(id)` will fail

### ❌ Blocked Code Fixes:
1. **Auth middleware** extracts `org_id` from `app_metadata`, but database has no `org_id` columns
2. **Background jobs** query `organizations` table which doesn't exist
3. **All routes** filter by `org_id` but database uses `user_id`

---

## REQUIRED ACTIONS (Priority Order)

### 🚨 Priority 1: Create Organizations Table (BLOCKING)

**Before ANY Warden fixes can be deployed, we must:**

1. **Create `organizations` table**
2. **Migrate from `user_id` to `org_id` model** (OR keep `user_id` and map it to `org_id`)
3. **Update all tables to have `org_id` columns**
4. **Backfill `org_id` from existing `user_id` data**

### 🚨 Priority 2: Fix Function Schema (BLOCKING)

The `auth.org_id()` function cannot be created in `auth` schema (reserved by Supabase). Must create in `public` schema instead.

### 🚨 Priority 3: Resolve Tenant Model Decision (ARCHITECTURAL)

**Decision Required:**
- **Option A:** Migrate to org-based model (create organizations table, migrate data)
- **Option B:** Keep user-based model (update code to use `user_id` instead of `org_id`)
- **Option C:** Hybrid model (map `user_id` to `org_id` 1:1 for backward compatibility)

---

## PROPOSED SOLUTION: Create Organizations Table First

Since the code expects `org_id` and `organizations`, we should:

### Step 1: Create Organizations Table (Foundation)
```sql
-- Migration: 20250110_create_organizations_table.sql
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create default organization for existing users
INSERT INTO organizations (id, name, status)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Default Organization', 'active')
ON CONFLICT (id) DO NOTHING;
```

### Step 2: Add org_id Columns to Existing Tables
```sql
-- Migration: 20250110_add_org_id_to_existing_tables.sql
-- For each table that needs org_id:
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE call_tracking ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS org_id UUID;
-- ... (all other tables)
```

### Step 3: Backfill org_id from user_id (1:1 mapping for now)
```sql
-- For tables with user_id, map to default org (temporary)
UPDATE call_logs SET org_id = 'a0000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE campaigns SET org_id = 'a0000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
-- ... (all other tables)
```

### Step 4: Update JWT app_metadata to include org_id
```typescript
// When user registers, set org_id in app_metadata
supabase.auth.admin.updateUserById(userId, {
  app_metadata: { org_id: 'a0000000-0000-0000-0000-000000000001' }
});
```

---

## ALTERNATIVE: Keep User-Based Model (Simpler)

If we decide to keep the user-based model (single tenant per user):

### Changes Required:
1. **Update auth middleware** to use `user_id` instead of `org_id`
2. **Update all queries** to filter by `user_id` instead of `org_id`
3. **Update RLS policies** to use `auth.uid()` instead of `auth.org_id()`
4. **Revert Warden fixes** to work with `user_id` model

**Pros:** No data migration needed, simpler  
**Cons:** Doesn't support multi-user organizations (clinic teams)

---

## RECOMMENDATION

**I recommend: Option A (Migrate to Org-Based Model)**

**Reasoning:**
- Code already expects `org_id` (less refactoring)
- Supports future multi-user organizations (clinic teams)
- Migrations already written (just need to apply them)
- Warden fixes already designed for org-based model

**Timeline:**
- **Day 1:** Create organizations table, add org_id columns
- **Day 2:** Backfill org_id from user_id (1:1 mapping)
- **Day 3:** Update JWT app_metadata for all users
- **Day 4:** Deploy Warden fixes (now that schema matches)
- **Day 5:** Test and verify

---

## BLOCKER CHECKLIST

Before proceeding with Warden fixes:

- [ ] ❌ **BLOCKED:** `organizations` table doesn't exist
- [ ] ❌ **BLOCKED:** `org_id` columns don't exist in critical tables
- [ ] ❌ **BLOCKED:** Can't create function in `auth` schema
- [ ] ⚠️ **WARNING:** Code expects org_id but database uses user_id
- [ ] ⚠️ **WARNING:** Migrations reference non-existent tables/columns

**Status:** 🔴 **CANNOT PROCEED** until schema mismatch is resolved

---

## NEXT STEPS

**Immediate Actions Required:**

1. **Decision:** Choose tenant model (org-based vs user-based)
2. **Create:** Organizations table if choosing org-based
3. **Migrate:** Add org_id columns to all tables
4. **Backfill:** Map existing user_id to org_id (or create org per user)
5. **Update:** JWT app_metadata to include org_id for all users
6. **Then:** Deploy Warden fixes (migrations will now work)

**Without resolving this, the Warden fixes cannot be deployed.**

---

**Signed,**  
**The Zero-Trust Warden**  
*Critical Blocker Identified - Schema Mismatch*
