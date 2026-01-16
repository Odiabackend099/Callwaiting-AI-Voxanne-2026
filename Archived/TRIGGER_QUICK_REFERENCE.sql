-- ============================================================================
-- QUICK REFERENCE: on_auth_user_created Trigger Diagnostics
-- Run these queries in: https://app.supabase.com → SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. CHECK TRIGGER EXISTS
-- ============================================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Expected: 1 row with INSERT AFTER users
-- If empty: Trigger doesn't exist - need to apply migration


-- ============================================================================
-- 2. CHECK TRIGGER FUNCTION EXISTS
-- ============================================================================
SELECT 
  routine_name,
  routine_type,
  routine_schema
FROM information_schema.routines
WHERE routine_name = 'handle_new_user_setup'
AND routine_schema = 'public';

-- Expected: 1 row showing FUNCTION
-- If empty: Function doesn't exist


-- ============================================================================
-- 3. CHECK TRIGGER ENABLED STATUS
-- ============================================================================
SELECT 
  tgname,
  tgenabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- Expected: tgenabled = 'O' (always enabled)
-- If 'D': Trigger disabled - run:
--   ALTER TABLE auth.users ENABLE ALWAYS TRIGGER on_auth_user_created;


-- ============================================================================
-- 4. CHECK VOXANNE@DEMO.COM IN AUTH.USERS
-- ============================================================================
SELECT 
  id,
  email,
  created_at,
  raw_app_metadata
FROM auth.users
WHERE email = 'voxanne@demo.com';

-- Check if user exists and if raw_app_metadata contains org_id


-- ============================================================================
-- 5. CHECK IF VOXANNE@DEMO.COM PROFILE EXISTS (CRITICAL)
-- ============================================================================
SELECT 
  id,
  email,
  org_id,
  role,
  created_at
FROM public.profiles
WHERE email = 'voxanne@demo.com';

-- If EMPTY: Profile is MISSING - trigger didn't fire or failed
-- If has row: Profile exists - trigger worked


-- ============================================================================
-- 6. CHECK RELATED ORGANIZATION FOR VOXANNE
-- ============================================================================
SELECT 
  id,
  name,
  status,
  created_at
FROM public.organizations
WHERE name ILIKE '%voxanne%demo%'
   OR name ILIKE '%' || 'voxanne@demo.com' || '%'
ORDER BY created_at DESC;


-- ============================================================================
-- 7. FIND ALL ORPHANED USERS (missing profiles)
-- ============================================================================
SELECT 
  au.id,
  au.email,
  au.created_at,
  p.id as profile_id,
  CASE WHEN p.id IS NULL THEN 'MISSING PROFILE' ELSE 'HAS PROFILE' END as status
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
ORDER BY au.created_at DESC
LIMIT 20;

-- This shows which users don't have profiles


-- ============================================================================
-- 8. CHECK PROFILES TABLE STRUCTURE
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Must have: id, email, org_id, role, created_at, updated_at


-- ============================================================================
-- 9. CHECK ORGANIZATIONS TABLE STRUCTURE
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'organizations'
ORDER BY ordinal_position;

-- Must have: id, name, status, created_at, updated_at


-- ============================================================================
-- 10. CHECK ROW LEVEL SECURITY (RLS) STATUS
-- ============================================================================
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'organizations');

-- Expected: rowsecurity = true for both


-- ============================================================================
-- 11. VIEW TRIGGER FUNCTION CODE
-- ============================================================================
SELECT pg_get_functiondef(p.oid) as function_code
FROM pg_proc p
WHERE p.proname = 'handle_new_user_setup'
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');


-- ============================================================================
-- MANUAL FIX: Create missing profile for voxanne@demo.com
-- ============================================================================
-- Step 1: Create org (copy the returned UUID)
INSERT INTO public.organizations (name, status, created_at, updated_at)
VALUES ('voxanne@demo.com Organization', 'active', NOW(), NOW())
RETURNING id;

-- Step 2: Replace ORG_ID_HERE with the ID from Step 1
INSERT INTO public.profiles (id, email, org_id, role, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  'ORG_ID_HERE'::uuid,
  'owner',
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email = 'voxanne@demo.com'
AND au.id NOT IN (SELECT id FROM public.profiles);

-- Step 3: Update JWT metadata
UPDATE auth.users
SET raw_app_metadata = COALESCE(raw_app_metadata, '{}'::jsonb) || 
    jsonb_build_object('org_id', 'ORG_ID_HERE'::text)
WHERE email = 'voxanne@demo.com';

-- Step 4: Verify
SELECT au.id, au.email, p.org_id, p.role
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE au.email = 'voxanne@demo.com';


-- ============================================================================
-- ENABLE TRIGGER (if it was disabled)
-- ============================================================================
ALTER TABLE auth.users ENABLE ALWAYS TRIGGER on_auth_user_created;


-- ============================================================================
-- RE-CREATE TRIGGER (if needed)
-- ============================================================================
-- Copy the entire contents of this migration file and run:
-- /backend/migrations/20260114_create_auth_trigger.sql

