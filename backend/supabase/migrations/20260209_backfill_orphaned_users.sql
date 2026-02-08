-- Migration: Backfill Orphaned Users (Fix for Broken Auto-Organization)
-- Date: 2026-02-09
-- Purpose: Find all users in auth.users who have NO profile and create:
--   1. Organization for them
--   2. Profile linked to that organization
--   3. Update JWT app_metadata with org_id

-- This migration fixes existing orphaned users created when the trigger was broken

DO $$
DECLARE
  orphan_record RECORD;
  new_org_id UUID;
  orphan_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting orphaned user backfill...';

  -- Find all orphaned users (users without profiles)
  FOR orphan_record IN
    SELECT au.id, au.email, au.created_at
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
    ORDER BY au.created_at ASC
  LOOP
    orphan_count := orphan_count + 1;

    RAISE NOTICE 'Processing orphaned user: % (ID: %)', orphan_record.email, orphan_record.id;

    -- 1. CREATE ORGANIZATION FOR THIS USER
    INSERT INTO public.organizations (name, email, status, created_at, updated_at)
    VALUES (
      orphan_record.email || ' Organization',
      orphan_record.email,
      'active',
      NOW(),
      NOW()
    )
    RETURNING id INTO new_org_id;

    RAISE NOTICE '  ✓ Created organization: %', new_org_id;

    -- 2. CREATE PROFILE LINKED TO ORG (using org_id column)
    INSERT INTO public.profiles (id, email, org_id, role, created_at, updated_at)
    VALUES (
      orphan_record.id,
      orphan_record.email,
      new_org_id,
      'owner',
      NOW(),
      NOW()
    );

    RAISE NOTICE '  ✓ Created profile for user: %', orphan_record.email;

    -- 3. UPDATE AUTH METADATA WITH ORG_ID (so JWT contains org_id)
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
        jsonb_build_object('org_id', new_org_id::text)
    WHERE id = orphan_record.id;

    RAISE NOTICE '  ✓ Updated JWT metadata with org_id';
    RAISE NOTICE '  ✅ Fixed orphaned user: % (org: %)', orphan_record.email, new_org_id;
    RAISE NOTICE '';

  END LOOP;

  IF orphan_count = 0 THEN
    RAISE NOTICE '✅ No orphaned users found. Database is clean.';
  ELSE
    RAISE NOTICE '✅ Backfill complete! Fixed % orphaned user(s).', orphan_count;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Backfill failed: %', SQLERRM;
END $$;
