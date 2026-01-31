#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://postgres:Eguale%402021%3F@db.lbjymlodxprzqgtyqtcq.supabase.co:5432/postgres';

async function applyFix() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n🔧 APPLYING SCHEMA FIX\n');
    await client.connect();
    console.log('✅ Connected to database\n');

    // Read migration file
    const migrationSQL = fs.readFileSync('/Users/mac/Desktop/Callwaiting-AI-Voxanne-2026/backend/supabase/migrations/20260131_fix_unified_calls_schema.sql', 'utf-8');

    // Execute migration
    console.log('1️⃣ Executing schema fix migration...\n');
    await client.query(migrationSQL);

    // Verify fix
    console.log('\n2️⃣ Verifying fix...\n');
    const result = await client.query(`
      SELECT 
        id,
        call_direction,
        phone_number,
        caller_name,
        sentiment_label,
        sentiment_score,
        created_at
      FROM calls
      LIMIT 3
    `);

    console.log('✅ Sample calls after fix:\n');
    result.rows.forEach((row, i) => {
      console.log(`   Call ${i + 1}:`);
      console.log(`     - Direction: ${row.call_direction}`);
      console.log(`     - Phone: ${row.phone_number || 'NULL'}`);
      console.log(`     - Caller: ${row.caller_name || 'NULL'}`);
      console.log(`     - Sentiment Label: ${row.sentiment_label || 'NULL'}`);
      console.log(`     - Sentiment Score: ${row.sentiment_score || 'NULL'}\n`);
    });

    // Check columns exist
    const colResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'calls'
      ORDER BY ordinal_position
    `);

    console.log('   All columns in calls table:');
    colResult.rows.forEach(col => {
      console.log(`     - ${col.column_name} (${col.data_type})`);
    });

    console.log('\n✅ SCHEMA FIX COMPLETE\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

applyFix();
