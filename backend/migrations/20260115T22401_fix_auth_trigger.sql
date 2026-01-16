-- Migration: Fix Auth Trigger for Auto-Organization Setup
-- Date: 2026-01-15
-- Purpose: Ensure every new user signup creates an organization automatically

-- First, ensure organizations table has email column
ALTER TABLE IF EXISTS public.organizations
ADD COLUMN IF NOT EXISTS email TEXT;

-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_setup();

-- Create the corrected trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER AS $trigger$
DECLARE
    new_org_id UUID;
BEGIN
    -- 1. CREATE ORGANIZATION FOR THIS USER
    INSERT INTO public.organizations (name, status, email, created_at, updated_at)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.email) || ' Organization',
        'active',
        NEW.email,
        NOW(),
        NOW()
    )
    RETURNING id INTO new_org_id;

    -- 2. CREATE PROFILE LINKED TO ORG (using org_id column)
    INSERT INTO public.profiles (id, email, org_id, role, created_at, updated_at)
    VALUES (
        NEW.id,
        NEW.email,
        new_org_id,
        'owner',
        NOW(),
        NOW()
    );

    -- 3. UPDATE AUTH METADATA WITH ORG_ID
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

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_setup();
