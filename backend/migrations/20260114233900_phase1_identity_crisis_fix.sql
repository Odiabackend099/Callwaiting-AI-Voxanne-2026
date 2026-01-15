-- PHASE 1: Database Migration Script
-- Identity Crisis Fix - Standardize org_id Naming
-- Created: 2026-01-14
-- 
-- This migration:
-- 1. Standardizes org_id/organization_id naming across tables
-- 2. Ensures profiles.org_id is used consistently (NOT organization_id)
-- 3. Updates auth trigger to use org_id in JWT
-- 4. Hardens RLS policies to prevent cross-org data access

-- ============================================================================
-- 1. FIX THE IDENTITY CRISIS: Standardize to org_id
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
        -- First drop any foreign key constraints
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_organization_id_fkey;
        ALTER TABLE public.profiles RENAME COLUMN organization_id TO org_id;
        -- Re-add foreign key
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
        RAISE NOTICE 'SUCCESS: Renamed profiles.organization_id to org_id';
    END IF;
    
    -- If neither exists, add org_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name IN ('org_id', 'organization_id', 'tenant_id')) THEN
        ALTER TABLE public.profiles ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        RAISE NOTICE 'SUCCESS: Added profiles.org_id column';
    END IF;
END $$;

-- ============================================================================
-- 2. SECURE THE FOUNDATION: Create the Auto-Org Trigger for new signups
-- ============================================================================
-- This function automatically creates an organization and profile when a new
-- user signs up via Supabase Auth. It also stamps the org_id into the JWT
-- so the backend middleware can access it immediately.

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
-- 3. BIND THE TRIGGER
-- ============================================================================
-- Delete old trigger if it exists and create the new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();

-- ============================================================================
-- 4. HARDEN RLS (Row Level Security)
-- ============================================================================
-- This ensures User A can NEVER see User B's data
-- RLS policies will only allow users to access data where org_id matches
-- their JWT app_metadata.org_id

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only see their own org" ON public.profiles;
CREATE POLICY "Users can only see their own org" ON public.profiles
    USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- Apply RLS to organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access their org" ON public.organizations;
CREATE POLICY "Users can access their org" ON public.organizations
    USING (id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================================
-- VERIFICATION QUERIES (run after migration to confirm success)
-- ============================================================================
-- 
-- 1. Confirm profiles.org_id column exists:
--    SELECT column_name, data_type FROM information_schema.columns 
--    WHERE table_name='profiles' AND column_name='org_id';
--
-- 2. Confirm trigger exists:
--    SELECT trigger_name FROM information_schema.triggers 
--    WHERE trigger_name='on_auth_user_created';
--
-- 3. Confirm RLS is enabled:
--    SELECT tablename, rowsecurity FROM pg_tables 
--    WHERE tablename IN ('profiles', 'organizations');
--
-- 4. Test new user signup (create via Supabase Auth UI, then check):
--    SELECT id, email, org_id FROM profiles WHERE email='test@example.com';
--    SELECT * FROM organizations WHERE name LIKE 'My%' ORDER BY created_at DESC LIMIT 1;
--
-- ============================================================================
