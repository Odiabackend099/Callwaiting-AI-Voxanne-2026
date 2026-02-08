# Cleanup Summary: Auth Trigger Fix (2026-02-09)

**Date:** 2026-02-09
**Action:** Removed conflicting migrations, created definitive documentation
**Purpose:** Prevent future AI assistants from being confused by outdated/broken code

---

## 🎯 What Was the Problem?

**Production Blocker:** New users (e.g., ceo@demo.com) could not login because the auto-organization trigger was broken, leaving them without profiles or organizations.

**Root Causes:**
1. **3 conflicting migration files** with different implementations
2. **Wrong column names** used in triggers (`organization_id` vs `org_id`, `raw_app_metadata` vs `raw_app_meta_data`)
3. **Silent error swallowing** (`RAISE WARNING` instead of `RAISE EXCEPTION`)

---

## 🧹 Files Removed (Archived)

These files were **moved to archive** to prevent confusion:

### Archived Location: `.archive/2026-02-09-broken-auth-triggers/`

1. **`backend/migrations/20260114_create_auth_trigger.sql`**
   - ❌ Used `organization_id` (column doesn't exist)
   - Status: BROKEN

2. **`backend/migrations/20260115T22401_fix_auth_trigger.sql`**
   - ❌ Used `raw_app_metadata` (column doesn't exist)
   - Status: PARTIAL FIX (still broken)

3. **`backend/supabase/migrations/20260116195200_add_auto_org_creation_trigger.sql`**
   - ❌ Used different architecture (`is_organization` flag)
   - Status: CONFLICTING

**Why Archived, Not Deleted:**
- Preserves history for debugging
- Includes README explaining why they're wrong
- Prevents accidental restoration

---

## ✅ Files Created (Current/Correct)

### Definitive Implementations:

1. **`backend/supabase/migrations/20260209_backfill_orphaned_users.sql`**
   - Fixes existing orphaned users
   - Applied once on 2026-02-09
   - ✅ Uses correct column names

2. **`backend/supabase/migrations/20260209_fix_auto_org_trigger.sql`**
   - Definitive auto-organization trigger
   - Replaces all 3 broken versions
   - ✅ Uses `org_id`, `raw_app_meta_data`
   - ✅ Blocks signup on failure (`RAISE EXCEPTION`)

### Documentation Files:

3. **`.agent/DATABASE_SCHEMA_REFERENCE.md`** ⭐ **START HERE**
   - Single source of truth for database schema
   - Documents correct column names
   - Explains auto-organization setup
   - Lists common mistakes to avoid

4. **`.archive/2026-02-09-broken-auth-triggers/README.md`**
   - Explains why old migrations were broken
   - Shows before/after comparison
   - Warns against restoring archived files

5. **`.agent/CLEANUP_2026-02-09_AUTH_TRIGGER_FIX.md`** (This file)
   - Summary of cleanup actions
   - Where to find correct information

### Helper Scripts:

6. **`backend/src/scripts/apply-migrations-via-api.ts`**
   - Applies migrations via Supabase Management API
   - Used to apply the fix on 2026-02-09

7. **`backend/src/scripts/verify-user-signup.ts`**
   - Verifies auto-organization trigger is working
   - Tests new user creation

---

## 📖 Where AI Assistants Should Look

**For database schema questions:**
→ **`.agent/DATABASE_SCHEMA_REFERENCE.md`** (Definitive reference)

**For migration history:**
→ `backend/supabase/migrations/` (Only current, working migrations)

**For archived/broken migrations:**
→ `.archive/2026-02-09-broken-auth-triggers/` (DO NOT USE)

**For Supabase API usage:**
→ `.agent/supabase-mcp.md` (Management API guide)

**For general backend info:**
→ `.claude/CLAUDE.md` (Project overview)

---

## 🔐 Critical Column Names (Memorize These!)

### Auth Users (`auth.users`)
```sql
✅ raw_app_meta_data   -- Server-set data (with underscore!)
✅ raw_user_meta_data  -- User-provided data (with underscore!)

❌ raw_app_metadata    -- WRONG (no underscore)
❌ raw_user_metadata   -- WRONG (no underscore)
```

### Profiles (`public.profiles`)
```sql
✅ org_id              -- Organization reference (short form!)

❌ organization_id     -- WRONG (long form doesn't exist)
```

---

## ✅ Verification (Post-Cleanup)

**Confirmed on 2026-02-09:**

1. **No orphaned users:**
   ```bash
   curl ... -d '{"query": "SELECT COUNT(*) FROM auth.users au LEFT JOIN profiles p ON au.id = p.id WHERE p.id IS NULL"}'
   # Result: [{"count":0}] ✅
   ```

2. **Trigger active:**
   ```bash
   curl ... -d '{"query": "SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = '\''on_auth_user_created'\''"}'
   # Result: [{"tgname":"on_auth_user_created","tgenabled":"O"}] ✅
   ```

3. **User login working:**
   - ceo@demo.com can login ✅
   - Dashboard loads without redirect loops ✅

4. **New user signup:**
   - http://localhost:3000/sign-up creates users correctly ✅
   - Organization + profile auto-created ✅
   - JWT contains org_id ✅

---

## 🚨 What Future AI Assistants Must Do

### ✅ DO:
1. **Read `.agent/DATABASE_SCHEMA_REFERENCE.md` FIRST** before making auth/org changes
2. **Use correct column names** (`org_id`, `raw_app_meta_data`)
3. **Reference current migrations** in `backend/supabase/migrations/`
4. **Test with verification scripts** before declaring success

### ❌ DON'T:
1. **Restore archived migrations** from `.archive/2026-02-09-broken-auth-triggers/`
2. **Use wrong column names** (`organization_id`, `raw_app_metadata`)
3. **Create new conflicting triggers** (one already exists: `on_auth_user_created`)
4. **Assume column names** (always verify in DATABASE_SCHEMA_REFERENCE.md)

---

## 📊 Impact Summary

**Before Cleanup (2026-02-08):**
- ❌ 3 conflicting migration files
- ❌ Wrong column names in triggers
- ❌ Users created without profiles
- ❌ Login infinite redirect loops
- ❌ No definitive documentation

**After Cleanup (2026-02-09):**
- ✅ 1 definitive migration (correct)
- ✅ Correct column names used
- ✅ All users have profiles + orgs
- ✅ Login works for all users
- ✅ Comprehensive documentation
- ✅ Archived broken files with explanations

**AI Assistant Confusion Risk:**
- Before: **HIGH** (3 conflicting sources of truth)
- After: **LOW** (1 definitive reference + clear warnings)

---

## 🔗 Related Files

**Must Read:**
- `.agent/DATABASE_SCHEMA_REFERENCE.md` - **START HERE** ⭐
- `.archive/2026-02-09-broken-auth-triggers/README.md` - Why old migrations are wrong

**Reference:**
- `backend/supabase/migrations/20260209_backfill_orphaned_users.sql` - Backfill migration
- `backend/supabase/migrations/20260209_fix_auto_org_trigger.sql` - Current trigger
- `.agent/supabase-mcp.md` - Supabase API usage

**Scripts:**
- `backend/src/scripts/apply-migrations-via-api.ts` - Migration runner
- `backend/src/scripts/verify-user-signup.ts` - Verification script

---

**For AI Assistants:** If you encounter ANY conflicting information about auth triggers, organizations, or user signup, trust `.agent/DATABASE_SCHEMA_REFERENCE.md` as the single source of truth. It was created 2026-02-09 after fixing production-blocking bugs and cleaning up all conflicting code.
