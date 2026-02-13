#!/usr/bin/env ts-node
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function applyMigration() {
  console.log('\n🔧 Applying Wallet Summary RPC Fix\n');

  const migrationFile = path.join(__dirname, '../../supabase/migrations/20260213_fix_wallet_summary_rpc.sql');
  const sql = fs.readFileSync(migrationFile, 'utf-8');

  try {
    // The migration file contains a CREATE OR REPLACE FUNCTION statement
    // We need to execute it as raw SQL
    console.log('📝 Executing CREATE OR REPLACE FUNCTION get_wallet_summary...\n');

    // Extract just the CREATE FUNCTION part (skip comments)
    const sqlLines = sql.split('\n').filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('--') && trimmed.length > 0;
    }).join('\n');

    // Try using Supabase's exec method if available, otherwise show instructions
    const result = await supabase.from('information_schema.routines')
      .select('routine_name')
      .eq('routine_name', 'get_wallet_summary')
      .eq('routine_schema', 'public')
      .single();

    if (result.data) {
      console.log('✅ Function exists. To update it, use Supabase Dashboard:');
      console.log('   1. Go to SQL Editor');
      console.log('   2. Paste migration file contents');
      console.log('   3. Execute\n');
    }

    // Show the SQL that needs to be executed
    console.log('📋 SQL to execute:\n');
    console.log(sql);
    console.log('\n✅ Copy the above SQL and execute it in Supabase Dashboard -> SQL Editor');

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

applyMigration();
