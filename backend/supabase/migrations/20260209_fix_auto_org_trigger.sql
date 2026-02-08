-- Migration: Fix Auto-Organization Creation Trigger (Definitive Version)
-- Date: 2026-02-09
-- Purpose: Replace all broken trigger versions with ONE correct implementation
--
-- PROBLEMS SOLVED:
-- 1. Column name mismatch (organization_id vs org_id)
-- 2. Multiple conflicting trigger versions
-- 3. Silent error swallowing (RAISE WARNING → RAISE EXCEPTION)
--
-- This trigger ensures EVERY new user signup automatically creates:
-- 1. Organization record
-- 2. Profile record (linked to org via org_id)
-- 3. JWT app_metadata (contains org_id for RLS)

-- Step 1: Drop ALL old trigger versions (clean slate)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Drop ALL old function versions (may have multiple names)
DROP FUNCTION IF EXISTS public.handle_new_user_signup() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_setup() CASCADE;

-- Step 3: Create ONE definitive trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  RAISE NOTICE 'Auto-organization trigger fired for user: %', NEW.email;

  -- 1. CREATE ORGANIZATION FOR THIS USER
  INSERT INTO public.organizations (name, email, status, created_at, updated_at)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.email) || ' Organization',
    NEW.email,
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_org_id;

  RAISE NOTICE '  ✓ Created organization: %', new_org_id;

  -- 2. CREATE PROFILE LINKED TO ORG
  -- CRITICAL: Uses org_id (NOT organization_id)
  INSERT INTO public.profiles (id, email, org_id, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    new_org_id,  -- CORRECT column name
    'owner',
    NOW(),
    NOW()
  );

  RAISE NOTICE '  ✓ Created profile with org_id: %', new_org_id;

  -- 3. UPDATE AUTH METADATA WITH ORG_ID
  -- This stamps the org_id into the JWT so frontend can read it
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('org_id', new_org_id::text)
  WHERE id = NEW.id;

  RAISE NOTICE '  ✓ Updated JWT metadata with org_id';
  RAISE NOTICE '  ✅ Auto-created org % for user %', new_org_id, NEW.email;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- CRITICAL: BLOCK signup if trigger fails (don't create broken users)
  -- This replaces the old RAISE WARNING which silently failed
  RAISE EXCEPTION 'Failed to create organization for user %: %', NEW.email, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Step 4: Create the trigger (binds function to auth.users INSERT)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();

-- Verification: Check trigger is active
DO $$
DECLARE
  trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgenabled = 'O'  -- 'O' means always enabled
  ) INTO trigger_exists;

  IF trigger_exists THEN
    RAISE NOTICE '✅ Trigger on_auth_user_created is ACTIVE';
  ELSE
    RAISE EXCEPTION '❌ Trigger on_auth_user_created is NOT ACTIVE';
  END IF;
END $$;
