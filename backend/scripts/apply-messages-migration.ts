#!/usr/bin/env ts-node
/**
 * Apply Messages Table Migration
 * Uses Supabase Management API or direct connection
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
    process.exit(1);
}

async function main() {
    console.log('🚀 Messages Table Migration Script\n');
    console.log('='.repeat(60) + '\n');

    const migrationPath = path.join(__dirname, '..', 'migrations', '20260125_create_messages_table.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Migration file not found:', migrationPath);
        process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration file: 20260125_create_messages_table.sql');
    console.log('📍 Location: backend/migrations/\n');

    console.log('='.repeat(60));
    console.log('\n📋 MIGRATION INSTRUCTIONS\n');
    console.log('Since direct SQL execution requires DATABASE_URL, please apply');
    console.log('the migration using one of these methods:\n');

    console.log('METHOD 1: Supabase Dashboard (Recommended)');
    console.log('-'.repeat(60));
    console.log('1. Open: https://supabase.com/dashboard/project/<your-project>');
    console.log('2. Go to: SQL Editor');
    console.log('3. Click: New Query');
    console.log('4. Copy the SQL from:');
    console.log(`   ${migrationPath}`);
    console.log('5. Paste and click "Run"\n');

    console.log('METHOD 2: Supabase CLI with Link');
    console.log('-'.repeat(60));
    console.log('1. Link your project:');
    console.log('   supabase link --project-ref <your-project-ref>');
    console.log('2. Push migrations:');
    console.log('   cd backend/supabase && supabase db push\n');

    console.log('METHOD 3: psql (if you have connection string)');
    console.log('-'.repeat(60));
    console.log('1. Get your connection string from Supabase Dashboard');
    console.log('2. Run:');
    console.log(`   psql "<connection-string>" -f ${migrationPath}\n`);

    console.log('='.repeat(60));
    console.log('\n📄 MIGRATION SQL PREVIEW:\n');
    console.log(migrationSQL.split('\n').slice(0, 20).join('\n'));
    console.log('\n... (see full file for complete SQL)\n');

    console.log('='.repeat(60));
    console.log('\n✅ AFTER APPLYING MIGRATION:\n');
    console.log('Run the test suite to verify:');
    console.log('   npx ts-node scripts/test-dashboard-api-fixes.ts\n');
    console.log('Then commit your changes:');
    console.log('   git add backend/src/routes/');
    console.log('   git add backend/migrations/20260125_create_messages_table.sql');
    console.log('   git commit -m "feat: fix API field mismatches and add action endpoints"\n');
    console.log('Finally, rebuild and test:');
    console.log('   npm run build');
    console.log('   # Test endpoints manually\n');
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('\n💥 Script failed:', err);
        process.exit(1);
    });
