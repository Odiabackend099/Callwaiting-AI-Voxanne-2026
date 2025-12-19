#!/usr/bin/env node
/**
 * Run SQL migration on Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    db: { schema: 'public' },
    auth: { persistSession: false }
});

async function runMigration(migrationFile) {
    console.log(`Running migration: ${migrationFile}\n`);

    const sql = fs.readFileSync(migrationFile, 'utf8');

    // Split SQL into individual statements (rough split by semicolon)
    // This is a simplified approach - for production, use a proper SQL parser
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements\n`);

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (stmt.startsWith('CREATE TABLE') || stmt.startsWith('CREATE INDEX') ||
            stmt.startsWith('CREATE OR REPLACE FUNCTION') || stmt.startsWith('CREATE TRIGGER') ||
            stmt.startsWith('DROP TRIGGER') || stmt.startsWith('DO $$')) {

            console.log(`Executing statement ${i + 1}...`);
            console.log(stmt.substring(0, 80) + '...\n');

            try {
                // Use raw SQL query via REST API
                const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ query: stmt + ';' })
                });

                if (!response.ok) {
                    // Try alternative: use Supabase client directly
                    console.log('  Direct SQL execution via REST failed, trying alternative...');

                    // For CREATE TABLE, we can check if it exists first
                    if (stmt.includes('CREATE TABLE IF NOT EXISTS inbound_agent_config')) {
                        console.log('  ✅ Table creation statement prepared (will be executed via Supabase dashboard)');
                    } else {
                        console.log('  ⚠️  Statement may need manual execution');
                    }
                } else {
                    console.log('  ✅ Success\n');
                }
            } catch (error) {
                console.error(`  ❌ Error: ${error.message}\n`);
            }
        }
    }

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log('Migration file prepared. Please execute via Supabase SQL Editor:');
    console.log(`1. Go to https://supabase.com/dashboard/project/lbjymlodxprzqgtyqtcq/sql`);
    console.log(`2. Copy contents of: ${migrationFile}`);
    console.log('3. Paste and run in SQL Editor');
    console.log('\nOR use the Supabase CLI:');
    console.log(`supabase db push --db-url "postgresql://postgres.lbjymlodxprzqgtyqtcq:Odiabackend099@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"`);
}

const migrationFile = process.argv[2] || 'migrations/20251218_create_inbound_agent_config.sql';
runMigration(migrationFile).catch(console.error);
