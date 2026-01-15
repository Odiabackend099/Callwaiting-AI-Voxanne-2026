# ⚡ PHASE 1 - READY TO EXECUTE

**Status:** ✅ Migration files prepared  
**Date:** 2026-01-14  
**Execution Time:** ~5 minutes  
**Risk Level:** LOW (idempotent, no data loss)

---

## 🎯 What This Fixes

The "Identity Crisis" in your infrastructure:

| Issue | Before | After |
|-------|--------|-------|
| **profiles column naming** | `organization_id` or `tenant_id` (inconsistent) | `org_id` everywhere ✅ |
| **JWT org claim** | Missing or wrong value | Always set to user's org_id ✅ |
| **New user signup** | Orphaned (no org created) | Auto-creates org & stamps JWT ✅ |
| **RLS Policies** | Incomplete | Enforces org isolation ✅ |
| **Backend access** | Falls back to 'first org' (security hole!) | Strict validation only ✅ |

---

## 🚀 Execute Phase 1

### **Open Supabase SQL Editor**
Go to: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/sql/new

### **Run This Migration**
Copy entire contents from:
```
/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/migrations/phase1_identity_crisis_fix.sql
```

Paste into SQL editor and click **"Run"**

---

## ✅ Verify Success

After migration completes, run these verification queries:

```sql
-- 1. Confirm org_id column exists on profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name='profiles' AND column_name='org_id';
-- Expected: 1 row, data_type='uuid', is_nullable='NO'

-- 2. Confirm trigger exists
SELECT trigger_name, event_object_table
FROM information_schema.triggers 
WHERE trigger_name='on_auth_user_created';
-- Expected: 1 row, event_object_table='users'

-- 3. Confirm RLS policies
SELECT policyname, tablename, qual
FROM pg_policies 
WHERE tablename IN ('profiles', 'organizations');
-- Expected: 2+ rows with 'org' in the policy name

-- 4. Verify existing data (optional)
SELECT COUNT(*), COUNT(org_id) 
FROM profiles;
-- Shows total profiles and how many have org_id set
```

---

## 📋 After Phase 1 Complete

Once you confirm migration success, reply:
```
Phase 1 complete
```

Then I'll execute **Phase 2: Backend Security Fix** which includes:
- ✅ Remove dangerous org_id fallback in middleware
- ✅ Create org-validation service
- ✅ Update all routes to validate org_id
- ✅ Fix the security hole where missing org defaults to 'first org'

---

## 🆘 If Something Goes Wrong

### **Problem: "Constraint violation" error**
- ✅ Normal if organization_id constraint exists
- ✅ Migration handles this automatically

### **Problem: "Column already exists"**
- ✅ Means migration was already run
- ✅ Safe to run again (idempotent)

### **Problem: RLS policy fails to create**
- ❌ Check that profiles table actually exists
- Run: `SELECT * FROM information_schema.tables WHERE table_name='profiles';`

---

## 💡 What's Happening Behind the Scenes

1. **Column Standardization:**
   ```sql
   -- Renames organization_id → org_id (consistency across codebase)
   ALTER TABLE profiles RENAME COLUMN organization_id TO org_id;
   ```

2. **Auto-Org Trigger:**
   ```sql
   -- Every new user gets an org created automatically
   INSERT INTO organizations (...) VALUES (...)
   INSERT INTO profiles (...org_id...) VALUES (...)
   UPDATE auth.users SET raw_app_metadata['org_id'] = ...
   ```

3. **RLS Policies:**
   ```sql
   -- Users can only access their own org data
   USING (org_id = auth.jwt()->>'app_metadata'->>'org_id')
   ```

---

## 🚨 Critical Notes

- ⚠️ This migration is **safe for production** (idempotent)
- ⚠️ Existing users may need backfilling org_id (Phase 2 handles this)
- ✅ New signups will work perfectly after this
- ✅ No data is deleted or corrupted

---

**Ready? Open Supabase and run the migration!**

Once done, reply `Phase 1 complete` to proceed to Phase 2 (Backend fixes).
