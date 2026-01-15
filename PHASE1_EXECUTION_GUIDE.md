# ⚡ PHASE 1 EXECUTION GUIDE

**Status:** Ready to Execute  
**Date:** 2026-01-14  
**Time to Execute:** ~5 minutes  
**Risk Level:** LOW (idempotent SQL, no data loss)

---

## 📋 What This Phase Does

This migration collapses your "Identity Crisis" into a single source of truth:

1. **Renames** `profiles.tenant_id` → `org_id` (consistency across codebase)
2. **Auto-creates** organizations for new signups (no more orphaned users)
3. **Stamps org_id** into JWT (backend middleware can access it immediately)
4. **Hardens RLS** policies (prevents cross-org data access)

---

## 🚀 How to Execute

### **Option 1: Supabase Dashboard (Easiest)**

1. Open your Supabase project: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/sql/new
2. Click **"New Query"**
3. Copy the entire contents from:
   ```
   /migrations/phase1_identity_crisis_fix.sql
   ```
4. Paste into the SQL editor
5. Click **"Run"** (top-right)
6. Wait for the green ✅ "Query executed successfully"

### **Option 2: Supabase CLI (Terminal)**

```bash
cd /Users/mac/Desktop/Callwaiting-AI-Voxanne-2026

# Install Supabase CLI if not installed
npm install -g @supabase/cli

# Log in
supabase login

# Execute the migration
supabase sql -f migrations/phase1_identity_crisis_fix.sql
```

---

## ✅ How to Verify Success

After running the migration, execute these verification queries in the Supabase SQL editor:

### **1. Confirm profiles.org_id exists:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='profiles' AND column_name='org_id';
```
**Expected:** 1 row, `data_type='uuid'`

### **2. Confirm trigger exists:**
```sql
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name='on_auth_user_created';
```
**Expected:** 1 row with `event_object_table='users'`

### **3. Confirm RLS is enabled:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('profiles', 'organizations');
```
**Expected:** 2 rows, both with `rowsecurity=true`

### **4. Confirm RLS policy exists:**
```sql
SELECT policyname, tablename 
FROM pg_policies 
WHERE tablename='profiles';
```
**Expected:** 1+ rows with policy names

### **5. Test the trigger (create new user via Auth, then query):**
```sql
-- After creating a test user in Supabase Auth Dashboard:
SELECT id, email, org_id 
FROM profiles 
WHERE email='test@example.com';
```
**Expected:** 1 row with org_id filled in (not NULL)

---

## 🔍 If Something Goes Wrong

### **Problem: Column tenant_id doesn't exist**
- ✅ **This is OK!** Means it was already renamed
- ✅ Migration is idempotent (won't error)
- Check: `SELECT * FROM profiles LIMIT 1;` to see actual column names

### **Problem: Trigger already exists**
- ✅ **This is OK!** Migration drops and recreates it
- No data loss, just replaces the function

### **Problem: RLS policy already exists**
- ✅ **This is OK!** Migration drops and recreates it
- No data loss, just updates the policy

### **Problem: FATAL error about schema mismatch**
- ❌ Check that profiles table actually has a tenant_id or org_id column
- Run: `\d profiles` (in psql) or check table schema in Supabase dashboard

---

## 📊 After Phase 1 Complete

Once you execute Phase 1:

1. **Database is standardized** ✅ (org_id everywhere)
2. **New signups auto-create orgs** ✅ (no more orphaned users)
3. **JWT includes org_id** ✅ (backend can access immediately)
4. **RLS policies enforce isolation** ✅ (can't access other orgs)

**Next Step:** After confirming Phase 1, notify me and I'll execute **Phase 2: Backend Security Fix**

---

## 🚨 Critical Notes

- ⚠️ This is **safe to run on production** (idempotent)
- ⚠️ No data is deleted or modified (only schema changes)
- ⚠️ Your existing users will need to be backfilled with org_id (Phase 2 handles this)
- ✅ New signups from this point on will have org_id automatically

---

## 📞 Need Help?

If the migration fails:
1. Share the **exact error message**
2. Confirm your **database credentials** are correct
3. Check **Supabase project status** (not paused)
4. Verify you have **SQL editor access** in Supabase dashboard

**Once you run this and confirm success, reply with "Phase 1 complete" and I'll proceed to Phase 2.**
