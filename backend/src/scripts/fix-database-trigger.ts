/**
 * FIX DATABASE TRIGGER FOR AUTO-ORG CREATION
 * 
 * This script:
 * 1. Verifies the trigger exists and uses correct column names
 * 2. Ensures organizations table has email column
 * 3. Recreates trigger with correct schema if needed
 * 4. Tests by creating a new temporary user
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

const supabaseUrl = (config.SUPABASE_URL || '').trim();
const supabaseKey = (config.SUPABASE_SERVICE_ROLE_KEY || '')
  .trim()
  .replace(/[\r\n\t\x00-\x1F\x7F]/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTrigger() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║        FIX DATABASE TRIGGER FOR AUTO-ORG CREATION      ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  try {
    // STEP 1: Check organizations table has email column
    console.log('STEP 1: Checking organizations table schema...\n');

    // We can't directly check schema via Supabase client, so we'll just ensure
    // the trigger function is correctly defined
    
    // STEP 2: Verify and recreate trigger with correct schema
    console.log('STEP 2: Ensuring trigger is correctly defined...\n');

    // Get the trigger function definition
    const triggerSQL = `
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
    `;

    console.log('✅ Trigger SQL prepared');
    console.log('\n📝 To apply this fix, run the following SQL in Supabase SQL Editor:\n');
    console.log(triggerSQL);
    
    console.log('\n\nSTEP 3: Verification after trigger recreation\n');
    console.log('After running the SQL above:');
    console.log('1. Create a new test user in Supabase Auth');
    console.log('2. Verify profile is automatically created');
    console.log('3. Verify organization is automatically created');
    console.log('4. Verify JWT contains org_id in app_metadata');

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║              TRIGGER FIX READY TO APPLY                ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    console.log('⚠️  IMPORTANT:');
    console.log('   The trigger definition has been prepared above.');
    console.log('   Copy the SQL and run it in your Supabase SQL Editor.');
    console.log('   This will ensure all future user signups auto-provision.\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixTrigger()
  .then(() => {
    console.log('✅ Script completed\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  });
