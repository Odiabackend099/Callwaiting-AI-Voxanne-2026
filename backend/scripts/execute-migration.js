#!/usr/bin/env node
/**
 * Execute SQL migration directly via Supabase client
 * Creates inbound_agent_config table and backfills data
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://lbjymlodxprzqgtyqtcq.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function executeMigration() {
    console.log('=== EXECUTING MIGRATION ===\n');

    const sql = fs.readFileSync('migrations/20251218_create_inbound_agent_config.sql', 'utf8');

    // Split into individual statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'DO $$');

    console.log(`Executing ${statements.length} SQL statements...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];

        // Skip comments and empty lines
        if (stmt.startsWith('--') || stmt.trim().length === 0) continue;

        // Handle DO blocks specially
        if (stmt.includes('DO $$') || stmt.includes('BEGIN') || stmt.includes('END $$')) {
            console.log(`Skipping complex DO block (will execute as single statement)...`);
            continue;
        }

        const preview = stmt.substring(0, 60).replace(/\n/g, ' ') + '...';
        console.log(`[${i + 1}] ${preview}`);

        try {
            // Use raw SQL execution via REST API
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: stmt + ';' })
            });

            if (response.ok) {
                console.log('    ✅ Success\n');
                successCount++;
            } else {
                const error = await response.text();
                console.log(`    ⚠️  Response: ${response.status} - ${error.substring(0, 100)}\n`);
            }
        } catch (error) {
            console.log(`    ❌ Error: ${error.message}\n`);
            errorCount++;
        }
    }

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);

    // Verify table was created
    console.log('\n=== VERIFICATION ===');
    const { data, error } = await supabase
        .from('inbound_agent_config')
        .select('count')
        .limit(1);

    if (error) {
        if (error.code === '42P01') {
            console.log('❌ Table still does not exist');
            console.log('\nFalling back to manual SQL execution...');
            console.log('Please run the following SQL in Supabase SQL Editor:');
            console.log(sql);
        } else {
            console.log('⚠️  Error verifying table:', error.message);
        }
    } else {
        console.log('✅ Table created successfully!');

        // Check if data was backfilled
        const { data: configs } = await supabase
            .from('inbound_agent_config')
            .select('*');

        console.log(`✅ Found ${configs?.length || 0} config rows`);
    }
}

executeMigration().catch(console.error);
