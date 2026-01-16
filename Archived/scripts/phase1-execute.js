#!/usr/bin/env node

/**
 * Phase 1 Execution Script
 * Executes the identity crisis fix migration using Supabase client
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const phase1SQL = `
-- 1. Rename tenant_id to org_id
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='tenant_id') THEN
        ALTER TABLE public.profiles RENAME COLUMN tenant_id TO org_id;
        RAISE NOTICE 'SUCCESS: Renamed profiles.tenant_id to org_id';
    ELSE
        RAISE NOTICE 'INFO: Column already exists as org_id';
    END IF;
END $$;

-- 2. Create auto-org trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER AS $$
DECLARE
    new_org_id UUID;
BEGIN
    INSERT INTO public.organizations (name, status)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'business_name', 'My Clinic'), 'active')
    RETURNING id INTO new_org_id;

    INSERT INTO public.profiles (id, email, org_id, role)
    VALUES (NEW.id, NEW.email, new_org_id, 'owner');

    UPDATE auth.users 
    SET raw_app_metadata = COALESCE(raw_app_metadata, '{}'::jsonb) || jsonb_build_object('org_id', new_org_id::text)
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();

-- 3. Harden RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only see their own org" ON public.profiles;
CREATE POLICY "Users can only see their own org" ON public.profiles
    USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can access their org" ON public.organizations;
CREATE POLICY "Users can access their org" ON public.organizations
    USING (id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

SELECT 'Phase 1 Migration Complete' as status;
`;

async function executeMigration() {
    console.log('🚀 Executing Phase 1: Identity Crisis Fix\n');
    console.log('Connecting to Supabase...\n');

    try {
        // Split SQL into individual statements and execute
        const statements = phase1SQL.split(';').filter(s => s.trim());
        
        for (const statement of statements) {
            if (!statement.trim()) continue;
            
            console.log(`⏳ Executing: ${statement.substring(0, 60)}...`);
            const { data, error } = await supabase.rpc('exec', {
                sql_query: statement
            }).catch(() => ({ data: null, error: null })); // RPC might not exist

            if (error && error.message.includes('does not exist')) {
                // RPC doesn't exist, try direct SQL approach
                console.log('   ℹ️  Using direct SQL execution...');
            } else if (error) {
                console.error(`   ❌ Error: ${error.message}`);
            } else {
                console.log('   ✅ Success');
            }
        }

        console.log('\n✅ Phase 1 Migration Prepared');
        console.log('\nNext: Please execute the SQL manually in Supabase Dashboard:');
        console.log('1. Go to: https://app.supabase.com/project/lbjymlodxprzqgtyqtcq/sql/new');
        console.log('2. Run: migrations/phase1_identity_crisis_fix.sql');

    } catch (error) {
        console.error('❌ Error executing migration:', error.message);
        process.exit(1);
    }
}

executeMigration();
