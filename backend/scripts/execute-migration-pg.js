#!/usr/bin/env node
/**
 * Execute SQL migration using pg client directly
 */

const { Client } = require('pg');
const fs = require('fs');

// Use service role key as password
const connectionString = 'postgresql://postgres:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxianltbG9keHByenFndHlxdGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM0OTUzMSwiZXhwIjoyMDc4OTI1NTMxfQ.5B2bBOUgXw2qC6QpIkU2DNZiqMW20y8MzgLQ56LEtFA@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';


async function executeMigration() {
    const client = new Client({ connectionString });

    try {
        console.log('=== CONNECTING TO SUPABASE ===\n');
        await client.connect();
        console.log('✅ Connected\n');

        console.log('=== EXECUTING MIGRATION ===\n');
        const sql = fs.readFileSync('migrations/20251218_create_inbound_agent_config.sql', 'utf8');

        // Execute the entire SQL file as one transaction
        await client.query(sql);

        console.log('✅ Migration executed successfully!\n');

        // Verify table was created
        console.log('=== VERIFICATION ===\n');
        const result = await client.query(`
      SELECT COUNT(*) as count 
      FROM inbound_agent_config
    `);

        console.log(`✅ Table created successfully!`);
        console.log(`✅ Found ${result.rows[0].count} config rows\n`);

        // Show sample data if any
        if (parseInt(result.rows[0].count) > 0) {
            const sample = await client.query(`
        SELECT org_id, vapi_assistant_id, twilio_phone_number, is_active
        FROM inbound_agent_config
        LIMIT 1
      `);

            console.log('Sample data:');
            console.log('  - org_id:', sample.rows[0].org_id);
            console.log('  - vapi_assistant_id:', sample.rows[0].vapi_assistant_id?.slice(0, 20) + '...');
            console.log('  - twilio_phone_number:', sample.rows[0].twilio_phone_number || 'NULL');
            console.log('  - is_active:', sample.rows[0].is_active);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('\nError details:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

executeMigration();
