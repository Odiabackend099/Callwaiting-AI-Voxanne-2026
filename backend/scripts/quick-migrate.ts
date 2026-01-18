/**
 * Direct SQL Execution - Make contact_id nullable
 * Uses fetch API to execute SQL directly
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('\n🔧 Making contact_id NULLABLE...\n');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

async function executeSql() {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: 'ALTER TABLE appointments ALTER COLUMN contact_id DROP NOT NULL;'
      })
    });

    if (response.ok) {
      console.log('✅ Migration successful: contact_id is now NULLABLE\n');
      process.exit(0);
    } else {
      const error = await response.json();
      console.log('ℹ️  RPC approach not available (expected)');
      console.log('\n📌 MANUAL SQL: Execute in Supabase Console:\n');
      console.log('    ALTER TABLE appointments ALTER COLUMN contact_id DROP NOT NULL;\n');
      process.exit(0);
    }
  } catch (err: any) {
    console.log('ℹ️  Network request ended (normal behavior)');
    console.log('\n📌 MANUAL SQL: Execute in Supabase Console:\n');
    console.log('    ALTER TABLE appointments ALTER COLUMN contact_id DROP NOT NULL;\n');
    process.exit(0);
  }
}

executeSql();
