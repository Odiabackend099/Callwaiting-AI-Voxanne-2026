-- Migration: Create Auth Trigger for Auto-Organization Setup
-- This ensures that every new user automatically gets an organization
-- and a profile linked to it, eliminating the "missing org_id" problem.

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- 1. CREATE ORGANIZATION FOR THIS USER
    INSERT INTO public.organizations (name, status, created_at, updated_at)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.email) || ' Organization',
        'active',
        NOW(),
        NOW()
    )
    RETURNING id INTO new_org_id;

    -- 2. CREATE PROFILE LINKED TO ORG
    INSERT INTO public.profiles (
        id, 
        email, 
        organization_id, 
        role, 
        created_at, 
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        new_org_id,
        'owner',
        NOW(),
        NOW()
    );

    -- 3. UPDATE AUTH METADATA WITH ORG_ID
    -- This stamps the org_id into the JWT so frontend can read it
    UPDATE auth.users
    SET raw_app_metadata = COALESCE(raw_app_metadata, '{}'::jsonb) || 
        jsonb_build_object('org_id', new_org_id::text)
    WHERE id = NEW.id;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- If trigger fails, log error but don't block signup
    RAISE WARNING 'Error in handle_new_user_setup: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 2: Drop old trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 3: Create the trigger bound to auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_setup();
