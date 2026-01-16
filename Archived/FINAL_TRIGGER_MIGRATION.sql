-- ============================================================================
-- FINAL TRIGGER MIGRATION - Auto-Organization Setup
-- ============================================================================
-- Apply this SQL in Supabase SQL Editor to complete the system setup
-- URL: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/sql
-- ============================================================================

-- Step 1: Add email column to organizations table
ALTER TABLE IF EXISTS public.organizations
ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 2: Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_setup();

-- Step 3: Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER AS $trigger$
DECLARE
    new_org_id UUID;
BEGIN
    -- Create organization for new user
    INSERT INTO public.organizations (name, status, email, created_at, updated_at)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.email) || ' Organization',
        'active',
        NEW.email,
        NOW(),
        NOW()
    )
    RETURNING id INTO new_org_id;

    -- Create profile linked to organization
    INSERT INTO public.profiles (id, email, org_id, role, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        new_org_id,
        'owner',
        NOW(),
        NOW()
    );

    -- Stamp org_id into JWT so frontend can access it
    UPDATE auth.users
    SET raw_app_metadata = COALESCE(raw_app_metadata, '{}'::jsonb) ||
        jsonb_build_object('org_id', new_org_id::text)
    WHERE id = NEW.id;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user_setup: %', SQLERRM;
    RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 4: Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_setup();

-- ============================================================================
-- VERIFICATION (run this query after applying the migration)
-- ============================================================================
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created';
-- Expected result: Should show on_auth_user_created with INSERT event on auth.users table
