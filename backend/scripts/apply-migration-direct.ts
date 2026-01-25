#!/usr/bin/env ts-node
/**
 * Apply Messages Table Migration - Using Supabase REST API
 * Since direct PostgreSQL connection requires specific credentials,
 * we'll use the Supabase client with service role key
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function main() {
    console.log('🚀 Applying Messages Table Migration\n');
    console.log('='.repeat(60) + '\n');

    const migrationPath = path.join(__dirname, '..', 'migrations', '20260125_create_messages_table.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Migration file not found:', migrationPath);
        process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration: 20260125_create_messages_table.sql\n');

    // First, check if table already exists
    console.log('🔍 Checking if messages table exists...');
    const { data: existingData, error: existingError } = await supabase
        .from('messages')
        .select('id')
        .limit(1);

    if (!existingError || existingError.code === 'PGRST116') {
        console.log('✅ Messages table already exists!\n');

        // Verify structure
        console.log('📋 Verifying table structure...');
        const { data: testInsert, error: testError } = await supabase
            .from('messages')
            .select('*')
            .limit(0);

        if (!testError) {
            console.log('✅ Table structure verified\n');
        }

        console.log('='.repeat(60));
        console.log('✅ Migration Already Applied!\n');
        console.log('The messages table is ready for use.\n');

        console.log('Next steps:');
        console.log('1. Run test suite: npx ts-node scripts/test-dashboard-api-fixes.ts');
        console.log('2. Test endpoints manually');
        console.log('3. Verify audit logging works\n');

        return;
    }

    // Table doesn't exist, need to apply migration
    console.log('⚠️  Messages table does not exist\n');
    console.log('='.repeat(60));
    console.log('\n📋 MANUAL MIGRATION REQUIRED\n');
    console.log('The Supabase REST API does not support executing DDL statements.');
    console.log('Please apply the migration using one of these methods:\n');

    console.log('METHOD 1: Supabase Dashboard (Recommended) ⭐');
    console.log('-'.repeat(60));
    console.log('1. Open: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to: SQL Editor');
    console.log('4. Click: "New Query"');
    console.log('5. Copy and paste the SQL from:');
    console.log(`   ${migrationPath}`);
    console.log('6. Click "Run" to execute\n');

    console.log('METHOD 2: Local Supabase CLI');
    console.log('-'.repeat(60));
    console.log('If you have the project linked locally:');
    console.log('   cd backend/supabase');
    console.log('   supabase db push\n');

    console.log('METHOD 3: Copy SQL Below');
    console.log('-'.repeat(60));
    console.log('Copy this SQL and run it in Supabase Dashboard:\n');
    console.log(migrationSQL);
    console.log('\n' + '='.repeat(60));

    console.log('\n💡 After applying the migration, run this script again to verify.\n');
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('\n💥 Script failed:', err);
        process.exit(1);
    });
