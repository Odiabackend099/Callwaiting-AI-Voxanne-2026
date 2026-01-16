-- Auto-Organization Creation Trigger
--
-- Purpose: Automatically create an organization for new users during signup
-- This ensures org_id is always available for multi-tenant isolation
--
-- Trigger Flow:
-- 1. New user signs up in auth.users
-- 2. Trigger fires automatically
-- 3. Creates new organization in profiles table
-- 4. Sets org_id in user's app_metadata so JWT includes it immediately
--
-- Result: New users never experience "missing org_id" errors

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function that handles new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id uuid;
  user_email text;
BEGIN
  -- Extract email from new user
  user_email := NEW.email;

  -- Generate new organization ID
  new_org_id := gen_random_uuid();

  -- Create organization in profiles table (profiles serves as orgs table)
  -- Organization type identified by is_organization = true
  INSERT INTO public.profiles (
    id,
    email,
    is_organization,
    created_at,
    updated_at,
    name
  ) VALUES (
    new_org_id,
    user_email,
    true,
    NOW(),
    NOW(),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Organization for ' || user_email)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Update user's app_metadata with org_id (immutable admin metadata)
  -- This ensures the JWT includes org_id immediately on first login
  UPDATE auth.users
  SET app_metadata = jsonb_set(
    COALESCE(app_metadata, '{}'::jsonb),
    '{org_id}',
    to_jsonb(new_org_id::text)
  )
  WHERE id = NEW.id;

  -- Log the organization creation for audit trail
  INSERT INTO public.audit_log (
    org_id,
    action,
    resource_type,
    details,
    created_by,
    created_at
  ) VALUES (
    new_org_id,
    'organization_created',
    'organization',
    jsonb_build_object(
      'method', 'auto_signup_trigger',
      'user_email', user_email,
      'user_id', NEW.id
    ),
    NEW.id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail signup
  -- User can manually create org later via dashboard
  RAISE WARNING 'Failed to auto-create organization for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users after insert
-- Fires for every new user that signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- Grant necessary permissions for trigger function
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO service_role;

-- Add comment explaining this trigger
COMMENT ON FUNCTION public.handle_new_user_signup() IS 'Automatically creates an organization for new users during signup. Ensures org_id is always available in JWT, eliminating multi-tenant context errors.';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Triggers on every new user signup to auto-create their organization.';
