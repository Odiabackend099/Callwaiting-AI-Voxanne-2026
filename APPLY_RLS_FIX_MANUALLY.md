# Manual RLS Fix Application Guide

## Issue
Appointments are not displaying in dashboard due to missing RLS SELECT policy.

## Quick Fix (5 minutes)

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq
   - Navigate to: SQL Editor (left sidebar)

2. **Create New Query**
   - Click "New query" button

3. **Paste This SQL**
   ```sql
   -- Enable RLS on appointments table
   ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

   -- Drop existing SELECT policies if any (idempotent)
   DROP POLICY IF EXISTS "Users can view own org appointments" ON appointments;
   DROP POLICY IF EXISTS "Enable read access for users based on org_id" ON appointments;
   DROP POLICY IF EXISTS "appointments_select_policy" ON appointments;

   -- Create SELECT policy: Users can view appointments for their own organization
   CREATE POLICY "Users can view own org appointments"
   ON appointments
   FOR SELECT
   USING (
     org_id = (
       SELECT org_id
       FROM profiles
       WHERE id = auth.uid()
     )
   );
   ```

4. **Run the Query**
   - Click "Run" button or press `Ctrl+Enter`
   - Should see: "Success. No rows returned"

5. **Verify**
   - Run this verification query:
   ```sql
   SELECT policyname, cmd, qual
   FROM pg_policies
   WHERE tablename = 'appointments' AND cmd = 'SELECT';
   ```
   - Should see: "Users can view own org appointments" policy listed

### Option 2: Via Supabase CLI (if installed)

```bash
cd backend
supabase db push --db-url $DATABASE_URL --file supabase/migrations/20260220_fix_appointments_rls.sql
```

## Verification Steps

After applying the fix, run the diagnostic script:

```bash
cd backend
npx ts-node src/scripts/diagnose-appointments-issue.ts
```

**Expected Results (AFTER fix):**
```
✅ Found 1 appointments in database
✅ Found 1 appointments via RLS      ← Should be 1 now (was 0 before)
✅ API returned 1 appointments        ← Should be 1 now (was 0 before)
```

## What This Fix Does

**Before Fix:**
- Database has appointment data ✅
- User query returns 0 results ❌ (RLS blocking)
- Dashboard shows empty list ❌

**After Fix:**
- Database has appointment data ✅
- User query returns 1 result ✅ (RLS allows access)
- Dashboard shows appointments ✅

## Technical Explanation

The appointment exists in the database but wasn't visible to authenticated users because Row Level Security (RLS) had no policy allowing SELECT operations.

The fix adds a policy that allows users to SELECT appointments where:
- `org_id` matches the user's organization (from their JWT token)
- This maintains multi-tenant data isolation (User A can't see User B's appointments)

## If Still Not Working

Run the full diagnostic again:
```bash
cd backend
npx ts-node src/scripts/diagnose-appointments-issue.ts
```

The script will identify which layer is still failing.
