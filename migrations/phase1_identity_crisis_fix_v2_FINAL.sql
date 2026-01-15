-- PHASE 1 REVISED: Identity Crisis Fix - Create profiles table if missing
-- Date: 2026-01-14
-- Fixed: Now creates profiles table as prerequisite before modifying it

-- ============================================================================
-- STEP 0: Create profiles table if it doesn't exist
-- ============================================================================
-- This table is referenced by Supabase Auth but might not be auto-created
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for org_id filtering
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profiles_updated_at();

-- ============================================================================
-- STEP 1: FIX THE IDENTITY CRISIS: Standardize to org_id
-- ============================================================================
DO $$ 
BEGIN
    -- Rename tenant_id if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='tenant_id') THEN
        ALTER TABLE public.profiles RENAME COLUMN tenant_id TO org_id;
        RAISE NOTICE 'SUCCESS: Renamed profiles.tenant_id to org_id';
    END IF;
    
    -- Rename organization_id to org_id if it exists (standardize naming)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='organization_id') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_organization_id_fkey;
        ALTER TABLE public.profiles RENAME COLUMN organization_id TO org_id;
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        RAISE NOTICE 'SUCCESS: Renamed profiles.organization_id to org_id';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: SECURE THE FOUNDATION: Create the Auto-Org Trigger for new signups
-- ============================================================================
-- This function automatically creates an organization and profile when a new
-- user signs up via Supabase Auth.

CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
BEGIN
    -- Create a REAL organization for the new user
    INSERT INTO public.organizations (name, status, created_at, updated_at)
    VALUES (
        COALESCE(NEW.raw_user_meta_data->>'business_name', NEW.email) || ' Organization',
        'active',
        NOW(),
        NOW()
    )
    RETURNING id INTO new_org_id;

    -- Create the profile and link it to the Org using org_id column
    INSERT INTO public.profiles (id, email, org_id, role, created_at, updated_at)
    VALUES (NEW.id, NEW.email, new_org_id, 'owner', NOW(), NOW());

    -- Stamp the Org ID into the JWT so the Backend/Middleware can see it instantly
    UPDATE auth.users 
    SET raw_app_metadata = COALESCE(raw_app_metadata, '{}'::jsonb) || jsonb_build_object('org_id', new_org_id::text)
    WHERE id = NEW.id;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user_setup: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- STEP 3: BIND THE TRIGGER
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();

-- ============================================================================
-- STEP 4: HARDEN RLS (Row Level Security)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only see their own org" ON public.profiles;
CREATE POLICY "Users can only see their own org" ON public.profiles
    USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access their org" ON public.organizations;
CREATE POLICY "Users can access their org" ON public.organizations
    USING (id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================================
-- SUCCESS
-- ============================================================================
-- Phase 1 migration complete. Your infrastructure is now synchronized!
